import assert from 'node:assert/strict';
import * as THREE from 'three';
import {installCafeLights} from './cafe-lights.js';
import {batchStatic} from './batch.js';

export function checkCafeLightSway(source,fromPlan){
  const world=new THREE.Scene(),model=new THREE.Group();
  world.add(model);
  const names=['Soft black cord','Cafe lights · clear teardrop glass','String bulbs · amber filament'];
  const meshes=[];
  source.traverse(original=>{
    const slot=names.indexOf(original.material?.name);
    if(slot<0 && !/^(FestoonPool_|WalkBlock_LightPole)/.test(original.name))return;
    const part=original.clone(false);
    original.matrixWorld.decompose(part.position,part.quaternion,part.scale);
    model.add(part);
    if(slot>=0){part.geometry=part.geometry.clone();meshes[slot]=part;}
  });
  world.updateMatrixWorld(true);
  const reduced={matches:false};
  const light=installCafeLights(world,model,fromPlan,reduced);
  batchStatic(model);
  const glow=world.getObjectByName('Warm cafe lights · deck and pergola');
  const positions=part=>part.geometry.attributes.position;
  const halos=positions(glow);
  assert.equal(halos.count,50,'Expected all fifty modeled pendants');
  for(const mesh of meshes)assert(mesh.visible && mesh.morphTargetInfluences.length===2);
  const camera=new THREE.PerspectiveCamera(65,1.4,.05,150);
  const deck=model.getObjectByName('FestoonPool_Deck').position,pergola=model.getObjectByName('FestoonPool_Pergola').position;
  camera.position.copy(pergola).add(new THREE.Vector3(3,-.5,3));
  camera.lookAt(pergola);
  const update=(time,walking=true,outdoors=true)=>light.update(walking,800,camera,time,outdoors);
  const offset=(part,i)=>{
    const p=new THREE.Vector3(),v=new THREE.Vector3();
    for(const [j,shape] of part.geometry.morphAttributes.position.entries())
      p.addScaledVector(v.fromBufferAttribute(shape,i),part.morphTargetInfluences[j]);
    return p;
  };
  const cable=meshes[0],base=positions(cable);
  const pins=[];
  function pin(x,y,height){const p=fromPlan(x,y,0);p.y=height;pins.push(p);}
  for(const x of [23.30,32,40.70]){
    pin(x,35.84,deck.y+.20);pin(x,35.89,deck.y+.20-1.146);
  }
  pin(23.30,35.87,deck.y+.20);
  for(const x of [34.71,35.29])
    for(const y of [48.325,54.1,59.875])pin(x,y,pergola.y+.20);
  for(const id of [0,1]){
    const box=new THREE.Box3().setFromObject(model.getObjectByName('WalkBlock_LightPole'+id));
    const p=box.getCenter(new THREE.Vector3());p.y=box.max.y+.04;pins.push(p);
  }
  const fixed=pins.map(()=>[]),vertex=new THREE.Vector3();
  for(let i=0;i<base.count;i++){
    vertex.fromBufferAttribute(base,i).applyMatrix4(cable.matrixWorld);
    pins.forEach((pin,j)=>{if(vertex.distanceTo(pin)<.005)fixed[j].push(i);});
  }
  assert(fixed.every(indices=>indices.length>=6),'A mount is missing its actual cable end');
  const peak=new Float32Array(halos.count);
  for(const time of [1.73,4.51]){
    assert.equal(update(time),true);
    for(const indices of fixed)
      for(const i of indices)assert.equal(offset(cable,i).lengthSq(),0,'The wire moved on its mount');
    for(let i=0;i<halos.count;i++){
      const center=new THREE.Vector3().fromBufferAttribute(halos,i),delta=offset(glow,i);
      peak[i]=Math.max(peak[i],delta.length());
      assert(delta.length()<.034,'The sway exceeds the modeled light scale');
      for(const mesh of meshes){
        let count=0,wire=0,drop=0,socket=0;
        const pos=positions(mesh);
        for(let j=0;j<pos.count;j++){
          vertex.fromBufferAttribute(pos,j).applyMatrix4(mesh.matrixWorld);
          const dx=vertex.x-center.x,dz=vertex.z-center.z,dy=vertex.y-center.y;
          if(dx*dx+dz*dz>.024**2 || dy<-.036 || dy>.086)continue;
          assert(offset(mesh,j).distanceTo(delta)<.00001,'Lamp assembly separated from its halo or wire');
          count++;
          if(dy>.077)wire++;
          if(dy>.042 && dy<.052)drop++;
          if(dy>.022 && dy<.028)socket++;
        }
        assert(count>0,'Halo lacks corresponding '+mesh.material.name);
        if(mesh===cable)assert(wire && drop && socket,'Missing wire, drop or socket at a pendant');
      }
    }
  }
  assert(peak.every(amount=>amount>.00005),'A pendant failed to sway on one of the authored runs');
  assert(Math.max(...peak)>.012,'The free spans should move visibly');
  const lamps=world.children.filter(part=>part.isPointLight);
  assert.equal(lamps.length,3);
  for(const [day,powers,gain] of [[1,[.33,.33,.33],.10],[0,[38.33,30.33,28.33],1.28]]){
    light.set(day,'rain');
    update(10);
    assert.deepEqual(lamps.map(lamp=>lamp.intensity),powers);
    assert(Math.abs(glow.material.uniforms.gain.value-gain)<1e-5);
  }
  const pose=[...cable.morphTargetInfluences];
  update(400);update(10);
  assert.deepEqual(cable.morphTargetInfluences,pose,'Motion accumulated between visits');
  reduced.matches=true;
  assert.equal(update(21),false);assert(glow.visible);
  for(const part of [...meshes,glow])assert(part.morphTargetInfluences.every(value=>value===0));
  reduced.matches=false;
  assert.equal(update(21,false),false);assert(!glow.visible);
  assert.equal(update(21,true,false),false);
  camera.position.set(1000,0,0);assert.equal(update(21),false);
  camera.position.copy(pergola).addScalar(10);camera.lookAt(camera.position.clone().multiplyScalar(2));
  assert.equal(update(21),false);
}
