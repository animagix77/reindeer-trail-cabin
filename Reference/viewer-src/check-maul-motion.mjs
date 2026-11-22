import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {STANDING_EYE_HEIGHT} from './walking.js';
import {makeSplittingMaul} from './splitting-maul.js';

function equipped(outcome,pace=1){
  const root=new T.Group(),tool=makeSplittingMaul(root);
  root.position.set(-2,1.2,3.5);root.rotation.y=.63;
  const camera=new T.PerspectiveCamera(65,1.6,.035,180);
  camera.position.copy(root.localToWorld(new T.Vector3(.22,STANDING_EYE_HEIGHT,.96)));
  const target=new T.Vector3(.035,.775,.026);
  camera.lookAt(root.localToWorld(target.clone()));camera.updateMatrixWorld();
  const aim={...target,nx:.96,nz:-.28,outcome,duration:tool.swingDuration*pace,endStamina:.43};
  tool.hold(camera,0,false,.64);
  const edge=()=>tool.edge.clone().applyQuaternion(tool.maul.quaternion).add(tool.maul.position);
  function stroke(t,reduced=false){tool.stroke(t,true,reduced,camera,aim);return edge();}
  function fromContact(seconds){return stroke(tool.impactFraction+seconds/aim.duration);}
  return {tool,camera,target,aim,edge,stroke,fromContact};
}

test('the accelerating maul reaches the selected grain on the collision frame at either pace',()=>{
  for(const pace of [1,1.8]){
    const {camera,tool,aim,target,edge,stroke,fromContact}=equipped('split',pace);
    const opening=edge();
    assert(stroke(0).distanceTo(opening)<1e-6);
    const early=fromContact(-.10).y,middle=fromContact(-.05).y,contact=fromContact(0);
    assert(contact.distanceTo(target)<1e-6);
    assert(middle-contact.y>early-middle,'Head should gather speed toward the hit');
    assert(fromContact(.10).y<contact.y-.095,'A clean split carries the head through the wood');
    const ending=stroke(1);
    tool.hold(camera,0,false,aim.endStamina);
    assert(edge().distanceTo(ending)<1e-6,'Release must settle into the same guard as idle');
  }
});

test('resistant oak arrests the face, returns a small bounce and damps it; a glancing bit also skids sideways',()=>{
  for(const pace of [1,1.8]){
    for(const outcome of ['bite','glance']){
      const {target,fromContact}=equipped(outcome,pace);
      const low=fromContact(.025),high=fromContact(.09),settled=fromContact(.14);
      assert(low.y<target.y && low.y>target.y-.025);
      assert(high.y>target.y+.035 && high.y<target.y+.08);
      assert(settled.y<high.y-.012);
      if(outcome==='bite')assert(Math.abs(settled.y-target.y)<.009,'The head falls back into its shallow kerf');
      else assert(settled.y>target.y,'A glancing bit skips free');
      const skid=Math.hypot(high.x-target.x,high.z-target.z);
      if(outcome==='glance')assert(skid>.045);
      else assert(skid<.025);
    }
  }
});

test('the hands load the handle before the head lifts, then change leverage to recover it from a split',()=>{
  const {tool,aim,edge,stroke,fromContact}=equipped('split');
  const opening=edge(),buttY=tool.maul.position.y;
  const loaded=stroke(.065/aim.duration);
  assert(tool.maul.position.y>buttY+.045 && loaded.y<opening.y-.018,'The hands must lead the heavy head');
  const splitDepth=fromContact(.103).y;
  const grip=tool.maul.getObjectByName('Right work glove'),atImpact=grip.position.z;
  const lifting=fromContact(.165);
  assert(Math.abs(lifting.y-splitDepth)<.012,'The heavy head stays low while the hands lever the handle');
  assert(grip.position.z<atImpact-.065,'The guide hand chokes up to recover the maul');
  assert(fromContact(.25).y>lifting.y+.09,'Extraction must carry the head back up');
});

test('the steel edge stops above the stump when it splits a low piece of kindling',()=>{
  const {aim,tool,target,stroke}=equipped('split');
  aim.blockTop=target.y-.033;
  const steel=tool.maul.getObjectByName('Forged wedge head').geometry.attributes.position;
  assert(stroke(tool.impactFraction).distanceTo(target)<1e-6);
  const vertex=new T.Vector3();
  let minimum=Infinity;
  for(let i=1;i<=50;i++){
    stroke(tool.impactFraction+(1-tool.impactFraction)*i/50);
    for(let j=0;j<steel.count;j++){
      vertex.fromBufferAttribute(steel,j).applyQuaternion(tool.maul.quaternion).add(tool.maul.position);
      minimum=Math.min(minimum,vertex.y);
    }
  }
  assert(minimum>=aim.blockTop-.0001 && minimum<aim.blockTop+.005);
});

test('reduced motion preserves exact impact without playing the windup or bouncing the viewmodel',()=>{
  const {target,edge,stroke,tool}=equipped('bite');
  const opening=edge();
  assert(stroke(tool.impactFraction-.02,true).distanceTo(opening)<1e-6);
  assert(stroke(tool.impactFraction,true).distanceTo(target)<1e-6);
  assert(stroke(tool.impactFraction+.06,true).distanceTo(target)<1e-6);
});
