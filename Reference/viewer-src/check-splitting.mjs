import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {installWoodSplitting} from './wood-splitting.js';
import {STANDING_EYE_HEIGHT,WalkSpace} from './walking.js';
import {makeSplittingBlock} from './splitting-block.js';
import './check-maul-motion.mjs';

// The HUD and texture canvas are stand-ins. The maul, raycasts, fracture,
// ground and pile collisions run through the same controller as the tour.
class Element extends EventTarget {
  dataset={};style={};textContent='';
  getBoundingClientRect(){return {width:1000,height:700,left:0,top:0};}
  getContext(){return {fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};}
  setAttribute(){} toggleAttribute(){} focus(){}
}

test('walking respects a heap and still lets a visitor escape if wood topples into their path',()=>{
  const space=new WalkSpace(),floor=new T.Mesh(new T.PlaneGeometry(4,4));
  floor.rotation.x=-Math.PI/2;floor.updateMatrixWorld();space.add(floor,'WalkSurface_ParcelGround');
  const start=space.spawn(0,0,STANDING_EYE_HEIGHT);
  space.dynamicBlocker=(x,z)=>x>.18 && x<.8 && Math.abs(z)<.5;
  assert.equal(space.spawn(.4,0,STANDING_EYE_HEIGHT),null);
  assert(space.move(start,1,0).x<=.18);
  const surrounded={...start,x:.35};
  assert(space.move(surrounded,-.42,0).x<.18);
  const around=space.move(start,0,.8);
  assert(space.move(around,1,0).x>.9);
});

function setup(t,{touch=false,reduced=false,stocking=false}={}){
  const elements=new Map();
  function el(id){
    if(!elements.has(id))elements.set(id,new Element());
    return elements.get(id);
  }
  globalThis.document=Object.assign(new EventTarget(),{
    getElementById:el,createElement:()=>new Element(),querySelector:()=>null
  });
  globalThis.window=new EventTarget();
  globalThis.matchMedia=query=>({matches:query.includes('coarse')?touch:reduced});
  t.after(()=>{delete globalThis.document;delete globalThis.window;delete globalThis.matchMedia;});
  let seconds=100,busy=false;
  const strikes=[],areas=[],landings=[],carried=[];
  let stocked=0;
  t.mock.method(performance,'now',()=>seconds*1000);
  const camera=new T.PerspectiveCamera(62,1000/700,.035,200),scene=new T.Scene();
  const ground={heights:()=>[{label:'WalkSurface_ParcelGround',y:0}],add(){}};
  const game=installWoodSplitting(scene,new T.Group(),ground,{
    camera,schedule(){},stockTotal:()=>stocked,onStockWood:stocking?n=>{stocked+=n;}:undefined,takeSplitLog(mass,mesh){busy=true;carried.push({mass,mesh});return true;},handsBusy:()=>busy,
    onSwing(){},onStrike:(energy,result,area)=>{strikes.push(result);areas.push(area)},onContact:speed=>landings.push(speed)
  });
  const station=scene.getObjectByName('Driveway wood splitting'),axe=station.getObjectByName('Splitting maul');
  const round=station.getObjectByName('Unsplit round');
  const time=()=>seconds;
  function tick(dt=0,moving=false){seconds+=dt;return game.update('splitting',seconds,moving);}
  const stage=()=>el('woodwork').dataset.stage;
  function until(predicate,description){
    for(let i=0;i<900;i++){if(predicate())return;tick(1/60);}
    assert.fail(description+' ('+stage()+', '+el('split-message').textContent+')');
  }
  function stand(x,z){
    camera.position.copy(station.localToWorld(new T.Vector3(x,STANDING_EYE_HEIGHT,z)));
    camera.lookAt(station.localToWorld(new T.Vector3(0,.75,0)));
    camera.updateMatrixWorld(true);tick();
  }
  function screen(object,x,y,z){
    const p=object.localToWorld(new T.Vector3(x,y,z)).project(camera);
    return [500*(p.x+1),350*(1-p.y)];
  }
  function pointer(type,[clientX,clientY],id=1){
    el('view').dispatchEvent(Object.assign(new Event(type),{
      button:0,pointerType:touch?'touch':'mouse',pointerId:id,clientX,clientY
    }));
  }
  function tap(point){pointer('pointerdown',point);pointer('pointerup',point);}
  const shaft=()=>screen(axe,0,0,-.27);
  const grain=(x,z)=>screen(round,x,.29,z);
  const clear=()=>el('split-clear').dispatchEvent(new Event('click'));
  const halfGrain=(mesh,x=0,z=0)=>screen(mesh,x,.145,z);
  const guided=()=>el('split-action').dispatchEvent(new Event('click'));
  const collect=()=>el('split-collect').dispatchEvent(new Event('click'));
  const pieces=()=>station.children.filter(obj=>obj.name==='Split oak firewood');
  stand(.04,.96);
  return {el,axe,round,station,clear,stocked:()=>stocked,carried,areas,halfGrain,guided,time,tick,until,stand,stage,pointer,tap,shaft,grain,collect,pieces,strikes,landings};
}

