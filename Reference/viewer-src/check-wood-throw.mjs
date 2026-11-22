import assert from 'node:assert/strict';
import * as T from 'three';
import {Body,Box,Vec3} from 'cannon-es';
import {createThrowMotion} from './toss-motion.js';

function landscape(incline,wall){
  const floor=new Body({shape:new Box(new Vec3(15,.3,15))});
  floor.quaternion.setFromEuler(0,0,incline);
  floor.position.copy(floor.quaternion.vmult(new Vec3(0,-.3,0)));
  const fence=new Body({shape:new Box(new Vec3(.035,.85,2))});
  fence.position.set(1.2,.85,0);
  floor.aabbNeedsUpdate=fence.aabbNeedsUpdate=true;
  const apron=new Body({shape:new Box(new Vec3(10,.15,10)),position:new Vec3(0,-.35,0)});
  return {sync(world){
    if(world.bodies.includes(floor))return;
    world.addBody(floor);
    if(incline)world.addBody(apron);
    if(wall)world.addBody(fence);
  }};
}

function simulate({incline=0,wall=false,fps=120,velocity=[1.8,.4,0],raised=false,obstacles=[]}={}){
  const geometry=new T.CylinderGeometry(.072,.072,.39,12).rotateZ(-Math.PI/2);
  const mesh=new T.Mesh(geometry);
  mesh.position.set(0,raised?.55:1.1,0);
  const motion=createThrowMotion({kind:'logs',mesh,velocity:new T.Vector3(...velocity),colliders:landscape(incline,wall),obstacles});
  const path=[];
  for(let i=1;i<=fps*7;i++){
    const settled=motion.sample(i/fps,mesh);
    path.push(mesh.position.clone());
    if(settled)return {path,mesh,end:mesh.position.clone()};
  }
  assert.fail('The wood never settled at '+JSON.stringify(mesh.position));
}

const flat=simulate();
const firstTouch=flat.path.findIndex((p,i,path)=>i>0&&i<path.length-1&&path[i-1].y>p.y&&path[i+1].y>p.y);
assert(firstTouch>0,'No rebound on the first impact');
assert(flat.path.slice(firstTouch+1).some(p=>p.y>flat.path[firstTouch].y+.022),'Rebound never lifted the log');
assert(flat.end.y>.055&&flat.end.y<.082,'Flat-ground rest height');
const slow=simulate({fps:30});
assert(flat.end.distanceTo(slow.end)<1e-6,'Frame rate changed the resting position');

// Throw across the fall line. Gravity must deflect the log downhill in X,
// including during the roll after its first contact with the inclined ground.
const cross=simulate({incline:-.28,velocity:[0,.12,2.1]}),control=simulate({velocity:[0,.12,2.1]});
assert(cross.end.x>control.end.x+.12,'Cross-slope throw did not turn downhill');
const blocked=simulate({wall:true,velocity:[4,.1,0]});
assert(Math.max(...blocked.path.map(p=>p.x))<1.185,'The thin wall was crossed');
assert(blocked.path.some((p,i)=>i>0&&p.x<blocked.path[i-1].x-.001),'The wall produced no rebound');
const lower=simulate({raised:true,velocity:[0,0,0]});
const upper=simulate({raised:true,velocity:[0,0,0],obstacles:[lower.mesh]});
assert(upper.end.y>lower.end.y+.08 || Math.hypot(upper.end.x-lower.end.x,upper.end.z-lower.end.z)>.12,'The second piece settled through the first');
const lost=new T.Mesh(new T.BoxGeometry(.2,.04,.05));
const beyondEdge=createThrowMotion({kind:'sticks',mesh:lost,velocity:new T.Vector3(2,-.2,0),colliders:{sync(){}}});
assert(beyondEdge.sample(4)&&beyondEdge.lost,'Missing ground must release the throw');
console.log('Gravity, impact, cross-slope deflection, thin wall, wood contact, settling and frame-rate checks passed.');
