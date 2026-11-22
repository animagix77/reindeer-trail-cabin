import * as T from 'three';
import {outdoorsFloor} from './woodland-sound.js';

const vec=()=>new T.Vector3();
const woodNames={twigs:'twigs',sticks:'stick',logs:'split log'};

// Read fixture positions before static batching. The same chair and ring volumes
// that keep a walker out of furniture define where they can sit and tend the fire.
function fixtures(model,wood){
  const targets=[],occluders=[];
  model.traverse(object=>{
    if(!object.isMesh)return;
    let owner=object;
    while(owner && !owner.name.startsWith('WalkBlock_'))owner=owner.parent;
    if(owner)occluders.push({owner:owner.name,mesh:object,bounds:new T.Box3().setFromObject(object,true)});
  });
  const boxOf=name=>new T.Box3().setFromObject(model.getObjectByName(name),true);
  function add(id,bounds,range,ignore){
    const target={id,bounds,center:bounds.getCenter(vec()),range,ignore};
    targets.push(target);return target;
  }
  const ring=add('pit',boxOf('WalkBlock_FireRing'),2.65,['WalkBlock_FireRing']);
  for(let i=0;i<4;i++){
    const helper='WalkBlock_YardChair0'+i;
    const chair=add('chair',boxOf(helper),2.1,[helper]);
    chair.number=i;
    chair.floor=chair.bounds.min.y-.01;
    const anchor=model.getObjectByName('YardChairSeat0'+i);
    chair.seatPoint=anchor?anchor.getWorldPosition(vec()):new T.Vector3(chair.center.x,chair.floor+.32,chair.center.z);
    chair.yaw=Math.atan2(chair.seatPoint.x-ring.center.x,chair.seatPoint.z-ring.center.z);
  }
  // A generous volume around the grate also includes the handle on a closed lid.
  const grate=model.getObjectByName('GrillSurface').getWorldPosition(vec());
  const grillBox=new T.Box3().setFromCenterAndSize(grate,new T.Vector3(1.22,.82,.77));
  add('grill',grillBox,2.65,['WalkBlock_DeckBarbecue','WalkBlock_GrillHoodTravel']);
  model.traverse(o=>{
    if(o.isMesh && o.material.name==='Cabin furnishing • Charcoal firebox glazing'){
      const glass=new T.Box3().setFromObject(o,true).expandByScalar(.15);
      add('furnace',glass,2.10,['WalkBlock_Hearth']);
    }
  });
  for(const [id,p] of Object.entries(wood.targets)){
    const bounds=new T.Box3().setFromCenterAndSize(p,new T.Vector3(.40,.14,.31));
    bounds.translate(new T.Vector3(0,.055,0));add(id,bounds,1.85,[]);
  }
  return {targets,occluders};
}

