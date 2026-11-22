import * as T from 'three';
import {plasticSled} from './winter-gear.js';
import {SledMotion} from './sled-motion.js';
import {createSledTracks} from './sled-tracks.js';

import {makeHill,surface} from './lake-terrain.js';

const hullLead=.38;

export function installSledHill(renderer,stop,resume){
  const dialog=document.getElementById('sled-trip'),ride=document.getElementById('sled-ride'),status=document.getElementById('sled-status');
  const camera=new T.PerspectiveCamera(64,1,.04,1100);
  const keys=new Set();
  const motion=new SledMotion(surface),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let scene,sled,tracks,phase='ready',frame=0,last=0,drag=null,steer=0;
  function reset(){
    motion.reset();phase='ready';ride.hidden=false;ride.textContent='Push off';
    status.textContent='Drag to steer, or use A and D.';last=0;
  }
  function draw(now){
    if(!dialog.open||document.hidden)return;
    const dt=last?(now-last)/1000:0;last=now;
    if(phase==='riding'){
      const input=Number(keys.has('right'))-Number(keys.has('left'))+steer;
      motion.advance(dt,input);
    }
    const {x,d,heading,bank}=motion;
    const mobile=innerWidth<innerHeight;
    camera.aspect=renderer.domElement.clientWidth/renderer.domElement.clientHeight;
    camera.fov=mobile?75:64;camera.updateProjectionMatrix();
    const ground=surface(x,d),eye=ground+.68;
    camera.position.set(x,eye,-d);
    const noseX=Math.sin(heading),noseD=Math.cos(heading);
    const slopeAhead=(surface(x+noseX*3,d+noseD*3)-ground)/3;
    const pitch=phase==='ready'?-.065:slopeAhead*.58-.05;
    camera.lookAt(x+noseX*5,eye+pitch*5,-d-noseD*5);
    if(!reducedMotion.matches)camera.rotateZ(bank*.62);
    const hullX=x+hullLead*noseX,hullD=d+hullLead*noseD;
    if(phase==='riding'){
      tracks.record(hullX,hullD,heading);
      if(motion.finished){
        phase='finished';ride.hidden=false;ride.textContent='Ride again';status.textContent='At the bottom of the hill';
      }
    }
    sled.position.set(hullX,surface(hullX,hullD)+.065,-hullD);
    const hullSlope=surface(hullX+noseX*.5,hullD+noseD*.5)-surface(hullX-noseX*.5,hullD-noseD*.5);
    sled.rotation.set(Math.atan(hullSlope),-heading,bank,'YXZ');
    renderer.render(scene,camera);
    frame=requestAnimationFrame(draw);
  }
  function restart(){cancelAnimationFrame(frame);last=0;if(dialog.open&&!document.hidden)frame=requestAnimationFrame(draw);}
  ride.onclick=()=>{
    motion.pushOff();
    tracks.beginRun(0,hullLead,0);
    phase='riding';ride.hidden=true;status.textContent='Drag or use A and D to steer';dialog.focus();
  };
  document.getElementById('sled-return').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{
    cancelAnimationFrame(frame);keys.clear();drag=null;steer=0;
    document.documentElement.classList.remove('sledding');renderer.shadowMap.needsUpdate=true;resume();
  });
  function direction(code){return ['KeyA','ArrowLeft'].includes(code)?'left':['KeyD','ArrowRight'].includes(code)?'right':null;}
  dialog.addEventListener('keydown',e=>{
    const key=direction(e.code);if(key){e.preventDefault();keys.add(key);}
    e.stopPropagation();
  });
  window.addEventListener('keyup',e=>keys.delete(direction(e.code)));
  dialog.addEventListener('pointerdown',e=>{
    if(e.target.closest('button')||drag!==null)return;
    drag={id:e.pointerId,x:e.clientX};dialog.setPointerCapture(e.pointerId);
  });
  dialog.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId)steer=T.MathUtils.clamp((e.clientX-drag.x)/64,-1,1);});
  function release(){drag=null;steer=0;}
  for(const event of ['pointerup','pointercancel','lostpointercapture'])dialog.addEventListener(event,release);
  window.addEventListener('blur',()=>{keys.clear();release();});
  document.addEventListener('visibilitychange',restart);
  return {get open(){return dialog.open;},visit(color){
    if(dialog.open)return;
    stop();if(document.pointerLockElement)document.exitPointerLock();
    if(!scene){
      tracks=createSledTracks();scene=makeHill(tracks);
      sled=plasticSled(color);scene.add(sled);
    }
    renderer.shadowMap.needsUpdate=true;
    sled.children[0].material.color.setHex(color);
    reset();dialog.showModal();document.documentElement.classList.add('sledding');ride.focus();restart();
  }};
}
