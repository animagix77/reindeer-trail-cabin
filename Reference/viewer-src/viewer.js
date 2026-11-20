import {installCabinSurfaces} from './cabin-surfaces.js';
import {cabinFilm} from './cabin-film.js';
import {walkingGait} from './footsteps.js';
import {installTreeLights} from './tree-lights.js';
import {installParty} from './party.js';
import {installGrill} from './grill.js';
import {installEntryDoors} from './entry-doors.js';
import {installWildlife} from './wildlife.js';
import {activityControls} from './activity-controls.js';
import {installWoodSplitting} from './wood-splitting.js';
import {installFirewoodControls} from './firewood-controls.js';
import {installFirewood} from './firewood.js';
import {installTourFires} from './fires.js';
import {installWelcome} from './welcome.js';
import {readModel,ModelDownloadError} from './model-loading.js';
import {installLoadingScreen,afterPaint} from './loading-screen.js';
import {installPropertyMap} from './property-map.js';
import {installSceneControls} from './scene-controls.js';
import {batchStatic} from './batch.js';
import {installWoodlandSound,outdoorsFloor} from './woodland-sound.js';
import {installTourLighting} from './tour-lighting.js';
import { WalkSpace } from './walking.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const element = id => document.getElementById(id);
const canvas = element('view');
const controlsPanel = element('tools');
const loading=installLoadingScreen();
let sceneCanRender=false;
const roofs = [];
const backdrop=[];
const diagram=[];
const canopy = [];
const terrainMaps = new Map();
const aerialLayers=[];
function showAerial(enabled) {
  for(const item of aerialLayers) {
    item.mesh.geometry=enabled?item.orthoGeometry:item.originalGeometry;
    item.mesh.material=enabled?item.orthoMaterial:item.originalMaterial;
  }
}
const size = new THREE.Vector3();
const center = new THREE.Vector3();
const camera = new THREE.PerspectiveCamera(39,1,0.03,4000);
const world = new THREE.Scene();
const woodland=installWoodlandSound();
let lighting,fires,firewood,woodSplit,ringCenter,grill,wildlife,entryDoors,treeLights,film,surfaces;
let renderer,orbit,span=0,distance=1;

