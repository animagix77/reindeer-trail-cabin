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
  bites.push({kind,hand,distance:nearest,animal:distances.indexOf(nearest)});
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
const spread=()=>Math.max(...deer.flatMap(a=>deer.map(b=>gap(a.position,b.position))));

home();run(.3);assert.deepEqual(state.inventory,stock);
assert(herd.hold('apple'));const initialPositions=deer.map(d=>d.position.clone());
assert(spread()>15,'The herd should occupy both sides of the woods');
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
const displacement=deer.map((d,i)=>gap(d.position,initialPositions[i]));
assert(displacement[0]>3 && displacement[2]>3,'The nearby doe and yearling did not scatter');
assert(displacement[1]<2.6 && displacement[3]<2.6,'A local alarm sent distant animals into flight');
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
// The shy buck's original stand is far from the food at the central clearing.
// The willing deer must travel the woodland route and reach the new offering.
const outpost=initialPositions[1];
camera.position.copy(outpost);camera.position.y+=1.59;
camera.lookAt(new T.Vector3().fromArray(herd.view.target));run(.3);
assert(state.near,'The wooded side of the parcel should support feeding');
const beforeApproach=deer.map(d=>gap(camera.position,d.position));
const priorBites=bites.length;
assert(herd.hold('apple'),'Unable to offer food at the woodland stand');
until(()=>bites.length>priorBites,85,'No animal came from the clearing to the wooded stand');
const handMeal=bites.at(-1);
assert(handMeal.hand && handMeal.animal!==1,'The wary buck should hang back from a hand');
assert(beforeApproach[handMeal.animal]>8,'Hand feeding did not draw an animal across the woods');

home();run(.3);
const beforeToss=deer.map(d=>d.position.clone()),count=bites.length;
toss('vegetables');run(1.2);
const mealPosition=[...foods][0].position.clone();
until(()=>bites.length>count,85,'No deer followed the tossed greens back to the clearing');
const tossMeal=bites.at(-1);
assert(!tossMeal.hand && gap(beforeToss[tossMeal.animal],mealPosition)>5,'Tossed food did not draw a distant animal');

// Observe real paths while standing on the driveway, outside the feeding zone.
const drive=model.scene.getObjectByName('WalkSpawn_Outside').getWorldPosition(new T.Vector3());
camera.position.copy(drive);camera.position.y+=1.59;
const origins=deer.map(d=>d.position.clone()),previous=origins.map(p=>p.clone());
const excursions=deer.map(()=>0);
for(let f=0;f<65*30;f++){
  herd.update(camera,'outside',clock+=1/30);
  for(const [i,d] of deer.entries()){
    assert(gap(previous[i],d.position)<.105,'A roaming deer jumped between patches');
    excursions[i]=Math.max(excursions[i],gap(d.position,origins[i]));previous[i].copy(d.position);
    if(f%15===0){
      const ground=space.spawn(d.position.x,d.position.z,d.position.y+1.59,d.position.y);
      assert(ground && Math.abs(ground.y-d.position.y)<.04,'Deer crossed an obstruction or left the terrain');
    }
  }
}
assert(!state.near);
assert(excursions.every(d=>d>3),'A distant deer stopped roaming while the visitor was on the driveway');
console.log('Forest roaming, local alarm, long-range food approach, safe routes, refunds and simultaneous throws passed.');
console.log(bites.length+' mouth contacts, maximum distance '+Math.round(100*Math.max(...bites.map(b=>b.distance)))+' cm.');
