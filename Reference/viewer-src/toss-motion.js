import * as T from 'three';
import {ConvexHull} from 'three/addons/math/ConvexHull.js';
import {Body, ConvexPolyhedron, Cylinder, SAPBroadphase, Sphere, Vec3, World} from 'cannon-es';

export function tossArc(out,start,contact,duration,t){
  out.lerpVectors(start,contact,t);
  out.y+=.5*9.81*duration*duration*t*(1-t);
  return out;
}

const step=1/180;
const responses={
  // Resistance is applied only at a supporting contact. Small branches catch
  // on their forks, greens crumple, and an apple can roll on its rounded skin.
  logs:       {mass:2.1,  bounce:.25, grip:.57, resistance:.62, spin:3.6},
  sticks:     {mass:.18,  bounce:.30, grip:.52, resistance:1.1, spin:6.1},
  twigs:      {mass:.055, bounce:.16, grip:.65, resistance:1.7, spin:6.8},
  apple:      {mass:.16,  bounce:.25, grip:.50, resistance:1.7, spin:4.5},
  carrot:     {mass:.08,  bounce:.13, grip:.54, resistance:1.6, spin:5.1},
  vegetables: {mass:.034, bounce:.07, grip:.70, resistance:2.3, spin:3.2}
};

const profiles=new WeakMap();
function contactProfile(geometry){
  let profile=profiles.get(geometry);
  if(profile)return profile;
  geometry.computeBoundingBox();
  const bounds=geometry.boundingBox,center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
  const attr=geometry.attributes.position,points=new Map();
  // Preserve the flat cleft and the extent of projecting forks, without
  // feeding decorative bark ridges or thousands of grain triangles to SAT.
  for(const end of [-1,0,1])for(let i=0;i<12;i++){
    const a=i*Math.PI/6,dx=end/(size.x||1),dy=Math.cos(a)/(size.y||1),dz=Math.sin(a)/(size.z||1);
    let score=-Infinity,index=0;
    for(let j=0;j<attr.count;j++){
      const dot=attr.getX(j)*dx+attr.getY(j)*dy+attr.getZ(j)*dz;
      if(dot>score){score=dot;index=j;}
    }
    const p=new T.Vector3().fromBufferAttribute(attr,index).sub(center);
    points.set(p.toArray().join(','),p);
  }
  const hull=new ConvexHull().setFromPoints([...points.values()]);
  const vertices=[],index=new Map(),faces=[],visited=new Set();
  for(const face of hull.faces){
    if(visited.has(face))continue;
    // Cannon clips against polygonal faces. Remove triangulation diagonals,
    // which would otherwise act like small edges across the flat split face.
    const group=[face],region=new Set(group),boundary=new Map();
    visited.add(face);
    for(let i=0;i<group.length;i++){
      let edge=group[i].edge;
      do{
        const adjacent=edge.twin.face;
        if(!visited.has(adjacent) && face.normal.dot(adjacent.normal)>1-1e-8){
          visited.add(adjacent);region.add(adjacent);group.push(adjacent);
        }
        if(!region.has(adjacent))boundary.set(edge.tail().point,edge.head().point);
        edge=edge.next;
      }while(edge!==group[i].edge);
    }
    const first=boundary.keys().next().value,indices=[];
    let p=first;
    do{
      if(!index.has(p)){index.set(p,vertices.length);vertices.push(p);}
      indices.push(index.get(p));p=boundary.get(p);
    }while(p!==first);
    faces.push(indices);
  }
  // The centre of the bounding box can lie outside a forked branch or a thin
  // triangular billet. A convex combination of hull vertices is internal.
  const centroid=vertices.reduce((sum,p)=>sum.add(p),new T.Vector3()).divideScalar(vertices.length);
  center.add(centroid);
  for(const p of vertices)p.sub(centroid);
  profile={center,vertices,faces};profiles.set(geometry,profile);
  return profile;
}

function rigidBody(mesh,kind,mass){
  const scale=mesh.getWorldScale(new T.Vector3()),rotation=mesh.getWorldQuaternion(new T.Quaternion());
  const center=new T.Vector3(),position=mesh.getWorldPosition(new T.Vector3());
  let shape;
  if(kind==='apple'){
    shape=new Sphere(.043*scale.x);center.y=-.001*scale.y;
  }else if(kind==='carrot'){
    shape=new Cylinder(.017*scale.x,.004*scale.x,.165*scale.y,9);center.y=-.012*scale.y;
  }else{
    const profile=contactProfile(mesh.geometry);
    center.copy(profile.center).multiply(scale);
    const vertices=profile.vertices.map(p=>new Vec3(p.x*scale.x,p.y*scale.y,p.z*scale.z));
    shape=new ConvexPolyhedron({vertices,faces:profile.faces});
  }
  position.add(center.clone().applyQuaternion(rotation));
  const body=new Body({mass,shape,linearDamping:.016,angularDamping:.065,sleepSpeedLimit:.14,sleepTimeLimit:.26});
  body.position.copy(position);body.quaternion.copy(rotation);
  body.aabbNeedsUpdate=true;body.updateInertiaWorld(true);
  return {body,center};
}

