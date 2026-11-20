// Run against the shipping export: node check-wildlife.mjs "../../Reindeer Trail.glb"
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WalkSpace} from './walking.js';
import {installWildlife} from './wildlife.js';

const bytes=await fs.readFile(process.argv[2]);
const loader=new GLTFLoader();
loader.register(()=>({name:'Walk geometry only',loadMaterial:async()=>new T.MeshBasicMaterial()}));
const model=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
model.scene.updateMatrixWorld(true);
const space=new WalkSpace();
model.scene.traverse(obj=>{
  if(!obj.isMesh)return;
  let owner=obj;
  while(owner && !/^Walk(Block|Surface)_/.test(owner.name))owner=owner.parent;
  if(owner)space.add(obj,owner.name);
});

const scene=new T.Scene(),camera=new T.PerspectiveCamera(),stock={apple:5,carrot:4,vegetables:4};
const foods=new Set(),events=[],bites=[],wordToFood={apple:'apple',carrot:'carrot',greens:'vegetables'};
let state,deer,clock=0;
const herd=installWildlife(scene,space,camera,{onChange(value){
  state=value;events.push(value.message);
  const meal=value.message.match(/ate the (\w+) (from your hand|you tossed)/);
  if(!meal)return;
  const kind=wordToFood[meal[1]],hand=meal[2]==='from your hand';
  const target=hand?scene.getObjectByName('Offering'):[...foods].find(f=>!f.parent && f.name==='Tossed '+kind);
  assert(target,'A serving disappeared without a tracked target');
  if(!hand)foods.delete(target);
  const distances=deer.map(deer=>deer.getObjectByName('Muzzle').getWorldPosition(new T.Vector3()).distanceTo(target.position));
  const nearest=Math.min(...distances);
  assert(nearest<.18,'Consumed '+kind+' beyond muzzle contact');
  bites.push({kind,hand,distance:nearest});
}});
const yard=scene.getObjectByName('Backyard wildlife');
deer=yard.children.filter(o=>o.type==='Group');
const home=()=>{camera.position.fromArray(herd.view.eye);camera.lookAt(new T.Vector3().fromArray(herd.view.target));};
const frame=()=>herd.update(camera,'deer',clock+=1/30);
function run(seconds){for(let f=0;f<seconds*30;f++)frame();}
function until(check,seconds,reason){for(let f=0;f<seconds*30 && !check();f++)frame();assert(check(),reason);}
function toss(kind){
  assert(herd.toss(kind),'Toss failed on open ground');
  const selected=yard.children.find(o=>o.name==='Tossed '+kind && !foods.has(o));
  assert(selected);foods.add(selected);
}
function leaveYard(){camera.position.set(100,10,100);herd.update(camera,'property',clock+=90);}
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const spread=()=>Math.max(...deer.map((a,i)=>gap(a.position,deer[(i+1)%deer.length].position)));

home();run(.3);assert.deepEqual(state.inventory,stock);
assert(herd.hold('apple'));const initialPositions=deer.map(d=>d.position.clone()),startSpread=spread();
until(()=>events.some(m=>m.includes('curious deer is')),4,'No curiosity toward a still visitor');
const direction=new T.Vector3().subVectors(deer[0].position,camera.position);direction.y=0;direction.normalize();
let body=space.spawn(camera.position.x,camera.position.z,camera.position.y,camera.position.y-1.59);
for(let f=0;f<65;f++){
  body=space.move(body,.048*direction.x,.048*direction.z);
  camera.position.set(body.x,body.y+body.eye,body.z);frame();
}
assert(events.some(m=>m.includes('scattered')),'Visitor approach did not alert the herd');
assert.equal(bites.length,0,'The herd ate during flight');
run(2.8);
assert(deer.every((d,i)=>gap(d.position,initialPositions[i])>2),'A herd member stayed behind');
assert(spread()>startSpread+2,'The herd did not fan out');
until(()=>bites.length>0,30,'No curious deer returned after the visitor stopped');
const afterMeal=events.length;run(18);
assert(!events.slice(afterMeal).some(m=>m.includes('scattered')),'A stationary hand-feeder triggered another alarm');

home();run(.2);assert(herd.hold('carrot'));leaveYard();
assert.equal(state.holding,null);assert.equal(state.inventory.carrot,stock.carrot);
assert.equal(herd.toss('carrot'),false,'Allowed to toss from outside the yard');
home();run(4);
for(const kind of Object.keys(stock)){
  const initial=bites.length;
  assert(herd.hold(kind));until(()=>!state.holding,35,'Hand offering timed out');
  assert.deepEqual(bites.slice(initial).map(b=>[b.kind,b.hand]),[[kind,true]]);
}
for(const kind of Object.keys(stock))toss(kind);
until(()=>!foods.size,55,'Simultaneously tossed food remained in the clearing');

herd.refill();assert.deepEqual(state.inventory,stock);
for(const [kind,amount] of Object.entries(stock)){
  for(let i=0;i<amount;i++)toss(kind);
  assert.equal(herd.toss(kind),false,'Spent a serving after the basket was empty');
}
herd.refill();assert.deepEqual(state.inventory,{apple:0,carrot:0,vegetables:0});
const starts=[...foods].map(f=>f.position.clone()),before=bites.length;
leaveYard();
assert([...foods].every((f,i)=>gap(f.position,starts[i])>1),'Food remained in midair while away');
assert.equal(bites.length,before,'A deer ate away from the food');
home();until(()=>!foods.size,100,'Full basket of overlapping servings did not clear');
herd.refill();assert.deepEqual(state.inventory,stock);
console.log('Walk-up alarm, flight, return to hand, all foods, refunds and simultaneous throws passed.');
console.log(bites.length+' mouth contacts, maximum distance '+Math.round(100*Math.max(...bites.map(b=>b.distance)))+' cm.');
