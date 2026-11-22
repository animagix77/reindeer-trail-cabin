// Geometry-only regression checks run on the same GLB that ships with the tour.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WalkSpace,walkIntent} from './walking.js';
import {walkingGait} from './footsteps.js';
import {checkFirewood} from './check-firewood.mjs';
import {checkWorldActions} from './check-world-actions.mjs';
import {installEggSwings} from './egg-swings.js';

const bytes=await fs.readFile(process.argv[2]);
assert.equal(bytes.readUInt32LE(8),bytes.length,'GLB is incomplete');
const length=bytes.readUInt32LE(12);
const manifest=JSON.parse(bytes.subarray(20,20+length));
const names=manifest.nodes.map(node=>node.name);
const materials=manifest.materials.map(m=>({
  name:m.name,doubleSided:true,
  pbrMetallicRoughness:{baseColorFactor:m.pbrMetallicRoughness?.baseColorFactor??[1,1,1,1]}
}));
const sceneDescription={...manifest,materials};
delete sceneDescription.images;
delete sceneDescription.textures;
delete sceneDescription.samplers;
// Keep transforms, topology and UVs. Image decoding requires a browser and is
// independently exercised by the walkthrough tests.
const json=Buffer.from(JSON.stringify(sceneDescription));
const padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);
json.copy(padded);
const header=Buffer.from(bytes.subarray(0,20));
const binary=bytes.subarray(20+length);
header.writeUInt32LE(padded.length,12);
header.writeUInt32LE(20+padded.length+binary.length,8);
const stripped=Buffer.concat([header,padded,binary]);
const data=await new GLTFLoader().parseAsync(stripped.buffer.slice(stripped.byteOffset,stripped.byteOffset+stripped.length),'');
const scene=data.scene;
scene.updateMatrixWorld(true);
const walks=new WalkSpace(),land=[],frontWalk=[],roofs=[],walls=[],entrance=[],nookWalls=[];
let primitives=0,triangles=0;
scene.traverse(o=>{
  if(!o.isMesh)return;
  primitives++;
  let owner=o;
  while(owner && !data.parser.associations.get(owner)?.hasOwnProperty('nodes'))owner=owner.parent;
  const name=owner?names[data.parser.associations.get(owner).nodes]:o.name;
  o.userData.part=name;
  assert(o.matrixWorld.elements.every(Number.isFinite),'Nonfinite transform on '+name);
  const geometry=o.geometry,position=geometry.getAttribute('position');
  for(const attr of Object.values(geometry.attributes)){
    // Exported interleaved accessors share their underlying vertex buffer.
    const values=attr.isInterleavedBufferAttribute?attr.data.array:attr.array;
    assert(values.every(Number.isFinite),'Nonfinite vertex attribute on '+name);
  }
  assert(position.count>0,'Empty mesh '+name);
  const index=geometry.index;
  if(index)assert(index.array.every(i=>i<position.count),'Index outside vertex array on '+name);
  const corners=index?index.count:position.count;
  assert.equal(corners%3,0,'Incomplete triangle on '+name);
  triangles+=corners/3;
  if(/^Walk(Surface|Block)_/.test(name))walks.add(o,name);
  if(/^Wooded terrain/.test(name))land.push(o);
  if(/^(Tree alcove · |Master pier return)/.test(name))nookWalls.push(o);
  if(/^(Front walk ·|Driveway steps ·|Exterior details · Weathered timber ties)/.test(name))frontWalk.push(o);
  if(/^Roof · (north pitch to entry valleys|entry cross gable shingles)/.test(name))roofs.push(o);
  if(/^(Exterior · wall 3|Entry wall · continuous cedar gable)/.test(name))walls.push(o);
  if(/^(Roof|Gutter|Entry wall|Exterior · wall 3)/.test(name))entrance.push(o);
});
const angle=5.4*Math.PI/180, c=Math.cos(angle),s=Math.sin(angle),feet=.3048;
function at(x,y,h){
  return new T.Vector3(4.65+feet*(-c*x-s*y),2.88+h,-8.5+feet*(-s*x+c*y));
}
const down=new T.Vector3(0,-1,0), inward=at(0,1,0).sub(at(0,0,0)).normalize();
const ray=new T.Raycaster();
function hits(objects,from,direction){
  ray.set(from,direction);
  return ray.intersectObjects(objects,false);
}
// Verify the exported east/north conversion against every mapped corner.
// Projected roof area also catches filled-in notches on nonrectangular homes.
const neighborhood=JSON.parse(await fs.readFile(new URL('../Woodland context/Neighboring homes.json',import.meta.url)));
const contextGround=[...land,scene.getObjectByName('Backdrop_Woodland_terrain')].filter(Boolean);
for(const {id,ring} of neighborhood.homes){
  const house=scene.getObjectByName('Backdrop_Neighbor_'+id);
  assert(house?.isMesh,'Missing mapped neighboring home '+id);
  const position=house.geometry.getAttribute('position');
  const vertices=Array.from({length:position.count},(_,i)=>
    new T.Vector3().fromBufferAttribute(position,i).applyMatrix4(house.matrixWorld));
  for(const [east,north] of ring){
    const column=vertices.filter(p=>Math.hypot(p.x-east,p.z+north)<.003);
    const ground=hits(contextGround,new T.Vector3(east,80,-north),down)[0]?.point.y;
    assert(column.some(p=>p.y<ground) && column.some(p=>p.y>ground+2),
      'Neighboring home '+id+' must meet the rendered hillside at every mapped corner');
  }
  let roofArea=0;
  const indices=house.geometry.index.array;
  for(let i=0;i<indices.length;i+=3){
    const a=vertices[indices[i]],b=vertices[indices[i+1]],c=vertices[indices[i+2]];
    roofArea+=Math.max(0,((b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z))*.5);
  }
  const planArea=Math.abs(ring.reduce((sum,[x,y],i)=>{
    const [u,v]=ring[(i+1)%ring.length];
    return sum+x*v-y*u;
  },0))*.5;
  assert(Math.abs(roofArea-planArea)<.02,'Roof differs from mapped footprint on '+id);
}
// Step-height rocks need support at their actual exposed faces. The surrounding
// packed gravel should stay close to the visitor's feet through its shallow ridges.
{
  const byPart=name=>{
    const matches=[];scene.traverse(o=>{if(o.isMesh && o.userData.part===name)matches.push(o);});
    return matches;
  };
  const banks=byPart('Garden · bank fieldstone and scattered cobbles');
  const chips=byPart('Garden · loose chips on graded paths');
  const supports=byPart('WalkSurface_WoodlandFieldstone');
  assert.equal(banks.length,1,'Woodland rocks should be batched');
  assert.equal(chips.length,1,'Gravel chips should be batched');
  assert.equal(supports.length,1,'Missing fieldstone walking surface');
  for(const mesh of [banks[0],chips[0]])assert(mesh.geometry.hasAttribute('color'),'Missing natural stone tints');
  const support=supports[0],geo=support.geometry,indices=geo.index;
  for(let i=0;i<indices.count;i+=3*Math.max(1,Math.floor(indices.count/48))){
    const point=new T.Vector3();
    for(let j=0;j<3;j++)point.add(new T.Vector3().fromBufferAttribute(geo.attributes.position,indices.getX(i+j)));
    point.multiplyScalar(1/3).applyMatrix4(support.matrixWorld);
    const from=point.clone();from.y+=1;
    const top=hits(banks,from,down)[0]?.point.y;
    const foot=walks.heights(point.x,point.z).find(h=>h.label===support.userData.part && Math.abs(h.y-top)<.001);
    assert(foot,'Feet and visible fieldstone disagree');
  }
  const pad=byPart('Rear gravel fire circle');
  for(let j=0;j<24;j++){
    const a=2*Math.PI*j/24,r=.82;
    const from=at(24.85+9.65*r*Math.cos(a),55.4+13*r*Math.sin(a),25);
    const top=hits(pad,from,down)[0].point.y;
    const foot=walks.heights(from.x,from.z).find(h=>h.label==='WalkSurface_FireCircleGravel');
    assert(foot && Math.abs(foot.y-top)<.005,'Fire-circle gravel and walking height disagree');
  }
}
// Both faces of the pergola carry bulbs, with a direct run to the deck and a
// longer return by the picnic table. Check the rendered filaments in plan.
const filaments=[];
scene.traverse(mesh=>{
  if(!mesh.isMesh || mesh.material.name!=='String bulbs · amber filament')return;
  const pos=mesh.geometry.getAttribute('position');
  for(let i=0;i<pos.count;i++){
    const p=new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);
    filaments.push(new T.Vector2(p.x,p.z));
  }
});
function lampsAlong(start,end,tolerance=.025){
  const projected=([x,y])=>{const p=at(x,y,0);return new T.Vector2(p.x,p.z);};
  const a=projected(start),line=projected(end).sub(a),length=line.length();
  line.normalize();
  const stations=[];
  for(const bulb of filaments){
    const delta=bulb.clone().sub(a),d=delta.dot(line);
    if(d<.04 || d>length-.04 || Math.abs(delta.cross(line))>tolerance)continue;
    if(stations.every(existing=>Math.abs(existing-d)>.035))stations.push(d);
  }
  return stations.length;
}
for(const x of [34.71,35.29]){
  assert(lampsAlong([x,48.325],[x,59.875])>=4,'Missing lights along the pergola timber');
}
assert(lampsAlong([40.70,35.84],[34.71,48.325])>=5,'Missing direct pergola-to-deck lights');
assert.equal(lampsAlong([13.25,54.4],[23.30,35.84]),7,'Expected seven pendants on the flue-side span');
for(const name of ['Deck','Picnic','Pergola'])assert(scene.getObjectByName('FestoonPool_'+name),'Missing outdoor lamp anchor '+name);
// Each basket needs its own upholstered seat inside the wicker shell.
const swingPads=[];
scene.traverse(mesh=>{
  if(mesh.isMesh && mesh.material.name==='Patio cushion · oatmeal')swingPads.push(mesh);
});
for(const id of [1,2]){
  const basket=scene.getObjectByName('WalkBlock_HangingBasket'+id);
  const bounds=new T.Box3().setFromObject(basket);
  const above=bounds.getCenter(new T.Vector3());
  above.y=bounds.max.y;
  const seat=hits(swingPads,above,down)[0];
  assert(seat && seat.point.y>bounds.min.y+.45 && seat.point.y<bounds.min.y+.75,
    'Missing seat cushion inside hanging basket '+id);
}
let spawns=0;
for(const name of names.filter(n=>n.startsWith('TourEye_'))){
  const v=scene.getObjectByName(name).getWorldPosition(new T.Vector3());
  assert(walks.spawn(v.x,v.z,v.y,v.y-(name.endsWith('_loft')?1:1.59)),'Walk start obstructed '+name);
  spawns++;
}
for(const x of [28.22,28.8,29.8,30.60,31.2,32.21,33.15,33.75]){
  for(const y of [-1.02,-.41,.01,1.3,2.9,5.4]){
    const intersections=hits(roofs,at(x,y,8),down);
    assert(intersections.length,'Missing roof above front entrance at '+[x,y]);
    assert(intersections.every(i=>Math.abs(i.distance-intersections[0].distance)<.001),
      'Overlapping cross gable and host pitch at '+[x,y]);
  }
}
for(const x of [29.65,30.4,31.7,32.31]){
  for(const h of [.12,1.68,1.95,2.01]){
    const from=at(x,-1.5,h);
    assert(!hits(entrance,from,inward).some(i=>i.distance<.6),'Doorway crossed by facade at '+[x,h]);
  }
}
for(const x of [23,28,33,40]){
  for(const h of [-.11,.2,.7,1.14,1.60]){
    const hitsHere=hits(walls,at(x,-1,h),inward);
    assert(hitsHere.some(i=>Math.abs(i.distance-feet)<.003),'Gap in front cladding at '+[x,h]);
  }
}
// The plaster projection beside the loft stairs meets the stone pier. Cast
// rays at both ends of each new face, including the plaster-to-stone seam.
const xAxis=at(1,0,0).sub(at(0,0,0)).normalize();
for(const h of [.15,1.0,1.85,2.17]){
  for(const y of [15.29,16.85,18.13]){
    const hit=hits(nookWalls,at(20.25,y,h),xAxis)[0];
    assert(hit && Math.abs(hit.distance-.50*feet)<.003 && hit.object.userData.part.startsWith('Tree alcove · stair-side plaster'),
      'Missing plaster beside the tree at '+[y,h]);
  }
  for(const x of [20.77,20.99,21.01,22.5,23.0,23.04,23.43]){
    const hit=hits(nookWalls,at(x,18.65,h),inward.clone().negate())[0];
    const finish=x<23.02?'Tree alcove · living-room plaster':'Master pier return';
    assert(hit && Math.abs(hit.distance-.50*feet)<.003 && hit.object.userData.part.startsWith(finish),
      'Open living-room corner or pier face at '+[x,h]);
  }
}
// The photographed stair-side route and the passage to the primary barn door
// must both work using the browser's real walker and clearance radius.
function traverseRoute(label,points,startingHeight=0,checkStep){
  const first=at(...points[0],startingHeight+1.59);
  let body=walks.spawn(first.x,first.z,first.y,2.88+startingHeight);
  assert(body,label+' has no starting floor');
  for(const [x,y] of points.slice(1)){
    const target=at(x,y,0),dx=target.x-body.x,dz=target.z-body.z;
    const n=Math.ceil(Math.hypot(dx,dz)/.025);
    for(let i=0;i<n;i++){
      const previous=body;
      body=walks.move(body,dx/n,dz/n);
      checkStep?.(previous,body);
    }
    assert(Math.hypot(body.x-target.x,body.z-target.z)<.025,label+' obstructed at '+[x,y]);
  }
  return body;
}
// Check the actual published surfaces as well as the collision lane. A clear
// centerline alone would miss the false recess formerly behind the pedal bin.
const hallWalls=[],counterWall=[],hallCeiling=[],hallLintel=[],shoeRack=[];
scene.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const part=mesh.userData.part;
  if(/^(Full bedroom and front hall|Front hall · straight wall to counter|Bathroom to entry passage)/.test(part))hallWalls.push(mesh);
  if(/^Full bedroom to kitchen/.test(part))counterWall.push(mesh);
  if(/^(Interior · front hall gabled ceiling|Front hall · plaster soffit at kitchen entry|Kitchen vault · ivory plaster on hall side)/.test(part))hallCeiling.push(mesh);
  if(/^Front hall · plaster lintel/.test(part))hallLintel.push(mesh);
  if(/^Front hall [|] shoe bench/.test(part))shoeRack.push(mesh);
});
const axisX=at(1,0,0).sub(at(0,0,0)).normalize(),againstX=axisX.clone().negate();
// A keydown can be timestamped just after the next animation frame's own timestamp.
{
  const gait=walkingGait();
  const height=gait.update(.02,1/60,false,()=>{},false);
  assert.equal(gait.update(0,0,false,()=>{},false),height,'A zero-time frame preserves the current head height');
  assert.ok(Number.isFinite(gait.update(.02,1/60,false,()=>{},false)),'Head motion resumes on the next walking frame');
}

