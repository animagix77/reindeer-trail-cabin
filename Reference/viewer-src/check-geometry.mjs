// Geometry-only regression checks run on the same GLB that ships with the tour.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WalkSpace} from './walking.js';

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
const walks=new WalkSpace(),land=[],frontWalk=[],roofs=[],walls=[],entrance=[];
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
console.log(`Checked ${primitives} mesh primitives, ${triangles.toLocaleString()} triangles and ${spawns} authored walk starts. Entry valleys, doorway, siding and front ground checks passed.`);
console.log('Developed frontage paving',Math.round(paved*1000)/10+'%',counts);