let activeView='property';
// Positions use glTF Y-up: Blender [x,y,z] maps to [x,z,-y].
const interiorCameras={
  living:{eye:[-1.911,4.36,-3.548],target:[1.81,4.40,-.49],fov:70},
  loft:{eye:[1.7373,6.08,-3.6625],target:[3.745,5.66,-3.136],fov:70}
};
const pointers=new Map();
const walkSpace=new WalkSpace();
const held=new Set();
const axes={x:0,y:0};
const gait=walkingGait(),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let bob=0;
const velocity=new THREE.Vector2();
const finishMeshes=[],finishRay=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
function footSurface(){
  if(/Bathroom/.test(body.label))return 'tile';
  if(/Gravel/.test(body.label))return 'gravel';
  if(/Flagstone|WellFloor/.test(body.label))return 'pavement';
  if(/ParcelGround|MainFloor/.test(body.label)){
    finishRay.ray.origin.set(body.x,body.y+.24,body.z);finishRay.ray.direction.copy(down);finishRay.far=.48;
    const hits=finishRay.intersectObjects(finishMeshes,false);
    if(hits.length){
      const name=hits[0].object.material.name;
      if(/porcelain/i.test(name))return 'tile';
      if(/asphalt|pavement|concrete/i.test(name))return 'pavement';
      if(/gravel|crushed stone|aggregate/i.test(name))return 'gravel';
    }
    return /MainFloor/.test(body.label)?'wood':'leaves';
  }
  return 'wood';
}
let body=null,frame=0,lastTime=0,stickPointer=null;
let previousFrame=0,overBudget=0,underBudget=0;
const maxRatio=Math.min(devicePixelRatio||1,matchMedia('(pointer: coarse)').matches?1.5:2);
function paceRenderer(time){
  const ms=time-previousFrame;previousFrame=time;
  if(ms<=0 || ms>750){overBudget=underBudget=0;return;}
  overBudget=ms>37?overBudget+Math.min(ms,100):Math.max(0,overBudget-40);
  underBudget=ms<19?underBudget+ms:0;
  const ratio=renderer.getPixelRatio();
  if(overBudget>650 && ratio>.72){
    renderer.setPixelRatio(Math.max(.72,ratio*.82));overBudget=underBudget=0;
  }else if(underBudget>8500 && ratio<maxRatio){
    renderer.setPixelRatio(Math.min(maxRatio,ratio+.12));overBudget=underBudget=0;
  }
}
const walkKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
const walking=()=>activeView!=='property' && body!==null;
function stopWalking() {
  camera.position.y-=bob;bob=0;gait.reset();velocity.set(0,0);
  held.clear();axes.x=axes.y=0;stickPointer=null;
  element('nub').style.transform='';
  if(frame) cancelAnimationFrame(frame);
  frame=0;lastTime=0;previousFrame=0;
}
function nextFrame(t) {
  frame=0;
  if(document.hidden)return;
  if(renderer)paceRenderer(t);
  if(!walking() || (!held.size && !axes.x && !axes.y && !bob && !velocity.lengthSq() && Math.abs(camera.position.y-body.y-body.eye)<.002)){
    lastTime=0;
    render();return;
  }
  const elapsed=lastTime?t-lastTime:16;
  const dt=Math.min(.085,Math.max(.008,elapsed/1000));
  lastTime=t;
  const on=(a,b)=>Number(held.has(a)||held.has(b));
  let sideways=on('KeyD','ArrowRight')-on('KeyA','ArrowLeft')+axes.x;
  let forward=on('KeyW','ArrowUp')-on('KeyS','ArrowDown')-axes.y;
  const norm=Math.max(1,Math.hypot(sideways,forward));
  const speed=/loft/i.test(body.label)?1.02:1.71;
  sideways*=speed/norm;forward*=speed/norm;
  const accelerating=Boolean(sideways||forward);
  const response=1-Math.exp(-(accelerating?13:23)*dt);
  const desiredX=Math.cos(yaw)*sideways-Math.sin(yaw)*forward;
  const desiredZ=-Math.sin(yaw)*sideways-Math.cos(yaw)*forward;
  velocity.x+=(desiredX-velocity.x)*response;
  velocity.y+=(desiredZ-velocity.y)*response;
  if(!accelerating && velocity.lengthSq()<.00025)velocity.set(0,0);
  const oldX=body.x,oldZ=body.z,eyeHeight=camera.position.y-bob;
  body=walkSpace.move(body,velocity.x*dt,velocity.y*dt);
  const wanted=body.y+body.eye;
  camera.position.x=body.x;camera.position.z=body.z;
  const travel=Math.hypot(body.x-oldX,body.z-oldZ);
  bob=gait.update(travel,dt,speed<1.1,left=>woodland.footstep(footSurface(),left),reducedMotion.matches);
  if(!travel && Math.abs(bob)<.0003)bob=0;
  camera.position.y=THREE.MathUtils.lerp(eyeHeight,wanted,1-Math.exp(-15*dt))+bob;
  render();
  if(sideways || forward || velocity.lengthSq() || bob || Math.abs(camera.position.y-wanted)>.002) schedule();
  else lastTime=0;
}
function schedule(){if(!frame) frame=requestAnimationFrame(nextFrame);}
function usableTarget(target) {
  return target===document.body || target===canvas || target.matches?.('button');
}
window.addEventListener('keydown',e=>{
  if(sceneControls.contains(e.target) || party.open || propertyMap.open || welcome.open || !walking() || !usableTarget(e.target) || e.metaKey||e.ctrlKey||e.altKey || !walkKeys.has(e.code)) return;
  e.preventDefault();
  held.add(e.code);
  if(!frame) nextFrame(performance.now());
});
window.addEventListener('keyup',e=>held.delete(e.code));
window.addEventListener('blur',stopWalking);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopWalking();else if(span)render();});
window.addEventListener('focus',()=>{if(span)render();});
const stick=element('stick');
function steer(e) {
  const rect=stick.getBoundingClientRect(),range=rect.width*.33;
  let x=(e.clientX-rect.left-rect.width/2)/range;
  let y=(e.clientY-rect.top-rect.height/2)/range;
  const scale=Math.max(1,Math.hypot(x,y));
  axes.x=x/scale;axes.y=y/scale;
  element('nub').style.transform='translate('+axes.x*range+'px,'+axes.y*range+'px)';
  schedule();
}
stick.addEventListener('pointerdown',e=>{
  if(!walking() || stickPointer!==null) return;
  stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);
  e.preventDefault();steer(e);
});
stick.addEventListener('pointermove',e=>{if(stickPointer===e.pointerId) steer(e);});
for(const type of ['pointerup','lostpointercapture','pointercancel']) stick.addEventListener(type,e=>{
  if(stickPointer!==e.pointerId)return;
  axes.x=axes.y=0;stickPointer=null;element('nub').style.transform='';
});
function hint() {
  if(activeView==='property') return 'Drag to orbit · Scroll or pinch to zoom';
  if(!walking()) return 'Drag to look around · Scroll or pinch to zoom';
  if(matchMedia('(pointer: coarse), (max-width:700px)').matches) return 'Move with the pad · Drag to look';
  return document.pointerLockElement===canvas?'WASD or arrows to walk · Mouse to look · Esc to release':'WASD or arrows to walk · Drag to look';
}
function updateLookControls(){
  element('hint').textContent=hint();
  element('lock').hidden=!walking() || !canvas.requestPointerLock;
  element('lock').textContent=document.pointerLockElement===canvas?'Release mouse':'Mouse look';
  element('stick').hidden=!walking();
}
element('lock').addEventListener('click',async()=>{
  if(document.pointerLockElement===canvas) document.exitPointerLock();
  else {
    try {await canvas.requestPointerLock();}
    catch {element('hint').textContent='Mouse capture is unavailable here. Drag to look · WASD or arrows to walk';}
  }
});
document.addEventListener('pointerlockchange',()=>{held.clear();pointers.clear();updateLookControls();});
document.addEventListener('mousemove',e=>{
  if(!walking() || document.pointerLockElement!==canvas) return;
  yaw-=e.movementX*.0022;pitch=THREE.MathUtils.clamp(pitch-e.movementY*.0022,-1.47,1.47);look();
});
function spawnBody(preset) {
  let p=new THREE.Vector3().fromArray(preset.eye);
  const expected=p.y-(activeView==='loft'?1:1.59);
  let candidate=walkSpace.spawn(p.x,p.z,p.y,expected);
  // A slightly different export may put a photo-matched camera immediately beside a handrail.
  for(const distance of [.12,.24,.40,.58]) {
    if(candidate)break;
    for(let n=0;n<12 && !candidate;n++) {
      const angle=n*Math.PI/6;
      candidate=walkSpace.spawn(p.x+distance*Math.cos(angle),p.z+distance*Math.sin(angle),p.y,expected);
    }
  }
  return candidate;
}

