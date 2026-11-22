// Locally synthesized woodland ambience and close-up footfalls.
import * as THREE from 'three';
import {soleSound} from './footsteps.js';
import {cabinCarol} from './cabin-carol.js';
import {atmosphere} from './tour-sky.js';

const tau=2*Math.PI;
export const outdoorsFloor=label=>!!label && !/^WalkSurface_(MainFloor|Loft|Bathroom|Basement)/i.test(label);
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
// Strike, tearing fibers and landing wood use separate envelopes. A half
// knocking the stump can sound before its later impact on the ground.
function splittingSound(ctx,outcome,variant,woodSize){
  const rate=22050,buf=ctx.createBuffer(1,Math.ceil(rate*.34),rate),samples=buf.getChannelData(0);
  const rng=random(5941+variant*3351+outcome.length*113);
  const split=outcome==='split',landing=outcome==='landing',glance=outcome==='glance';
  const pitch=(landing?82:glance?183:181-87*woodSize)*(.92+.16*rng());
  const decay=landing?39:45-18*woodSize;
  const tearAt=.012+.009*rng();
  // The maul and stump give contact a short low knock, even on a light billet.
  // The wood above it has its own pitch and opens over a longer time on a full round.
  const stumpHz=74+5*rng(),tearDecay=100-58*woodSize;
  let previous=0,low=0;
  for(let i=0;i<samples.length;i++){
    const t=i/rate,white=rng()*2-1,fiberTime=t-tearAt;
    low+=.14*(white-low);
    const impulse=(landing?low:.48*(white-previous))*Math.exp(-t*(glance?72:164));
    const block=(.64*Math.sin(tau*pitch*t)+.31*Math.sin(tau*pitch*2.27*t)*Math.exp(-t*19))*Math.exp(-t*decay);
    const stumpTime=t-.004;
    const stump=!landing && !glance && stumpTime>0
      ?.5*Math.sin(tau*stumpHz*stumpTime)*Math.exp(-stumpTime*23):0;
    const fibers=split && fiberTime>0?(white-.7*low)*Math.exp(-fiberTime*tearDecay)*(.55+.45*Math.cos(810*fiberTime)**2):0;
    const ring=glance?.20*Math.sin(tau*691*t)*Math.exp(-t*47):0;
    previous=white;
    samples[i]=Math.tanh(impulse+stump+block+1.24*fibers+ring)*Math.min(1,i/8);
  }
  return buf;
}
function swingSound(ctx){
  const rate=22050,buffer=ctx.createBuffer(1,Math.round(rate*.19),rate);
  const samples=buffer.getChannelData(0),rng=random(19408);
  let slow=0,fast=0;
  for(let i=0;i<samples.length;i++){
    const t=i/(samples.length-1),air=rng()*2-1;
    // The head accelerates through the air, then the whoosh dies at contact.
    slow+=.035*(air-slow);fast+=(.09+.28*t*t)*(air-fast);
    samples[i]=(fast-slow)*.85*t*t*Math.min(1,(1-t)*11);
  }
  return buffer;
}
export function installWoodlandSound() {
  let audio=null,bus,muffle,pan,enabled=false,revision=0;
  let hour,sunDirection,weather='clear',day=1;
  const tracks={},right=new THREE.Vector3(),toward=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  const last={},steps=new Map(),impacts=new Map();
  let stepNumber=0,impactNumber=0,swingBuffer;
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
  function woodSound(outcome,volume,sectionArea=.035){
    if(!enabled || audio?.state!=='running' || hidden())return;
    const band=Math.round(4*THREE.MathUtils.clamp(Math.sqrt(Math.max(0,sectionArea)/.06),0,1));
    const variant=impactNumber++%3,key=outcome+variant+'-'+band;
    if(!impacts.has(key))impacts.set(key,splittingSound(audio,outcome,variant,band/4));
    const source=audio.createBufferSource(),gain=audio.createGain();
    source.buffer=impacts.get(key);source.playbackRate.value=.97+.06*Math.random();
    gain.gain.value=volume;source.connect(gain);gain.connect(bus);
    source.onended=()=>{source.disconnect();gain.disconnect();};source.start();
  }
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
    swing(seconds){
      if(!enabled || audio?.state!=='running' || hidden() || !(seconds>.035))return;
      swingBuffer??=swingSound(audio);
      const source=audio.createBufferSource();
      source.buffer=swingBuffer;source.playbackRate.value=swingBuffer.duration/seconds;
      source.connect(bus);source.onended=()=>source.disconnect();source.start();
    },
    strike(strength,outcome=strength>.6?'split':'glance',sectionArea){
      woodSound(outcome,.32+.57*THREE.MathUtils.clamp(strength,0,1),sectionArea);
    },
    woodImpact(speed){
      woodSound('landing',THREE.MathUtils.clamp((speed-.28)*.13,0,.46));
    },
    conditions(settings){
      hour=settings.hour??hour;weather=settings.weather??weather;
      if('sunDirection' in settings)sunDirection=settings.sunDirection;
      if(Number.isFinite(hour))day=atmosphere(hour,weather,sunDirection).day;
    },
    update(camera,outside,walking,ring,fire){
      if(!enabled||!audio||!tracks.fire)return;
      const indoors=walking && !outside;
      if(indoors && !tracks.carol){
        const source=audio.createBufferSource(),gain=audio.createGain();
        source.loop=true;gain.gain.value=0;
        source.connect(gain);gain.connect(bus);tracks.carol=gain.gain;
        cabinCarol(audio).then(buffer=>{source.buffer=buffer;source.start();});
      }
      if(tracks.carol)aim('carol',tracks.carol,indoors?.13:0,indoors?.7:.32);
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
