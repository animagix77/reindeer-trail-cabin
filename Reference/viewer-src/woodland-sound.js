// Locally synthesized woodland ambience and close-up footfalls.
import * as THREE from 'three';
import {soleSound} from './footsteps.js';
import {atmosphere} from './tour-sky.js';

const tau=2*Math.PI;
export const outdoorsFloor=label=>!!label && !/^WalkSurface_(MainFloor|Loft|Bathroom)/i.test(label);
function random(seed){
  return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
}
function channel(ctx,kind,channelIndex){
  const rate=22050,seconds={wind:15,day:19,crickets:16,fire:12}[kind];
  const samples=new Float32Array(seconds*rate),rng=random(619+channelIndex*7001+kind.length*55);
  const wrap=n=>n%samples.length;
  if(kind==='wind'||kind==='fire'){
    let slow=0,middle=0;
    for(let i=0;i<samples.length;i++){
      const white=rng()*2-1,s=i/rate;
      slow=.987*slow+.013*white;middle=.84*middle+.16*white;
      const breeze=.57+.24*Math.sin(tau*s/seconds+.5)+.15*Math.cos(3*tau*s/seconds);
      samples[i]=kind==='fire'?(.27*middle+.60*slow)*(.64+.36*rng()):(.36*middle+1.2*slow)*breeze;
    }
    if(kind==='fire'){
      // Bark popping and fine resin ticks have independent attack, decay,
      // pitch and spacing. Near saltatory bursts emerge above the steady burn.
      let clock=0;
      while(clock<seconds){
        clock+=.045-Math.log(Math.max(.0001,rng()))*.22;
        const start=Math.round(clock*rate),length=.008+.085*rng()**2;
        const peak=.06+.58*rng()**3,pitch=410+3100*rng();let phase=0,last=0;
        for(let i=0;i<rate*length;i++){
          const t=i/rate,u=t/length,white=rng()*2-1;
          phase+=tau*pitch*(1-.65*u)/rate;last=.18*last+.82*white;
          samples[wrap(start+i)]+=peak*Math.min(1,t/.0007)*Math.exp(-5.8*u)*(.67*last+.33*Math.sin(phase));
        }
      }
    }
  }else if(kind==='crickets'){
    for(let voice=0;voice<4;voice++){
      const pitch=3050+820*rng()+280*voice,period=.42+.58*rng();
      let t=rng()*period;
      while(t<seconds){
        const pulses=3+Math.floor(rng()*4),spacing=.023+rng()*.012,volume=.075+.15*rng();
        for(let p=0;p<pulses;p++){
          const start=Math.floor((t+p*spacing)*rate),duration=.013+.006*rng();
          for(let i=0;i<rate*duration;i++){
            const time=i/rate,u=time/duration,w=Math.sin(Math.PI*u)**2;
            samples[wrap(start+i)]+=volume*w*Math.sin(tau*(pitch*time+90*time*u));
          }
        }
        t+=period*(.86+.4*rng())+(rng()<.10?.5:0);
      }
    }
  }else{
    // A few distant whistles leave long gaps in a quiet daylight clearing.
    let at=.3+rng()*2.7;
    while(at<seconds){
      const startPitch=1730+1350*rng(),count=2+Math.floor(rng()*3);
      for(let c=0;c<count;c++){
        const start=Math.floor((at+c*.22)*rate),duration=.083+.10*rng();
        let phase=0;
        for(let i=0;i<rate*duration;i++){
          const t=i/rate,u=t/duration;
          phase+=tau*(startPitch+(350+140*c)*Math.sin(u*Math.PI)-430*u)/rate;
          samples[wrap(start+i)]+=.19*Math.sin(Math.PI*u)**2*(Math.sin(phase)+.12*Math.sin(phase*2));
        }
      }
      at+=4.3+3.8*rng();
    }
  }
  // Window the loop boundaries so short noise changes never produce a click.
  const edge=Math.round(.025*rate);
  for(let i=0;i<edge;i++){const fade=i/edge;samples[i]*=fade;samples[samples.length-1-i]*=fade;}
  return samples;
}
// A short block resonance follows the metal impact. On a good strike, a second,
// higher transient gives the split a distinct dry crack.
function splittingSound(ctx,solid){
  const rate=22050,buf=ctx.createBuffer(1,Math.ceil(rate*.34),rate),samples=buf.getChannelData(0);
  const rng=random(solid?5941:3151);
  let previous=0;
  for(let i=0;i<samples.length;i++){
    const t=i/rate,white=rng()*2-1,fiberTime=t-.022;
    const impulse=(white-previous)*Math.exp(-t*152);
    const block=Math.sin(tau*(solid?113:170)*t)*Math.exp(-t*24)
      +.31*Math.sin(tau*281*t)*Math.exp(-t*40);
    const crack=solid && fiberTime>0 ? white*Math.exp(-fiberTime*88)*(.72+.28*Math.cos(910*fiberTime)) : 0;
    previous=white;
    samples[i]=Math.tanh(.60*impulse+.54*block+.91*crack)*Math.min(1,i/9);
  }
  return buf;
}
export function installWoodlandSound() {
  let audio=null,bus,muffle,pan,enabled=false,revision=0;
  let hour=16.25,weather='clear',day=1;
  const tracks={},right=new THREE.Vector3(),toward=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  const last={},steps=new Map(),impacts=new Map();
  let stepNumber=0;
  function init(){
    const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!Context)throw Error('Web Audio is unavailable.');
    audio=new Context();
    bus=audio.createGain();bus.gain.value=0;
    muffle=audio.createBiquadFilter();muffle.type='lowpass';muffle.frequency.value=14000;
    muffle.connect(bus);bus.connect(audio.destination);
  }
  function makeTracks(){
    if(tracks.fire)return;
    for(const kind of ['wind','day','crickets','fire']){
      const left=channel(audio,kind,0),right=channel(audio,kind,1);
      const buf=audio.createBuffer(2,left.length,22050);
      buf.getChannelData(0).set(left);buf.getChannelData(1).set(right);
      const source=audio.createBufferSource(),gain=audio.createGain();
      source.buffer=buf;source.loop=true;gain.gain.value=0;source.connect(gain);
      if(kind==='fire'&&audio.createStereoPanner){
        pan=audio.createStereoPanner();gain.connect(pan);pan.connect(muffle);
      } else gain.connect(muffle);
      source.start();tracks[kind]=gain.gain;
    }
  }
  function aim(key,param,value,lag=.30){
    if(last[key]!==undefined && Math.abs(last[key]-value)<.001)return;
    last[key]=value;param.setTargetAtTime(value,audio.currentTime,lag);
  }
  const hidden=()=>document.hidden;
  async function wake(){if(enabled&&audio&&!hidden())await audio.resume().catch(()=>{});}
  document.addEventListener('visibilitychange',()=>{if(hidden())audio?.suspend().catch(()=>{});else wake();});
  window.addEventListener('pagehide',()=>audio?.suspend().catch(()=>{}));
  window.addEventListener('pageshow',wake);
  // Some mobile browsers leave Web Audio interrupted after a call or a lock.
  window.addEventListener('pointerdown',()=>{if(enabled && audio?.state!=='running')wake();},{passive:true});
  return {
    async enable(on){
      const token=++revision;enabled=on;
      if(!on){
        if(audio){bus.gain.cancelScheduledValues(audio.currentTime);bus.gain.value=0;await audio.suspend().catch(()=>{});}
        return false;
      }
      try{
        if(!audio)init();
        const resumed=audio.resume();
        makeTracks();await resumed;
        if(token!==revision)return enabled;
        bus.gain.setTargetAtTime(.70,audio.currentTime,.16);
        return enabled;
      }catch{
        if(token===revision)enabled=false;
        return false;
      }
    },
    footstep(surface,left){
      if(!enabled || audio?.state!=='running' || hidden())return;
      const variant=stepNumber++%5,key=surface+variant;
      if(!steps.has(key))steps.set(key,soleSound(audio,surface,variant));
      const src=audio.createBufferSource();src.buffer=steps.get(key);
      src.playbackRate.value=.96+Math.random()*.09;
      const pan=audio.createStereoPanner?.();
      if(pan){pan.pan.value=left?-.12:.12;src.connect(pan);pan.connect(bus);}
      else src.connect(bus);
      src.onended=()=>{src.disconnect();pan?.disconnect();};
      src.start();
    },
    strike(strength){
      if(!enabled || audio?.state!=='running' || hidden())return;
      const solid=strength>.6;
      if(!impacts.has(solid))impacts.set(solid,splittingSound(audio,solid));
      const source=audio.createBufferSource(),gain=audio.createGain();
      source.buffer=impacts.get(solid);source.playbackRate.value=.97+.07*Math.random();
      gain.gain.value=.36+.59*strength;
      source.connect(gain);gain.connect(bus);
      source.onended=()=>{source.disconnect();gain.disconnect();};
      source.start();
    },
    conditions(settings){
      hour=settings.hour??hour;weather=settings.weather??weather;day=atmosphere(hour,weather).day;
    },
    update(camera,outside,walking,ring,fire){
      if(!enabled||!audio||!tracks.fire)return;
      const wet=weather==='rain',snow=weather==='snow';
      const room=outside?1:.095;
      aim('wind',tracks.wind,walking?room*(snow?.28:wet?.63:.34):0);
      aim('day',tracks.day,walking?room*day*(wet?.07:snow?.035:.16):0);
      aim('crickets',tracks.crickets,walking?room*(1-day)*(wet?.11:snow?0:.43):0);
      const distance=ring?camera.position.distanceTo(ring):100;
      const rolloff=1/(1+.32*Math.max(0,distance-1.1))**1.8;
      aim('fire',tracks.fire,walking?(outside?1:.22)*Math.min(1,fire)*rolloff:0,.095);
      aim('muffle',muffle.frequency,outside?13500:1350);
      if(pan&&ring){
        camera.getWorldDirection(right);right.cross(up).normalize();toward.subVectors(ring,camera.position).normalize();
        aim('firePan',pan.pan,.70*right.dot(toward),.12);
      }
    }
  };
}