// Hold each strafe key in the actual entry hallway with the camera facing
// along it. The visitor can step toward both walls without changing aim.
{
  const eye=at(31,8.8,1.59),body=walks.spawn(eye.x,eye.z,eye.y);
  const yaw=Math.atan2(-axisX.z,axisX.x),pad={x:0,y:0};
  function intent(...keys){return walkIntent(new Set(keys),pad,yaw,1/60);}
  const forward=intent('KeyW');
  for(const [key,sign] of [['KeyA',-1],['KeyD',1]]){
    const step=intent(key),end=walks.move(body,step.x,step.z);
    const side=(end.x-body.x)*axisX.x+(end.z-body.z)*axisX.z;
    assert.equal(step.yaw,yaw);
    assert(Math.abs(step.x*forward.x+step.z*forward.z)<1e-9);
    assert(sign*side>.20 && sign*side<.48,'Sideways walking should stop at the hall wall');
    const diagonal=intent('KeyW',key);
    assert(Math.abs(Math.hypot(diagonal.x,diagonal.z)-1)<1e-9,'Diagonals cannot travel faster');
    assert.equal(diagonal.yaw,yaw);
  }
  assert.deepEqual(intent('ArrowUp','KeyW'),forward);
  assert.deepEqual(intent('ArrowDown'),intent('KeyS'));
  assert.deepEqual(intent('KeyA','KeyD'),intent());
  const left=intent('ArrowLeft'),right=intent('ArrowRight');
  assert(left.yaw>yaw && right.yaw<yaw && !left.x && !left.z && !right.x && !right.z,'Arrow keys rotate in place');
  const analog=walkIntent(new Set(),{x:.4,y:0},yaw,1/60);
  assert(Math.abs(Math.hypot(analog.x,analog.z)-.4)<1e-9 && analog.yaw===yaw,'The touch pad retains its analog range');
}
for(const y of [1.0,2.5,6.5,8.0,8.8,9.8,10.5,11.8,12.4]){
  for(const h of [.30,1.63]){
    const from=at(31,y,h);
    const right=hits(hallWalls,from,axisX)[0];
    assert(right && Math.abs(right.distance-1.75*feet)<.003,'Bedroom-side hall wall must remain straight at '+[y,h]);
    if(y<10.25){
      const left=hits(hallWalls,from,againstX)[0];
      assert(left && Math.abs(left.distance-1.96*feet)<.003,'Bathroom-side hall wall must remain straight at '+[y,h]);
    }
  }
}
for(const x of [32.79,33.0,33.46,34.02,35.85,39.9]){
  for(const h of [.15,.92,1.7,2.15]){
    const hit=hits(counterWall,at(x,15,h),inward.clone().negate())[0];
    assert(hit && Math.abs(hit.distance-(15-12.49)*feet)<.004,'Counter and bin need a continuous wall behind them at '+[x,h]);
  }
}
for(const x of [29.24,31.0,32.62]){
  for(const y of [.33,2.22,4.15,7.84,9.90,10.22,11.50,12.59]){
    const hit=hits(hallCeiling,at(x,y,1.70),down.clone().negate())[0];
    assert(hit && hit.distance>.20 && hit.distance<1.4,'Unfinished ceiling over the hall at '+[x,y]);
  }
  for(const h of [2.06,2.21,2.37,2.74]){
    const hit=hits(hallLintel,at(x,9.2,h),inward)[0];
    assert(hit && Math.abs(hit.distance-.87*feet)<.003,'Gap in solid kitchen-end lintel at '+[x,h]);
  }
}
assert(shoeRack.length,'Missing shoe bench');
for(const mesh of shoeRack){
  const positions=mesh.geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++){
    const from=new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
    assert(from.sub(at(29.04,0,0)).dot(axisX)<.003,'Shoe bench protrudes into the hall opening');
  }
}
for(const x of [30.54,31,31.64]){
  const lane=[[x,-.50],[x,1.1],[x,5.9],[x,10.35],[x,15.8]];
  traverseRoute('Straight front-door to kitchen route',lane);
  traverseRoute('Straight kitchen to front-door route',[...lane].reverse());
}
traverseRoute('Hall to front bedroom',[[31,4.30],[32.75,4.30],[33.72,4.30]]);
traverseRoute('Kitchen to bathroom beside the shoe rack',[[26.55,13],[26.55,10.20],[26.55,9.14]]);
assert(scene.getObjectByName('TourEye_hall') && names.includes('Front hall · Be Our Guest'),'Missing photographed hall viewpoint or sign');
// The dedicated view should see the decorated face around the finished
// projection, the way the stair-side tree appears in the December photographs.
const treeEye=scene.getObjectByName('TourEye_tree').getWorldPosition(new T.Vector3());
for(const h of [.47,1.06,1.68]){
  const target=at(19.00,16.88,h),sight=target.clone().sub(treeEye).normalize();
  assert(!hits(nookWalls,treeEye,sight).some(hit=>hit.distance<treeEye.distanceTo(target)),
    'The plaster projection hides the tree from its own viewpoint at height '+h);
}
traverseRoute('Primary door around the stone pier',[[25.35,20.16],[24.7,18.8],[24.7,12.75],[22.28,12.75]]);
const stairRoute=[[25.35,20.16],[19.9,19.56],[16.94,19.35],[16.94,16.83],[15.65,16.83],[9.05,16.83],[7.85,16.83],[7.85,19.55]];
assert.equal(traverseRoute('Tree nook to loft',stairRoute).label,'WalkSurface_LoftLanding');
assert.equal(traverseRoute('Loft down to tree nook',[...stairRoute].reverse(),2.21).label,'WalkSurface_MainFloor_west');
traverseRoute('Woodpile to the fire ring between the chairs',[[34.65,46.92],[32.,46.2],[30.4,47.6],[30.1,50.6],[29.1,52.5]],-1.11);
const visibleSolids=[];
scene.traverse(mesh=>{
  if(mesh.isMesh && !/^Walk(Surface|Block)_/.test(mesh.userData.part)){
    visibleSolids.push({mesh,bounds:new T.Box3().setFromObject(mesh)});
  }
});
const probe=new T.Raycaster(),bounds=new T.Box3();
function firstVisible(a,b){
  const length=a.distanceTo(b);
  if(length<1e-7)return;
  bounds.setFromPoints([a,b]).expandByScalar(.001);
  probe.set(a,b.clone().sub(a).divideScalar(length));
  probe.far=length;
  return probe.intersectObjects(visibleSolids.filter(part=>part.bounds.intersectsBox(bounds)).map(part=>part.mesh),false)[0];
}