export function installWorldActions({model,canvas,camera,firewood,woodSplit,television,winterGear,activities,sceneControls,
  space,getBody,neighbors,seatOccupied,seat,schedule}){
  const button=document.getElementById('world-action'),label=document.getElementById('world-action-label');
  const {targets,occluders}=fixtures(model,firewood);
  const cast=new T.Raycaster(),ndc=new T.Vector2(),hit=vec(),broadHit=vec(),obstructions=[];
  let seated=null,standing=null,hover=null,press=null,displayed=null,caption='';
  const pointers=new Set();
  function available(){return !!getBody() && !activities.open && !document.querySelector('dialog[open]');}
  function actionFor(t,body){
    const wood=firewood.state;
    // With wood in hand a tap aims the throw, including at yard furniture.
    if(wood?.held && t.id!=='pit' && !Object.hasOwn(woodNames,t.id))return '';
    if(t.id==='furnace'){
      if(outdoorsFloor(body.label))return '';
      return sceneControls.isFurnaceOn()?'Turn furnace off':'Turn furnace on';
    }
    if(!outdoorsFloor(body.label))return '';
    switch(t.id){
      case 'grill':return activities.grillInReach?'Use grill':'';
      case 'chair':return seatOccupied(t.number)?'':'Sit by the fire';
      case 'pit':
        if(wood?.inFlight)return '';
        if(wood?.held)return wood.canToss?'Toss '+(wood.heldName||woodNames[wood.held])+' into fire':'';
        return sceneControls.isFireLit()?'Put out fire':'Light fire';
      default:
        if(wood?.held===t.id && !activities.offeringFood && wood.nearby.includes(t.id))
          return 'Put back '+(wood.heldName||woodNames[t.id]);
        return '';
    }
  }
  function blocked(t,distance){
    cast.far=distance-.025;
    for(const block of occluders){
      if(t.ignore?.includes(block.owner) || !cast.ray.intersectBox(block.bounds,broadHit))continue;
      // Rotated walls have large world-aligned bounds. Test their actual faces
      // before rejecting a reachable stove or grill on this side of the wall.
      obstructions.length=0;
      cast.intersectObject(block.mesh,false,obstructions);
      if(obstructions.length)return true;
    }
    return false;
  }
  function setRay(pixel){
    if(pixel){
      const rect=canvas.getBoundingClientRect();
      if(!rect.width||!rect.height)return false;
      ndc.set(2*(pixel.x-rect.left)/rect.width-1,1-2*(pixel.y-rect.top)/rect.height);
    }else ndc.set(0,0);
    camera.updateWorldMatrix(true,false);
    cast.setFromCamera(ndc,camera);
    cast.far=Infinity;return true;
  }
  function aim(pixel){
    const body=getBody();
    if(!body || !available())return null;
    if(seated)return {target:seated,caption:'Stand up'};
    if(!setRay(pixel))return null;
    if(winterGear && outdoorsFloor(body.label) && !woodSplit?.equipped &&
       !firewood.state?.held && !firewood.state?.inFlight && !activities.offeringFood){
      const gear=winterGear.aim(cast);
      if(gear && !blocked(gear,gear.contact.distance))return {target:gear,caption:gear.caption};
      if(winterGear.equipped)return null;
    }
    let best=null,closest=Infinity;
    for(const t of targets){
      const range=t.id==='pit' && firewood.state?.held?5.5:t.range;
      if(Math.hypot(t.center.x-body.x,t.center.z-body.z)>range || Math.abs(t.center.y-body.y)>2.15)continue;
      const text=actionFor(t,body);
      if(!text || !cast.ray.intersectBox(t.bounds,hit))continue;
      const distance=camera.position.distanceTo(hit);
      if(distance>=closest || blocked(t,distance))continue;
      closest=distance;best={target:t,caption:text};
    }
    if(!firewood.state?.held && !firewood.state?.inFlight && !activities.offeringFood){
      // Use the visible surface so that individual logs can be lifted from a
      // pile and a click in the spaces between twigs still hits the ground.
      for(const source of [firewood,woodSplit,television]){
        if(!source)continue;
        const tv=source===television;
        if(!tv && source!==woodSplit && woodSplit?.equipped)continue;
        cast.far=source===woodSplit?Math.min(closest,2.70):closest;
        const contact=tv?source.hit(cast):source.hitWood(cast);
        if(!contact || contact.distance>=closest)continue;
        if(source===woodSplit && (Math.hypot(body.x-contact.point.x,body.z-contact.point.z)>1.65 ||
            Math.abs(body.y-contact.point.y)>1.95))continue;
        const target={id:tv?'tv':'wood',source,contact};
        if(blocked(target,contact.distance))continue;
        closest=contact.distance;
        best={target,caption:tv?'Use TV':'Pick up '+(woodNames[contact.kind]||'split wood')};
      }
    }
    return best;
  }
  function show(item){
    displayed=item?.target??null;
    document.documentElement.toggleAttribute('data-direct-focus',!!displayed?.contact && !['sled','scoop','shovel'].includes(displayed.id));
    document.documentElement.toggleAttribute('data-grabbable',displayed?.id==='wood'||displayed?.id==='shovel');
    document.documentElement.toggleAttribute('data-direct-aim',!!displayed?.contact && (!hover || document.pointerLockElement===canvas));
    const next=item?.caption??'';
    if(next===caption)return;
    caption=next;button.hidden=!next;label.textContent=next;
    document.documentElement.toggleAttribute('data-world-focus',Boolean(next));
  }
  function leave(){
    if(!seated)return false;
    const from=standing;let next=from;
    const nearby=neighbors();
    const occupied=(x,z)=>nearby.some(p=>Math.abs(p.y-from.y)<.8 && Math.hypot(p.x-x,p.z-z)<.54);
    if(occupied(from.x,from.z)){
      search:for(const radius of [.55,.82,1.1])for(let i=0;i<12;i++){
        const x=from.x+Math.cos(i*Math.PI/6)*radius,z=from.z+Math.sin(i*Math.PI/6)*radius;
        if(occupied(x,z))continue;
        const free=space.spawn(x,z,from.y+from.eye,from.y);
        if(free && Math.abs(free.y-from.y)<.23){next=free;break search;}
      }
    }
    seated=standing=null;hover=null;show(null);
    document.documentElement.classList.remove('is-seated');seat(next,null);
    return true;
  }
  function sit(chair){
    if(seatOccupied(chair.number))return;
    standing={...getBody()};seated=chair;
    document.documentElement.classList.add('is-seated');
    const p=chair.seatPoint;
    seat({x:p.x,y:chair.floor,z:p.z,eye:p.y-chair.floor+.82,label:'WalkSurface_FireCircleGravel'},chair.yaw);
  }
  function use(item){
    if(!item || !available())return false;
    if(seated){leave();return true;}
    const t=item.target;
    if(t.id==='sled'||t.id==='scoop'||t.id==='shovel'){
      const used=winterGear.use(t,cast.ray.direction);schedule();return used;
    }
    if(t.contact){
      const used=t.id==='tv'?t.source.select(t.contact.uv):t.source.pickUpHit(t.contact);
      schedule();return used!==false;
    }
    if(!actionFor(t,getBody()))return false;
    switch(t.id){
      case 'chair':sit(t);break;
      case 'grill':activities.openGrill();break;
      case 'furnace':sceneControls.toggleFurnace();break;
      case 'pit':
        if(firewood.state?.held)firewood.toss();else sceneControls.toggleFire();
        break;
      default:
        firewood.putBack();
    }
    schedule();return true;
  }
  function currentAim(){
    return aim(document.pointerLockElement===canvas?null:hover);
  }
  function throwAt(pixel){
    if(!available() || seated || !firewood.state?.held || activities.offeringFood || !setRay(pixel))return false;
    const thrown=firewood.throwWood(cast.ray.direction);
    if(thrown)schedule();
    return thrown;
  }
  function update(){
    if(seated && seatOccupied(seated.number,true))leave();
    show(currentAim());
  }
  function cancel(){press=null;pointers.clear();}
  canvas.addEventListener('pointerdown',e=>{
    pointers.add(e.pointerId);
    press=pointers.size===1 && e.button===0?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;
  });
  canvas.addEventListener('pointermove',e=>{
    if(press && (Math.hypot(e.clientX-press.x,e.clientY-press.y)>7 ||
      document.pointerLockElement===canvas && Math.hypot(e.movementX,e.movementY)>7))press=null;
    if(e.pointerType==='mouse'){
      hover={x:e.clientX,y:e.clientY};schedule();
    }
  });
  canvas.addEventListener('pointerup',e=>{
    const tapped=press?.id===e.pointerId && Math.hypot(e.clientX-press.x,e.clientY-press.y)<=7;
    pointers.delete(e.pointerId);press=null;
    // While seated, looking around cannot accidentally stand the visitor up.
    if(!tapped || seated || e.defaultPrevented)return;
    const pixel=document.pointerLockElement===canvas?null:{x:e.clientX,y:e.clientY};
    const result=aim(pixel);
    if((result?use(result):throwAt(pixel)) && !activities.open && !document.querySelector('dialog[open]'))canvas.focus({preventScroll:true});
  });
  canvas.addEventListener('pointerleave',e=>{
    if(!button.contains(e.relatedTarget)){hover=null;schedule();}
  });
  for(const event of ['pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{press=null;pointers.delete(e.pointerId);});
  window.addEventListener('blur',cancel);
  window.addEventListener('pagehide',cancel);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancel();hover=null;}});
  window.addEventListener('touchend',e=>{if(!e.touches.length)cancel();},{passive:true});
  window.addEventListener('touchcancel',cancel,{passive:true});
  document.addEventListener('pointerlockchange',()=>{cancel();hover=null;schedule();});
  button.addEventListener('click',()=>{
    // Retest reach and sight after walking, and before acting on a pointer prompt.
    const aimed=currentAim();
    const target=aimed?.target;
    const same=target===displayed || target?.contact && target.contact.object===displayed?.contact?.object &&
      target.contact.instanceId===displayed.contact.instanceId;
    if(displayed && same && use(aimed) && !activities.open && !document.querySelector('dialog[open]'))canvas.focus({preventScroll:true});
  });
  document.addEventListener('keydown',e=>{
    if(e.target!==document.body && e.target!==canvas)return;
    if(/^(Key[WASD]|Arrow(Up|Down|Left|Right)|Page(Up|Down))$/.test(e.code)){
      hover=null;schedule();return;
    }
    if(e.defaultPrevented||e.repeat||e.altKey||e.ctrlKey||e.metaKey||
      !['KeyE','KeyG','KeyT'].includes(e.code))return;
    const aimed=currentAim();
    if(e.code==='KeyT'){
      if((aimed?.target.id==='pit' && firewood.state?.held)?use(aimed):throwAt(document.pointerLockElement===canvas?null:hover))e.preventDefault();
      return;
    }
    if(!aimed || (e.code==='KeyG' && aimed.target.id!=='wood' && !Object.hasOwn(woodNames,aimed.target.id)))return;
    if(use(aimed))e.preventDefault();
  });
  return {update,leave,get seated(){return !!seated;},get seatHeading(){return seated?.yaw;},get seatId(){return seated?.number;}};
}
