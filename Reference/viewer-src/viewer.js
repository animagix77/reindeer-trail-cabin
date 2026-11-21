import {installCabinSurfaces} from './cabin-surfaces.js';
import {installWoodlandGrass} from './woodland-grass.js';
import {cabinFilm} from './cabin-film.js';
import {walkingGait} from './footsteps.js';
import {installHallReflections} from './hall-reflections.js';
import {installMotionFloodlights} from './motion-floodlights.js';
import {installWalkingFlashlight} from './walking-flashlight.js';
import {installTreeLights} from './tree-lights.js';
import {installParty} from './party.js';
import {installGrill} from './grill.js';
import {installEntryDoors} from './entry-doors.js';
import {installWildlife} from './wildlife.js';
import {activityControls} from './activity-controls.js';
import {installWoodSplitting} from './wood-splitting.js';
import {installWorldActions} from './world-actions.js';
import {installTourInterface} from './tour-interface.js';
import {installFirewood} from './firewood.js';
import {installTourFires} from './fires.js';
import {installWelcome} from './welcome.js';
import {installWaterNotes} from './water-notes.js';
import {readModel,ModelDownloadError} from './model-loading.js';
import {installLoadingScreen,afterPaint} from './loading-screen.js';
import {installPropertyMap} from './property-map.js';
import {installSceneControls} from './scene-controls.js';
import {batchStatic} from './batch.js';
import {installWoodlandSound,outdoorsFloor} from './woodland-sound.js';
import {installTourLighting} from './tour-lighting.js';
import {WalkSpace,walkIntent} from './walking.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const element = id => document.getElementById(id);
const canvas = element('view');
const controlsPanel = element('tools');
let sceneCanRender=false;
const camera = new THREE.PerspectiveCamera(39,1,0.03,4000);
const world = new THREE.Scene();
const woodland=installWoodlandSound();
const flashlightButton=element('flashlight');
let flashlight,floodlights,hallReflections,flashlightOn=false;
let lighting,fires,firewood,woodSplit,ringCenter,grill,wildlife,entryDoors,treeLights,film,surfaces;
let renderer,worldActions,updateGrass;
let activeView='outside';
// Positions use glTF Y-up: Blender [x,y,z] maps to [x,z,-y].
const starts={};
const pointers=new Map();
const walkSpace=new WalkSpace();
const held=new Set();
const axes={x:0,y:0};
const gait=walkingGait(),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let bob=0;
const velocity=new THREE.Vector2();
const finishMeshes=[],finishRay=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
function footSurface(){
  if(/^WalkSurface_Basement/.test(body.label))return /Wood|Bathroom/.test(body.label)?'wood':'pavement';
  if(/Bathroom/.test(body.label))return 'tile';
  if(/Gravel/.test(body.label))return 'gravel';
  if(/Flagstone|WellFloor|ServiceDriveStep|LowerServiceStep|ExteriorServiceLanding/.test(body.label))return 'pavement';
  if(/ParcelGround|MainFloor/.test(body.label)){
    finishRay.ray.origin.set(body.x,body.y+.24,body.z);finishRay.ray.direction.copy(down);finishRay.far=.48;
    const hits=finishRay.intersectObjects(finishMeshes,false);
    if(hits.length){
      const name=hits[0].object.material.name;
      if(/porcelain|charcoal.gray tile/i.test(name))return 'tile';
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
const walking=()=>body!==null;
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
  const dt=Math.min(.085,Math.max(0,elapsed/1000));
  lastTime=t;
  const input=walkIntent(held,axes,yaw,dt);
  if(input.turn){
    yaw=input.yaw;
    camera.rotation.set(pitch,yaw,0,'YXZ');
  }
  if(worldActions?.seated){
    render();
    if(input.turn)schedule();else lastTime=0;
    return;
  }
  const speed=/loft/i.test(body.label)?1.02:1.71;
  const accelerating=Boolean(input.x||input.z);
  const response=1-Math.exp(-(accelerating?13:23)*dt);
  velocity.x+=(input.x*speed-velocity.x)*response;
  velocity.y+=(input.z*speed-velocity.y)*response;
  if(!accelerating && velocity.lengthSq()<.00025)velocity.set(0,0);
  const oldX=body.x,oldZ=body.z,eyeHeight=camera.position.y-bob;
  body=walkSpace.move(body,velocity.x*dt,velocity.y*dt);
  const wanted=body.y+body.eye;
  camera.position.x=body.x;camera.position.z=body.z;
  const travel=Math.hypot(body.x-oldX,body.z-oldZ);
  tourInterface.walked(travel);
  bob=gait.update(travel,dt,speed<1.1,left=>woodland.footstep(footSurface(),left),reducedMotion.matches);
  if(!travel && Math.abs(bob)<.0003)bob=0;
  camera.position.y=THREE.MathUtils.lerp(eyeHeight,wanted,1-Math.exp(-15*dt))+bob;
  render();
  if(held.size || accelerating || velocity.lengthSq() || bob || Math.abs(camera.position.y-wanted)>.002) schedule();
  else lastTime=0;
}
function schedule(){if(!frame) frame=requestAnimationFrame(nextFrame);}
function usableTarget(target) {
  return target===document.body || target===canvas || target.matches?.('button');
}
window.addEventListener('keydown',e=>{
  if(sceneControls.contains(e.target) || party.open || propertyMap.open || welcome.open || waterNotes.open || tourInterface.open || !walking() || !usableTarget(e.target) || e.metaKey||e.ctrlKey||e.altKey || !walkKeys.has(e.code)) return;
  e.preventDefault();
  if(worldActions?.seated && e.code!=='ArrowLeft' && e.code!=='ArrowRight')return;
  held.add(e.code);
  if(!frame) nextFrame(performance.now());
});
window.addEventListener('keyup',e=>held.delete(e.code));
window.addEventListener('blur',stopWalking);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopWalking();else if(sceneCanRender)render();});
window.addEventListener('focus',()=>{if(sceneCanRender)render();});
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
  if(!walking() || worldActions?.seated || stickPointer!==null) return;
  stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);
  e.preventDefault();steer(e);
});
stick.addEventListener('pointermove',e=>{if(stickPointer===e.pointerId) steer(e);});
for(const type of ['pointerup','lostpointercapture','pointercancel']) stick.addEventListener(type,e=>{
  if(stickPointer!==e.pointerId)return;
  axes.x=axes.y=0;stickPointer=null;element('nub').style.transform='';
});
const touchControls=matchMedia('(pointer: coarse)');
function hint() {
  if(!walking()) return 'Drag to look around · Scroll or pinch to zoom';
  if(document.pointerLockElement===canvas) return 'Mouse to look · Esc to release';
  return touchControls.matches?'Move with the pad · Drag to look':'Drag to look';
}
function updateLookControls(){
  element('walk-keys').hidden=!walking() || worldActions?.seated || touchControls.matches;
  element('look-gesture').textContent=hint();
  element('lock').hidden=!walking() || !canvas.requestPointerLock;
  element('lock').textContent=document.pointerLockElement===canvas?'Release mouse':'Mouse look';
  element('stick').hidden=!walking() || worldActions?.seated || !matchMedia('(any-pointer: coarse)').matches;
  let label='Cabin view. Drag or use the arrow keys to look around.';
  if(walking()) label=touchControls.matches?'Walk with the movement pad and drag to look around.':
    'Walk forward with W and back with S. Sidestep left with A and right with D. The up and down arrows also walk. Turn with the left and right arrows, or drag to look around.';
  if(worldActions?.seated)label='Seated by the fire. Drag to look around. Use Stand up to walk again.';
  canvas.setAttribute('aria-label',label);
}
touchControls.addEventListener('change',updateLookControls);
element('lock').addEventListener('click',async()=>{
  if(document.pointerLockElement===canvas) document.exitPointerLock();
  else {
    try {await canvas.requestPointerLock();}
    catch {element('look-gesture').textContent='Drag to look · Mouse capture unavailable';}
  }
});
document.addEventListener('pointerlockchange',()=>{held.clear();pointers.clear();updateLookControls();});
document.addEventListener('mousemove',e=>{
  if(!walking() || document.pointerLockElement!==canvas) return;
  yaw-=e.movementX*.0022;pitch=THREE.MathUtils.clamp(pitch-e.movementY*.0022,-1.47,1.47);look();
});
function spawnBody(preset) {
  let p=new THREE.Vector3().fromArray(preset.eye);
  const expected=p.y-1.59;
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
const tourAreas={
  outside:{label:'Driveway',slug:'driveway',aliases:['property','well','well-casing','splitting','wood-splitting']},
  entry:{label:'Front of house',slug:'front-of-house',aliases:['front-entry','path','front-path']},
  yard:{label:'Back yard',slug:'back-yard',aliases:['fire-pit','porch','covered-porch','grill','deck-grill',
    'cook','grilling','wood','woodpile','deer','backyard-deer','stars','stargazing']},
  hall:{label:'Inside',slug:'inside',aliases:['front-hall','frontbed','front-bedroom','master','master-and-bath',
    'bath','bathroom','primary','master-bedroom','vault','kitchen-vault','kitchenwork','island-cooler','kitchen',
    'living','living-room','bunk','bunk-room','loft','tree','christmas-tree','hearth','propane-furnace']}
};
const locationPicker=element('location');
function areaFor(name){
  return Object.keys(tourAreas).find(key=>key===name || tourAreas[key].slug===name || tourAreas[key].aliases.includes(name));
}
function viewFromAddress(){
  const fragment=location.hash.slice(1);
  const name=fragment.split('?')[0];
  const key=areaFor(name) || 'outside';
  if(fragment && name!==tourAreas[key].slug){
    history.replaceState(history.state,'','#'+tourAreas[key].slug+fragment.slice(name.length));
  }
  return key;
}
function chooseView(key){
  const hash='#'+tourAreas[key].slug+party.suffix;
  if(location.hash===hash)changeView(key);
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
  pointers.clear();
  document.documentElement.classList.add('inside');
  locationPicker.value=view;
  activities.close();
  reset();
  updateLookControls();
  flashlightButton.hidden=!walking();
  canvas.focus({preventScroll:true});
}
locationPicker.addEventListener('change',()=>chooseView(locationPicker.value));
window.addEventListener('hashchange',()=>{
  if(sceneCanRender) changeView(viewFromAddress());
});
function reset() {
  worldActions?.leave();
  const preset=starts[activeView];
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
  if(!walking() || document.pointerLockElement===canvas || event.button!==0) return;
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
  if(!walking()) return;
  event.preventDefault();
  zoom(Math.exp(THREE.MathUtils.clamp(event.deltaY,-120,120)*.0015));
},{passive:false});

