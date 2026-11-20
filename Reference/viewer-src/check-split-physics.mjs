import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {createSplitPhysics} from './split-physics.js';

const material=new T.MeshStandardMaterial();
function station(groundAt=()=>0,onContact){
  const root=new T.Group();
  const stump=new T.Mesh(new T.CylinderGeometry(.305,.305,.47,20),material);
  stump.name='Scored chopping stump';stump.position.y=.235;root.add(stump);
  const round=new T.Mesh(new T.CylinderGeometry(.135,.135,.29,20),material);
  round.name='Unsplit round';round.visible=false;root.add(round);
  return {root,round,physics:createSplitPhysics({root,groundAt,onContact})};
}
function halves(angle,r=.135){
  const height=.29;
  const nx=Math.cos(angle),nz=Math.sin(angle);
  const result=[1,-1].map(side=>{
    const shape=Array.from({length:12},(_,i)=>{
      const a=angle+Math.PI*((side<0?.5:-.5)+i/11);return {x:r*Math.cos(a),z:r*Math.sin(a)};
    });
    const offset=4*r/(3*Math.PI);
    const hull=shape.map(({x,z})=>({x:x-side*offset*nx,z:z-side*offset*nz}));
    const mesh=new T.Mesh(new T.BoxGeometry(r*1.2,height,r*1.8),material);
    mesh.position.set(side*nx*offset,.47+height/2,side*nz*offset);
    return {mesh,hull,height,density:740,side};
  });
  return {result,cut:{x:0,z:0,nx,nz}};
}
function settle(physics,limit=16,dt=1/60){
  for(let i=0;i<limit/dt;i++)if(!physics.step(dt))return i*dt;
  return Infinity;
}
test('split halves fall, collide with the ground and one another and become a persistent pile',()=>{
  const contacts=[],groundAt=(x,z)=>x*.025-z*.015;
  const {root,physics}=station(groundAt,s=>contacts.push(s));
  assert(physics.canLoad());
  const all=[];
  for(let n=0;n<12;n++){
    const {result,cut}=halves((n%3)*.14);
    physics.release(result,cut);all.push(...result);
    assert.equal(physics.count,(n+1)*2);
    assert(!physics.canLoad(),'The round blocks reloading while still on the stump');
    for(let attempt=0;attempt<3;attempt++){
      if(attempt)assert(physics.clearBlock()>0,'A new round nudges perched wood over the lip');
      assert(Number.isFinite(settle(physics,20)),'Bodies reach sleep after round '+n);
      if(physics.canLoad())break;
    }
    assert(physics.canLoad(),'Chopping surface clears for the next round '+n);
  }
  assert(contacts.length>=12,'Contact speeds come from actual impacts');
  assert(root.children.some(m=>m.name==='Settled split wood'),'A large sleeping pile batches its draw calls');
  for(const {mesh} of all){
    assert(mesh.position.y>groundAt(mesh.position.x,mesh.position.z)-.01,'The terrain supports each half');
    assert(Math.abs(mesh.position.x)<4 && Math.abs(mesh.position.z)<4);
  }
  assert(all.some(({mesh})=>mesh.position.y-groundAt(mesh.position.x,mesh.position.z)>.21),'At least one half rests on other splits');
  const frozen=all[0].mesh.position.clone();
  assert.equal(physics.step(2),false);assert(all[0].mesh.position.equals(frozen));
  for(let i=0;i<all.length;i++)assert(physics.take());
  assert.equal(physics.take(),false);assert.equal(physics.count,0);
});
test('heavy rounds accelerate less under a strike and the solver advances in fixed steps',()=>{
  function flight(radius,dt){
    const {physics}=station(),{result,cut}=halves(.3,radius);
    physics.release(result,cut);
    const before=result[0].mesh.position.clone();
    for(let i=0;i<Math.round(.1/dt);i++)physics.step(dt);
    return result[0].mesh.position.clone().sub(before);
  }
  const light=flight(.11,1/90),heavy=flight(.16,1/90);
  assert(Math.hypot(light.x,light.z)>Math.hypot(heavy.x,heavy.z));
  assert(light.distanceTo(flight(.11,1/30))<.025,'Different render rates give the same trajectory');
});

test('a loading round wakes and pushes settled wood in its path',()=>{
  const {round,physics}=station(),{result,cut}=halves(0);
  physics.release(result,cut);
  assert(physics.blocksStep(0,0,0));
  assert(!physics.blocksStep(2,0,0));
  assert(Number.isFinite(settle(physics)));
  const settled=result[0].mesh.position.clone();
  round.visible=true;
  round.position.set(settled.x-.49,settled.y+.03,settled.z);
  physics.step(1/60);
  for(let i=0;i<50;i++){
    round.position.x+=.014;round.rotation.z=.14*Math.sin(i/50*Math.PI);
    physics.step(1/60);
  }
  assert(result[0].mesh.position.x>settled.x+.16,'Contact follows the moving blank');
  assert(result[0].mesh.position.y>=0,'The pushed piece stays above the ground');
  assert.equal(physics.count,2);
  while(physics.take()){}
  assert(!physics.blocksStep(0,0,0));
});
