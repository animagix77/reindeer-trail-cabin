import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene} from 'three';
import {smallwoodTime,readStationReport,createLocalConditions} from './local-conditions.js';
import {atmosphere} from './tour-sky.js';
import {installSceneEnvironment} from './scene-environment.js';
import {installNightSky} from './night-sky.js';

test('Smallwood clock follows Eastern DST and the sun follows the local season',()=>{
  const spring=['2026-03-08T06:59:00Z','2026-03-08T07:00:00Z'].map(d=>smallwoodTime(new Date(d)));
  assert.equal(spring[0].hour,1+59/60);
  assert.equal(spring[1].hour,3);
  assert.match(spring[0].label,/EST$/);assert.match(spring[1].label,/EDT$/);
  assert(Math.hypot(...spring[1].sunDirection.map((v,i)=>v-spring[0].sunDirection[i]))<.006);
  const fall=['2026-11-01T05:30:00Z','2026-11-01T06:30:00Z'].map(d=>smallwoodTime(new Date(d)));
  assert.equal(fall[0].hour,1.5);assert.equal(fall[1].hour,1.5);
  assert.notEqual(fall[0].label,fall[1].label);
  assert.equal(smallwoodTime(new Date('2026-01-01T04:59:00Z')).hour,23+59/60);
  assert.equal(smallwoodTime(new Date('2026-01-01T05:00:00Z')).hour,0);
  const winter=smallwoodTime(new Date('2026-12-21T22:30:00Z')),summer=smallwoodTime(new Date('2026-06-21T21:30:00Z'));
  assert.equal(winter.hour,17.5);assert.equal(summer.hour,17.5);
  assert(winter.sunDirection[1]<-.15 && summer.sunDirection[1]>.45);
  for(const d of [winter,summer]){
    assert(Math.abs(Math.hypot(...d.sunDirection)-1)<1e-12);
    assert(atmosphere(d.hour,'clear',d.sunDirection).direction.distanceTo({x:d.sunDirection[0],y:d.sunDirection[1],z:d.sunDirection[2]})<1e-12);
  }
  assert(atmosphere(17.5,'clear').direction.y>0,'Manual golden hour still uses its own sky');
});

test('the live star field advances through both 1:30 AM hours at the end of daylight saving time',()=>{
  const scene=new Scene(),stars=installNightSky(scene);
  const sidereal=scene.getObjectByName('Hipparcos stars over Smallwood').material.uniforms.sidereal.value;
  const rotations=['2026-11-01T05:30:00Z','2026-11-01T06:30:00Z'].map(iso=>{
    const date=new Date(iso),{hour,sunDirection}=smallwoodTime(date);
    stars.set(hour,atmosphere(hour,'clear',sunDirection),date.getTime());
    return sidereal.clone();
  });
  const degrees=Math.atan2(rotations[0].cross(rotations[1]),rotations[0].dot(rotations[1]))*180/Math.PI;
  assert(Math.abs(degrees-15.04107)<.00001);
});

test('station reports require a credible time and usable sky classification',()=>{
  const now=Date.parse('2026-11-20T20:00:00Z');
  const report=(properties,offset=0)=>readStationReport({properties:{
    timestamp:new Date(now+offset).toISOString(),...properties}},now);
  assert.equal(report({textDescription:'Light Snow'}).weather,'snow');
  assert.equal(report({presentWeather:[{weather:'drizzle',modifier:'freezing'}]}).weather,'rain');
  assert.equal(report({textDescription:'Fair'}).weather,'clear');
  assert.equal(report({cloudLayers:[{amount:'BKN'}]}).weather,'cloudy');
  assert.equal(report({textDescription:'Showers in Vicinity',presentWeather:[{weather:'rain',inVicinity:true}],cloudLayers:[{amount:'CLR'}]}).weather,'clear');
  const old=report({textDescription:'Fog'},-3*3600000);
  assert.equal(old.status,'stale');assert.equal(old.weather,null);assert.equal(old.label,'Fog');
  assert.throws(()=>report({textDescription:'Unknown'}));
  assert.throws(()=>report({textDescription:'Clear'},24*3600000));
});

