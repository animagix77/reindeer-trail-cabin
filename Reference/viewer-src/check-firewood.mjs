import assert from 'node:assert/strict';
import * as T from 'three';
import {STANDING_EYE_HEIGHT} from './walking.js';
import {installTourFires,fuelDuration} from './fires.js';
import {installFirewood} from './firewood.js';
import {createTossMotion} from './toss-motion.js';

function checkLandingMotion(){
  const start=new T.Vector3(0,1.25,0),contact=new T.Vector3(0,.04,2),flight=.65;
  const distances={};
  for(const kind of ['apple','carrot','vegetables','twigs','sticks','logs']){
    const groundAt=(x,z)=>.04+(z-2)*.07;
    const motion=createTossMotion({kind,start,contact,duration:flight,groundAt}),mesh=new T.Object3D();
    motion.sample(flight,mesh);
    assert(mesh.position.distanceTo(contact)<1e-7);
    const impactRotation=mesh.quaternion.clone();
    let rebound=0;
    for(let elapsed=flight;elapsed<motion.duration;elapsed+=1/120){
      motion.sample(elapsed,mesh);
      const clearance=mesh.position.y-groundAt(mesh.position.x,mesh.position.z);
      assert(clearance>=-1e-5,'Toss penetrated its landing surface');
      rebound=Math.max(rebound,clearance);
    }
    assert(rebound>.006 && rebound<.14,'Expected a small damped rebound for '+kind);
    assert(motion.sample(motion.duration+4,mesh));
    assert(mesh.position.equals(motion.rest));
    assert(Math.abs(mesh.position.y-groundAt(mesh.position.x,mesh.position.z))<1e-6);
    distances[kind]=mesh.position.z-contact.z;
    assert(distances[kind]>.007);
    assert(mesh.quaternion.angleTo(impactRotation)>.08,'The piece rolled or tipped after impact');
    const finalRotation=mesh.quaternion.clone();
    motion.sample(200,mesh);assert(mesh.position.equals(motion.rest));assert(mesh.quaternion.angleTo(finalRotation)<1e-6);
  }
  assert(distances.apple>distances.carrot && distances.carrot>distances.vegetables);
  const bounded=createTossMotion({kind:'apple',start,contact,duration:flight,
    groundAt:(x,z)=>z<=2.045?.04:null});
  assert(bounded.rest.z>contact.z && bounded.rest.z<=2.045,'Rolling objects stop at the edge of valid ground');
}

export function checkFirewood(model,space){
  checkLandingMotion();
  const world=new T.Scene(),camera=new T.PerspectiveCamera(63,1.4,.035,200);
  const fires=installTourFires(world,model);
  let deliveries=0,now=performance.now()*.001;
  const wood=installFirewood(world,model,space,camera,fires,()=>{},()=>++deliveries);
  const fresh=world.getObjectByName('Fresh split wood behind the swings');
  const stackBounds=new T.Box3().setFromObject(model.getObjectByName('WalkBlock_StackedGardenFirewood'));
  const oldRinds=[];
  model.traverse(o=>{if(o.isMesh && o.material.name==='Weathered timber ties')oldRinds.push(o);});
  const pos=new T.Vector3(),matrix=new T.Matrix4(),ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
  assert.equal(fresh.count,0);assert(!fresh.visible);
  wood.setRestocked(1);assert(fresh.visible && fresh.count===1);
  fresh.getMatrixAt(0,matrix);pos.setFromMatrixPosition(matrix);
  let top=-Infinity;
  for(const d of [-.13,0,.13]){
    const offset=.3048*d,angle=5.4*Math.PI/180;
    ray.set(new T.Vector3(pos.x-Math.sin(angle)*offset,pos.y+1,pos.z+Math.cos(angle)*offset),down);
    const hit=ray.intersectObjects(oldRinds,false)[0];if(hit)top=Math.max(top,hit.point.y);
  }
  assert(Math.abs(pos.y-top-.031)<.035,'The first fresh billet rests on the existing stack');
  wood.setRestocked(2000);assert.equal(fresh.count,150);
  for(let i=0;i<fresh.count;i++){
    fresh.getMatrixAt(i,matrix);pos.setFromMatrixPosition(matrix);
    assert(pos.x>=stackBounds.min.x-.03 && pos.x<=stackBounds.max.x+.03 &&
      pos.z>=stackBounds.min.z-.03 && pos.z<=stackBounds.max.z+.03,
      'The refilled pile stays behind the swings');
  }
  wood.setRestocked(3);assert.equal(fresh.count,3,'Joining a new house replaces the displayed count');
  wood.setRestocked(0);assert.equal(fresh.count,0);assert(!fresh.visible);
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
    const thrown=world.children.find(mesh=>mesh.isMesh&&mesh.name==='Held '+k);
    assert(thrown);
    for(let i=0;i<240 && wood.snapshot().inFlight;i++){
      now+=1/90;wood.update(body,'yard',now);
    }
    assert(!wood.snapshot().inFlight && !thrown.parent);
    const bank=world.getObjectByName('Firewood in the ring · '+k);
    const matrix=new T.Matrix4(),at=new T.Vector3(),rotation=new T.Quaternion();
    bank.getMatrixAt(0,matrix);matrix.decompose(at,rotation,new T.Vector3());
    assert(at.distanceTo(thrown.position)<1e-5 && rotation.angleTo(thrown.quaternion)<.001,'Fuel stayed where it settled');
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
  visit({eye:[behind.x,ring.y+STANDING_EYE_HEIGHT,behind.z],target:ring.toArray()});
  assert(wood.snapshot().nearPit);assert(!wood.toss(),'Firewood cannot travel through a hanging chair');
  wood.update(null,'property',now);assert.equal(wood.snapshot().held,'logs');
  const body=visit(yard);assert(wood.toss());now+=4;wood.update(body,'yard',now);
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
  // The original pile mesh is released on collection. The billet keeps its
  // cut shape from palm to coals, including pieces that only burn as kindling.
  fires.setFirePitOn(false);
  for(const [mass,kind] of [[.12,'twigs'],[.63,'sticks'],[2.1,'logs']]){
    fires.applyFuel({twigs:0,sticks:0,logs:0});wood.update(body,'yard',now);
    const source=new T.Mesh(new T.BoxGeometry(.035,.29,.045),new T.MeshStandardMaterial());
    assert(wood.takeSplitLog(mass,source));assert.equal(wood.state.held,kind);
    const hand=world.getObjectByName('Freshly split oak');
    assert.notEqual(hand.geometry,source.geometry);assert.equal(hand.material,source.material);
    const size=new T.Vector3();hand.geometry.computeBoundingBox();hand.geometry.boundingBox.getSize(size);
    assert(Math.abs(size.x-.29)<1e-5,'The cut face and full billet length survived pickup');
    source.geometry.dispose();assert(wood.toss());
    now+=3;wood.update(body,'yard',now);
    const landed=world.getObjectByName('Freshly split oak');
    assert.equal(landed.geometry,hand.geometry);assert.equal(landed.parent,world);
    assert.equal(fires.fuelSnapshot()[kind],fuelDuration[kind]);
    let disposed=false;landed.geometry.addEventListener('dispose',()=>{disposed=true;});
    fires.applyFuel({twigs:0,sticks:0,logs:0});wood.update(body,'yard',now);
    assert(!landed.parent && disposed);source.material.dispose();
  }
}
