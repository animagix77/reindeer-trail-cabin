import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Body, Box, ConvexPolyhedron, Cylinder, Heightfield, Quaternion, SAPBroadphase, Vec3, World} from 'cannon-es';

const stepSize=1/60, terrainSize=6, terrainCells=18, batchSize=16;

function prism(hull,height){
  // Keep the visible bark profile at full resolution. Its collision polygon
  // can lose vertices while the maximum local chord deviation is below 4 mm.
  hull=hull.slice();
  while(hull.length>4){
    let nearest=-1,error=.004;
    for(let i=0;i<hull.length;i++){
      const a=hull[(i+hull.length-1)%hull.length],b=hull[i],c=hull[(i+1)%hull.length];
      const dx=c.x-a.x,dz=c.z-a.z;
      const deviation=Math.abs(dx*(b.z-a.z)-dz*(b.x-a.x))/Math.hypot(dx,dz);
      if(deviation<error){nearest=i;error=deviation;}
    }
    if(nearest<0)break;
    hull.splice(nearest,1);
  }
  const n=hull.length,vertices=[],faces=[],bottom=[],top=[];
  for(let i=0;i<n;i++){
    const {x,z}=hull[i],j=(i+1)%n;
    vertices.push(new Vec3(x,-height/2,z),new Vec3(x,height/2,z));
    bottom.push(2*i);top.unshift(2*i+1);
    faces.push([2*i,2*i+1,2*j+1,2*j]);
  }
  faces.push(bottom,top);
  return new ConvexPolyhedron({vertices,faces});
}

// Keep sleeping pieces as independent collision bodies. Combine their draw calls in
// small groups. Removing or waking one restores that group's individual meshes.
function batchResting(records,root){
  const meshes=records.map(r=>r.mesh);
  const byMaterial=new Map(),geometries=[];
  let offset=0;
  for(const mesh of meshes){
    mesh.updateMatrix();
    const g=mesh.geometry.clone().applyMatrix4(mesh.matrix);
    const groups=g.groups.length?g.groups:[{start:0,count:g.index?.count??g.attributes.position.count,materialIndex:0}];
    for(const {start,count,materialIndex} of groups){
      const material=Array.isArray(mesh.material)?mesh.material[materialIndex]:mesh.material;
      if(!byMaterial.has(material))byMaterial.set(material,[]);
      const target=byMaterial.get(material);
      for(let i=start;i<start+count;i++)target.push(offset+(g.index?g.index.getX(i):i));
    }
    g.setIndex(null);g.clearGroups();geometries.push(g);offset+=g.attributes.position.count;
  }
  const geometry=mergeGeometries(geometries);
  for(const g of geometries)g.dispose();
  const materials=[...byMaterial.keys()],indices=[...byMaterial.values()];
  geometry.setIndex(indices.flat());let start=0;
  indices.forEach((group,i)=>{if(group.length)geometry.addGroup(start,group.length,i);start+=group.length;});
  geometry.computeBoundingSphere();
  const batch=new T.Mesh(geometry,materials);
  batch.name='Settled split wood';batch.castShadow=batch.receiveShadow=true;root.add(batch);
  const unpack=()=>{
    batch.removeFromParent();geometry.dispose();
    for(const item of records){item.mesh.visible=true;item.unpack=null;}
  };
  for(const item of records){item.mesh.visible=false;item.unpack=unpack;}
}

