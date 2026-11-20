import assert from 'node:assert/strict';
import test from 'node:test';
import {Scene,Group,Mesh,BoxGeometry,MeshStandardMaterial,Vector3} from 'three';
import {installMotionFloodlights} from './motion-floodlights.js';

// Walking eye positions of the mapped driveway spawn and photographed front approach.
const driveway=new Vector3(9.792,1.573,-11.076);
const entrance=new Vector3(-4.126,3.931,-16.065);
const bedroom=new Vector3(-7,4.47,-8.5);
function setup(t){
  const world=new Scene(),model=new Group(),lens=new MeshStandardMaterial();
  lens.name='Garage · opal lamp faces';
  model.add(new Mesh(new BoxGeometry(),lens));world.add(model);
  const sensors=installMotionFloodlights(world,model,()=>{});
  t.after(()=>sensors.dispose());
  const drive=world.getObjectByName('Driveway motion flood'),front=world.getObjectByName('Front entry motion flood');
  return {drive,front,lens,update:(...args)=>sensors.update(...args)};
}
test('each motion flood lights its own night approach and sleeps between transitions',t=>{
  const {drive,front,lens,update}=setup(t);
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
