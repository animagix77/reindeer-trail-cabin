// Smallwood parcel center, from Reference/terrain-provenance.json.
const latitude=41.663539*Math.PI/180, longitude=-74.803745;
const eastern={timeZone:'America/New_York'};
const clockParts=new Intl.DateTimeFormat('en-US',{...eastern,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const clockLabel=new Intl.DateTimeFormat('en-US',{...eastern,hour:'numeric',minute:'2-digit',timeZoneName:'short'});
const dayLabel=new Intl.DateTimeFormat('en-US',{...eastern,month:'short',day:'numeric',year:'numeric'});
const minute=60000, refreshInterval=15*minute, maxAge=120*minute;
// Also governs a report relayed by a group host which later sleeps or goes offline.
export function observationTimeLeft(observedAt,now=Date.now()){
  const observed=Date.parse(observedAt);
  if(!Number.isFinite(observed) || observed>now+5*minute)return 0;
  return Math.max(0,observed+maxAge-now);
}

// The first station returned for the cabin's NWS grid BGM/107,43 is KMSV,
// Monticello, Sullivan County International Airport.
const stationURL='https://api.weather.gov/stations/KMSV/observations/latest';

export function smallwoodTime(date=new Date()){
  const parts=Object.fromEntries(clockParts.formatToParts(date).map(({type,value})=>[type,value]));
  const hour=Number(parts.hour)+Number(parts.minute)/60;
  // NOAA GML: https://gml.noaa.gov/grad/solcalc/solareqns.PDF
  // Compute in UTC so the sun moves continuously across civil clock changes.
  const year=date.getUTCFullYear(),yearStart=Date.UTC(year,0,1),yearEnd=Date.UTC(year+1,0,1);
  const phase=2*Math.PI*(date.getTime()-yearStart-12*60*minute)/(yearEnd-yearStart);
  const equation=229.18*(.000075+.001868*Math.cos(phase)-.032077*Math.sin(phase)
    -.014615*Math.cos(2*phase)-.040849*Math.sin(2*phase));
  const declination=.006918-.399912*Math.cos(phase)+.070257*Math.sin(phase)
    -.006758*Math.cos(2*phase)+.000907*Math.sin(2*phase)-.002697*Math.cos(3*phase)+.00148*Math.sin(3*phase);
  const utcMinutes=date.getUTCHours()*60+date.getUTCMinutes()+date.getUTCSeconds()/60;
  const angle=((utcMinutes+equation+4*longitude)/4-180)*Math.PI/180;
  const meridian=Math.cos(declination)*Math.cos(angle);
  const east=-Math.cos(declination)*Math.sin(angle);
  const up=Math.sin(latitude)*Math.sin(declination)+Math.cos(latitude)*meridian;
  const south=Math.sin(latitude)*meridian-Math.cos(latitude)*Math.sin(declination);
  return {hour,label:clockLabel.format(date),dateLabel:dayLabel.format(date),sunDirection:[east,up,south]};
}

function sceneWeather(report){
  const phenomena=report.presentWeather||[];
  const local=phenomena.filter(p=>!p.inVicinity).map(p=>p.weather);
  // A nearby shower can appear in the published description even when the
  // instruments at the station report dry, clear skies.
  const description=phenomena.some(p=>p.inVicinity)?'':report.textDescription||'';
  if(local.some(w=>['snow','snow_grains','snow_pellets','ice_crystals','ice_pellets'].includes(w)))return 'snow';
  if(local.some(w=>['rain','drizzle','hail','thunderstorms'].includes(w)))return 'rain';
  if(local.some(w=>['fog','fog_mist','haze','smoke'].includes(w)))return 'cloudy';
  if(/snow|sleet|ice pellets|ice crystals|blizzard|flurr/i.test(description))return 'snow';
  if(/rain|drizzle|shower|thunder|hail/i.test(description))return 'rain';
  if(/overcast|cloudy|fog|mist|haze|smoke/i.test(description))return 'cloudy';
  if(/fair|clear|sunny|few clouds/i.test(description))return 'clear';
  const layers=(report.cloudLayers||[]).map(layer=>layer.amount);
  if(layers.some(layer=>['BKN','OVC','VV','SCT'].includes(layer)))return 'cloudy';
  if(layers.some(layer=>['FEW','CLR','SKC','NSC'].includes(layer)))return 'clear';
  return null;
}

export function readStationReport(data,now=Date.now()){
  const p=data?.properties,observed=Date.parse(p?.timestamp);
  if(!p || !Number.isFinite(observed) || observed>now+5*minute)throw Error('Invalid station observation time.');
  const weather=sceneWeather(p);
  if(!weather)throw Error('The station has no usable sky observation.');
  const label=p.textDescription?.trim()||({clear:'Clear skies',cloudy:'Cloud cover',rain:'Rain',snow:'Snow'})[weather];
  const observedAt=new Date(observed).toISOString();
  const fresh=observationTimeLeft(observedAt,now)>0;
  return {status:fresh?'ready':'stale',weather:fresh?weather:null,label,observedAt};
}

export function createLocalConditions({onTime,onWeather}){
  let clockOn=false,weatherOn=false,timeTimer,weatherTimer,request=null;
  let lastReport=null,lastCheck=0;
  function tick(){
    clearTimeout(timeTimer);
    if(!clockOn || document.hidden)return;
    const date=new Date();
    onTime(smallwoodTime(date));
    timeTimer=setTimeout(tick,minute-date.getTime()%minute);
  }
  async function refreshWeather(){
    // A background tab may still be supplying weather to guests in the cabin.
    if(!weatherOn || request)return;
    clearTimeout(weatherTimer);
    const controller=new AbortController();
    request=controller;
    const timeout=setTimeout(()=>controller.abort(),11000);
    let result;
    try{
      const response=await fetch(stationURL,{signal:controller.signal,credentials:'omit',headers:{Accept:'application/geo+json'}});
      if(!response.ok)throw Error('Station request failed.');
      const report=readStationReport(await response.json());
      if(request!==controller)return;
      lastReport=report;
      result=report;
    }catch{
      if(request!==controller)return;
      result={status:lastReport?'stale':'unavailable',weather:null,label:lastReport?.label||'',observedAt:lastReport?.observedAt||null};
    }finally{clearTimeout(timeout);}
    request=null;
    lastCheck=Date.now();
    const age=lastReport?lastCheck-Date.parse(lastReport.observedAt):Infinity;
    const delay=result.status==='ready'?Math.min(refreshInterval,Math.max(1000,maxAge-age)):5*minute;
    weatherTimer=setTimeout(refreshWeather,delay);
    onWeather(result);
  }
  function setTimeEnabled(on){
    if(on===clockOn)return;
    clockOn=on;tick();
  }
  function setWeatherEnabled(on){
    if(on===weatherOn)return;
    weatherOn=on;
    clearTimeout(weatherTimer);
    if(on){
      onWeather({status:'loading',weather:null,label:'',observedAt:null});
      void refreshWeather();
    }else{
      request?.abort();request=null;
    }
  }
  function resume(){
    tick();
    if(!weatherOn || document.hidden || request)return;
    clearTimeout(weatherTimer);
    // A tab can sleep past an observation's expiry or its scheduled refresh.
    if(!lastReport || Date.now()-lastCheck>=refreshInterval || Date.now()-Date.parse(lastReport.observedAt)>=maxAge){
      void refreshWeather();
    }else{
      const deadline=Math.min(lastCheck+refreshInterval,Date.parse(lastReport.observedAt)+maxAge);
      weatherTimer=setTimeout(refreshWeather,Math.max(0,deadline-Date.now()));
    }
  }
  document.addEventListener('visibilitychange',resume);
  window.addEventListener('online',refreshWeather);
  return {setTimeEnabled,setWeatherEnabled,refreshWeather,
    dispose(){
      setTimeEnabled(false);setWeatherEnabled(false);
      document.removeEventListener('visibilitychange',resume);
      window.removeEventListener('online',refreshWeather);
    }
  };
}
