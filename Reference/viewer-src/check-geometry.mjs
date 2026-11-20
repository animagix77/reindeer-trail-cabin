// Geometry-only regression checks run on the same GLB that ships with the tour.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WalkSpace} from './walking.js';
import {checkFirewood} from './check-firewood.mjs';

const bytes=await fs.readFile(process.argv[2]);
assert.equal(bytes.readUInt32LE(8),bytes.length,'GLB is incomplete');
const length=bytes.readUInt32LE(12);
const manifest=JSON.parse(bytes.subarray(20,20+length));
const names=manifest.nodes.map(node=>node.name);
const materials=manifest.materials.map(m=>({name:m.name,doubleSided:true}));
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
function traverseRoute(label,points,startingHeight=0){
  const first=at(...points[0],startingHeight+1.59);
  let body=walks.spawn(first.x,first.z,first.y,2.88+startingHeight);
  assert(body,label+' has no starting floor');
  for(const [x,y] of points.slice(1)){
    const target=at(x,y,0),dx=target.x-body.x,dz=target.z-body.z;
    const n=Math.ceil(Math.hypot(dx,dz)/.025);
    for(let i=0;i<n;i++)body=walks.move(body,dx/n,dz/n);
    assert(Math.hypot(body.x-target.x,body.z-target.z)<.025,label+' obstructed at '+[x,y]);
  }
  return body;
}
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
checkFirewood(scene,walks);
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
for(const finish of hardFinishes)assert(counts[finish]>40,'Missing front paving finish '+finish);
const sampleCount=Object.values(counts).reduce((a,b)=>a+b,0);
const paved=hardFinishes.reduce((sum,key)=>sum+counts[key],0)/sampleCount;
assert(paved>.63,'Paving should cover roughly two-thirds of the developed frontage');
for(const [x,y,expected] of [[21.38,-20.7,hardFinishes[1]],[21.38,-17,hardFinishes[1]],[28,-15.9,hardFinishes[2]]]){
  assert.equal(hits(land,at(x,y,10),down)[0]?.object.material.name,expected,'Frontage finish at '+[x,y]);
}
console.log(`Checked ${primitives} mesh primitives, ${triangles.toLocaleString()} triangles and ${spawns} authored walk starts. Entry, front ground, pergola and deck lighting, tree nook closure, primary passage and loft stair checks passed.`);
console.log('Developed frontage paving',Math.round(paved*1000)/10+'%',counts);