test('clicking a supported piece repeatedly splits that same piece past quarters; clearing frees the block and preserves the pile',t=>{
  const {el,stage,stand,pointer,tap,shaft,grain,round,axe,station,tick,until,collect,pieces,strikes,areas,landings,carried,clear,halfGrain,guided}=setup(t);
  const reticle=el('split-reticle'),strength=el('split-strength');
  assert.equal(stage(),'parked');assert(!reticle.hidden);
  tap([30,30]);assert.equal(stage(),'parked');
  const grip=shaft();
  pointer('pointerdown',grip);pointer('pointermove',[grip[0]+18,grip[1]]);pointer('pointerup',grip);
  assert.equal(stage(),'parked','Looking around cannot pick up the axe');
  tap(grip);tap(grain(0,0));stand(0,2);tick(1);stand(.04,.96);
  assert.equal(stage(),'parked');assert.deepEqual(strikes,[],'Leaving while drawing cancels the queued strike');
  tap(grip);
  const x=.035,z=.04;
  tap(grain(x,z));tap(grain(-.07,-.04));
  assert.equal(stage(),'drawing');
  until(()=>stage()==='swinging','Queued swing never started');
  assert(strength.value>=86 && strength.value<=87);assert(reticle.hidden);
  for(let i=0;i<500 && !strikes.length;i++)tick(.0025);
  assert.deepEqual(strikes,['split']);
  const head=axe.getObjectByName('Forged wedge head');
  head.geometry.computeBoundingBox();
  const edge=head.geometry.boundingBox.getCenter(new T.Vector3());edge.y=head.geometry.boundingBox.min.y;
  station.worldToLocal(head.localToWorld(edge));
  assert(Math.hypot(edge.x-x,edge.z-z)<.004,'The cutting edge landed on the first selected spot');
  assert(!round.visible);assert.equal(pieces().length,2);
  collect();assert.equal(pieces().length,2,'Wood cannot be collected during the stroke');
  const ready=()=>until(()=>stage()==='ready','Waiting for a supported piece');
  ready();assert(strength.value<89);assert.equal(reticle.dataset.ready,'true');
  let parent=pieces()[0];const otherHalf=pieces()[1];
  for(let i=0;i<3;i++){
    const before=pieces(),hitCount=strikes.length;
    // The selected piece has its own rigid-body pose and its own end grain.
    // Let the piece settle before aiming at the real surface.
    for(let n=0;n<65;n++)tick(1/60);
    tap(halfGrain(parent));until(()=>strikes.length>hitCount,'Tap the retained descendant');
    assert.equal(strikes.at(-1),'split');assert(!pieces().includes(parent));
    const children=pieces().filter(p=>!before.includes(p));
    assert.equal(children.length,2);assert(pieces().includes(otherHalf),'Aiming at a child cannot fracture the other half');
    assert(areas.at(-1)<areas.at(-2),'Impact feedback uses the struck cross-section');
    parent=children.reduce((best,p)=>p.geometry.boundingSphere.radius>best.geometry.boundingSphere.radius?p:best);
    ready();
  }
  assert.equal(pieces().length,5);assert(!round.visible,'There is no four-piece reload');
  for(let n=0;n<600;n++)tick(1/60);
  assert(!round.visible,'A settled supported billet is never automatically cleared');
  assert(!el('split-clear').hidden);clear();
  until(()=>round.visible && stage()==='ready','Clearing the block should allow the next round to load');
  assert.equal(pieces().length,5);assert(landings.length>0,'Falling wood reached a collider');
  assert(pieces().some(p=>p.position.y<.30),'The split pieces fell off the chopping face');
  guided();until(()=>stage()!=='swinging','Spend stamina');
  const previousStrength=strength.value;
  for(let i=0;i<90;i++)tick(1/60,true);
  assert.equal(strength.value,previousStrength,'Walking pauses recovery');
  tick(.5);assert(strength.value>previousStrength && strength.value<100);
  const previous=pieces();collect();assert.equal(stage(),'parked');assert.equal(pieces().length,previous.length-1);
  assert(carried[0].mass>0 && previous.includes(carried[0].mesh) && !pieces().includes(carried[0].mesh));
  collect();tap(grip);assert.equal(pieces().length,previous.length-1);assert.equal(stage(),'parked','Carrying a log occupies both hands');
});