// Probe the rendered timber and joinery themselves. Their world-aligned boxes
// overlap on an angled building even when the gap beside the newel is clear.
function checkDeck(){
  const timber='Porch · deck boards, posts and guardrails';
  for(const [height,y] of [[.778,26.122],[.865,26.12]]){
    const seam=at(23.57,y,height);
    const post=firstVisible(seam,at(22.9,y,height));
    const casing=firstVisible(seam,at(24.2,y,height));
    assert.equal(post?.object.userData.part,timber,'Missing house-end newel of deck guard');
    assert.match(casing?.object.userData.part||'',/^Dining nook 1 · frame/,'Missing dining sash beside guard');
    assert(post.point.distanceTo(casing.point)>.08,'Window casing overlaps or crowds the deck guard');
  }
  const facade=firstVisible(at(23.57,26.42,1.24),at(23.57,25.72,1.24));
  assert.match(facade?.object.userData.part||'',/^Exterior · wall 5/,'Open wall behind the deck guard');
  const opening=firstVisible(at(26.8,26.35,1.4),at(26.8,25.72,1.4));
  assert.match(opening?.object.userData.part||'',/^Dining nook 1 · clear glazing/,'New dining opening is blocked');
  const sideRail=firstVisible(at(23.25,29.2,1.03),at(23.25,29.2,.70));
  assert.equal(sideRail?.object.userData.part,timber,'Missing side guard cap away from house');

  const rackEye=at(27.9,29.75,1.525),frame='Deck firewood rack · tubular steel frame';
  const logs='Deck firewood rack · split logs';
  const materialFaces=new Set();
  for(const x of [24.25,24.6,24.95,25.3,25.65,26.0,26.35,26.7]){
    for(const h of [.11,.24,.39,.54,.7,.83]){
      const seen=firstVisible(rackEye,at(x,26.4,h));
      if(seen)materialFaces.add(seen.object.userData.part);
    }
  }
  assert(materialFaces.has(frame) && materialFaces.has(logs),'Standing visitor must see the rack frame and split logs');
  const feetMeshes=visibleSolids.filter(part=>part.mesh.userData.part===frame).map(part=>part.mesh);
  const deckBoards=visibleSolids.filter(part=>part.mesh.userData.part===timber).map(part=>part.mesh);
  for(const side of [-1,1])for(const end of [-1,1]){
    const x=25.48+side*.274/feet,y=27.18+end*.10/feet;
    const underside=hits(feetMeshes,at(x,y,-.18),down.clone().negate())[0];
    const floor=hits(deckBoards,at(x,y,.06),down)[0];
    assert(underside && floor && Math.abs(underside.point.y-floor.point.y)<.007,
      'Both rack feet must rest on the deck boards');
  }
  const center=at(25.48,27.18,-.065),approach=at(25.48,29.7,-.065);
  const guest=walks.spawn(approach.x,approach.z,approach.y+1.59,approach.y);
  assert.equal(guest?.label,'WalkSurface_CoveredDeck','Cannot stand in front of the rack');
  const stop=walks.move(guest,center.x-guest.x,center.z-guest.z);
  const beforeRack=(stop.x-center.x)*inward.x+(stop.z-center.z)*inward.z;
  assert(beforeRack>.405 && beforeRack<.50,'Visitor must stop just in front of the rack');

  // From the yard, take both short flights at the grill end. Walk between
  // the grill and chair, to the rack, then through the slider and back out.
  const path=[[11.1,60.2],[11.1,41.6],[22,42.3],[40,42.3],[44.72,40.2],
    [44.72,33.6],[38.32,33.6],[38.25,32.05],[35,32.05],[34.63,30.3],
    [34.63,29.2],[27.9,29.75],[30.7,27.5],[30.7,24.8]];
  const yard=scene.getObjectByName('TourEye_yard').getWorldPosition(new T.Vector3());
  const yardHeight=yard.y-at(0,0,1.59).y;
  assert.equal(traverseRoute('Yard steps to rack and dining slider',path,yardHeight).label,'WalkSurface_MainFloor_west');
  assert.equal(traverseRoute('Dining slider past wood rack to garden',[...path].reverse()).label,'WalkSurface_ParcelGround');

  // Follow the gravel path from the foot of the grill-side steps around the
  // end of the wood stack. A shortcut across the bank misses the path grade.
  const garden=[[38.32,33.6],[44.96,33.6],[44.96,37.78],[45.65,38.86],[47.42,39.10],
    [49.56,38.57],[51.40,38.55],[52.80,39.45],[53.23,40.80],[52.70,42.10],[51.36,43.08],
    [49.02,43.64],[45.81,43.86],[42.75,43.74],[40.28,43.92],[38.26,44.55],[36.80,45.70],
    [34.65,46.92],[32,46.2],[30.4,47.6],[30.1,50.6],[29.1,52.5]];
  function gardenWalk(points,height,sign){
    return traverseRoute('Grill-side steps and garden path',points,height,(before,after)=>{
      assert(after.eye>=1.58,'Forced crouch on grill-side garden path');
      if(before.label!==after.label || after.label!=='WalkSurface_ParcelGround')return;
      const distance=Math.hypot(after.x-before.x,after.z-before.z);
      const rise=sign*(after.y-before.y);
      assert(rise>=-.03*distance-.001 && rise<=.36*distance+.001,'Unexpected bank across the garden path');
    });
  }
  const circle=gardenWalk(garden,-.065,-1);
  assert.equal(circle.label,'WalkSurface_FireCircleGravel');
  assert.equal(gardenWalk([...garden].reverse(),circle.y-at(0,0,0).y,1).label,'WalkSurface_CoveredDeck');
}
checkDeck();