export function createSplitPhysics({root,groundAt,onContact,onSupport,onStockWood}){
  const world=new World({gravity:new Vec3(0,-9.81,0),allowSleep:true});
  world.broadphase=new SAPBroadphase(world);
  world.broadphase.useBoundingBoxes=true;
  world.solver.iterations=10;
  world.narrowphase.enableFrictionReduction=true;
  Object.assign(world.defaultContactMaterial,{friction:.61,restitution:.075,contactEquationStiffness:3e6});
  const tiles=new Map(),pieces=[],matrix=new T.Matrix4(),center=new T.Vector3(),size=new T.Vector3();
  let accumulator=0,active=false,regroup=false,collisionSpeed=0,nextSound=0;
  let pileChanged=true,hasBlockWood=false;
  const groundStock=[];
  function addTile(ix,iz){
    const key=ix+','+iz;if(tiles.has(key))return;
    const left=ix*terrainSize-terrainSize/2,far=iz*terrainSize+terrainSize/2,spacing=terrainSize/terrainCells;
    const data=Array.from({length:terrainCells+1},(_,i)=>
      Array.from({length:terrainCells+1},(_,j)=>{
        const y=groundAt(left+i*spacing,far-j*spacing);return Number.isFinite(y)?y:0;
      }));
    const shape=new Heightfield(data,{elementSize:spacing});tiles.set(key,shape);
    const body=new Body({mass:0,shape});
    body.quaternion.setFromAxisAngle(new Vec3(1,0,0),-Math.PI/2);
    body.position.set(left,0,far);body.aabbNeedsUpdate=true;world.addBody(body);
  }
  function cover(x,z){
    for(let i=Math.floor((x+terrainSize/2-.55)/terrainSize);i<=Math.floor((x+terrainSize/2+.55)/terrainSize);i++)
      for(let j=Math.floor((z+terrainSize/2-.55)/terrainSize);j<=Math.floor((z+terrainSize/2+.55)/terrainSize);j++)addTile(i,j);
  }
  function solid(mesh,transform,box=false){
    mesh.geometry.computeBoundingBox();
    const bounds=mesh.geometry.boundingBox;
    bounds.getCenter(center).applyMatrix4(transform);bounds.getSize(size);
    const p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();transform.decompose(p,q,s);size.multiply(s);
    const radius=(size.x+size.z)*.25;
    const shape=box?new Box(new Vec3(size.x/2,size.y/2,size.z/2)):new Cylinder(radius*.98,radius,size.y,16);
    const body=new Body({mass:0,shape});
    body.position.copy(center);body.quaternion.copy(q);body.aabbNeedsUpdate=true;world.addBody(body);return body;
  }
  const stump=root.getObjectByName('Scored chopping stump'),round=root.getObjectByName('Unsplit round');
  let stumpTop=.47,stumpBody=null;
  if(stump){
    stump.updateMatrix();stumpBody=solid(stump,stump.matrix);stumpTop=stump.geometry.boundingBox.max.y+stump.position.y;
  }
  for(const name of ['Unsplit oak rounds','Split log cradle']){
    const stock=root.getObjectByName(name);
    if(stock)for(let i=0;i<stock.count;i++){stock.getMatrixAt(i,matrix);solid(stock,matrix,name==='Split log cradle');}
  }
  let onBlock=null,onBlockGeometry=null;
  function clearBlank(){
    if(onBlock)world.removeBody(onBlock);
    onBlock=onBlockGeometry=null;
  }
  const turn=new T.Quaternion(),previous=new T.Quaternion();
  function syncBlank(duration){
    if(!round?.visible){clearBlank();return;}
    round.updateMatrix();
    if(onBlockGeometry!==round.geometry || !onBlock){
      clearBlank();onBlock=solid(round,round.matrix);onBlock.type=Body.KINEMATIC;
      onBlock.allowSleep=false;onBlockGeometry=round.geometry;
    }
    round.geometry.boundingBox.getCenter(center).applyMatrix4(round.matrix);
    const b=onBlock;
    previous.copy(b.quaternion).invert();turn.copy(round.quaternion).multiply(previous);
    if(turn.w<0)turn.set(-turn.x,-turn.y,-turn.z,-turn.w);
    const moved=b.position.distanceSquared(center)>1e-12 || 1-turn.w>1e-10;
    b.velocity.set(0,0,0);b.angularVelocity.set(0,0,0);
    if(!moved || !duration)return;
    b.velocity.set((center.x-b.position.x)/duration,(center.y-b.position.y)/duration,(center.z-b.position.z)/duration);
    const sine=Math.hypot(turn.x,turn.y,turn.z);
    if(sine>1e-7){
      const scale=2*Math.atan2(sine,turn.w)/(duration*sine);b.angularVelocity.set(turn.x*scale,turn.y*scale,turn.z*scale);
    }
    for(const {body} of pieces)if(body.sleepState===Body.SLEEPING && body.position.distanceSquared(center)<.45*.45)body.wakeUp();
    active=true;
  }
  // Follow real load-bearing contacts from the stump up through any stacked
  // pieces. Sleeping bodies keep their last support until something wakes them.
  function updateSupport(){
    if(!stumpBody)return;
    const resting=new Set([stumpBody]);
    for(const item of pieces)
      if(item.supported && item.body.sleepState===Body.SLEEPING)resting.add(item.body);
    let grew=true;
    while(grew){
      grew=false;
      for(const {bi,bj,ni} of world.contacts){
        if(Math.abs(ni.y)<.28)continue;
        const upper=ni.y>0?bj:bi,lower=ni.y>0?bi:bj;
        if(resting.has(upper)||!resting.has(lower)||upper.mass<=0||Math.hypot(upper.position.x,upper.position.z)>.32)continue;
        resting.add(upper);grew=true;
      }
    }
    for(const item of pieces){
      const b=item.body;
      const supported=resting.has(b) && b.velocity.lengthSquared()<.40**2 && b.angularVelocity.lengthSquared()<2.1**2;
      if(item.supported!==supported){
        item.supported=supported;
        if(item.choppable){if(supported)item.unpack?.();onSupport?.(item.mesh,supported);}
      }
    }
  }
  function collision({contact}){
    collisionSpeed=Math.max(collisionSpeed,Math.abs(contact.getImpactVelocityAlongNormal()));
  }
  function release(fragments,cut,parent){
    clearBlank();
    const old=parent && pieces.find(item=>item.mesh===parent);
    if(old){old.unpack?.();pieces.splice(pieces.indexOf(old),1);world.removeBody(old.body);}
    for(const {mesh,hull,height,density=730,side,choppable=false} of fragments){
      let twiceArea=0;
      for(let i=0;i<hull.length;i++){const a=hull[i],b=hull[(i+1)%hull.length];twiceArea+=a.x*b.z-b.x*a.z;}
      const shape=prism(hull,height);
      const mass=density*height*Math.abs(twiceArea)/2;
      const body=new Body({mass,shape,allowSleep:true,sleepSpeedLimit:.48,sleepTimeLimit:.52,
        linearDamping:.13,angularDamping:.44});
      body.position.copy(mesh.position);body.quaternion.copy(mesh.quaternion);body.aabbNeedsUpdate=true;
      if(mesh.parent!==root)root.add(mesh);
      cover(body.position.x,body.position.z);
      world.addBody(body);
      if(old){
        const apart=body.position.vsub(old.body.position);
        old.body.angularVelocity.cross(apart,body.velocity);
        body.velocity.vadd(old.body.velocity,body.velocity);
        body.angularVelocity.copy(old.body.angularVelocity);
      }
      // Most of the stroke enters the block. A large face spreads by a few
      // centimetres; a light offcut catches more speed and is easier to tip.
      const energy=Math.min(1,Math.max(0,cut.energy??1));
      const speed=Math.min(choppable?1.05:1.7,(choppable?.61:1.45)/Math.sqrt(Math.max(.22,mass)))*(.74+.26*energy);
      const impulse=mass*speed,up=choppable?.018:.10;
      const offset=new Vec3(cut.x-body.position.x,Math.min(.42*height,(cut.y??stumpTop+height)-body.position.y),cut.z-body.position.z);
      body.applyImpulse(new Vec3(side*cut.nx*impulse,(side*(cut.ny??0)*speed+up)*mass,side*cut.nz*impulse),offset);
      const item={mesh,body,choppable,supported:false,unpack:null,nudges:0,restAt:world.time,restPos:body.position.clone(),restRot:body.quaternion.clone()};
      pieces.push(item);
      body.addEventListener('sleep',()=>{regroup=true;});
      body.addEventListener('wakeup',()=>{item.unpack?.();item.restAt=world.time;active=true;pileChanged=true;});
      if(onContact)body.addEventListener('collide',collision);
    }
    active=true;pileChanged=true;
  }
  function lodge(mesh,hit,energy){
    const item=pieces.find(piece=>piece.mesh===mesh);
    if(!item)return;
    const b=item.body,offset=new Vec3(hit.x-b.position.x,hit.y-b.position.y,hit.z-b.position.z);
    // A stopped edge transfers a short downward load into the stump. An
    // off-centre bite can rock loose wood without ejecting it like a split.
    const load=Math.min(.85,b.mass*.23)*energy;
    b.wakeUp();b.applyImpulse(new Vec3(0,-load,0),offset);active=true;
  }
  const nextRound=new Cylinder(.16,.16,.33,16),nextCenter=new Vec3(0,stumpTop+.175,0);
  const upright=new Quaternion(),axis=new Vec3();
  function blocksReload(item){
    const b=item.body;if(b.aabbNeedsUpdate)b.updateAABB();
    const {lowerBound:l,upperBound:u}=b.aabb;
    const x=Math.max(0,l.x,-u.x),z=Math.max(0,l.z,-u.z);
    return u.y>stumpTop+.010 && l.y<stumpTop+.34 && x*x+z*z<.16*.16 &&
      b.shapes[0].findSeparatingAxis(nextRound,b.position,b.quaternion,nextCenter,upright,axis);
  }
  function overFace(item){
    const b=item.body;
    if(b.aabbNeedsUpdate)b.updateAABB();
    return Math.hypot(b.position.x,b.position.z)<.32 && b.aabb.upperBound.y>stumpTop+.02 &&
      b.aabb.lowerBound.y>stumpTop-.08;
  }
  function canStillSettleOnBlock(item){
    return item.choppable && (item.supported || item.body.sleepState!==Body.SLEEPING && overFace(item));
  }
  const swept=new Set();
  function canLoad(){
    // A swept half can bounce off the heap and back onto the rim. Keep the
    // face reserved until those particular pieces have landed off the stump.
    const occupied=pieces.some(item=>swept.has(item)
      ? item.body.sleepState!==Body.SLEEPING || onChoppingFace(item)
      : blocksReload(item) || canStillSettleOnBlock(item));
    if(!occupied)swept.clear();
    return !occupied;
  }
  function onChoppingFace(item){return item.supported || overFace(item) || blocksReload(item);}
  function refreshPile(){
    if(!pileChanged)return;
    hasBlockWood=false;groundStock.length=0;
    for(const item of pieces){
      if(onChoppingFace(item))hasBlockWood=true;
      else if(item.body.sleepState===Body.SLEEPING)groundStock.push(item);
    }
    pileChanged=false;
  }
  function clearBlock(manual=false){
    let count=0;
    for(const item of pieces){
      if(manual?!onChoppingFace(item):!blocksReload(item)||canStillSettleOnBlock(item)){
        item.nudges=0;continue;
      }
      const b=item.body,n=item.nudges++;
      if(manual)swept.add(item);
      const radial=Math.hypot(b.position.x,b.position.z)<.02?-Math.PI/2:Math.atan2(b.position.z,b.position.x);
      // When the surrounding heap catches a half, lever it up and work around
      // that obstruction from alternate sides instead of repeating the same push.
      const angle=radial+(n===0?0:(n%2?1:-1)*Math.min(.88,.38+.15*n));
      const lift=Math.min(2.3,.65+.65*n),speed=Math.min(2.2,1.7+.15*n);
      b.wakeUp();b.applyImpulse(new Vec3(Math.cos(angle)*b.mass*speed,lift*b.mass,Math.sin(angle)*b.mass*speed),
        new Vec3(0,.03,0));count++;
    }
    if(count)active=true;
    return count;
  }
  function blocksStep(x,z,footY){
    return pieces.some(({body:b})=>{
      if(b.aabbNeedsUpdate)b.updateAABB();
      const {lowerBound:l,upperBound:u}=b.aabb;
      if(u.y<=footY+.28 || l.y>=footY+1.58)return false;
      const dx=Math.max(0,l.x-x,x-u.x),dz=Math.max(0,l.z-z,z-u.z);
      return dx*dx+dz*dz<.18*.18;
    });
  }
  function removePieces(items){
    const removed=new Set(items);
    let kept=0;
    for(const piece of pieces){
      if(!removed.has(piece)){pieces[kept++]=piece;continue;}
      piece.unpack?.();if(piece.choppable)onSupport?.(piece.mesh,false);
      world.removeBody(piece.body);piece.mesh.removeFromParent();piece.mesh.geometry.dispose();
    }
    pieces.length=kept;
    // Wood left behind can lose its support when a visitor carries or stacks
    // the piece underneath. Wake only the neighbours of the removed wood.
    for(const {body} of pieces)if(items.some(item=>body.position.distanceSquared(item.body.position)<.48*.48))body.wakeUp();
    regroup=true;active=pieces.length>0;pileChanged=true;
  }
  function stackGroundWood(){
    refreshPile();
    const count=groundStock.length;
    if(count){
      removePieces(groundStock);
      groundStock.length=0;
      onStockWood?.(count);
    }
    return count;
  }
  function hitPiece(raycaster){
    const hits=[];
    const origin=root.worldToLocal(center.copy(raycaster.ray.origin));
    for(const {mesh,body} of pieces){
      const reach=raycaster.far+body.boundingRadius+.04;
      if(body.position.distanceSquared(origin)>reach*reach)continue;
      // Even in a merged draw batch, the individual billet keeps its exact
      // geometry and pose. It can be selected without unpacking the pile.
      mesh.updateWorldMatrix(true,false);
      mesh.raycast(raycaster,hits);
    }
    let closest=null;
    for(const hit of hits)if(!closest || hit.distance<closest.distance)closest=hit;
    return closest;
  }
  function take(accept,selected){
    if(!pieces.length)return false;
    let chosen;
    if(selected){
      chosen=pieces.findIndex(item=>item.mesh===selected);
      if(chosen<0)return false;
    }else{
      // The "Carry a piece" shortcut favors wood that is in the way of loading.
      chosen=pieces.findIndex(blocksReload);
      if(chosen<0)for(let i=0;i<pieces.length;i++)if(chosen<0 || pieces[i].body.position.y>=pieces[chosen].body.position.y)chosen=i;
    }
    const item=pieces[chosen];if(accept && !accept(item.body.mass,item.mesh))return false;
    removePieces([item]);return true;
  }
  function settle(item){
    const b=item.body;if(b.sleepState===Body.SLEEPING)return;
    // A thin sliver squeezed between the moving blank and stump can cross a
    // one-sided terrain triangle within a fixed step. Put it back on that face.
    const ix=Math.floor(b.position.x/terrainSize+.5),iz=Math.floor(b.position.z/terrainSize+.5);
    const floor=tiles.get(ix+','+iz)?.getHeightAt(b.position.x-(ix-.5)*terrainSize,(iz+.5)*terrainSize-b.position.z,true);
    if(b.position.y<floor-.008){
      b.updateAABB();b.position.y+=floor+.002-b.aabb.lowerBound.y;
      b.aabbNeedsUpdate=true;b.velocity.y=Math.max(0,b.velocity.y);b.angularVelocity.scale(.5,b.angularVelocity);
    }
    const p=item.restPos,q=item.restRot,r=b.quaternion;
    const rotation=Math.abs(q.x*r.x+q.y*r.y+q.z*r.z+q.w*r.w);
    if(p.distanceSquared(b.position)>.012**2 || rotation<.9993){
      p.copy(b.position);q.copy(r);item.restAt=world.time;return;
    }
    // Rocking on rough bark can leave the solver oscillating indefinitely at a
    // contact. Sleep only after the pose holds on a load-bearing surface.
    if(world.time-item.restAt>.72 && world.contacts.some(c=>
      (c.bi===b && c.ni.y<-.25) || (c.bj===b && c.ni.y>.25))){
      b.sleep();regroup=true;
    }
  }
  function step(seconds){
    if(!pieces.length)return false;
    // A suspended browser resumes from the last pose, without a giant integration step.
    const dt=Math.min(.15,Math.max(0,Number.isFinite(seconds)?seconds:0));
    accumulator+=dt;
    syncBlank(Math.floor(accumulator/stepSize)*stepSize);
    if(!active){accumulator=0;return false;}
    for(const {body} of pieces)if(body.sleepState!==Body.SLEEPING)cover(body.position.x,body.position.z);
    while(accumulator>=stepSize){world.step(stepSize);accumulator-=stepSize;}
    active=false;
    for(const item of pieces){
      const {mesh,body,unpack}=item;
      settle(item);
      if(body.sleepState!==Body.SLEEPING)active=true;
      if(!unpack){mesh.position.copy(body.position);mesh.quaternion.copy(body.quaternion);}
    }
    updateSupport();
    pileChanged=true;
    if(regroup){
      const resting=pieces.filter(r=>!r.unpack && !(r.choppable && r.supported) && r.body.sleepState===Body.SLEEPING);
      for(let i=0;i+batchSize<=resting.length;i+=batchSize)batchResting(resting.slice(i,i+batchSize),root);
      regroup=false;
    }
    if(onContact && collisionSpeed>.75 && world.time>=nextSound){
      onContact(collisionSpeed);nextSound=world.time+.075;
    }
    collisionSpeed=0;
    return active;
  }
  return {release,lodge,step,canLoad,clearBlock,blocksStep,hitPiece,take,stackGroundWood,
    get stackableCount(){refreshPile();return groundStock.length;},
    get hasBlockWood(){refreshPile();return hasBlockWood;},
    get surface(){return pieces.filter(i=>i.supported||overFace(i)).map(i=>i.mesh);},
    get count(){return pieces.length;}};
}