test('tougher oak keeps its cut between strikes from different spots and a different stance',t=>{
  const {el,tap,shaft,grain,stand,stage,round,strikes,pieces,until,tick,clear}=setup(t);
  const ready=()=>until(()=>stage()==='ready','Next swing should become available');
  tap(shaft());ready();tap(grain(0,0));tick(2);
  assert.deepEqual(strikes,['split'],'A low frame rate still sweeps the edge across the round');
  ready();clear();until(()=>round.visible && stage()==='ready','Load a fresh round after clearing the supported halves');
  until(()=>el('split-strength').value===100,'Recover fully before the next round');
  const pristine=round.geometry;
  tap(grain(0,0));until(()=>strikes.length===2,'Expected contact with the second round');
  assert.deepEqual(strikes,['split','bite']);assert.equal(pieces().length,2);
  assert(round.visible);assert.notEqual(round.geometry,pristine);assert.match(el('split-message').textContent,/crack/i);
  ready();
  // Shift around the stump and aim at the far end of the first cut.
  stand(.22,.90);tap(grain(.006,.09));
  until(()=>strikes.length===3,'A second strike from a new stance should land');
  assert.equal(strikes.at(-1),'split');assert.equal(pieces().length,4);ready();
});

test('touch, reduced motion, reach limits and a walk-away never create ghost strikes',t=>{
  const {el,stage,stand,tap,pointer,shaft,grain,axe,tick,until,strikes,pieces,collect}=setup(t,{touch:true,reduced:true});
  const originalPosition=axe.position.clone(),originalRotation=axe.quaternion.clone();
  stand(.04,1.7);tap(shaft());assert.equal(stage(),'parked','Beyond pickup reach');
  stand(.04,.96);
  const grip=shaft();
  pointer('pointerdown',grip);pointer('pointercancel',grip);pointer('pointerup',grip);
  pointer('pointerdown',grip,1);pointer('pointerdown',grip,2);
  pointer('pointerup',grip,2);pointer('pointerup',grip,1);
  assert.equal(stage(),'parked','Canceled and multitouch gestures cannot pick up the axe');
  tap(grip);assert.equal(stage(),'ready');
  stand(.04,1.37);tap(grain(0,0));assert.equal(stage(),'ready','Standing beyond striking reach cannot start a swing');
  stand(.04,.96);tap(grain(0,0));assert.equal(stage(),'swinging');
  stand(0,2);assert.equal(stage(),'parked');assert(axe.position.equals(originalPosition));
  assert(axe.quaternion.angleTo(originalRotation)<1e-6);
  tick(.75,true);assert.deepEqual(strikes,[]);assert.equal(pieces().length,0);
  stand(.04,.96);tap(shaft());assert.equal(stage(),'ready');
  assert(el('split-strength').value<100,'Returning to the block cannot refill strength');
  tap(grain(0,0));tick(1);
  assert.deepEqual(strikes,['split'],'The reduced-motion strike still hits real wood');
  assert.equal(pieces().length,2);until(()=>stage()==='ready','Wait for the splitting face to settle');
  el('split-action').dispatchEvent(new Event('click'));until(()=>strikes.length===2,'Guided touch strike');
  assert.equal(pieces().length,3);stand(0,1.65);collect();assert.equal(pieces().length,3);
  assert(el('split-collect').disabled,'Wood cannot be collected out of reach');
});


