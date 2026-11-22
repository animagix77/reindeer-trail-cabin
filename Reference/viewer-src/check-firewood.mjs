import assert from 'node:assert/strict';
import * as T from 'three';
import {Body,Box,Vec3} from 'cannon-es';
import {STANDING_EYE_HEIGHT} from './walking.js';
import {installTourFires,fuelDuration} from './fires.js';
import {installFirewood} from './firewood.js';

function checkLiftUnderPile(model,space){
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(60,1,.035,100);
  const body={x:0,y:0,z:0,eye:STANDING_EYE_HEIGHT,label:'WalkSurface_ParcelGround'};
  camera.position.set(0,body.eye,0);camera.lookAt(0,body.eye,-2);camera.updateMatrixWorld();
  const fire=installTourFires(scene,model);
  let supported=true,now=0;
  const colliders={blockedSegment:()=>false,sync(world){
    if(!supported || world.bodies.some(b=>b.testGround))return;
    const ground=new Body({mass:0,shape:new Box(new Vec3(10,.2,10)),position:new Vec3(0,-.2,0)});
    ground.testGround=true;world.addBody(ground);
  }};
  const wood=installFirewood(scene,model,space,camera,fire,undefined,undefined,colliders);
  const step=()=>wood.update(body,'yard',now+=1/60),down=new T.Vector3(0,-1,0);
  function release(size,over){
    step();
    const source=new T.Mesh(new T.BoxGeometry(...size));
    assert(wood.takeSplitLog(1.1,source));
    const hand=scene.getObjectByName('Carrying firewood').children.find(m=>m.name==='Freshly split oak'),geometry=hand.geometry;
    if(over){
      const origin=hand.getWorldPosition(new T.Vector3());
      camera.position.x+=over.position.x-origin.x;camera.position.z+=over.position.z-origin.z;
      body.x=camera.position.x;body.z=camera.position.z;step();
    }
    assert(wood.throwWood(down));
    for(let i=0;i<360 && wood.state.inFlight;i++)step();
    assert(!wood.state.inFlight);
    return scene.children.find(m=>m.geometry===geometry);
  }
  // A broad piece in the same spot makes the contact deterministic. Pick its
  // exposed end while a smaller piece is asleep on its upper face.
  const base=release([.14,.80,.62]),upper=release([.07,.29,.15],base);
  assert(upper && base);
  const rest=upper.position.y;
  assert(rest>.14,'The smaller piece must actually be supported by the lower one, '+base.position.toArray()+' / '+upper.position.toArray());
  const end=base.localToWorld(new T.Vector3(.33,0,0));
  assert(wood.pickUpHit({object:base,kind:'logs',point:end}));
  assert.equal(wood.state.held,'logs');
  for(let i=0;i<180;i++)step();
  assert(upper.position.y<rest-.07 && upper.position.y>.018,'Unsupported split wood falls to a lower stable contact');
  assert.equal(wood.state.held,'logs','The pile settles independently while the lower piece is in hand');
  supported=false;
  // A throw beyond the collision world restores the same freshly cut wood.
  const shape=base.geometry;
  assert(wood.throwWood(new T.Vector3(0,-.3,1)));
  for(let i=0;i<360 && wood.state.inFlight;i++)step();
  assert.equal(wood.state.held,'logs');
  const recovered=scene.getObjectByName('Carrying firewood').children.find(m=>m.name==='Freshly split oak');
  assert.equal(recovered.geometry,shape,'Losing a custom throw preserves its exact cut shape in hand');
}

export function checkFirewood(model,space){
  checkLiftUnderPile(model,space);
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
  assert(fires.fuelLevel<strength);assert(Math.abs(fires.fuelSnapshot().logs - 228) < 1e-9);
  fires.setFirePitOn(false);const paused=fires.fuelSnapshot();
  now+=60;fires.update(camera,'yard',now);assert.deepEqual(fires.fuelSnapshot(),paused);
  fires.setFirePitOn(true);now+=11;fires.update(camera,'yard',now);
  assert.equal(fires.fuelSnapshot().twigs,0);
  assert(Math.abs(fires.fuelSnapshot().logs - 217) < 1e-9);assert.equal(deliveries,4);
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
  // A free throw has no destination anchor. Recover the same loose mesh
  // where the physics engine actually left it, even away from the stockpile.
  visit(wood.view);assert(wood.pickUp('logs'));
  visit(yard);
  const awayFromFire=camera.position.clone().sub(ring);awayFromFire.y=.06;awayFromFire.normalize();
  const fuelBefore=fires.fuelSnapshot(),deliveriesBefore=deliveries;
  assert(wood.throwWood(awayFromFire));
  const free=world.children.find(o=>o.isMesh && o.name==='Held logs');
  assert(free);
  for(let i=0;i<240 && wood.state.inFlight;i++){now+=1/30;wood.update(body,'yard',now);}
  assert(!wood.state.inFlight && free.parent===world,'A missed throw remains where it landed');
  assert.deepEqual(fires.fuelSnapshot(),fuelBefore);
  assert.equal(deliveries,deliveriesBefore);
  let freeHit;
  free.updateMatrixWorld(true);
  const surface=free.localToWorld(new T.Vector3(.07,.032,0));
  for(const range of [.74,1.05,1.4]){
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6,p=free.position;
      const spot=space.spawn(p.x+range*Math.cos(a),p.z+range*Math.sin(a),p.y+STANDING_EYE_HEIGHT);
      if(!spot || Math.abs(spot.y-p.y)>.45)continue;
      camera.position.set(spot.x,spot.y+spot.eye,spot.z);
      wood.update(spot,'yard',now);
      ray.set(camera.position,surface.clone().sub(camera.position).normalize());
      freeHit=wood.hitWood(ray);
      if(freeHit?.object===free)break;
    }
    if(freeHit?.object===free)break;
  }
  assert.equal(freeHit?.object,free);assert(wood.pickUpHit(freeHit));
  assert(!free.parent && wood.state.held==='logs','Pickup removes the exact settled piece');

}
