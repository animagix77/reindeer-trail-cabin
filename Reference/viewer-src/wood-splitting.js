import * as T from 'three';
import {makeSplittingBlock} from './splitting-block.js';

const now=()=>performance.now()/1000;
const clamp=n=>Math.min(1,Math.max(0,n));
// One beat crosses the painted band in each direction. The period stays
// identical for touch and keyboard even when the renderer drops frames.
const beat=t=>.5-.5*Math.cos(Math.max(0,t)*Math.PI*2/1.85);

export function installWoodSplitting(scene,model,space,{schedule,takeSplitLog,onStrike=()=>{}}){
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
  const eye=worldPoint(.05,0,2.32);eye.y=(ground(eye.x,eye.z)??root.position.y)+1.59;
  const view={eye:eye.toArray(),target:worldPoint(-.03,.63,-.05).toArray(),fov:56};
  const el=id=>document.getElementById(id);
  const panel=el('woodwork'),trigger=el('split-open'),action=el('split-action'),mode=el('split-mode');
  const collect=el('split-collect'),reset=el('split-reset'),meter=el('split-meter'),needle=el('split-needle');
  const scoreText=el('split-score'),message=el('split-message');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  if(reduced.matches)mode.value='steady';
  let opened=false,near=false,lastView=null,stage='ready',score=0,rewards=0;
  let began=0,good=false,centered=false,credited=false,struck=false,lastNeedle='';
  function shadowChanged(){model.userData.lightRevision=(model.userData.lightRevision||0)+1;schedule();}
  function show(){
    panel.hidden=!opened;trigger.hidden=!near;trigger.setAttribute('aria-expanded',String(opened));
    const aiming=stage==='aiming',swinging=stage==='swinging';
    action.textContent=aiming?'Swing maul':swinging?'Swinging…':stage==='done'?'Set next round':'Set round';
    action.disabled=swinging;mode.disabled=aiming||swinging;reset.disabled=swinging||(!score && stage==='ready');
    meter.hidden=!aiming || mode.value==='steady';collect.hidden=rewards===0;scoreText.textContent=score+' '+(score===1?'point':'points')+' · '+rewards+' '+(rewards===1?'piece':'pieces')+' stacked';
    station.inventory(rewards);
  }
  function setOpen(on){
    if(on && !near)return;
    opened=on;
    if(!on){
      if(stage==='aiming'||stage==='swinging'){
        stage=credited?'done':'ready';
        if(!credited)station.begin();
        else station.stroke(1,true,true);
        station.rest();shadowChanged();
      }
    }else if(document.pointerLockElement)document.exitPointerLock();
    if(on && !message.textContent)message.textContent='Set a round on the block to begin.';
    show();schedule();
  }
  function award(){
    if(credited || !good)return;
    credited=true;score+=mode.value==='steady'?1:centered?3:2;rewards+=2;
    show();
  }
  function act(){
    if(!opened || !near || stage==='swinging')return;
    const t=now();
    if(stage!=='aiming'){
      stage='aiming';began=t;credited=false;station.begin();
      message.textContent=mode.value==='steady'?'The round is steady. Swing when you’re ready.':'Swing as the marker crosses the gold band.';
    }else{
      const error=Math.abs(beat(t-began)-.5);
      good=mode.value==='steady' || error<=.16;centered=error<=.065;
      struck=false;began=t;stage='swinging';message.textContent='';
    }
    shadowChanged();show();schedule();
  }
  trigger.addEventListener('click',()=>{setOpen(!opened);if(opened)action.focus({preventScroll:true});});
  el('split-close').addEventListener('click',()=>{setOpen(false);trigger.focus({preventScroll:true});});
  action.addEventListener('click',act);
  mode.addEventListener('change',()=>{message.textContent=mode.value==='steady'?'Steady mode gives you as long as you like to swing.':'Timed swings earn extra points near the center.';show();});
  collect.addEventListener('click',()=>{
    if(!opened || !near || !rewards)return;
    if(takeSplitLog()){
      rewards--;shadowChanged();message.textContent='You’re carrying a split log. Take it to the fire pit.';show();
      if(!rewards)action.focus({preventScroll:true});
    }else message.textContent='Your hands are full. Put down the wood you’re carrying first.';
    schedule();
  });
  reset.addEventListener('click',()=>{
    if(!opened || !near || stage==='swinging')return;
    stage='ready';score=0;credited=false;station.begin();station.rest();shadowChanged();
    message.textContent='Fresh score. Your stacked firewood is here.';show();schedule();
  });
  document.addEventListener('keydown',event=>{
    if(!opened || !near || event.defaultPrevented || document.querySelector('dialog[open]'))return;
    if(event.key==='Escape'){el('split-close').click();return;}
    if(event.code==='Space' && !event.repeat && ['view','split-open'].includes(document.activeElement?.id)){
      event.preventDefault();act();
    }
  });
  return {view,update(camera,activeView,seconds){
    const p=camera.position;
    const next=activeView!=='property' && Math.hypot(p.x-x,p.z-z)<2.95 && Math.abs(p.y-root.position.y-1.55)<1.25;
    if(next!==near || activeView!==lastView){
      const arrived=activeView==='splitting' && (!near || lastView!==activeView);
      near=next;lastView=activeView;
      if(!near)setOpen(false);
      else if(arrived)setOpen(true);
      else show();
    }
    if(!opened || !near)return false;
    const elapsed=Math.max(0,seconds-began),steady=mode.value==='steady';
    if(stage==='aiming'){
      station.lift(elapsed,steady||reduced.matches);
      if(steady)return false;
      const value=(beat(elapsed)*100).toFixed(1)+'%';
      if(value!==lastNeedle){needle.style.left=value;lastNeedle=value;}
      return true;
    }
    if(stage==='swinging'){
      const t=clamp(elapsed/(reduced.matches?.17:.78));
      station.stroke(t,good,reduced.matches);
      if(t>=.48 && !struck){struck=true;shadowChanged();onStrike(good?(centered && !steady?1:.82):.32);award();}
      if(t<1)return true;
      stage=good?'done':'ready';station.rest();shadowChanged();
      message.textContent=good?(steady?'Clean split.':centered?'Center hit!':'Good split.')+' Two pieces for the fire pit.':'Glancing hit. The round is still on the block.';
      show();
    }
    return false;
  }};
}
