import assert from 'node:assert/strict';
import {Box3,Vector3} from 'three';
import {World,Vec3,RaycastResult} from 'cannon-es';
import {createThrowColliders} from './throw-colliders.js';

export function checkThrowColliders(model,space){
  const colliders=createThrowColliders(space,model),world=new World();
  const p=(x,y,z)=>new Vec3(x,y,z);
  function hit(from,to){
    colliders.sync(world,from);
    const result=new RaycastResult();
    assert(world.raycastClosest(from,to,{},result),'Wood needs a solid contact at '+from);
    return result;
  }
  const ring=new Box3().setFromObject(model.getObjectByName('WalkBlock_FireRing'),true);
  const {x,z}=ring.getCenter(new Vector3()),base=ring.min.y+.010;
  const topAt=(dx,dz)=>hit(p(x+dx,base+.68,z+dz),p(x+dx,base-.2,z+dz)).hitPointWorld.y-base;
  assert(topAt(.482,0)>.32,'The log can hit the actual narrow steel lip');
  assert(colliders.blockedSegment(p(x+.8,base+.14,z),p(x+.54,base+.14,z)),'Stop a release through the near ring wall');
  assert(!colliders.blockedSegment(p(x+.8,base+.55,z),p(x+.54,base+.55,z)),'Allow a release above the same rim');
  const center=topAt(0,0);
  assert(center>.015 && center<.22,'The pit is hollow above its fuel bed');
  const wall=hit(p(x+.88,base+.16,z),p(x+.24,base+.16,z));
  assert(Math.abs(wall.hitPointWorld.x-x-.674)<.035,'Throws hit the outer stone face from the side');

  const backdrop=model.getObjectByName('Backdrop_Woodland_terrain');
  const mesh=backdrop.isMesh?backdrop:backdrop.children.find(o=>o.isMesh);
  const geo=mesh.geometry,index=geo.index,vertices=geo.attributes.position;
  let sampled=false;
  for(let i=0;i<(index?.count??vertices.count);i+=3){
    const triangle=[0,1,2].map(j=>new Vector3().fromBufferAttribute(vertices,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));
    const mid=triangle.reduce((sum,v)=>sum.add(v),new Vector3()).multiplyScalar(1/3);
    const [a,b,c]=triangle,normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    if(Math.hypot(mid.x-x,mid.z-z)<35 || normal.y<.6 || normal.y>.985)continue;
    const contact=hit(p(mid.x,mid.y+.25,mid.z),p(mid.x,mid.y-.25,mid.z));
    assert(Math.abs(contact.hitPointWorld.y-mid.y)<.001,'Outer terrain supports wood at its rendered height');
    assert(normal.dot(contact.hitNormalWorld)>.999,'The terrain imparts the authored downhill normal');
    sampled=true;break;
  }
  assert(sampled,'Expected a sloped triangle beyond the walkable parcel');
  colliders.sync(world,p(500,200,500));
  assert.equal(world.bodies.length,0,'Colliders retire when an object leaves the modeled grounds');
  assert(Math.abs(topAt(.482,0)-.333)<.005,'Returning to the yard restores the same ring');
}