function resized() {
  const rect = canvas.getBoundingClientRect();
  if(!rect.width || !rect.height)return;
  const preset=starts[activeView];
  const aspect=rect.width/rect.height;
  if(preset)camera.fov=THREE.MathUtils.clamp(camera.fov*walkingFov(preset,aspect)/walkingFov(preset,camera.aspect),30,94);
  renderer.setSize(rect.width,rect.height,false);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  if (sceneCanRender) render();
}
const sceneControls=installSceneControls({
  setConditions(settings){lighting?.setConditions(settings);surfaces?.setWeather(settings.weather);woodland.conditions(settings);fires?.setWeather(settings.weather);render();},
  share(){party.conditions();},
  async setSound(on){const enabled=await woodland.enable(on);if(sceneCanRender)schedule();return enabled;},
  setFurnace(on){fires.setFurnaceOn(on);party.conditions();render();},
  setFirePit(on){fires.setFirePitOn(on);party.conditions();render();},
  stopMovement(){stopWalking();render();}
});
const activities=activityControls({
  grill:()=>grill,herd:()=>wildlife,schedule,
  lid:on=>grill?.open(on)
});
const propertyMap=installPropertyMap({
  stopMovement(){stopWalking();pointers.clear();},
  destinations(){
    const locations={};
    for(const key of ['entry','yard']){
      const eye=starts[key]?.eye;
      // The model is centred on this NAD83 / UTM 18N origin, with north along -Z.
      if(eye) locations[key]=[516338+eye[0],4612439-eye[2]];
    }
    return locations;
  },
  visit:chooseView, resume(){if(sceneCanRender) schedule();}
});
const party=installParty({
  world,schedule,
  stop(){stopWalking();pointers.clear();},
  getPose(){
    const round=n=>Math.round(n*100)/100;
    const seated=worldActions?.seated;
    return {view:activeView,x:round(body?.x??0),y:round(body?.y??0),z:round(body?.z??0),
      yaw:round(seated?worldActions.seatHeading:yaw),...(seated?{seated:true,seat:worldActions.seatId}:{})};
  },
  joined({index,people}){
    history.replaceState(null,'','#'+tourAreas.outside.slug+party.suffix);
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
    const region=areaFor(guest.view);
    if(!region || guest.view==='property')return;
    const place=()=>{
      if(!body)return;
      stopWalking();
      for(const radius of [1.15,.8,1.55])for(let i=0;i<12;i++){
        const angle=guest.yaw+(index-1)*Math.PI/4+i*Math.PI/6;
        const x=guest.x-radius*Math.sin(angle),z=guest.z-radius*Math.cos(angle);
        const floor=walkSpace.spawn(x,z,guest.y+(guest.view==='loft'?1:1.59),guest.y);
        if(!floor || Math.abs(floor.y-guest.y)>.25)continue;
        const others=[...occupied,...party.neighbors()];
        if(others.some(p=>p.view!=='property'&&Math.abs(p.y-floor.y)<.8&&Math.hypot(x-p.x,z-p.z)<.74))continue;
        worldActions?.leave();
        body=floor;camera.position.set(body.x,body.y+body.eye,body.z);
        yaw=Math.atan2(body.x-guest.x,body.z-guest.z);pitch=0;look();return;
      }
    };
    if(activeView===region){place();return;}
    window.addEventListener('hashchange',()=>{if(activeView===region)place();},{once:true});
    chooseView(region);
  },
  snapshotFuel:()=>fires?.fuelSnapshot(),
  applyFuel:state=>{fires?.applyFuel(state);render();},
  addRemoteFuel:kind=>{fires?.addFuel(kind);render();},
  snapshot:()=>sceneControls.snapshot(),
  apply:(s,guest)=>sceneControls.apply(s,guest),solo:()=>sceneControls.solo()
});
const waterNotes=installWaterNotes({
  pause(){stopWalking();pointers.clear();},
  resume(){if(sceneCanRender)schedule();}
});
const welcome=installWelcome({
  pause(){stopWalking();pointers.clear();},
  resume(){if(sceneCanRender) schedule();},
  enter(){
    history.replaceState(null,'','#'+tourAreas.outside.slug+party.suffix);
    if(sceneCanRender && activeView!=='outside')changeView('outside');
    canvas.focus({preventScroll:true});
  }
});
const loading=installLoadingScreen(welcome.setLoadState);
const tourInterface=installTourInterface({
  stopMovement(){stopWalking();pointers.clear();},
  resume(){if(sceneCanRender)schedule();},
  isOutside:()=>outdoorsFloor(body?.label)
});
function render(firstFrame=false){
  if(!sceneCanRender || (firstFrame!==true && (propertyMap.open || welcome.open || waterNotes.open || tourInterface.open)))return;
  const seconds=performance.now()/1000;
  const outside=outdoorsFloor(body?.label);
  lighting?.update(camera.position,activeView,seconds,camera,outside,body?.label);
  flashlight?.update(camera,walking(),outside,flashlightOn);
  const animateFlood=floodlights?.update(camera.position,walking() && outside,lighting?.daylight??1,seconds,walking());
  const animateSplitting=woodSplit?.update(activeView,seconds,velocity.lengthSq()>.0025);
  const animateWood=firewood?.update(body,activeView,seconds,activities.offeringFood);
  const animateFire=fires?.update(camera,activeView,seconds);
  woodland.update(camera,outside,walking(),ringCenter,fires?.energy??0);
  const animateLeaves=surfaces?.update(camera,activeView,seconds,outside);
  const animateGrass=updateGrass?.(camera,seconds,outside);
  const animateTree=treeLights?.update(camera,activeView,seconds,canvas.height);
  const animateGuests=party.update(seconds);
  const animateDoors=entryDoors?.update(camera,walking(),seconds);
  const animateGrill=grill?.update(camera,activeView,seconds);
  const animateDeer=wildlife?.update(camera,activeView,seconds);
  worldActions?.update();
  hallReflections?.update(camera,walking(),seconds,lighting?.daylight??1);
  const cinematic=film && walking();
  const adapting=cinematic?film.render(world,camera,lighting,outside,seconds):false;
  if(!cinematic)renderer.render(world,camera);
  if(!document.hidden && (adapting || animateFlood || animateSplitting || animateWood || animateLeaves || animateGrass || animateTree || animateGuests || animateDoors || animateFire || animateGrill || animateDeer || lighting?.animated))schedule();
}
function updateState(button,enabled) {button.setAttribute('aria-pressed',String(enabled));}
element('reset').addEventListener('click',reset);
function toggleFlashlight(){
  if(!walking())return;
  flashlightOn=!flashlightOn;
  updateState(flashlightButton,flashlightOn);
  render();
}
flashlightButton.addEventListener('click',()=>{
  toggleFlashlight();
  canvas.focus({preventScroll:true});
});
window.addEventListener('keydown',event=>{
  if(event.code!=='KeyL' || event.repeat || event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey ||
     (event.target!==canvas && event.target!==document.body) || document.querySelector('dialog[open]'))return;
  if(walking()){event.preventDefault();toggleFlashlight();}
});
function zoom(factor) {
  camera.fov=THREE.MathUtils.clamp(camera.fov*factor,30,94);
  camera.updateProjectionMatrix();
  render();
}
element('near').addEventListener('click',()=>zoom(.78));
element('far').addEventListener('click',()=>zoom(1/.78));
canvas.addEventListener('keydown',e=>{
  if(!sceneCanRender || e.metaKey || e.ctrlKey || e.altKey)return;
  switch(e.key){
    case 'PageUp': case 'PageDown':
      pitch=THREE.MathUtils.clamp(pitch+(e.key==='PageUp'?.12:-.12),-1.47,1.47);
      look();break;
    case '+': case '=': zoom(.78);break;
    case '-': zoom(1/.78);break;
    case 'Home': reset();break;
    default:return;
  }
  e.preventDefault();
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
      // Face the walk up to the porch, with the garage to the left of the first flight.
      const step=gltf.scene.getObjectByName('WalkSurface_RetainerTread04');
      const aim=new THREE.Box3().setFromObject(step).getCenter(new THREE.Vector3());
      aim.y+=.92;
      starts.outside={eye:[anchor.x,anchor.y+1.59,anchor.z],target:aim.toArray(),fov:65};
      object.visible=false;
    }
    if(!object.isMesh) return;
    if(/asphalt|pavement|poured concrete|fescue|leaf litter|brushed greige floor porcelain|charcoal.gray tile|blue-gray crushed stone/i.test(object.material.name) && !/shingle/i.test(object.material.name))finishMeshes.push(object);
    let helper=object;
    while(helper && !/^Walk(Surface|Block)_/i.test(helper.name)) helper=helper.parent;
    if(!helper) return;
    walkSpace.add(object,helper.name);
    helper.visible=false;
  });
  // The camera starts are stored with the geometry so they follow changes to the floor plan.
  for(const key of Object.keys(tourAreas)){
    const eye=gltf.scene.getObjectByName('TourEye_'+key);
    const target=gltf.scene.getObjectByName('TourLook_'+key);
    if(eye && target){
      const position=eye.getWorldPosition(new THREE.Vector3());
      const aim=target.getWorldPosition(new THREE.Vector3());
      if(key==='entry'){
        // The roadside photo was taken behind the retaining wall. Start on the walk to the door.
        const towardDoor=aim.clone().sub(position);
        towardDoor.y=0;
        position.addScaledVector(towardDoor.normalize(),1.22);
      }
      starts[key]={
        eye:position.toArray(),target:aim.toArray(),
        fov:({entry:55,hall:68})[key] || 66
      };
    }
  }
  wildlife=installWildlife(world,walkSpace,camera,{onChange:activities.setDeer});
  fires=installTourFires(world,gltf.scene);
  firewood=installFirewood(world,gltf.scene,walkSpace,camera,fires,undefined,kind=>party.fuel(kind));
  woodSplit=installWoodSplitting(world,gltf.scene,walkSpace,{
    camera,schedule,takeSplitLog:firewood.takeSplitLog,
    handsBusy(){const wood=firewood.snapshot();return wood.held || wood.inFlight || activities.offeringFood;},
    onSwing:duration=>woodland.swing(duration),onStrike:woodland.strike,
    onContact:speed=>woodland.woodImpact(speed)
  });
  walkSpace.dynamicBlocker=woodSplit.blocksStep;
  grill=installGrill(world,gltf.scene,activities.setGrill);
  worldActions=installWorldActions({
    model:gltf.scene,canvas,camera,space:walkSpace,firewood,activities,sceneControls,
    getBody:()=>body,neighbors:party.neighbors,seatOccupied:party.seatOccupied,schedule,
    seat(next,heading){
      stopWalking();body=next;camera.position.set(body.x,body.y+body.eye,body.z);
      if(heading!=null){yaw=heading;pitch=-.1;}
      updateLookControls();look();
    }
  });
  entryDoors=installEntryDoors(gltf.scene,()=>{renderer.shadowMap.needsUpdate=true;});
  for(const [key,area] of Object.entries(tourAreas)){
    if(!starts[key])throw Error('Missing walking start for '+area.label);
    locationPicker.add(new Option(area.label,key));
  }
  const arrival=sceneControls.conditions();
  lighting=installTourLighting(world,renderer,gltf.scene,arrival);
  woodland.conditions(arrival);
  gltf.scene.traverse(object=>{
    if(/^(Tax[ _]parcel|Site[ _]section|Canopy)/i.test(object.name))object.visible=false;
  });
  gltf.scene.updateMatrixWorld(true);
  const ring=gltf.scene.getObjectByName('WalkBlock_FireRing');
  if(ring)ringCenter=new THREE.Box3().setFromObject(ring).getCenter(new THREE.Vector3());
  treeLights=installTreeLights(world,gltf.scene,reducedMotion);
  updateGrass=installWoodlandGrass(world,gltf.scene,walkSpace,reducedMotion);
  surfaces=installCabinSurfaces(gltf.scene,renderer);
  await loading.preparing(3,'Lighting and drawing your first view');
  floodlights=installMotionFloodlights(world,gltf.scene,schedule);
  batchStatic(gltf.scene);
  lighting.captureExterior();
  flashlight=installWalkingFlashlight(world);
  hallReflections=installHallReflections(world,gltf.scene,renderer);
  film=cabinFilm(renderer);
  changeView(viewFromAddress());
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
