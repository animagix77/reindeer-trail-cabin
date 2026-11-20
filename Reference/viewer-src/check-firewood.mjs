import assert from 'node:assert/strict';
import * as T from 'three';
import {installTourFires,fuelDuration} from './fires.js';
import {installFirewood} from './firewood.js';

export function checkFirewood(model,space){
  const world=new T.Scene(),camera=new T.PerspectiveCamera(63,1.4,.035,200);
  const fires=installTourFires(world,model);
  let deliveries=0,now=performance.now()*.001;
  const wood=installFirewood(world,model,space,camera,fires,()=>{},()=>++deliveries);
  const marker=name=>model.getObjectByName(name).getWorldPosition(new T.Vector3()).toArray();
  const yard={eye:marker('TourEye_yard'),target:marker('TourLook_yard')};
  function visit(view){
    const [x,y,z]=view.eye,body=space.spawn(x,z,y);
    assert(body,'Wood gathering destination needs a walkable camera');
    camera.position.set(body.x,body.y+body.eye,body.z);camera.lookAt(...view.target);
    wood.update(body,view===yard?'yard':'wood',now);
    return body;
  }
  visit(wood.view);
  assert.deepEqual(wood.snapshot().nearby,['twigs','sticks','logs']);
  for(const k of Object.keys(fuelDuration)){
    visit(wood.view);
    assert(wood.pickUp(k));assert(!wood.takeSplitLog());assert(!wood.pickUp(k));
    assert(wood.putBack());assert(wood.pickUp(k));
    const body=visit(yard);
    assert(wood.snapshot().canToss,'A carried piece can reach the ring from the fire pit viewpoint');
    wood.update(body,'yard',now,true);
    assert(!wood.snapshot().canToss);assert(!wood.toss());assert.equal(wood.snapshot().held,k);
    assert(!world.getObjectByName('Carrying firewood').visible);
    wood.update(body,'yard',now,false);
    assert(wood.toss());assert(!wood.toss());assert(wood.snapshot().inFlight);
    assert.equal(fires.fuelSnapshot()[k],0,'Credit the fuel only after it lands');
    now+=1.1;wood.update(body,'yard',now);
    assert.equal(fires.fuelSnapshot()[k],fuelDuration[k]);assert(!fires.lit);
  }
  assert.equal(deliveries,3);
  assert.deepEqual(wood.snapshot().counts,{twigs:5,sticks:4,logs:3});
  assert(!wood.pickUp('logs'),'The woodpile is out of reach at the pit');
  assert(wood.takeSplitLog());assert(!wood.takeSplitLog());
  const center=name=>new T.Box3().setFromObject(model.getObjectByName(name),true).getCenter(new T.Vector3());
  const ring=center('WalkBlock_FireRing'),basket=center('WalkBlock_HangingBasket1');
  const away=basket.clone().sub(ring);away.y=0;away.normalize();
  const behind=basket.clone().addScaledVector(away,.88);
  visit({eye:[behind.x,ring.y+1.59,behind.z],target:ring.toArray()});
  assert(wood.snapshot().nearPit);assert(!wood.toss(),'Firewood cannot travel through a hanging chair');
  wood.update(null,'property',now);assert.equal(wood.snapshot().held,'logs');
  const body=visit(yard);assert(wood.toss());now+=1.1;wood.update(body,'yard',now);
  assert.deepEqual(wood.snapshot().counts,{twigs:5,sticks:4,logs:3});
  assert.equal(fires.fuelSnapshot().logs,240);
  const cold=fires.fuelSnapshot(),strength=fires.fuelLevel;
  now+=180;fires.update(camera,'yard',now);assert.deepEqual(fires.fuelSnapshot(),cold);
  fires.setFirePitOn(true);now+=12;fires.update(camera,'yard',now);
  assert(fires.fuelLevel<strength);assert.equal(fires.fuelSnapshot().logs,228);
  fires.setFirePitOn(false);const paused=fires.fuelSnapshot();
  now+=60;fires.update(camera,'yard',now);assert.deepEqual(fires.fuelSnapshot(),paused);
  fires.setFirePitOn(true);now+=11;fires.update(camera,'yard',now);
  assert.equal(fires.fuelSnapshot().twigs,0);
  assert.equal(fires.fuelSnapshot().logs,217);assert.equal(deliveries,4);
}