// A visitor reaches the lower level from the two actual outdoor starts, walks
// to each fixture at standing height, and retraces the same steps to daylight.
function checkBasement(){
  function assertClear(a,b,label){
    const hit=firstVisible(a,b);
    if(hit)assert.fail(label+' crosses '+hit.object.userData.part+' at '+hit.point.toArray().map(v=>v.toFixed(2)));
  }
  function clearance(start,end){
    const dx=end.x-start.x,dz=end.z-start.z,length=Math.hypot(dx,dz);
    if(length<1e-6)return;
    // Sweep both shoulders, the shins, torso and eye line. The upward cast
    // also catches an invisible crouch beneath a beam or a stair crossing a deck.
    for(const side of [-.145,0,.145]){
      const x=side*dz/length,z=-side*dx/length;
      for(const h of [.29,1.05,1.60]){
        assertClear(new T.Vector3(start.x+x,start.y+h,start.z+z),
          new T.Vector3(end.x+x,end.y+h,end.z+z),'Basement approach');
      }
      assertClear(new T.Vector3(end.x+x,end.y+.19,end.z+z),
        new T.Vector3(end.x+x,end.y+1.75,end.z+z),'Basement standing clearance');
    }
  }
  const lowerFloor=-2.72+.027;
  const destinations=points=>points.map(([x,y])=>at(x,y,0));
  const doorX=23.05;
  const apronAndDoor=destinations([[doorX,33.4],[doorX,24.7]]);
  const drivewayApproach=destinations([[-8.8,-8.2],[-8.8,30.8],[6.9,30.8],[14.8,30.8],[14.8,33.4]]);
  const gardenApproach=destinations([[11.1,41.6],[doorX,41.6]]);
  // Approach the panel from the tank aisle, angling away from the end of the
  // den wall. Test left and right tracking through the bend; a line within
  // millimetres of the corner passes scripted tests but snags human walkers.
  function panelApproach(side){
    return [[37.75+side*.20,13.1],[37.82+side*.12,12.1],[38.125+side*.34,11.4],[38.125+side*.34,6.9]];
  }
  const lowerVisit=destinations([
    [doorX,19.35],[29.68,19.35],[29.68,18], // see the washer head-on across its floor space
    [29.68,19.35],[26.15,19.35],[26.15,13.95],[33.86,13.95],[33.86,18.55],[33.86,13.95], // both bathroom fixtures
    [37.60,13.95],[37.60,14.3],[37.60,17.5],[37.60,20.85],[37.75,14.0], // water system
    ...panelApproach(-1),...panelApproach(1).reverse(),
    [25.86,13.95],[25.86,6.8],[25.86,21.4],[16.5,21.4] // den and garage
  ]);
  function follow(body,points){
    const floors=new Set();
    for(const target of points){
      const dx=target.x-body.x,dz=target.z-body.z,n=Math.ceil(Math.hypot(dx,dz)/.04);
      let last=body;
      for(let i=0;i<n;i++){
        body=walks.move(body,dx/n,dz/n);
        assert(body.eye>=1.58,'Unexpected crouch on '+body.label);
        floors.add(body.label);
        if(Math.hypot(body.x-last.x,body.z-last.z)>.43 || i===n-1){
          clearance(last,body);
          last=body;
        }
      }
      assert(Math.hypot(body.x-target.x,body.z-target.z)<.025,
        'Basement route stopped on '+body.label+' before '+target.toArray());
    }
    return {body,floors};
  }
  // Hold forward at one fixed heading. A diagonal slide along an obstruction
  // or a parallel ramp can otherwise pass a waypoint-only check.
  function walkStraightSteps(body,target,sign){
    const dx=target.x-body.x,dz=target.z-body.z,distance=Math.hypot(dx,dz);
    const yaw=Math.atan2(-dx,-dz),forward=walkIntent(new Set(['KeyW']),{x:0,y:0},yaw,1/60);
    const count=Math.ceil(distance/.03),stride=distance/count,start=body,risers=[];
    let otherHeightChange=0,lastClear=body;
    for(let i=1;i<=count;i++){
      const previous=body;
      body=walks.move(body,forward.x*stride,forward.z*stride);
      const travel=i*stride;
      assert(Math.hypot(body.x-start.x-forward.x*travel,body.z-start.z-forward.z*travel)<.002,
        'Straight basement entry requires steering on '+body.label);
      assert(body.eye>=1.58,'Forced crouch on straight basement entry at '+body.label);
      const change=sign*(body.y-previous.y);
      if(Math.abs(change)>.035){
        assert(change>=.11 && change<=.22,'Unexpected basement riser height '+change);
        risers.push(travel);
      }else otherHeightChange+=Math.abs(change);
      if(i%5===0 || i===count){
        clearance(lastClear,body);
        lastClear=body;
        const foot=new T.Vector3(body.x,body.y,body.z);
        const hit=firstVisible(foot.clone().addScaledVector(down,-.045),foot.clone().addScaledVector(down,.065));
        assert(hit && Math.abs(hit.point.y-body.y)<.024,
          'Foot above or below visible floor on '+body.label+' at '+foot.toArray());
      }
    }
    assert.equal(risers.length,2,'Expected two risers between the level approach and the basement');
    assert(risers[1]-risers[0]>=.22,'Basement middle tread is too short to stand on');
    assert(otherHeightChange<.025,'Extra grade change beside the two basement steps');
    return body;
  }
  const serviceFlight=Array.from({length:5},(_,i)=>'WalkSurface_ServiceDriveStep'+i);
  const lowerFlight=['WalkSurface_LowerServiceStep0','WalkSurface_LowerServiceStep1'];
  assert.deepEqual(names.filter(n=>/^WalkSurface_LowerServiceStep/.test(n)).sort(),lowerFlight);
  for(const x of [doorX-.65,doorX,doorX+.65]){
    const apron=at(x,32.9,lowerFloor+.34),inside=at(x,24.7,lowerFloor);
    const start=walks.spawn(apron.x,apron.z,apron.y+1.59,apron.y);
    assert.match(start?.label||'',/^WalkSurface_UtilityFlagstoneApron(?:\.\d+)?$/);
    const bottom=walkStraightSteps(start,inside,-1);
    assert.equal(bottom.label,'WalkSurface_BasementServiceSlab');
    const top=walkStraightSteps(bottom,apron,1);
    assert.equal(top.label,start.label);
    assert(Math.abs(top.y-start.y)<.005,'Basement steps returned visitor to the wrong elevation');
  }
  const required=[...lowerFlight,'WalkSurface_ExteriorServiceLanding','WalkSurface_BasementServiceSlab'];
  for(const [name,eyeHeight,approach,visit] of [
    ['WalkSpawn_Outside',0,drivewayApproach,lowerVisit],
    ['TourEye_yard',1.59,gardenApproach,[]]
  ]){
    const anchor=scene.getObjectByName(name).getWorldPosition(new T.Vector3());
    const floor=anchor.y-eyeHeight;
    const start=walks.spawn(anchor.x,anchor.z,floor+1.59,floor);
    assert(start,'Missing walking start for '+name);
    const path=[anchor,...approach,...apronAndDoor,...visit];
    const there=follow(start,path.slice(1));
    const back=follow(there.body,path.slice(0,-1).reverse());
    const expected=visit.length?[...serviceFlight,...required,'WalkSurface_BasementBathroomFloor','WalkSurface_BasementDenWood','WalkSurface_BasementGarageSlab']:required;
    for(const label of expected){
      assert(there.floors.has(label) && back.floors.has(label),'Round trip from '+name+' bypassed '+label);
    }
    assert(Math.abs(back.body.y-start.y)<.025,'Returned to a different floor at '+name);
  }

  // Stair helpers must coincide with the actual tread tops at the center and
  // both sides. Headroom and collision alone don't reveal a hovering avatar.
  function topCheck(x,y,helper,visible){
    const world=at(x,y,0),surface=walks.heights(world.x,world.z).find(f=>f.label===helper);
    assert(surface,'Missing support '+helper);
    const above=new T.Vector3(world.x,surface.y+.06,world.z);
    const hit=firstVisible(above,above.clone().addScaledVector(down,.13));
    assert(hit?.object.userData.part.startsWith(visible) && Math.abs(hit.point.y-surface.y)<.012,
      helper+' does not meet its visible finish ('+hit?.object.userData.part+')');
  }
  for(const [index,x] of [8.07,9.21,10.35,11.49,12.63].entries()){
    for(const y of [30.17,30.86,31.52])topCheck(x,y,serviceFlight[index],'Garage wing · concrete service tread');
  }
  for(const [index,y] of [29.91,28.77].entries()){
    for(const x of [doorX-.85,doorX,doorX+.85])topCheck(x,y,lowerFlight[index],'Areaway · concrete tread');
  }
  topCheck(doorX,27.3,'WalkSurface_ExteriorServiceLanding','Areaway · lower landing');
  topCheck(doorX,24.7,'WalkSurface_BasementServiceSlab','Basement · ServiceSlab');
  topCheck(33.86,18.55,'WalkSurface_BasementBathroomFloor','Basement powder room | wood-look plank floor');

  // Visible architectural faces, trim or soil must never occupy the clear
  // doorway even if its collision opening still passes a centerline walk.
  const local=(x,y,h)=>at(x,y,lowerFloor+h);
  for(const x of [doorX-1.02,doorX,doorX+1.02]){
    for(const h of [.15,.95,1.80])assertClear(local(x,27,h),local(x,24.8,h),'Basement threshold');
  }
  for(const [who,eye,look] of [
    ...[-.35,0,.35].flatMap(drift=>[[-.74,.19],[0,.58],[.72,.94]].map(([offset,height])=>[
      'Basement laundry | graphite front-loading wash and dry combo',[29.68+drift,18],[29.68+offset,22.80,height]
    ])),
    ['Basement powder room | dual-flush toilet with raised seat',[33.86,18.55],[31.6,18.65,.64]],
    ['Basement powder room | vanity, molded basin and chrome mixer',[33.86,18.55],[35.77,18.55,.78]],
    ['Basement | well pressure tank 1',[37.5,14.3],[39.64,14.3,1.00]],
    ['Basement | well pressure tank 2',[37.5,17.5],[39.64,17.5,1.00]],
    ['Basement | well manifold, gauge and distribution pipes',[37.5,15.88],[39.07,15.88,.59]],
    ['Basement | 40 gallon electric water heater',[37.5,20.85],[39.64,20.85,1.00]],
    ...[-1,1].map(side=>['Basement | electrical panel, open schedule door and protected breakers',
      panelApproach(side).at(-1),[40.52,6.9,1.47]])
  ]){
    const hit=firstVisible(local(...eye,1.59),local(...look));
    assert.equal(hit?.object.userData.part,who,'Obstructed view of '+who);
  }
  assert.equal(names.filter(n=>/^Basement \| well pressure tank \d+$/.test(n)).length,2);
  const lamps=['Areaway','Bathroom','Den','Entry','Garage','PanelAisle','Service'].map(s=>'BasementLamp_'+s);
  assert.deepEqual(names.filter(n=>n.startsWith('BasementLamp_')).sort(),lamps.sort());
  for(const name of lamps){
    const lamp=scene.getObjectByName(name).getWorldPosition(new T.Vector3());
    const diffuser=name==='BasementLamp_Areaway'
      ?firstVisible(lamp.clone().addScaledVector(inward,.30),lamp)
      :firstVisible(lamp.clone().addScaledVector(down,.30),lamp.clone().addScaledVector(down,-.09));
    assert.equal(diffuser?.object.userData.part,name,'Occluded ceiling diffuser '+name);
  }
}
checkBasement();

