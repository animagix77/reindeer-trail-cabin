import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {installWoodSplitting} from './wood-splitting.js';
import {WalkSpace} from './walking.js';

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
  const start=space.spawn(0,0,1.59);
  space.dynamicBlocker=(x,z)=>x>.18 && x<.8 && Math.abs(z)<.5;
  assert.equal(space.spawn(.4,0,1.59),null);
  assert(space.move(start,1,0).x<=.18);
  const surrounded={...start,x:.35};
  assert(space.move(surrounded,-.42,0).x<.18);
  const around=space.move(start,0,.8);
  assert(space.move(around,1,0).x>.9);
});

function setup(t,{touch=false,reduced=false}={}){
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
  const strikes=[],landings=[];
  t.mock.method(performance,'now',()=>seconds*1000);
  const camera=new T.PerspectiveCamera(62,1000/700,.035,200),scene=new T.Scene();
  const ground={heights:()=>[{label:'WalkSurface_ParcelGround',y:0}],add(){}};
  const game=installWoodSplitting(scene,new T.Group(),ground,{
    camera,schedule(){},takeSplitLog(){busy=true;return true;},handsBusy:()=>busy,
    onSwing(){},onStrike:(energy,result)=>strikes.push(result),onContact:speed=>landings.push(speed)
  });
  const station=scene.getObjectByName('Driveway wood splitting'),axe=station.getObjectByName('Splitting maul');
  const round=station.getObjectByName('Unsplit round');
  function tick(dt=0,moving=false){seconds+=dt;return game.update('splitting',seconds,moving);}
  const stage=()=>el('woodwork').dataset.stage;
  function until(predicate,description){
    for(let i=0;i<900;i++){if(predicate())return;tick(1/60);}
    assert.fail(description+' ('+stage()+', '+el('split-message').textContent+')');
  }
  function stand(x,z){
    camera.position.copy(station.localToWorld(new T.Vector3(x,1.59,z)));
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
  const collect=()=>el('split-collect').dispatchEvent(new Event('click'));
  const pieces=()=>station.children.filter(obj=>obj.name==='Split oak firewood');
  stand(.04,.96);
  return {el,axe,round,station,tick,until,stand,stage,pointer,tap,shaft,grain,collect,pieces,strikes,landings};
}

test('a click on the maul and a click on the oak leave two real pieces; rest and collect',t=>{
  const {el,stage,stand,pointer,tap,shaft,grain,round,axe,station,tick,until,collect,pieces,strikes,landings}=setup(t);
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
  assert.equal(strength.value,0);assert(reticle.hidden);
  for(let i=0;i<500 && !strikes.length;i++)tick(.0025);
  assert.deepEqual(strikes,['split']);
  const head=axe.getObjectByName('Forged wedge head');
  head.geometry.computeBoundingBox();
  const edge=head.geometry.boundingBox.getCenter(new T.Vector3());edge.y=head.geometry.boundingBox.min.y;
  station.worldToLocal(head.localToWorld(edge));
  assert(Math.hypot(edge.x-x,edge.z-z)<.004,'The cutting edge landed on the first selected spot');
  assert(!round.visible);assert.equal(pieces().length,2);
  tap(grain(x,z));collect();assert.equal(pieces().length,2,'The contact releases the pair only once');
  for(let i=0;i<90;i++)tick(1/60,true);
  assert.equal(strength.value,0,'Walking pauses recovery');
  tick(.5);assert(strength.value>0 && strength.value<100);
  until(()=>stage()==='ready','Standing still should reload and restore strength');
  assert(!reticle.hidden);assert.equal(reticle.dataset.ready,'true');assert(round.visible);
  assert.deepEqual(strikes,['split']);assert(landings.length>0,'Falling wood reached a collider');
  assert(pieces().some(p=>p.position.y<.3),'The wood fell away from the chopping face');
  collect();assert.equal(stage(),'parked');assert.equal(pieces().length,1);
  collect();tap(grip);assert.equal(pieces().length,1);assert.equal(stage(),'parked','Carrying a log occupies both hands');
});

test('tougher oak keeps its cut between strikes from different spots and a different stance',t=>{
  const {el,tap,shaft,grain,stand,stage,round,strikes,pieces,until,tick}=setup(t);
  const ready=()=>until(()=>stage()==='ready','Next swing should become available');
  tap(shaft());ready();tap(grain(0,0));tick(2);
  assert.deepEqual(strikes,['split'],'A low frame rate still sweeps the edge across the round');
  ready();
  const pristine=round.geometry;
  tap(grain(0,0));until(()=>strikes.length===2,'Expected contact with the second round');
  assert.deepEqual(strikes,['split','bite']);assert.equal(pieces().length,2);
  assert(round.visible);assert.notEqual(round.geometry,pristine);assert.match(el('split-message').textContent,/crack/i);
  ready();
  // Shift around the stump and aim at the far end of the first cut.
  stand(.22,.90);tap(grain(.006,.09));
  until(()=>strikes.length===3,'A second strike from a new stance should land');
  assert.equal(strikes.at(-1),'split');assert.equal(pieces().length,4);
  ready();assert.equal(pieces().length,4,'Reloading the stump preserves the earlier pile');
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
  stand(.04,.96);tap(shaft());assert.equal(stage(),'recovering','Returning to the block cannot refill strength');
  until(()=>stage()==='ready','Rest should allow another swing');
  tap(grain(0,0));tick(1);
  assert.deepEqual(strikes,['split'],'The reduced-motion strike still hits real wood');
  assert.equal(pieces().length,2);stand(0,1.65);collect();assert.equal(pieces().length,2);
  assert(el('split-collect').disabled,'Wood cannot be collected out of reach');
});
