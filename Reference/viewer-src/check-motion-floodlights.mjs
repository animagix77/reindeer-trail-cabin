import assert from 'node:assert/strict';
import test from 'node:test';
import {Scene,Group,Mesh,BoxGeometry,MeshStandardMaterial,Vector3} from 'three';
import {installMotionFloodlights} from './motion-floodlights.js';
import {installCafeLights} from './cafe-lights.js';

// Walking eye positions of the mapped driveway spawn and photographed front approach.
const driveway=new Vector3(9.792,1.573,-11.076);
const entrance=new Vector3(-4.126,3.931,-16.065);
const bedroom=new Vector3(-7,4.47,-8.5);
const deckThreshold=new Vector3(-5.443,4.38,-1.127);
const backyard=new Vector3(-.445,2.454,9.449);
function setup(t){
  const world=new Scene(),model=new Group(),lens=new MeshStandardMaterial();
  lens.name='Garage · opal lamp faces';
  model.add(new Mesh(new BoxGeometry(),lens));world.add(model);
  const sensors=installMotionFloodlights(world,model,()=>{});
  t.after(()=>sensors.dispose());
  const drive=world.getObjectByName('Driveway motion flood'),front=world.getObjectByName('Front entry motion flood');
  const rear=world.getObjectByName('Rear deck motion flood');
  const rearLens=world.getObjectByName('Rear deck · twin motion floodlight').children[1].material;
  return {drive,front,rear,lens,rearLens,update:(...args)=>sensors.update(...args)};
}
test('each motion flood lights its own night approach and sleeps between transitions',t=>{
  const {drive,front,lens,update}=setup(t);
  // Center of each real stair flight in the shipped model. The brightest
  // part of each broad beam must catch the treads as well as the near paving.
  for(const [lamp,tread] of [[drive,new Vector3(4.51,.69,-10.87)],[front,new Vector3(-4.57,2.51,-11.36)]]){
    const aim=lamp.target.position.clone().sub(lamp.position);
    assert(aim.angleTo(tread.sub(lamp.position))<.36);
  }
  update(driveway,true,1,0,true);assert.equal(drive.intensity,0);
  assert.equal(update(driveway,true,0,1,true),true);
  assert.equal(update(driveway,true,0,1.25,true),false);
  assert(drive.intensity>0 && lens.emissiveIntensity>0);assert.equal(front.intensity,0);
  // Looking or breathing in place must not continually reset the timer.
  update(driveway.clone().add(new Vector3(0,.015,0)),true,0,15,true);
  assert.equal(update(driveway,true,0,26.55,true),true);
  const fading=drive.intensity;assert(fading>0 && fading<285);
  // A step while the lamp fades brings it back up from its current brightness.
  const step=driveway.clone().add(new Vector3(.25,0,0));
  update(step,true,0,26.55,true);assert.equal(drive.intensity,fading);
  update(step,true,0,27,true);assert(drive.intensity>fading);
  update(entrance,true,0,28,true);update(entrance,true,0,28.3,true);
  assert(front.intensity>0);
  update(entrance,true,0,52,true);assert(drive.intensity<285);
  update(entrance,true,0,56,true);assert.equal(drive.intensity,0);assert.equal(front.intensity,0);
});
test('daylight, cutaway and movement inside the front wall do not trip the sensors',t=>{
  const {drive,front,update}=setup(t);
  update(entrance,true,.63,0,true);update(entrance,true,.63,1,true);
  update(bedroom,true,0,2,true);update(bedroom,true,0,3,true);
  update(entrance,false,0,4,true);update(entrance,false,0,5,true);
  update(entrance,true,0,6,false);update(entrance,true,0,7,false);
  assert.equal(drive.intensity,0);assert.equal(front.intensity,0);
  update(entrance,true,0,8,true);update(entrance,true,0,8.3,true);assert(front.intensity>0);
  update(entrance,true,1,9,true);assert.equal(front.intensity,0);
});
test('the back fixture lights the deck threshold and yard independently of both front approaches',t=>{
  const {drive,front,rear,rearLens,update}=setup(t);
  for(const [eye,start] of [[deckThreshold,0],[backyard,40]]){
    update(eye,true,0,start,true);update(eye,true,0,start+.3,true);
    assert(rear.intensity>0 && rearLens.emissiveIntensity>0);
    assert.equal(front.intensity,0);assert.equal(drive.intensity,0);
    update(eye,true,0,start+28,true);assert.equal(rear.intensity,0);
  }
  update(backyard,true,1,70,true);update(backyard,true,1,71,true);
  assert.equal(rear.intensity,0);
  update(backyard,false,0,72,true);update(backyard,false,0,73,true);
  assert.equal(rear.intensity,0);
  assert(rear.target.position.y<rear.position.y);
  assert.equal([drive,front,rear].filter(lamp=>lamp.castShadow).length,2);
});
test('café lights cast steady pools on the deck, pergola and picnic area after dark',()=>{
  const scene=new Scene(), model=new Group();
  for(const name of ['Deck','Pergola','Picnic']){
    const marker=new Group();marker.name='FestoonPool_'+name;marker.position.y=3;model.add(marker);
  }
  const lighting=installCafeLights(scene,model), lamps=scene.children.filter(x=>x.isPointLight);
  assert.equal(lamps.length,3);
  lighting.set(0);
  for(const lamp of lamps){
    assert(lamp.intensity>=28 && lamp.distance>=8);
    assert(lamp.position.y>0 && lamp.position.y<3);
    assert.equal(lamp.castShadow,false);
  }
  lighting.set(1);
  assert(lamps.every(lamp=>lamp.intensity<.5));
});