checkFirewood(scene,walks);
checkWorldActions(scene,walks);
const survey=JSON.parse(await fs.readFile(new URL('../model-geometry.json',import.meta.url),'utf8'));
const boundary=survey.boundary.map(([e,n])=>{
  const de=(e-516342.65)/feet, dn=(n-4612447.5)/feet;
  return [-c*de+s*dn,-s*de-c*dn];
});
function insideParcel(x,y){
  let inside=false;
  for(let i=0,j=boundary.length-1;i<boundary.length;j=i++){
    const [a,b]=boundary[j], [d,e]=boundary[i];
    if((b>y)!==(e>y) && x<a+(y-b)*(d-a)/(e-b))inside=!inside;
  }
  return inside;
}
const counts={};
// One-foot sampling across the developed frontage, clipped to the parcel and
// the footprint's stepped front line. Include gravel/timber in the denominator.
for(let x=-27.375;x<42;x++)for(let y=-21.625;y<3;y++){
  if(!insideParcel(x,y)||y>=(x>21?0:3))continue;
  const from=at(x,y,10);
  const result=hits(land,from,down)[0]??hits(frontWalk,from,down)[0];
  assert(result,'Missing forecourt or path surface at '+[x,y]);
  const key=result.object.material.name;
  counts[key]=(counts[key]??0)+1;
}
const hardFinishes=['Front motor court · weathered asphalt',
  'Street gate and upper court · aged poured concrete','Uphill front court · weathered gray pavement'];