let yaw=0,pitch=0;

function look() {
  camera.rotation.set(pitch,yaw,0,'YXZ');
  render();
}
const viewSlugs = {
  splitting:'wood-splitting', wood:'woodpile', stars:'stargazing', entry:'front-entry', grill:'deck-grill', cook:'grilling', deer:'backyard-deer', tree:'christmas-tree', hearth:'propane-furnace', property:'property', outside:'outside', porch:'covered-porch', yard:'fire-pit', path:'front-path', hall:'front-hall', frontbed:'front-bedroom',
  master:'master-and-bath', bath:'bathroom', primary:'master-bedroom', vault:'kitchen-vault', kitchenwork:'island-cooler', kitchen:'kitchen', living:'living-room', bunk:'bunk-room', loft:'loft'
};
const locationPicker=element('location');
const viewButtons=[...document.querySelectorAll('[data-view]')];
function viewFromAddress() {
  const hash=location.hash.slice(1).split('?')[0];
  if(hash==='property')return 'property';
  return Object.keys(interiorCameras).find(key=>viewSlugs[key]===hash) || 'outside';
}
function chooseView(key) {
  const hash='#'+viewSlugs[key]+party.suffix;
  if(location.hash===hash) changeView(key);
  else location.hash=hash;
}
function walkingFov(preset,aspect) {
  if(aspect>=1)return preset.fov;
  const vertical=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(Math.PI/6)/aspect));
  return THREE.MathUtils.clamp(vertical,preset.fov,94);
}
function changeView(view) {
  stopWalking();
  if(document.pointerLockElement===canvas) document.exitPointerLock();
  body=null;
  activeView=view;
  const inside=view!=='property';
  orbit.enabled=!inside;
  backdrop.forEach(object=>{object.visible=inside;});
  diagram.forEach(object=>{object.visible=!inside;});
  showAerial(!inside && element('imagery').getAttribute('aria-pressed')==='true');
  roofs.forEach(roof=>{roof.visible=inside || element('roof').getAttribute('aria-pressed')==='true';});
  pointers.clear();
  document.documentElement.classList.toggle('inside',inside);
  locationPicker.value=view;
  for(const button of viewButtons) {
    updateState(button,button.dataset.view===view);
  }
  canvas.setAttribute('aria-label',inside?'Interior view. Drag or use the arrow keys to look around.':'Property view. Drag or use the arrow keys to orbit.');
  element('hint').textContent=inside?'Drag to look around · Scroll or pinch to zoom':'Drag to orbit · Scroll or pinch to zoom';
  reset();
  if(view==='stars')sceneControls.stargaze();
  activities.destination(view);
  woodControls.destination(view);
  updateLookControls();
  if(body) canvas.setAttribute('aria-label','Walk with WASD or arrows. Drag to look, or enable mouse look.');
  if(inside) canvas.focus({preventScroll:true});
}
for(const button of viewButtons) {
  button.addEventListener('click',()=>chooseView(button.dataset.view));
}
locationPicker.addEventListener('change',()=>chooseView(locationPicker.value));
window.addEventListener('hashchange',()=>{
  if(span) changeView(viewFromAddress());
});
function resetInterior() {
  const preset=interiorCameras[activeView];
  stopWalking();
  body=spawnBody(preset);
  camera.position.fromArray(preset.eye);
  if(body) camera.position.set(body.x,body.y+body.eye,body.z);
  const forward=new THREE.Vector3().fromArray(preset.target).sub(camera.position).normalize();
  yaw=Math.atan2(-forward.x,-forward.z);
  pitch=Math.asin(forward.y);
  // Keep nearby door frames and both sides of an aisle in view on a portrait screen.
  camera.fov=walkingFov(preset,camera.aspect);
  camera.near=.035;
  camera.updateProjectionMatrix();
  look();
}
canvas.addEventListener('pointerdown',event=>{
  if(activeView==='property' || document.pointerLockElement===canvas || event.button!==0) return;
  canvas.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
});
canvas.addEventListener('pointermove',event=>{
  const old=pointers.get(event.pointerId);
  if(!old) return;
  const next={x:event.clientX,y:event.clientY};
  if(pointers.size===1) {
    const speed=2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)/canvas.clientHeight;
    yaw+=(next.x-old.x)*speed;
    pitch=THREE.MathUtils.clamp(pitch+(next.y-old.y)*speed,-1.47,1.47);
    look();
  } else if(pointers.size===2) {
    const other=Array.from(pointers.entries()).find(([id])=>id!==event.pointerId)[1];
    const before=Math.hypot(other.x-old.x,other.y-old.y);
    const after=Math.hypot(other.x-next.x,other.y-next.y);
    if(before>2 && after>2) zoom(before/after);
  }
  pointers.set(event.pointerId,next);
});
for (const type of ['pointerup','pointercancel','lostpointercapture']) {
  canvas.addEventListener(type,event=>pointers.delete(event.pointerId));
}
canvas.addEventListener('wheel',event=>{
  if(activeView==='property') return;
  event.preventDefault();
  zoom(Math.exp(THREE.MathUtils.clamp(event.deltaY,-120,120)*.0015));
},{passive:false});

