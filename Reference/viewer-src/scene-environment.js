import {createLocalConditions,observationTimeLeft} from './local-conditions.js';

const observedTime=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
function clockLabel(hour){
  const minutes=Math.round(hour*60),h=Math.floor(minutes/60)%24;
  return (h%12||12)+':'+String(minutes%60).padStart(2,'0')+(h>=12?' PM':' AM');
}

// Manual settings are saved separately, so leaving either live mode restores the visitor's scene.
export function installSceneEnvironment({setConditions,share}){
  const get=id=>document.getElementById(id);
  const hour=get('scene-hour'),clock=get('scene-clock'),weather=get('scene-weather');
  const timeSwitch=get('local-time'),weatherSwitch=get('local-weather');
  const note=get('local-weather-note'),status=get('local-weather-status'),retry=get('local-weather-retry');
  let manualHour=Number(hour.value),manualWeather=weather.value,liveClock=null;
  let effectiveWeather=manualWeather,remoteWeather=false,report=null,remoteExpiry;
  function settings(){
    const live=timeSwitch.checked && liveClock;
    return {hour:live?live.hour:manualHour,weather:effectiveWeather,sunDirection:live?live.sunDirection:null};
  }
  function show(){
    const value=settings(),live=timeSwitch.checked && liveClock;
    hour.disabled=timeSwitch.checked;
    hour.max=timeSwitch.checked?'24':'23.75';hour.step=timeSwitch.checked?'any':'.25';
    hour.value=String(value.hour);
    clock.value=live?live.label:clockLabel(value.hour);
    hour.setAttribute('aria-valuetext',clock.value);
    weather.disabled=weatherSwitch.checked;weather.value=effectiveWeather;
    note.hidden=!weatherSwitch.checked;
    retry.hidden=remoteWeather || !weatherSwitch.checked || !['stale','unavailable'].includes(report?.status);
    if(!weatherSwitch.checked){status.textContent='';return;}
    const date=report?.observedAt?Date.parse(report.observedAt):NaN;
    const when=Number.isFinite(date)?observedTime.format(date):'';
    const shown=weather.selectedOptions[0]?.textContent||effectiveWeather;
    let message;
    if(report?.status==='ready')message=[report.label,when].filter(Boolean).join(' · ')+'.';
    else if(report?.status==='stale')message='Last report'+(when?' · '+when:'')+'. Showing '+shown+'.';
    else if(report?.status==='unavailable')message='Weather unavailable. Showing '+shown+'.';
    else message=remoteWeather?'Waiting for the group’s weather report.':'Checking the local weather…';
    if(status.textContent!==message)status.textContent=message;
  }
  const source=createLocalConditions({
    onTime(value){if(timeSwitch.checked){liveClock=value;show();setConditions(settings());}},
    onWeather(value){
      if(!weatherSwitch.checked||remoteWeather)return;
      const previous=effectiveWeather;report=value;
      if(value.status==='ready')effectiveWeather=value.weather;
      show();if(effectiveWeather!==previous)setConditions(settings());share();
    }
  });
  function syncSources(){
    clearTimeout(remoteExpiry);
    if(remoteWeather && weatherSwitch.checked && report?.status==='ready'){
      const remaining=observationTimeLeft(report.observedAt);
      const expire=()=>{report={...report,status:'stale'};show();};
      if(remaining)remoteExpiry=setTimeout(expire,remaining);
      else expire();
    }
    source.setTimeEnabled(timeSwitch.checked);
    source.setWeatherEnabled(weatherSwitch.checked && !remoteWeather);
  }
  function change(){
    if(!timeSwitch.checked)liveClock=null;
    if(!weatherSwitch.checked){effectiveWeather=manualWeather;report=null;}
    syncSources();show();setConditions(settings());share();
  }
  timeSwitch.addEventListener('change',change);
  weatherSwitch.addEventListener('change',change);
  hour.addEventListener('input',()=>{if(!timeSwitch.checked){manualHour=Number(hour.value);change();}});
  weather.addEventListener('change',()=>{if(!weatherSwitch.checked){manualWeather=weather.value;change();}});
  retry.addEventListener('click',()=>source.refreshWeather());
  return {
    settings,
    snapshot(){
      const {hour,weather}=settings();
      const weatherReport=report?{status:report.status,label:report.label||'',observedAt:report.observedAt||null}:null;
      return {hour,weather,localTime:timeSwitch.checked,localWeather:weatherSwitch.checked,manualHour,manualWeather,weatherReport};
    },
    apply(s,guest){
      // The host requests the airport report once for the group. Each browser keeps its own Eastern clock.
      remoteWeather=guest;
      timeSwitch.checked=Boolean(s.localTime);weatherSwitch.checked=Boolean(s.localWeather);
      manualHour=s.manualHour??s.hour;manualWeather=s.manualWeather??s.weather;
      if(!timeSwitch.checked)liveClock=null;
      if(!weatherSwitch.checked){effectiveWeather=manualWeather;report=null;}
      else if(guest){effectiveWeather=s.weather;report=s.weatherReport??null;}
      syncSources();show();setConditions(settings());
    },
    solo(){
      if(!remoteWeather)return;
      remoteWeather=false;syncSources();show();
    },
    stargaze(){
      const h=settings().hour;
      timeSwitch.checked=weatherSwitch.checked=false;
      manualHour=h>=5 && h<20?22:Math.min(23.75,Math.round(h*4)/4);
      manualWeather='clear';change();
    }
  };
}
