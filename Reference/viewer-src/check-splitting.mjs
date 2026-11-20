import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {installWoodSplitting} from './wood-splitting.js';

// Only the HUD and its wood-grain canvas are stand-ins. Hits are raycast
// against the same 3D maul and billet visitors see.
class Element extends EventTarget {
  dataset={};style={};textContent='';
  getBoundingClientRect(){return {width:1000,height:700,left:0,top:0};}
  getContext(){return {fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};}
  setAttribute(){} toggleAttribute(){} focus(){}
}

test('pick up the maul, spend and restore strength, and return it on walkaway',t=>{
  const elements=new Map();
  function element(id){
    if(!elements.has(id))elements.set(id,new Element());
    return elements.get(id);
  }
  globalThis.document=Object.assign(new EventTarget(),{
    getElementById:element,createElement:()=>new Element(),querySelector:()=>null
  });
  globalThis.window=new EventTarget();
  globalThis.matchMedia=()=>({matches:false});
  t.after(()=>{delete globalThis.document;delete globalThis.window;delete globalThis.matchMedia;});
  let seconds=100,impacts=0;
  t.mock.method(performance,'now',()=>seconds*1000);
  const camera=new T.PerspectiveCamera(62,1000/700,.035,200),scene=new T.Scene();
  const ground={heights:()=>[{label:'WalkSurface_ParcelGround',y:0}],add(){}};
  element('split-mode').value='aim';
  const game=installWoodSplitting(scene,new T.Group(),ground,{
    camera,schedule(){},handsBusy:()=>false,takeSplitLog:()=>true,onSwing(){},onStrike(){impacts++;}
  });
  const station=scene.getObjectByName('Driveway wood splitting');
  const axe=station.getObjectByName('Splitting maul'),round=station.getObjectByName('Unsplit round');
  const parked=axe.position.clone(),orientation=axe.quaternion.clone();
  const stage=()=>element('woodwork').dataset.stage;
  const strength=()=>element('split-strength').value;
  const score=()=>element('split-score').textContent;
  function tick(dt=0,moving=false){seconds+=dt;return game.update('splitting',seconds,moving);}
  function visit(){
    camera.position.fromArray(game.view.eye);camera.lookAt(...game.view.target);
    camera.updateMatrixWorld(true);tick();
  }
  function leave(){
    camera.position.copy(station.localToWorld(new T.Vector3(0,1.59,2)));tick(.1,true);
    assert.equal(stage(),'parked');assert(axe.position.equals(parked));
    assert(axe.quaternion.angleTo(orientation)<1e-6);
  }
  function pointer(type,[x,y]){
    const event=Object.assign(new Event(type),{button:0,pointerType:'mouse',pointerId:1,clientX:x,clientY:y});
    element('view').dispatchEvent(event);
  }
  function tap(point){pointer('pointerdown',point);pointer('pointerup',point);}
  visit();
  function screen(point){point.project(camera);return [500*(point.x+1),350*(1-point.y)];}
  const shaft=screen(axe.localToWorld(new T.Vector3(0,0,-.27))),center=[500,350];
  const grain=new T.Vector3(.054,.29,.041);
  const offCenter=screen(round.localToWorld(grain.clone()));
  tap([80,80]);assert.equal(stage(),'parked');
  pointer('pointerdown',shaft);pointer('pointermove',[shaft[0]+16,shaft[1]]);pointer('pointerup',shaft);
  assert.equal(stage(),'parked','Dragging the view must not pick up the tool');

  tap(shaft);tap(offCenter);tap(center);assert.equal(stage(),'drawing');
  tick(.34);assert.equal(stage(),'swinging');assert.equal(strength(),0);
  tap(center);
  for(let frame=0;frame<240 && !impacts;frame++)tick(.005);
  assert.equal(impacts,1);assert(!round.visible);
  const head=axe.getObjectByName('Forged wedge head');
  head.geometry.computeBoundingBox();
  const edge=head.geometry.boundingBox.getCenter(new T.Vector3());edge.y=head.geometry.boundingBox.min.y;
  station.worldToLocal(head.localToWorld(edge));
  assert(Math.hypot(edge.x-grain.x,edge.z-grain.z)<.004,'The blade must land on the first queued grain hit');
  assert.equal(score(),'3 points · 2 pieces stacked','One queued strike earns one split');
  tick(.50);assert.equal(stage(),'recovering');
  const tired=strength();tick(1,true);assert.equal(strength(),tired,'Walking pauses recovery');
  tick(1);assert(strength()>tired && strength()<100);
  element('split-action').dispatchEvent(new Event('click'));assert.equal(stage(),'recovering');
  tick(4);assert.equal(strength(),100);assert(round.visible);

  tap(center);leave();visit();tap(shaft);tick(.34);
  assert.equal(stage(),'recovering','Walking away and picking up again must not refill strength');
  assert.equal(impacts,1,'Leaving before contact cancels the unfinished swing');
  assert.equal(score(),'3 points · 2 pieces stacked');
  tick(6);assert.equal(stage(),'ready');

  leave();visit();tap(shaft);tap(center);leave();visit();tick(1);
  assert.equal(stage(),'parked');assert.equal(impacts,1,'A queued swing must clear on departure');
  tap(shaft);tick(.34);tap(center);tick(8);
  assert.equal(impacts,2);assert.equal(score(),'6 points · 4 pieces stacked');
  assert.equal(stage(),'ready');assert(round.visible,'A late frame still sets the next round');

  tap(center);camera.position.x+=8;tick(.1,true);
  assert(tick(1),'Standing still away from the block must keep the recovery clock running');
  assert(!tick(4));visit();tap(shaft);tick(.34);
  assert.equal(strength(),100);assert.equal(stage(),'ready');
});