// The blue well cap is visible from the upper path beside the cabin-facing
// stair post. Check the visible model, the soil line and the actual walk route.
const wellParts=[],wellSight=[];
scene.traverse(o=>{
  if(!o.isMesh)return;
  if(o.material.name.startsWith('Water well ·'))wellParts.push(o);
  if(/^(Wooded terrain|Front walk ·|Driveway steps ·|Exterior details · (Weathered|Entry · weathered|Water well ·))/.test(o.userData.part))wellSight.push(o);
});
const wellProbe=at(4.45,-4.70,5),grade=hits(land,wellProbe,down)[0];
assert.equal(grade?.object.material.name,'Leaf litter and low cover','Well should rise from the soil beside the steps');
const cap=hits(wellParts,wellProbe,down)[0];
assert.equal(cap?.object.material.name,'Water well · cobalt enamel cap','Missing photographed blue well cap');
assert(cap.point.y-grade.point.y>.25 && cap.point.y-grade.point.y<.34,'Well cap at wrong height above the soil');
const wellBlock=scene.getObjectByName('WalkBlock_WellCasing');
const wellFootprint=new T.Box3().setFromObject(wellBlock).getSize(new T.Vector3());
assert(wellFootprint.x<.25 && wellFootprint.z<.25,'The well collision footprint obstructs the landing');
assert.equal(walks.spawn(wellProbe.x,wellProbe.z,grade.point.y+1.59,grade.point.y),null,'Visitors can walk through the casing');
const wellEye=scene.getObjectByName('TourEye_well').getWorldPosition(new T.Vector3());
const wellLook=scene.getObjectByName('TourLook_well').getWorldPosition(new T.Vector3());
assert(hits(wellSight,wellEye,wellLook.sub(wellEye).normalize())[0]?.object.material.name.startsWith('Water well ·'),
  'Well is hidden by the stairs from its own viewpoint');