// The scene and its fixed colliders use metres. A throw owns one short-lived
// world so there is no global simulation cost after the object comes to rest.
export function createThrowMotion({kind,mesh,velocity,massKg,colliders,obstacles=[],spin=true}){
  const response=responses[kind];
  const world=new World({gravity:new Vec3(0,-9.81,0),allowSleep:true});
  world.broadphase=new SAPBroadphase(world);
  world.broadphase.useBoundingBoxes=true;
  world.narrowphase.enableFrictionReduction=true;
  world.solver.iterations=14;
  Object.assign(world.defaultContactMaterial,{
    friction:response.grip,restitution:response.bounce,contactEquationStiffness:3e6
  });
  const {body,center}=rigidBody(mesh,kind,massKg??response.mass);
  body.velocity.copy(velocity);
  if(spin){
    const heading=Math.atan2(velocity.x,velocity.z);
    body.angularVelocity.set(Math.cos(heading)*response.spin,.68,-Math.sin(heading)*response.spin);
  }
  world.addBody(body);
  const obstacleMeshes=new Map(),supports=new Set();
  for(const obstacle of obstacles){
    if(obstacle===mesh || !obstacle.geometry)continue;
    const solid=rigidBody(obstacle,obstacle.userData.throwKind,0).body;
    obstacleMeshes.set(solid,obstacle);world.addBody(solid);
  }
  const offset=new T.Vector3(),rotation=new T.Quaternion(),impactVelocity=new Vec3();
  const restPoint=new Vec3(),restRotation=new T.Quaternion();
  let stepped=0,quietTime=0,recentContact=0,lastSurface=body.position.y,lost=false;
  return {
    supports,
    get lost(){return lost;},
    sample(age,target=mesh){
      // A resumed background tab catches up in bounded chunks. A slow draw
      // frame takes exactly the same physics steps as many quick draw frames.
      const goal=Math.min(Math.floor(age/step+1e-8),stepped+720);
      while(stepped<goal && body.sleepState!==Body.SLEEPING && !lost){
        colliders.sync(world,body.position);
        impactVelocity.copy(body.velocity);impactVelocity.y-=9.81*step;
        world.step(step);stepped++;
        let support=0;
        for(const contact of world.contacts){
          const sign=contact.bi===body?-1:1,n=contact.ni;
          // Adjacent facets can produce simultaneous impulses, each trying to
          // resolve the same incoming motion. Limit their combined rebound to
          // the material's restitution while preserving tangential deflection.
          const approach=-impactVelocity.dot(n)*sign;
          if(approach>.28){
            const excess=body.velocity.dot(n)*sign-approach*response.bounce;
            if(excess>0)body.velocity.addScaledVector(-sign*excess,n,body.velocity);
          }
          const up=sign*n.y;
          if(up<=.15)continue;
          if(!support)supports.clear();
          support=Math.max(support,up);
          const mesh=obstacleMeshes.get(contact.bi===body?contact.bj:contact.bi);
          if(mesh)supports.add(mesh);
        }
        if(support>.48){
          lastSurface=body.position.y;
          const rate=Math.exp(-response.resistance*step);
          body.angularVelocity.scale(rate,body.angularVelocity);
          // Rolling resistance is a contact loss proportional to the normal
          // load, not air drag. The solver still supplies downhill acceleration.
          const speed=body.velocity.length();
          const loss=response.resistance*step;
          if(speed>0)body.velocity.scale(Math.max(0,1-loss/speed),body.velocity);
        }
        // Rest on a multi-point support can alternate between contact faces
        // from one step to the next. Sleep only if the object stays inside a
        // small pose tolerance on that support for the entire quiet interval.
        recentContact=world.contacts.length?.05:Math.max(0,recentContact-step);
        if(!recentContact || body.velocity.lengthSquared()>.14 ||
          restPoint.distanceSquared(body.position)>.012**2 ||
          Math.abs(restRotation.dot(rotation.copy(body.quaternion)))<.997){
          quietTime=0;restPoint.copy(body.position);restRotation.copy(body.quaternion);
        }else quietTime+=step;
        if(quietTime>.36)body.sleep();
        lost=body.position.y<lastSurface-25 && body.velocity.y<-10;
      }
      rotation.copy(body.quaternion);
      target.position.copy(body.position).sub(offset.copy(center).applyQuaternion(rotation));
      target.quaternion.copy(rotation);
      return lost || body.sleepState===Body.SLEEPING;
    }
  };
}