test('the first three heavy swings stay quick; repeated work tires the visitor and rest restores full cadence',t=>{
  const {el,tap,shaft,stage,guided,time,tick,until,strikes}=setup(t);
  const meter=el('split-strength');
  const ready=()=>until(()=>stage()==='ready','Waiting for an available round or rested arms');
  tap(shaft());ready();
  const lengths=[];
  for(let i=0;i<18;i++){
    const start=time();guided();assert.equal(stage(),'swinging');
    until(()=>stage()!=='swinging','Finish the current downswing and recovery');
    lengths.push(time()-start);
    if(stage()==='recovering')break;
    // Clearing a previous round can briefly occupy the worker's hands even
    // when fatigue has reached the rest threshold.
    until(()=>stage()==='ready'||stage()==='recovering','Finish loading');
    if(stage()==='recovering')break;
  }
  assert(lengths.length>=7 && lengths.length<=10,'At least seven full strokes before stopping to rest');
  assert(lengths.slice(0,3).every(n=>Math.abs(n-lengths[0])<.025),'First three strokes have fresh cadence');
  assert(Math.max(...lengths)>lengths[0]*1.45,'Last tired swing visibly slows');
  assert(meter.value<16);assert.equal(stage(),'recovering');
  const stoppedAt=strikes.length,spent=meter.value;
  guided();for(let i=0;i<120;i++)tick(1/60,true);
  assert.equal(strikes.length,stoppedAt);assert.equal(meter.value,spent);
  ready();assert(meter.value>=51 && meter.value<100,'Breathing recovers enough to swing before the meter is full');
  until(()=>meter.value===100,'Full rest should restore the initial cadence');
  const start=time();guided();until(()=>stage()!=='swinging','Complete the fresh stroke');
  assert(Math.abs(time()-start-lengths[0])<.025);
});

test('cutting and carrying pieces leave the shared woodpile unchanged',t=>{
  const {stage,shaft,tap,guided,tick,until,stocked,carried,collect,pieces}=setup(t,{stocking:true});
  const ready=()=>until(()=>stage()==='ready','Waiting for the wood to settle');
  tap(shaft());ready();guided();ready();
  assert.equal(pieces().length,2);assert.equal(stocked(),0);
  // Both halves remain on the stump long enough to be split again.
  for(let i=0;i<240;i++)tick(1/60);
  guided();ready();assert.equal(pieces().length,3);assert.equal(stocked(),0);
  collect();assert.equal(carried.length,1);assert.equal(stocked(),0);
  assert.equal(stage(),'parked');
  assert.equal(pieces().length,2);
});

test('clearing makes room for a new round and loose wood persists until a visitor chooses to stack it',t=>{
  const {el,stage,stand,shaft,tap,guided,round,clear,tick,until,stocked,pieces}=setup(t,{stocking:true});
  const stack=el('split-stack'),stackWood=()=>stack.dispatchEvent(new Event('click'));
  const ready=()=>until(()=>stage()==='ready','Waiting for the next swing');
  tap(shaft());ready();guided();ready();guided();ready();assert.equal(pieces().length,3);
  assert(stack.disabled);stackWood();assert.equal(stocked(),0);
  clear();until(()=>round.visible && !stack.disabled,'Clearing should free the block and leave wood to stack');
  for(let i=0;i<600;i++)tick(1/60);
  assert.equal(stocked(),0);assert.equal(pieces().length,3);
  stand(0,3);stackWood();assert.equal(stocked(),0,'Visitors outside the station cannot bank wood');
  stand(.04,.96);assert.equal(stage(),'parked');assert(!stack.disabled);
  stackWood();tick();assert.equal(stocked(),3);
  assert.equal(pieces().length,0);assert.equal(el('split-score').textContent,'3 stacked');
  assert(stack.disabled);stackWood();clear();for(let i=0;i<240;i++)tick(1/60);
  assert.equal(stocked(),3);assert(el('split-clear').hidden);
});

test('a side-lying billet cleaves along its own grain and children inherit its pose',()=>{
  const station=makeSplittingBlock(new T.Group()),round=station.round;
  const first=station.impact({target:round,x:0,y:.76,z:0,nx:1,nz:0,energy:1});
  assert.equal(first.pieces.length,2);
  const half=first.pieces[0].mesh;
  half.rotation.z=Math.PI/2;half.position.set(.03,.55,-.02);
  station.root.add(half);station.setSupported(half,true);station.root.updateMatrixWorld(true);
  const ray=new T.Raycaster(new T.Vector3(half.position.x,1,half.position.z),new T.Vector3(0,-1,0));
  const contact=ray.intersectObject(half)[0];assert(contact);
  const aim=station.aimDirection(half,1,0,contact.face.normal);
  const next=station.impact({target:half,...contact.point,...aim,energy:1});
  assert(next.split);
  for(const {mesh} of next.pieces){
    assert(mesh.quaternion.angleTo(half.quaternion)<1e-6,'Child stays aligned to the side-lying parent');
    assert(mesh.position.distanceTo(half.position)<.16,'Child originates at the fallen billet');
  }
  assert(Math.abs(next.cut.nz)>.5,'The cut stays along the physical length of the fallen wood');
});
