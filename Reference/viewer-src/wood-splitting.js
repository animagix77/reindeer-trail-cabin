import * as T from 'three';
import {makeSplittingBlock} from './splitting-block.js';

const now=()=>performance.now()/1000;
const recoverSeconds=3.2, drawSeconds=.32;
const swingReach=1.20, pickupReach=1.45, returnDistance=1.80;
const clamp=n=>Math.min(1,Math.max(0,n));
// One beat crosses the painted band in each direction. The period stays
// identical for touch and keyboard even when the renderer drops frames.
const beat=t=>.5-.5*Math.cos(Math.max(0,t)*Math.PI*2/1.85);

export function installWoodSplitting(scene,model,space,{camera,schedule,takeSplitLog,handsBusy,onSwing,onStrike}){
  const station=makeSplittingBlock(model),root=station.root;
  function ground(x,z){
    return space.heights(x,z).find(h=>h.label==='WalkSurface_ParcelGround')?.y;
  }
  // End of the garage motor court where IMG_5816 looks down the gravel
  // shoulder into the yard. No permanent splitting station is identifiable
  // in the photographs; this spot leaves the garage and stair access clear.
  const px=-8,py=32.6;
  const x=4.65-.3048*(.995562*px+.094108*py);
  const z=-8.5+.3048*(-.094108*px+.995562*py);
  root.position.set(x,ground(x,z),z);root.rotation.y=1.52;scene.add(root);
  root.updateMatrixWorld(true);
  const worldPoint=(x,y,z)=>root.localToWorld(new T.Vector3(x,y,z));
  for(const name of ['Unsplit oak rounds','Split wood ready to carry','Split log cradle']){
    const mesh=root.getObjectByName(name),inst=new T.Matrix4(),q=new T.Vector3();
    for(let i=0;i<mesh.instanceMatrix.count;i++){
      mesh.getMatrixAt(i,inst);q.setFromMatrixPosition(inst);
      const wp=worldPoint(q.x,0,q.z),floor=ground(wp.x,wp.z);
      if(Number.isFinite(floor))inst.elements[13]+=floor-root.position.y;
      mesh.setMatrixAt(i,inst);
    }
    mesh.instanceMatrix.needsUpdate=true;
  }
  function blocker(name,cx,cz,width,depth,height){
    const g=new T.BoxGeometry(width,height,depth),box=new T.Mesh(g);
    box.position.copy(worldPoint(cx,height*.5,cz));box.rotation.y=root.rotation.y;
    box.updateMatrixWorld();space.add(box,'WalkBlock_Splitting'+name);g.dispose();box.material.dispose();
  }
  blocker('Block',0,0,.51,.51,.60);blocker('Rounds',-.92,-.16,.94,.40,.59);blocker('LogCradle',.92,-.15,.95,.33,.39);
  const eye=worldPoint(.04,0,.90);eye.y=(ground(eye.x,eye.z)??root.position.y)+1.59;
  const view={eye:eye.toArray(),target:worldPoint(0,.75,0).toArray(),fov:62};
  const el=id=>document.getElementById(id);
  const panel=el('woodwork'),trigger=el('split-open'),action=el('split-action'),mode=el('split-mode');
  const collect=el('split-collect'),reset=el('split-reset'),meter=el('split-meter'),needle=el('split-needle');
  const power=el('split-strength'),readout=el('split-strength-value'),reticle=el('split-reticle');
  const scoreText=el('split-score'),message=el('split-message'),canvas=el('view');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),touch=matchMedia('(pointer: coarse)');
  if(reduced.matches)mode.value='steady';

  let near=false,opened=false,equipped=false,distance=Infinity,drawnAt=0,aimBegan=0;
  let swing=null,queuedHit=null,strength=1,recoveryFrom=0,lastTick=now(),score=0,rewards=0;
  let roundSplit=false,shownPower=-1,shownState='',note='';
  function shadowChanged(){model.userData.lightRevision=(model.userData.lightRevision||0)+1;schedule();}
  function drawTime(){return reduced.matches?0:drawSeconds;}
  function stage(t){
    if(!equipped)return 'parked';
    if(swing)return 'swinging';
    if(t<drawnAt+drawTime())return 'drawing';
    return strength===1?'ready':'recovering';
  }
  function say(text){note=text;}
  function show(t){
    const phase=stage(t),canReach=distance<=(equipped?swingReach:pickupReach);
    const locked=document.pointerLockElement===canvas;
    const key=[near,opened,phase,canReach,mode.value,score,rewards,note,locked].join('|');
    if(key!==shownState){
      shownState=key;
      panel.hidden=!opened;trigger.hidden=!near;trigger.setAttribute('aria-expanded',String(opened));
      panel.toggleAttribute('data-equipped',equipped);panel.dataset.stage=phase;
      reticle.hidden=!near||!locked;
      action.textContent=({parked:'Pick up axe',drawing:'Lifting axe…',swinging:'Swinging…',recovering:'Resting…',ready:'Swing axe'})[phase];
      action.disabled=!canReach || !['parked','ready'].includes(phase);
      mode.disabled=!!swing;reset.disabled=!score||!!swing;collect.hidden=!rewards;collect.disabled=!!swing;
      meter.hidden=phase!=='ready'||mode.value!=='timed';
      scoreText.textContent=score+' '+(score===1?'point':'points')+' · '+rewards+' '+(rewards===1?'piece':'pieces')+' stacked';
      station.inventory(rewards);
      let guide=note;
      if(!guide && !canReach)guide='Step closer to the chopping block.';
      if(!guide && phase==='parked')guide=touch.matches?'Tap the axe to pick it up.':'Click the axe or press E to pick it up.';
      if(!guide && phase==='drawing')guide='Lifting the axe. Choose your spot on the round.';
      if(!guide && phase==='swinging')guide='Swinging through the round.';
      if(!guide && phase==='ready'){
        guide=touch.matches?'Tap the round to swing.':'Click the round or aim and press Space to swing.';
        if(mode.value==='timed')guide='Swing as the marker crosses the gold band.';
      }
      if(!guide && phase==='recovering')guide='Stand still to recover your strength.';
      if(message.textContent!==guide)message.textContent=guide;
    }
    const percent=strength===1?100:Math.floor(strength*100);
    if(shownPower!==percent){
      shownPower=percent;power.value=percent;readout.textContent=percent+'%';
    }
  }
  function returnAxe(){
    if(!equipped)return;
    if(swing && roundSplit)station.stroke(1,true,true,undefined,swing.aim);
    swing=null;queuedHit=null;equipped=false;canvas.style.cursor='';station.rest();shadowChanged();
  }
  function setOpen(on){
    if(on && !near)return;
    opened=on;
    if(!on){returnAxe();say('');}
    show(now());schedule();
  }
  function setRound(){
    station.begin();roundSplit=false;shadowChanged();
  }
  function pickup(){
    if(!near || distance>pickupReach || equipped)return false;
    opened=true;
    if(handsBusy()){
      say('Your hands are full. Put down what you’re carrying first.');show(now());return false;
    }
    canvas.style.cursor='';equipped=true;drawnAt=now();aimBegan=drawnAt+drawTime();
    if(roundSplit && strength===1)setRound();
    say('');show(drawnAt);shadowChanged();return true;
  }
  function strike(hit){
    const t=now();
    if(!equipped || strength<1 || distance>swingReach || swing)return false;
    if(stage(t)==='drawing'){
      if(!queuedHit)queuedHit=hit;
      return true;
    }
    queuedHit=null;
    const error=mode.value==='timed'?Math.abs(beat(t-aimBegan)-.5):0;
    const duration=reduced.matches?.38:station.swingDuration;
    swing={start:t,duration,aim:hit,good:error<=.16,contact:false,whoosh:false,
      centered:mode.value==='timed'?error<=.065:Math.hypot(hit.x,hit.z)<.085};
    canvas.style.cursor='';strength=0;recoveryFrom=t+duration;
    say('');show(t);schedule();return true;
  }
  function contact(){
    swing.contact=true;
    swing.good=swing.good && distance<=swingReach;
    onStrike(swing.good?(swing.centered?1:.82):.32);
    if(swing.good){
      roundSplit=true;rewards+=2;score+=mode.value==='steady'?1:swing.centered?3:2;
      say('Clean split. Two pieces stacked. Stand still to recover.');
    }else say('Glancing hit. Rest, then try the round again.');
    shadowChanged();
  }

  const ray=new T.Raycaster(),ndc=new T.Vector2(),localHit=new T.Vector3();
  const stump=root.getObjectByName('Scored chopping stump');
  function hitTest(clientX,clientY,slop=0){
    const rect=canvas.getBoundingClientRect();
    if(!rect.width || !rect.height)return null;
    const nx=clientX==null?0:2*(clientX-rect.left)/rect.width-1;
    const ny=clientY==null?0:1-2*(clientY-rect.top)/rect.height;
    camera.updateWorldMatrix(true,false);root.updateWorldMatrix(true,true);
    // Test the nearest station surface. In-hand geometry is excluded so the
    // visitor's grip never occludes their aim at the round.
    const targets=equipped?[station.round,stump]:[station.maul,station.round,stump];
    for(const [dx,dy] of (slop?[[0,0],[slop,0],[-slop,0],[0,slop],[0,-slop]]:[[0,0]])){
      ndc.set(nx+2*dx/rect.width,ny+2*dy/rect.height);ray.setFromCamera(ndc,camera);
      const hit=ray.intersectObjects(targets,true).find(({object})=>{
        for(let o=object;o && o!==root;o=o.parent)if(!o.visible)return false;
        return true;
      });
      if(!hit)continue;
      if(!equipped){
        for(let o=hit.object;o;o=o.parent)if(o===station.maul)return {kind:'axe'};
      }else if(hit.object===station.round){
        station.round.worldToLocal(localHit.copy(hit.point));
        return {kind:'round',x:localHit.x,z:localHit.z};
      }
    }
    return null;
  }
  function canInput(){return near && !document.querySelector('dialog[open]');}
  function activate(hit){
    if(!canInput())return false;
    if(!equipped)return hit?.kind==='axe' && pickup();
    return hit?.kind==='round' && strike(hit);
  }
  // A look drag, pinch or cancelled touch must never become a pickup or swing.
  const pressed=new Set();
  let tap=null;
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0||!canInput())return;
    canvas.style.cursor='';pressed.add(event.pointerId);
    tap=pressed.size===1?{id:event.pointerId,x:event.clientX,y:event.clientY}:null;
  });
  canvas.addEventListener('pointermove',event=>{
    if(document.pointerLockElement===canvas)return;
    if(!pressed.size && near && event.pointerType==='mouse'){
      const available=equipped?strength===1 && !swing && distance<=swingReach:distance<=pickupReach;
      const hit=available && hitTest(event.clientX,event.clientY,3);
      canvas.style.cursor=hit?'pointer':'';
    }
    if(!tap || tap.id!==event.pointerId)return;
    if(Math.hypot(event.clientX-tap.x,event.clientY-tap.y)>(event.pointerType==='touch'?10:5))tap=null;
  });
  canvas.addEventListener('pointerup',event=>{
    const didTap=tap && tap.id===event.pointerId;
    pressed.delete(event.pointerId);tap=null;
    if(!didTap || !canInput())return;
    const locked=document.pointerLockElement===canvas;
    const hit=hitTest(locked?null:event.clientX,locked?null:event.clientY,event.pointerType==='touch'?8:3);
    if(activate(hit))canvas.focus({preventScroll:true});
  });
  canvas.addEventListener('pointerleave',()=>{canvas.style.cursor='';});
  function cancelTap(event){pressed.delete(event.pointerId);tap=null;}
  canvas.addEventListener('pointercancel',cancelTap);canvas.addEventListener('lostpointercapture',cancelTap);
  window.addEventListener('blur',()=>{pressed.clear();tap=null;});
  document.addEventListener('pointerlockchange',()=>{canvas.style.cursor='';pressed.clear();tap=null;show(now());schedule();});

  trigger.addEventListener('click',()=>{setOpen(!opened);if(opened)action.focus({preventScroll:true});});
  el('split-close').addEventListener('click',()=>{setOpen(false);canvas.focus({preventScroll:true});});
  action.addEventListener('click',()=>{
    if(!canInput() || !opened)return;
    if(!equipped)pickup();
    else if(!activate(hitTest(null,null))){
      say('Look at the round on top of the block.');show(now());
    }
    canvas.focus({preventScroll:true});
  });
  mode.addEventListener('change',()=>{aimBegan=now();say('');show(aimBegan);schedule();});
  collect.addEventListener('click',()=>{
    if(!canInput() || !opened || !rewards || swing)return;
    if(takeSplitLog()){
      returnAxe();rewards--;say('You’re carrying a split log. Take it to the fire pit.');shadowChanged();
      canvas.focus({preventScroll:true});
    }else say('Your hands are full. Put down the wood you’re carrying first.');
    show(now());schedule();
  });
  reset.addEventListener('click',()=>{
    if(!canInput() || !opened || swing)return;
    score=0;say('Fresh score. Your stacked firewood is here.');show(now());schedule();
  });
  document.addEventListener('keydown',e=>{
    if(!canInput()||e.defaultPrevented||e.repeat||e.altKey||e.ctrlKey||e.metaKey)return;
    if(e.key==='Escape' && opened){setOpen(false);return;}
    if(document.pointerLockElement!==canvas && ![canvas,document.body].includes(e.target))return;
    if(e.code==='KeyE'){
      if(equipped){returnAxe();say('');show(now());}else pickup();
      e.preventDefault();
    }else if(e.code==='Space' && equipped){
      if(['ready','drawing'].includes(stage(now())) && !activate(hitTest(null,null))){say('Aim at the round on top of the block.');show(now());}
      e.preventDefault();
    }
  });

  return {view,update(activeView,seconds,moving){
    const p=camera.position;
    distance=Math.hypot(p.x-x,p.z-z);
    const next=activeView!=='property' && distance<2.5 && Math.abs(p.y-root.position.y-1.55)<1.25;
    if(next!==near){
      near=next;opened=next;say('');canvas.style.cursor='';pressed.clear();tap=null;
    }
    if(equipped && (!near || distance>returnDistance)){returnAxe();say('');}
    if(queuedHit && stage(seconds)==='ready'){
      const hit=queuedHit;queuedHit=null;strike(hit);
    }
    if(swing){
      const t=clamp((seconds-swing.start)/swing.duration);
      const untilContact=(station.impactFraction-t)*swing.duration;
      if(!swing.whoosh && untilContact>0 && untilContact<.20){
        swing.whoosh=true;if(!reduced.matches)onSwing(untilContact);
      }
      if(!swing.contact && t>=station.impactFraction)contact();
      station.stroke(t,swing.good,reduced.matches,camera,swing.aim);
      if(t===1)swing=null;
    }
    if(strength<1 && !moving){
      const elapsed=Math.max(0,seconds-Math.max(lastTick,recoveryFrom));
      strength=Math.min(1,strength+elapsed/recoverSeconds);
      if(strength===1){
        if(roundSplit)setRound();
        aimBegan=seconds;say('');
      }
    }
    lastTick=seconds;
    if(equipped && !swing){
      const raised=drawTime()?clamp((seconds-drawnAt)/drawTime()):1;
      station.hold(camera,seconds,reduced.matches,strength,raised);
      if(mode.value==='timed' && stage(seconds)==='ready')needle.style.left=(beat(seconds-aimBegan)*100).toFixed(1)+'%';
    }
    show(seconds);
    return !!swing || (strength<1 && !moving) || (equipped && (stage(seconds)==='drawing' || mode.value==='timed'));
  }};
}