// Sight along the soil/path seam from uphill. Both surfaces passed the old
// vertical coverage check despite a daylight crack at eye level.
const uphill=at(8.8,-9.,-.02),pathGround=[...land,...frontWalk];
for(const x of [4.53,4.68,4.83,4.98,5.09]){
  for(let j=0;j<12;j++){
    const target=at(x,-5.38+j*.006,-1.64);
    assert(hits(pathGround,uphill,target.sub(uphill).normalize())[0]?.distance<4,
      'Daylight through soil beside the driveway landing at '+[x,j]);
  }
}
traverseRoute('Driveway steps and upper path past well',[[-3.15,-7.70],[4.85,-7.70],[8.8,-8.0]],-2.75);
for(const finish of hardFinishes)assert(counts[finish]>40,'Missing front paving finish '+finish);
const sampleCount=Object.values(counts).reduce((a,b)=>a+b,0);
const paved=hardFinishes.reduce((sum,key)=>sum+counts[key],0)/sampleCount;
assert(paved>.63,'Paving should cover roughly two-thirds of the developed frontage');
for(const [x,y,expected] of [[21.38,-20.7,hardFinishes[1]],[21.38,-17,hardFinishes[1]],[28,-15.9,hardFinishes[2]]]){
  assert.equal(hits(land,at(x,y,10),down)[0]?.object.material.name,expected,'Frontage finish at '+[x,y]);
}
// Verify the moving pieces on the same combined meshes used by the viewer.
{
  const preferences={matches:false},update=installEggSwings(scene,preferences);
  const camera=new T.PerspectiveCamera(68,1,.035,200);
  camera.position.copy(scene.getObjectByName('TourEye_yard').getWorldPosition(new T.Vector3()));
  camera.lookAt(scene.getObjectByName('TourLook_yard').getWorldPosition(new T.Vector3()));
  const poses=[1,2].map(id=>{
    const pivot=scene.getObjectByName('EggSwingPivot'+id);
    assert.equal(pivot.children.length,3,'The chain, wicker and cushion must stay together');
    const [links,,pad]=pivot.children;
    const anchor=pivot.getWorldPosition(new T.Vector3());
    assert(Math.abs(anchor.y-new T.Box3().setFromObject(links).max.y)<.001);
    const local=pad.geometry.boundingBox.getCenter(new T.Vector3());
    return {pivot,pad,local,start:pad.localToWorld(local.clone()),anchor};
  });
  assert(update(camera,.5,true),'The chairs should animate in the backyard view');
  for(const {pivot,pad,local,start,anchor} of poses){
    const current=pad.localToWorld(local.clone());
    assert(current.distanceTo(start)>.001 && current.distanceTo(start)<.035);
    assert(pivot.getWorldPosition(new T.Vector3()).distanceTo(anchor)<1e-6);
    assert(Math.abs(current.distanceTo(anchor)-start.distanceTo(anchor))<1e-6);
  }
  preferences.matches=true;
  assert.equal(update(camera,1,true),false);
  assert(poses.every(({pad,local,start})=>pad.localToWorld(local.clone()).distanceTo(start)<1e-6));
  preferences.matches=false;camera.position.y+=50;
  assert.equal(update(camera,2,true),false,'Distant swings should not request animation frames');
}
console.log(`Checked ${primitives} mesh primitives, ${triangles.toLocaleString()} triangles and ${spawns} authored walk starts. Straight front hall, kitchen counter backing, side doorways, entry, front ground, well casing and stair access, pergola lighting, covered-deck window and firewood rack, tree nook closure, primary passage, loft stairs, the two straight basement steps and basement round trips passed.`);
console.log('Developed frontage paving',Math.round(paved*1000)/10+'%',counts);