function resized() {
  const rect = canvas.getBoundingClientRect();
  if(!rect.width || !rect.height)return;
  const preset=interiorCameras[activeView];
  const aspect=rect.width/rect.height;
  if(preset)camera.fov=THREE.MathUtils.clamp(camera.fov*walkingFov(preset,aspect)/walkingFov(preset,camera.aspect),30,94);
  renderer.setSize(rect.width,rect.height,false);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  if (span) render();
}
const sceneControls=installSceneControls({
  setConditions(settings){lighting.setConditions(settings);surfaces?.setWeather(settings.weather);woodland.conditions(settings);fires?.setWeather(settings.weather);party.conditions();render();},
  async setSound(on){const enabled=await woodland.enable(on);if(span)schedule();return enabled;},
  viewStars(){chooseView('stars');},
  setFurnace(on){fires.setFurnaceOn(on);party.conditions();render();},
  setFirePit(on){fires.setFirePitOn(on);party.conditions();render();},
  stopMovement(){stopWalking();render();}
});
const activities=activityControls({
  grill:()=>grill,herd:()=>wildlife,view:()=>activeView,choose:chooseView,schedule,
  lid:on=>grill?.open(on)
});
const woodControls=installFirewoodControls({
  pickUp:kind=>firewood?.pickUp(kind),toss:()=>firewood?.toss(),putBack:()=>firewood?.putBack(),
  gather:()=>chooseView('wood'),stopMovement(){stopWalking();pointers.clear();},render
});
const propertyMap=installPropertyMap({
  stopMovement(){stopWalking();pointers.clear();},
  destinations(){
    const locations={};
    for(const key of ['entry','porch']){
      const eye=interiorCameras[key]?.eye;
      // The model is centred on this NAD83 / UTM 18N origin, with north along -Z.
      if(eye) locations[key]=[516338+eye[0],4612439-eye[2]];
    }
    return locations;
  },
  visit:chooseView, resume(){if(span) schedule();}
});
const party=installParty({
  world,choose:chooseView,schedule,
  stop(){stopWalking();pointers.clear();},
  label:key=>viewButtons.find(b=>b.dataset.view===key)?.textContent || 'Property',
  getPose(){
    const round=n=>Math.round(n*100)/100;
    return {view:activeView,x:round(body?.x??0),y:round(body?.y??0),z:round(body?.z??0),yaw:round(yaw)};
  },
  joined({index,people}){
    history.replaceState(null,'','#outside'+party.suffix);
    changeView('outside');
    if(!body)return;
    // Spread arrivals across the same grade, leaving a full stride between visitors.
    const origin=body,occupied=people.flatMap(p=>p.pose?[p.pose]:[]);
    const candidates=[];
    const rows=[[0,0],[-.8,-1.85],[.8,-1.85],[0,-3.1],[-1.65,-3.1],[1.65,-3.1],[-2.7,-3.6],[2.7,-3.6]];
    for(const depth of [0,1.25,2.5,-4.4])for(const side of [-2.5,-1.25,0,1.25,2.5])rows.push([side,depth]);
    for(const [side,depth] of rows){
      const x=origin.x+Math.cos(yaw)*side+Math.sin(yaw)*depth;
      const z=origin.z-Math.sin(yaw)*side+Math.cos(yaw)*depth;
      const spot=walkSpace.spawn(x,z,origin.y+origin.eye,origin.y);
      if(spot && spot.label===origin.label && Math.abs(spot.y-origin.y)<.60 && candidates.every(s=>Math.hypot(s.x-x,s.z-z)>.8))candidates.push(spot);
    }
    if(!candidates.length)return;
    const order=candidates.slice(index).concat(candidates.slice(0,index));
    body=order.find(s=>occupied.every(p=>Math.hypot(s.x-p.x,s.z-p.z)>.83))??order[0];
    camera.position.set(body.x,body.y+body.eye,body.z);
    if(index){yaw=Math.atan2(body.x-origin.x,body.z-origin.z);pitch=0;}
    look();
  },
  meet(guest,{index=0,occupied=[]}={}){
    if(!Object.hasOwn(viewSlugs,guest.view))return;
    const place=()=>{
      if(!body || guest.view==='property')return;
      stopWalking();
      for(const radius of [1.15,.8,1.55])for(let i=0;i<12;i++){
        const angle=guest.yaw+(index-1)*Math.PI/4+i*Math.PI/6;
        const x=guest.x-radius*Math.sin(angle),z=guest.z-radius*Math.cos(angle);
        const floor=walkSpace.spawn(x,z,guest.y+(guest.view==='loft'?1:1.59),guest.y);
        if(!floor || Math.abs(floor.y-guest.y)>.25)continue;
        const others=[...occupied,...party.neighbors()];
        if(others.some(p=>p.view!=='property'&&Math.abs(p.y-floor.y)<.8&&Math.hypot(x-p.x,z-p.z)<.74))continue;
        body=floor;camera.position.set(body.x,body.y+body.eye,body.z);
        yaw=Math.atan2(body.x-guest.x,body.z-guest.z);pitch=0;look();return;
      }
    };
    if(activeView===guest.view){place();return;}
    window.addEventListener('hashchange',()=>{if(activeView===guest.view)place();},{once:true});
    chooseView(guest.view);
  },
  snapshotFuel:()=>fires?.fuelSnapshot(),
  applyFuel:state=>{fires?.applyFuel(state);render();},
  addRemoteFuel:kind=>{fires?.addFuel(kind);render();},
  snapshot:()=>sceneControls.snapshot(),
  apply:s=>sceneControls.apply(s)
});
const welcome=installWelcome({
  pause(){stopWalking();pointers.clear();},
  resume(){if(span) schedule();},
  enter(){
    history.replaceState(null,'','#'+viewSlugs.outside+party.suffix);
    if(span && activeView!=='outside')changeView('outside');
    canvas.focus({preventScroll:true});
  }
});
function render(firstFrame=false){
  if(!sceneCanRender || (firstFrame!==true && (propertyMap.open || welcome.open)))return;
  const seconds=performance.now()/1000;
  const outside=outdoorsFloor(body?.label);
  lighting?.update(camera.position,activeView,seconds,camera,outside);
  const animateSplitting=woodSplit?.update(camera,activeView,seconds);
  const animateWood=firewood?.update(body,activeView,seconds,activities.offeringFood);
  const animateFire=fires?.update(camera,activeView,seconds);
  woodland.update(camera,outside,walking(),ringCenter,fires?.energy??0);
  sceneControls.setNearFire(Boolean(body && ringCenter && camera.position.distanceToSquared(ringCenter)<49 &&
    Math.abs(camera.position.y-ringCenter.y)<2.8),activeView==='stars');
  const animateLeaves=surfaces?.update(camera,activeView,seconds,outside);
  const animateTree=treeLights?.update(camera,activeView,seconds,canvas.height);
  const animateGuests=party.update(seconds);
  const animateDoors=entryDoors?.update(camera,walking(),seconds);
  const animateGrill=grill?.update(camera,activeView,seconds);
  const animateDeer=wildlife?.update(camera,activeView,seconds);
  const cinematic=film && walking();
  const adapting=cinematic?film.render(world,camera,lighting,outside,seconds):false;
  if(!cinematic)renderer.render(world,camera);
  if(!document.hidden && (adapting || animateSplitting || animateWood || animateLeaves || animateTree || animateGuests || animateDoors || animateFire || animateGrill || animateDeer || lighting?.animated))schedule();
}
function reset() {
  if(activeView!=='property') {resetInterior();return;}
  camera.fov=39;
  orbit.target.copy(center);
  // Fit all eight corners in the initial view, leaving room for the header and controls.
  const direction=new THREE.Vector3(.70,.94,-1.13).normalize();
  const right=new THREE.Vector3().crossVectors(camera.up,direction).normalize();
  const up=new THREE.Vector3().crossVectors(direction,right);
  const tanY=Math.tan(camera.fov*Math.PI/360);
  const tanX=tanY*camera.aspect;
  distance=0;
  for (const x of [-.5,.5]) for (const y of [-.5,.5]) for (const z of [-.5,.5]) {
    const corner=new THREE.Vector3(x*size.x,y*size.y,z*size.z);
    const fit=Math.max(Math.abs(corner.dot(right))/(tanX*.88),Math.abs(corner.dot(up))/(tanY*.67));
    distance=Math.max(distance,corner.dot(direction)+fit);
  }
  camera.position.copy(center).addScaledVector(direction,distance);
  camera.near = Math.max(.015,span * .0005);
  camera.far = Math.max(500, distance*14);
  camera.updateProjectionMatrix();
  orbit.minDistance = Math.max(1,span * .025);
  orbit.maxDistance = distance*2.5;
  orbit.update();
  render();
}
function updateState(button,enabled) {button.setAttribute('aria-pressed',String(enabled));}
element('roof').addEventListener('click',event=>{
  const visible = event.currentTarget.getAttribute('aria-pressed') !== 'true';
  roofs.forEach(object=>{object.visible=visible;});
  renderer.shadowMap.needsUpdate=true;
  updateState(event.currentTarget,visible);
  render();
});
element('canopy').addEventListener('click',event=>{
  const visible=event.currentTarget.getAttribute('aria-pressed')!=='true';
  canopy.forEach(object=>{object.visible=visible;});
  renderer.shadowMap.needsUpdate=true;
  updateState(event.currentTarget,visible);
  render();
});
element('imagery').addEventListener('click',event=>{
  const enabled=event.currentTarget.getAttribute('aria-pressed') !== 'true';
  showAerial(enabled);
  terrainMaps.forEach((original,material)=>{
    material.map=enabled?original.map:null;
    material.color.copy(enabled?original.color:new THREE.Color(0xb5bda6));
    material.needsUpdate=true;
  });
  updateState(event.currentTarget,enabled);
  render();
});
element('reset').addEventListener('click',reset);
function zoom(factor) {
  if(activeView!=='property') {
    camera.fov=THREE.MathUtils.clamp(camera.fov*factor,30,94);
    camera.updateProjectionMatrix();
    render();
    return;
  }
  const shift=camera.position.clone().sub(orbit.target);
  const next=THREE.MathUtils.clamp(shift.length()*factor,orbit.minDistance,orbit.maxDistance);
  camera.position.copy(orbit.target).add(shift.setLength(next));
  orbit.update();
  render();
}
element('near').addEventListener('click',()=>zoom(.78));
element('far').addEventListener('click',()=>zoom(1/.78));
canvas.addEventListener('keydown',e=>{
  if (!orbit || !span || (walking() && walkKeys.has(e.code))) return;
  if(activeView!=='property' && e.key.startsWith('Arrow')) {
    if(e.key==='ArrowLeft') yaw+=.10;
    if(e.key==='ArrowRight') yaw-=.10;
    if(e.key==='ArrowUp') pitch+=.10;
    if(e.key==='ArrowDown') pitch-=.10;
    pitch=THREE.MathUtils.clamp(pitch,-1.47,1.47);
    e.preventDefault();
    look();
    return;
  }
  const vec=camera.position.clone().sub(orbit.target);
  const s=new THREE.Spherical().setFromVector3(vec);
  switch (e.key){
    case 'ArrowLeft': s.theta-=.12;break;
    case 'ArrowRight': s.theta+=.12;break;
    case 'ArrowUp': s.phi=Math.max(.02,s.phi-.13);break;
    case 'ArrowDown': s.phi=Math.min(orbit.maxPolarAngle,s.phi+.13);break;
    case '+': case '=': zoom(.78);e.preventDefault();return;
    case '-': zoom(1/.78);e.preventDefault();return;
    case 'Home': reset();e.preventDefault();return;
    default: return;
  }
  e.preventDefault();
  camera.position.copy(orbit.target).add(vec.setFromSpherical(s));
  orbit.update();render();
});
class GraphicsStartError extends Error {}
async function show() {
  await afterPaint();
  try{
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
  }catch(cause){
    throw new GraphicsStartError('This browser couldn’t start 3D graphics. Enable hardware acceleration or try another browser.',{cause});
  }
  renderer.setPixelRatio(maxRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setClearColor(0xffffff,0);
  orbit = new OrbitControls(camera,canvas);
  orbit.maxPolarAngle=Math.PI*.485;
  orbit.addEventListener('change',render);
  new ResizeObserver(resized).observe(canvas);
  resized();
  const bytes=await readModel(element('model'),loading.transfer);
  await loading.preparing(1,'Unpacking rooms and textures');
  const gltf=await new GLTFLoader().parseAsync(bytes,'');
  await loading.preparing(2,'Setting up the grounds and walking paths');
  world.add(gltf.scene);
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(object=>{
    if(/^WalkSpawn_Outside/i.test(object.name)) {
      const anchor=object.getWorldPosition(new THREE.Vector3());
      interiorCameras.outside={eye:[anchor.x,anchor.y+1.59,anchor.z],target:interiorCameras.living.eye,fov:65};
      object.visible=false;
    }
    if(!object.isMesh) return;
    if(/asphalt|pavement|poured concrete|fescue|leaf litter|brushed greige floor porcelain|blue-gray crushed stone/i.test(object.material.name) && !/shingle/i.test(object.material.name))finishMeshes.push(object);
    let helper=object;
    while(helper && !/^Walk(Surface|Block)_/i.test(helper.name)) helper=helper.parent;
    if(!helper) return;
    walkSpace.add(object,helper.name);
    helper.visible=false;
  });
  // The camera starts are stored with the geometry so they follow changes to the floor plan.
  for(const key of Object.keys(viewSlugs)){
    const eye=gltf.scene.getObjectByName('TourEye_'+key);
    const target=gltf.scene.getObjectByName('TourLook_'+key);
    if(eye && target){
      interiorCameras[key]={
        eye:eye.getWorldPosition(new THREE.Vector3()).toArray(),
        target:target.getWorldPosition(new THREE.Vector3()).toArray(),
        fov:({entry:55,cook:57,tree:66,grill:66,hearth:58,kitchenwork:67,kitchen:70,vault:56,master:76,bath:68,primary:68,hall:68})[key] || 66
      };
    }
  }
  wildlife=installWildlife(world,walkSpace,camera,{onChange:activities.setDeer});
  interiorCameras.deer=wildlife.view;
  if(interiorCameras.yard){
    const eye=interiorCameras.yard.eye;
    // Look north from the clearing at the local celestial pole.
    const elevation=THREE.MathUtils.degToRad(41.67);
    interiorCameras.stars={eye:[...eye],target:[eye[0],eye[1]+5*Math.sin(elevation),eye[2]-5*Math.cos(elevation)],fov:68};
  }
  fires=installTourFires(world,gltf.scene);
  firewood=installFirewood(world,gltf.scene,walkSpace,camera,fires,woodControls.set,kind=>party.fuel(kind));
  interiorCameras.wood=firewood.view;
  woodSplit=installWoodSplitting(world,gltf.scene,walkSpace,{
    schedule,takeSplitLog:()=>firewood.takeSplitLog(),onStrike:strength=>woodland.strike(strength)
  });
  interiorCameras.splitting=woodSplit.view;
  grill=installGrill(world,gltf.scene,activities.setGrill);
  entryDoors=installEntryDoors(gltf.scene,()=>{renderer.shadowMap.needsUpdate=true;});
  for(const button of viewButtons){
    const key=button.dataset.view;
    button.hidden=key!=='property' && !interiorCameras[key];
    if(!button.hidden) locationPicker.add(new Option(button.textContent,key));
  }
  locationPicker.value='property';
  lighting=installTourLighting(world,renderer,gltf.scene);
  const imagerySource=element('ortho').textContent.trim();
  element('ortho').remove();
  if(imagerySource) {
    const map=await new THREE.TextureLoader().loadAsync('data:image/jpeg;base64,'+imagerySource);
    map.colorSpace=THREE.SRGBColorSpace;
    const orthoMaterial=new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide});
    gltf.scene.traverse(mesh=>{
      if(!mesh.isMesh) return;
      let owner=mesh;
      while(owner && !/^wooded[ _]terrain/i.test(owner.name))owner=owner.parent;
      if(!owner)return;
      const geometry=mesh.geometry.clone();
      const attribute=geometry.getAttribute('position'),uvs=[],point=new THREE.Vector3();
      // Bounds in EPSG:26918 minus the model origin (516338 E, 4612439 N).
      for(let i=0;i<attribute.count;i++){
        point.fromBufferAttribute(attribute,i).applyMatrix4(mesh.matrixWorld);
        uvs.push((point.x+22)/44,(-point.z+22)/45);
      }
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
      aerialLayers.push({mesh,orthoGeometry:geometry,orthoMaterial,originalGeometry:mesh.geometry,originalMaterial:mesh.material});
    });
    if(aerialLayers.length)updateState(element('imagery'),false);
  }
  gltf.scene.traverse(object=>{
    if(/^Walk(?:Surface|Block|Spawn)_/i.test(object.name)) return;
    if(/^Backdrop_/i.test(object.name)) {backdrop.push(object);object.visible=false;}
    if(/^(Tax[ _]parcel|Site[ _]section)/i.test(object.name)) diagram.push(object);
    if(/^roof|ceiling|^vault[ _]/i.test(object.name)) roofs.push(object);
    if(/^canopy/i.test(object.name)) {canopy.push(object);object.visible=false;}
    if(!object.isMesh || !/^terrain/i.test(object.name)) return;
    const original=Array.isArray(object.material)?object.material:[object.material];
    const cloned=original.map(mat=>{
      if(!mat.map || !mat.color) return mat;
      const separate=mat.clone();
      terrainMaps.set(separate,{map:mat.map,color:mat.color.clone()});
      return separate;
    });
    object.material=Array.isArray(object.material)?cloned:cloned[0];
  });
  gltf.scene.updateMatrixWorld(true);
  const ring=gltf.scene.getObjectByName('WalkBlock_FireRing');
  if(ring)ringCenter=new THREE.Box3().setFromObject(ring).getCenter(new THREE.Vector3());
  treeLights=installTreeLights(world,gltf.scene,reducedMotion);
  surfaces=installCabinSurfaces(gltf.scene,renderer);
  for(const item of aerialLayers){
    item.originalMaterial=item.mesh.material;
    item.originalGeometry=item.mesh.geometry;
  }
  await loading.preparing(3,'Lighting and drawing your first view');
  batchStatic(gltf.scene);
  lighting.captureExterior();
  film=cabinFilm(renderer);
  const bounds=new THREE.Box3();
  gltf.scene.traverseVisible(object=>{
    if(!object.geometry) return;
    if(!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
  });
  if(bounds.isEmpty()) throw Error('The model has no visible geometry.');
  bounds.getSize(size);
  bounds.getCenter(center);
  span=Math.max(size.x,size.y,size.z);
  element('roof').hidden=!roofs.length;
  element('canopy').hidden=!canopy.length;
  element('imagery').hidden=!terrainMaps.size && !aerialLayers.length;
  reset();
  updateLookControls();
  const initialView=viewFromAddress();
  if(initialView!=='property') changeView(initialView);
  sceneCanRender=true;
  render(true);
  await afterPaint();
  controlsPanel.hidden=false;
  element('views').hidden=false;
  element('tour-controls').hidden=false;
  loading.ready();
  party.initial();
}
show().catch(error=>{
  console.error(error);
  loading.failed(error instanceof ModelDownloadError || error instanceof GraphicsStartError
    ? error.message : 'The scene could not be prepared. Try loading the cabin again.');
});
