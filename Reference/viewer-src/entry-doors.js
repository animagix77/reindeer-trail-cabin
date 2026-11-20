import * as THREE from 'three';

// The outer flyscreen swings toward the landing. The inset burgundy leaf
// swings into the hall. Blender supplies their closed positions and pin axes.
export function installEntryDoors(model,invalidateShadows=()=>{}){
  const inner=model.getObjectByName('FrontDoorHinge');
  const screen=model.getObjectByName('FrontScreenHinge');
  if(!inner || !screen)return null;
  const threshold=inner.matrixWorld.clone().invert();
  const center=new THREE.Vector3(),last=new THREE.Vector3(Infinity,Infinity,Infinity);
  const up=new THREE.Vector3(0,1,0);
  const leaves=[
    {hinge:inner,closed:inner.quaternion.clone(),direction:1},
    {hinge:screen,closed:screen.quaternion.clone(),direction:-1}
  ];
  let fraction=0,open=false,lastTime=null;
  return {update(camera,walking,seconds){
    center.copy(camera.position).applyMatrix4(threshold);
    const depth=Math.abs(center.z);
    const inLane=walking && center.y>.42 && center.y<2.5 && center.x>-.12 && center.x<1.10;
    if(!inLane || depth>3.0)open=false;
    else if(depth<2.38)open=true;
    const teleport=last.distanceToSquared(camera.position)>.8**2;
    const dt=lastTime===null?0:THREE.MathUtils.clamp(seconds-lastTime,0,.1);
    lastTime=seconds;last.copy(camera.position);
    const target=open?1:0;
    // Arriving directly in the doorway must never place a leaf through the
    // visitor. The open pin-side footprints then protect each parked leaf.
    const insideSweep=walking && center.y>.42 && center.y<2.5 &&
      center.x>-.10 && center.x<1.08 && depth<1.39;
    const next=insideSweep?1:(!walking||teleport)?target:
      THREE.MathUtils.clamp(target,fraction-1.55*dt,fraction+2.05*dt);
    if(next===fraction)return false;
    fraction=next;
    const angle=THREE.MathUtils.smootherstep(fraction,0,1)*Math.PI/2;
    for(const leaf of leaves){
      leaf.hinge.quaternion.copy(leaf.closed).multiply(
        rotation.setFromAxisAngle(up,angle*leaf.direction)
      );
      leaf.hinge.updateMatrixWorld(true);
    }
    invalidateShadows();return fraction!==target;
  }};
}
const rotation=new THREE.Quaternion();