test('weather can be disabled mid-request, and failures preserve the last station timestamp',async t=>{
  const doc=new EventTarget(),win=new EventTarget();
  globalThis.document=doc;globalThis.window=win;
  const requests=[];
  t.mock.method(globalThis,'fetch',(url,options)=>new Promise((resolve,reject)=>requests.push({url,signal:options.signal,resolve,reject})));
  const weather=[],times=[];
  const feed=createLocalConditions({onWeather:s=>weather.push(s),onTime:s=>times.push(s)});
  t.after(()=>{feed.dispose();delete globalThis.document;delete globalThis.window;});
  feed.setTimeEnabled(true);assert.equal(times.length,1);assert.equal(requests.length,0);
  doc.hidden=true;
  feed.setWeatherEnabled(true);
  assert.equal(weather.at(-1).status,'loading');
  assert.equal(requests.length,1,'A background host can supply a guest’s weather request');
  feed.setWeatherEnabled(false);assert(requests[0].signal.aborted);
  feed.setWeatherEnabled(true);
  const timestamp=new Date(Date.now()-20*60000).toISOString();
  const result=description=>({ok:true,json:async()=>({properties:{timestamp,textDescription:description}})});
  requests[1].resolve(result('Overcast'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(weather.at(-1).weather,'cloudy');
  requests[0].resolve(result('Snow'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(weather.at(-1).weather,'cloudy','A canceled request cannot override the current choice');
  const refresh=feed.refreshWeather();requests[2].reject(new Error('Offline'));await refresh;
  assert.equal(weather.at(-1).status,'stale');assert.equal(weather.at(-1).observedAt,timestamp);assert.equal(weather.at(-1).weather,null);
  feed.setWeatherEnabled(false);feed.setTimeEnabled(false);feed.dispose();
  doc.dispatchEvent(new Event('visibilitychange'));win.dispatchEvent(new Event('online'));
  assert.equal(times.length,1);assert.equal(requests.length,3);
});

test('scene controls restore manual settings, share the host report, and follow midnight',async t=>{
  t.mock.timers.enable({apis:['Date','setTimeout'],now:Date.parse('2026-11-20T04:59:00Z')});
  class Control extends EventTarget{
    checked=false;hidden=false;value='';setAttribute(){}
    get selectedOptions(){return [{textContent:{clear:'Clear',cloudy:'Overcast',rain:'Rain',snow:'Snow'}[this.value]}];}
    toggle(){this.checked=!this.checked;this.dispatchEvent(new Event('change'));}
  }
  const controls=new Map();
  function el(id){if(!controls.has(id))controls.set(id,new Control());return controls.get(id);}
  globalThis.document=Object.assign(new EventTarget(),{getElementById:el});
  globalThis.window=new EventTarget();
  const requests=[];
  t.mock.method(globalThis,'fetch',(_url,{signal})=>new Promise((resolve,reject)=>requests.push({resolve,reject,signal})));
  async function observe(request,label,ageMinutes=5){
    const timestamp=new Date(Date.now()-ageMinutes*60000).toISOString();
    request.resolve({ok:true,json:async()=>({properties:{timestamp,textDescription:label}})});
    await new Promise(resolve=>setImmediate(resolve));
  }
  const sourceTime=el('local-time'),sourceWeather=el('local-weather'),status=el('local-weather-status'),retry=el('local-weather-retry');
  const hour=el('scene-hour'),weather=el('scene-weather'),clock=el('scene-clock');
  hour.value='17.5';weather.value='clear';
  let applied,shares=0;
  const env=installSceneEnvironment({setConditions:s=>applied=s,share:()=>shares++});
  t.after(()=>{env.apply({hour:17.5,weather:'clear'},false);delete globalThis.document;delete globalThis.window;});

  hour.value='11.25';hour.dispatchEvent(new Event('input'));
  weather.value='snow';weather.dispatchEvent(new Event('change'));
  sourceTime.toggle();sourceWeather.toggle();
  assert(hour.disabled && weather.disabled);assert.match(clock.value,/11:59 PM EST/);
  assert.equal(env.snapshot().hour,23+59/60);assert.equal(applied.sunDirection.length,3);
  await observe(requests[0],'Rain');assert.equal(applied.weather,'rain');
  const sharesBeforeMidnight=shares;t.mock.timers.tick(60000);
  assert.equal(env.snapshot().hour,0);assert.match(clock.value,/12:00 AM EST/);assert.equal(shares,sharesBeforeMidnight);
  sourceTime.toggle();assert.equal(applied.hour,11.25);assert.equal(applied.sunDirection,null);
  assert(sourceWeather.checked);assert.equal(applied.weather,'rain');

  // The host alone requests observations. A guest keeps the host's last scene
  // while a report is unavailable and resumes its own requests after leaving.
  const hostState=env.snapshot();
  const relayed={...hostState,weatherReport:{status:'ready',label:'Rain',observedAt:new Date(Date.now()-119*60000).toISOString()}};
  env.apply(relayed,true);assert.match(status.textContent,/Rain/);
  t.mock.timers.tick(60000);
  assert.equal(env.snapshot().weatherReport.status,'stale','A guest ages out the last report while the host sleeps');
  assert.match(status.textContent,/Last report/);assert.equal(applied.weather,'rain');assert(retry.hidden);
  env.apply(relayed,true);assert.equal(env.snapshot().weatherReport.status,'stale');
  env.apply({...hostState,weather:'cloudy',weatherReport:{status:'stale',label:'Overcast',observedAt:new Date().toISOString()}},true);
  assert.equal(applied.weather,'cloudy');assert.match(status.textContent,/Last report/);assert(retry.hidden);
  assert.equal(requests.length,1);
  env.solo();assert.equal(requests.length,2);
  await observe(requests[1],'Snow',180);assert.equal(applied.weather,'cloudy');
  assert(!retry.hidden);retry.dispatchEvent(new Event('click'));await observe(requests[2],'Clear');
  assert.equal(applied.weather,'clear');assert(retry.hidden);
  sourceWeather.toggle();assert.equal(applied.weather,'snow');assert.equal(hour.value,'11.25');
  env.apply({...hostState,localTime:false,localWeather:true},false);
  assert.equal(requests.length,4);env.stargaze();assert(requests[3].signal.aborted);
  await observe(requests[3],'Heavy Snow');
  assert.deepEqual(applied,{hour:22,weather:'clear',sunDirection:null});
  assert(!hour.disabled && !weather.disabled && !sourceTime.checked && !sourceWeather.checked);
});
