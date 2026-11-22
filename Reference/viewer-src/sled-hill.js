import * as T from 'three';
import {plasticSled} from './winter-gear.js';

import {makeHill,surface} from './lake-terrain.js';

export function installSledHill(renderer,stop,resume){
  const dialog=document.getElementById('sled-trip'),ride=document.getElementById('sled-ride'),status=document.getElementById('sled-status');
  const camera=new T.PerspectiveCamera(64,1,.04,1100);
  const keys=new Set();
  let scene,sled,x=0,d=0,side=0,speed=0,phase='ready',frame=0,last=0,drag=null,steer=0;
  function reset(){
    x=d=side=speed=0;phase='ready';ride.hidden=false;ride.textContent='Push off';
    status.textContent='Drag to steer, or use A and D.';last=0;
  }
  function draw(now){
    if(!dialog.open||document.hidden)return;
    const dt=last?Math.min(.08,(now-last)/1000):0;last=now;
    if(phase==='riding'){
      const grade=(surface(x,d-.15)-surface(x,d+.15))/.3;
      speed=T.MathUtils.clamp(speed+(9.81*grade-.18-.010*speed*speed-(d>52?1.25:0))*dt,0,12);
      side+=((Number(keys.has('right'))-Number(keys.has('left'))+steer)*Math.min(3.5,speed*.5)-side)*(1-Math.exp(-4*dt));
      x=T.MathUtils.clamp(x+side*dt,-8.2,8.2);d+=speed*dt;
      if(speed<.03||d>=68){phase='finished';side=speed=0;ride.hidden=false;ride.textContent='Ride again';status.textContent='At the bottom of the hill';}
    }
    const mobile=innerWidth<innerHeight;
    camera.aspect=renderer.domElement.clientWidth/renderer.domElement.clientHeight;
    camera.fov=mobile?75:64;camera.updateProjectionMatrix();
    const ground=surface(x,d),eye=ground+.68;
    camera.position.set(x,eye,-d);
    const slopeAhead=(surface(x,d+5)-ground)/5;
    const pitch=phase==='riding'?slopeAhead*.58-.05:-.065;
    camera.lookAt(x+side*.31,eye+pitch*5,-d-5);
    camera.rotateZ(-side*.014);
    sled.position.set(x,ground+.065,-d-.38);
    sled.rotation.set(Math.atan((surface(x,d+1)-ground)),0,side*.018);
    renderer.render(scene,camera);
    frame=requestAnimationFrame(draw);
  }
  function restart(){cancelAnimationFrame(frame);last=0;if(dialog.open&&!document.hidden)frame=requestAnimationFrame(draw);}
  ride.onclick=()=>{
    if(phase==='finished')reset();
    phase='riding';speed=2.1;ride.hidden=true;status.textContent='Drag or use A and D to steer';dialog.focus();
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
    if(!scene){scene=makeHill();sled=plasticSled(color);scene.add(sled);}
    renderer.shadowMap.needsUpdate=true;
    sled.children[0].material.color.setHex(color);
    reset();dialog.showModal();document.documentElement.classList.add('sledding');ride.focus();restart();
  }};
}
