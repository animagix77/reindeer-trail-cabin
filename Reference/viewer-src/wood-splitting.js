import * as T from 'three';
import {makeSplittingBlock} from './splitting-block.js';
import {createSplitPhysics} from './split-physics.js';

const now=()=>performance.now()/1000;
const clamp=T.MathUtils.clamp;
const drawSeconds=.34,loadSeconds=.66;
const effort=.13,freshReserve=.72,minimumStrength=.16,restedEnough=.51,fullRestSeconds=5.4;
const swingReach=1.2,pickupReach=1.45,returnDistance=1.8;

export function installWoodSplitting(scene,model,space,{camera,schedule,takeSplitLog,handsBusy,onSwing,onStrike,onContact,onStockWood,stockTotal=()=>0}){
  const station=makeSplittingBlock(model),root=station.root;
  const ground=(x,z)=>space.heights(x,z).find(h=>h.label==='WalkSurface_ParcelGround')?.y;
  // Gravel shoulder beside the garage motor court, clear of the driveway stairs.
  const px=-8,py=32.6;
  const x=4.65-.3048*(.995562*px+.094108*py),z=-8.5+.3048*(-.094108*px+.995562*py);
  root.position.set(x,ground(x,z),z);root.rotation.y=1.52;scene.add(root);
  root.updateMatrixWorld(true);
  const worldPoint=(x,y,z)=>root.localToWorld(new T.Vector3(x,y,z));
  function groundAt(x,z){
    const p=worldPoint(x,0,z);
    return (ground(p.x,p.z)??root.position.y)-root.position.y;
  }
  const cache=root.getObjectByName('Unsplit oak rounds');
  const matrix=new T.Matrix4(),p=new T.Vector3();
  for(let i=0;i<cache.count;i++){
    cache.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix);
    matrix.elements[13]+=groundAt(p.x,p.z);cache.setMatrixAt(i,matrix);
  }
  cache.instanceMatrix.needsUpdate=true;cache.computeBoundingSphere();
  function blocker(name,cx,cz,width,depth,height){
    const box=new T.Mesh(new T.BoxGeometry(width,height,depth));
    box.position.copy(worldPoint(cx,height*.5,cz));box.rotation.y=root.rotation.y;
    box.updateMatrixWorld();space.add(box,'WalkBlock_Splitting'+name);box.geometry.dispose();box.material.dispose();
  }
  blocker('Block',0,0,.51,.51,.60);blocker('Rounds',-.92,-.16,.94,.40,.59);
  const physics=createSplitPhysics({root,groundAt,onSupport:station.setSupported,onStockWood,onContact:speed=>{
    const range=Math.hypot(camera.position.x-x,camera.position.z-z);
    if(range<10)onContact?.(speed*Math.min(1,2/Math.max(1,range)));
  }});
  const eye=worldPoint(.04,0,.96);eye.y=(ground(eye.x,eye.z)??root.position.y)+1.59;
  const view={eye:eye.toArray(),target:worldPoint(0,.72,0).toArray(),fov:62};
  const el=id=>document.getElementById(id);
  const panel=el('woodwork'),action=el('split-action'),collect=el('split-collect');
  const clear=el('split-clear');
  const power=el('split-strength'),readout=el('split-strength-value'),reticle=el('split-reticle');
  const pile=el('split-score'),message=el('split-message'),canvas=el('view');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),touch=matchMedia('(pointer: coarse)');
  let near=false,distance=Infinity,equipped=false,drawnAt=0,strength=1,exhausted=false,recoverAt=0,lastTick=now();
  let swing=null,queuedHit=null,reloadAfter=null,loading=null,clearing=false,lastClear=0,lastShadow=0,hint='',hover=null;
  const stump=root.getObjectByName('Scored chopping stump');
  const ray=new T.Raycaster(),ndc=new T.Vector2(),point=new T.Vector3(),viewer=new T.Vector3();
  const oldEdge=new T.Vector3(),newEdge=new T.Vector3(),projected=new T.Vector3();
  let preferred=null,notch=null;
  function dirty(){model.userData.lightRevision=(model.userData.lightRevision||0)+1;}
  function canInput(){return near && !document.querySelector('dialog[open]');}
  function phase(t){
    if(!equipped)return 'parked';
    if(swing)return 'swinging';
    if(t<drawnAt+(reduced.matches?0:drawSeconds))return 'drawing';
    if(loading || clearing || reloadAfter!==null || !station.targets.length)return 'loading';
    return exhausted?'recovering':'ready';
  }
  function canReach(){return distance<=(equipped?swingReach:pickupReach);}
  function hud(t){
    panel.hidden=!near;
    const stage=phase(t);
    panel.dataset.stage=stage;panel.toggleAttribute('data-equipped',equipped);
    const percent=Math.floor(strength*100);
    if(power.value!==percent){power.value=percent;readout.textContent=percent+'%';}
    const n=physics.count;
    const quantity=stockTotal()+' stacked';
    if(pile.textContent!==quantity)pile.textContent=quantity;
    collect.hidden=!n;collect.disabled=!!swing||distance>pickupReach;
    clear.hidden=station.round.visible || !n || loading!==null || !equipped;clear.disabled=clearing || !!swing || distance>swingReach;
    const text=equipped?'Swing':'Pick up axe';
    if(action.textContent!==text)action.textContent=text;
    action.disabled=!canReach() || !['ready','parked'].includes(stage);
    let guide=stage==='recovering'?'Rest a moment to catch your breath.':hint;
    if(!guide && !canReach())guide='Step closer to the block.';
    if(!guide && stage==='parked')guide=touch.matches?'Tap the axe to pick it up.':'Click the axe to pick it up.';
    if(!guide && stage==='ready'){
      const gesture=touch.matches?'Tap':'Click';
      guide=gesture+(station.round.visible?' where you want to split the round.':' a piece on the stump to split it again.');
    }
    if(!guide && stage==='loading')guide=loading?'Setting the next round on the block.':clearing?'Clearing the stump.':'Let the wood settle.';
    if(message.textContent!==guide)message.textContent=guide;
  }

  function aimAt(x,z,target){
    // Sweep down onto the actual visible cutting surface, even if a billet
    // lies on its side. Its transform also fixes the orientation of the grain.
    ray.set(worldPoint(x,station.top+1,z),new T.Vector3(0,-1,0));
    ray.far=Infinity;
    const candidates=target?[target]:station.targets;
    for(const mesh of candidates)mesh.updateWorldMatrix(true,false);
    const top=ray.intersectObjects(candidates,false)[0];
    if(!top)return null;
    root.worldToLocal(point.copy(top.point));root.worldToLocal(viewer.copy(camera.position));
    const bearing=Math.atan2(viewer.x-point.x,viewer.z-point.z);
    const lateral=(point.x*Math.cos(bearing)-point.z*Math.sin(bearing))/station.radius;
    const angle=bearing+.36*clamp(lateral,-1,1);
    const anchor=top.object.worldToLocal(top.point.clone());
    return {kind:'round',target:top.object,anchor,x:point.x,y:point.y,z:point.z,...station.aimDirection(top.object,Math.cos(angle),-Math.sin(angle),top.face.normal)};
  }
  function guidedAim(){
    const stock=station.targets;
    const target=stock.includes(preferred)?preferred:stock[0];
    if(!target)return null;
    if(target===preferred && notch){
      const p=notch.clone().applyQuaternion(target.quaternion).add(target.position);
      const aim=aimAt(p.x,p.z,target);if(aim)return aim;
    }
    const center=station.grainCenter(target);
    return aimAt(center.x,center.z,target);
  }
  function hitTest(clientX,clientY,slop=0){
    const rect=canvas.getBoundingClientRect();
    const nx=clientX==null?0:2*(clientX-rect.left)/rect.width-1;
    const ny=clientY==null?0:1-2*(clientY-rect.top)/rect.height;
    camera.updateWorldMatrix(true,false);root.updateWorldMatrix(true,true);
    const stock=station.targets,targets=[stump,cache,...new Set([...stock,...physics.surface])];
    if(!equipped)targets.push(station.maul);
    const offsets=slop?[[0,0],[slop,0],[-slop,0],[0,slop],[0,-slop]]:[[0,0]];
    for(const [dx,dy] of offsets){
      ndc.set(nx+2*dx/rect.width,ny+2*dy/rect.height);ray.far=Infinity;ray.setFromCamera(ndc,camera);
      const hit=ray.intersectObjects(targets,true).find(({object})=>{
        for(let o=object;o && o!==root;o=o.parent)if(!o.visible)return false;
        return true;
      });
      if(!hit)continue;
      if(!equipped){
        for(let obj=hit.object;obj;obj=obj.parent)if(obj===station.maul)return {kind:'axe'};
      }else if(stock.includes(hit.object) && !loading){
        root.worldToLocal(point.copy(hit.point));
        const aim=aimAt(point.x,point.z,hit.object);
        if(aim)return aim;
      }
    }
    return null;
  }
  function showTarget(t){
    reticle.hidden=true;
    if(!near||!canReach()||!canInput()||swing||loading||clearing||reloadAfter!==null)return;
    const locked=document.pointerLockElement===canvas;
    const hit=locked?hitTest(null,null):hover;
    if(locked&&!hit)return;
    if(equipped){
      if(!station.targets.length)return;
      const aim=hit?.kind==='round' && station.targets.includes(hit.target)?hit:guidedAim();
      if(!aim)return;
      aim.target.localToWorld(projected.copy(aim.anchor));projected.y+=.003;
    }else station.maul.localToWorld(projected.set(0,0,-.27));
    camera.updateWorldMatrix(true,false);projected.project(camera);
    if(Math.abs(projected.x)>.995||Math.abs(projected.y)>.995||Math.abs(projected.z)>1)return;
    reticle.style.left=(locked?50:50*(1+projected.x))+'%';
    reticle.style.top=(locked?50:50*(1-projected.y))+'%';
    reticle.dataset.ready=String(phase(t)==='ready'||!equipped);
    reticle.hidden=false;
  }
  function refresh(){hud(now());showTarget(now());schedule();}
  function returnAxe(){
    swing=null;queuedHit=null;equipped=false;hover=null;canvas.style.cursor='';
    station.rest();dirty();
  }
  function pickup(){
    if(!near||!canReach()||equipped)return false;
    if(handsBusy()){hint='Put down what you’re carrying first.';refresh();return false;}
    equipped=true;drawnAt=now();hint='';hover=null;dirty();refresh();return true;
  }
  function strike(aim){
    const t=now();
    if(!aim || !equipped || distance>swingReach || exhausted || clearing || reloadAfter!==null || loading || !station.targets.includes(aim.target))return false;
    if(swing){
      if(t-swing.start>=swing.duration-.14)queuedHit??=aim;
      return false;
    }
    if(phase(t)==='drawing'){queuedHit??=aim;return true;}
    // The reserve drains with every stroke. Fresh arms can sustain the first
    // few full-speed swings before fatigue begins to affect the heavy maul.
    const stamina=Math.min(1,strength/freshReserve);
    const duration=(reduced.matches?.48:station.swingDuration)*(1+.95*(1-stamina)**1.35);
    strength=Math.max(0,strength-effort);exhausted=strength<minimumStrength;
    swing={start:t,duration,aim:{...aim,blockTop:station.top,stamina,endStamina:strength,duration},contact:false,whoosh:false};
    recoverAt=t+duration+.86;hint='';hover=null;canvas.style.cursor='';
    refresh();return true;
  }
  function resolveImpact(hit,t){
    swing.contact=true;
    if(!hit || hit.object!==swing.aim.target || distance>swingReach){
      swing.aim.outcome='glance';onStrike(.28,'glance');hint='Glancing blow. Aim inside the rim.';return;
    }
    const contact=root.worldToLocal(hit.point.clone());
    const result=station.impact({...swing.aim,x:contact.x,y:contact.y,z:contact.z,energy:.68+.32*swing.aim.stamina});
    swing.aim.outcome=result.split?'split':result.bite?'bite':'glance';
    onStrike((result.split?1:result.bite?.7:.28)*(.76+.24*swing.aim.stamina),swing.aim.outcome,result.area);
    if(result.split){
      physics.release(result.pieces,result.cut,swing.aim.target);
      preferred=result.pieces.find(piece=>piece.choppable)?.mesh;notch=null;
      hint='';
    }else if(result.bite){
      physics.lodge(swing.aim.target,contact,.68+.32*swing.aim.stamina);
      const {x,y,z,nx,nz}=result.cut;
      const direction=z*nx-x*nz>0?-1:1;
      preferred=swing.aim.target;
      notch=new T.Vector3(x-direction*.027*nz,y,z+direction*.027*nx)
        .sub(preferred.position).applyQuaternion(preferred.quaternion.clone().invert());
      hint='Follow the crack toward either end.';
    }else hint='Glancing blow. Aim inside the rim.';
    dirty();
  }
  function advanceSwing(t){
    const s=swing,end=clamp((t-s.start)/s.duration,0,1),impact=station.impactFraction;
    if(!s.whoosh && end>=impact-.18/s.duration){
      s.whoosh=true;if(!reduced.matches && end<impact)onSwing((impact-end)*s.duration);
    }
    if(!s.contact && end>=impact){
      // Evaluate the final descent even when a slow frame spans the entire hit.
      // Sweep the sharpened edge against the current, possibly notched mesh.
      const pose=(u,out)=>{
        station.stroke(u,true,false,camera,s.aim);
        return station.maul.localToWorld(out.copy(station.edge));
      };
      let hit=null;
      pose(impact-.08,oldEdge);
      for(let i=1;i<=5 && !hit;i++){
        pose(impact-.08+.08*i/5,newEdge);
        const length=oldEdge.distanceTo(newEdge);
        if(length>1e-7){
          ray.set(oldEdge,point.subVectors(newEdge,oldEdge).normalize());
          ray.far=length+.003;
          hit=ray.intersectObjects([stump,...new Set([...station.targets,...physics.surface])],false)[0];
        }
        oldEdge.copy(newEdge);
      }
      ray.far=Infinity;
      resolveImpact(hit,t);
    }
    station.stroke(end,true,reduced.matches,camera,s.aim);
    if(end===1)swing=null;
  }
  function reload(t){
    if(clearing){
      if(physics.canLoad())clearing=false;
      else if(t-lastClear>.72){physics.clearBlock(true);lastClear=t;}
    }
    if(!loading && !clearing && !station.round.visible && !swing){
      if(station.targets.length)reloadAfter=null;
      else reloadAfter??=t+.28;
    }
    if(reloadAfter!==null && t>=reloadAfter && !swing){
      if(physics.canLoad()){
        station.begin();preferred=notch=null;loading={start:t};reloadAfter=null;hint='';dirty();
      }else if(t-lastClear>1.5){physics.clearBlock();lastClear=t;}
    }
    if(!loading)return;
    const u=clamp((t-loading.start)/(reduced.matches?.12:loadSeconds),0,1);
    const travel=u*u*(3-2*u);
    station.round.position.set(-.62*(1-travel),station.top+.24*Math.sin(Math.PI*travel)-.21*(1-travel),-.22*(1-travel));
    station.round.rotation.set(1.32*(1-travel),0,.14*Math.sin(Math.PI*travel));
    if(u===1){loading=null;dirty();}
  }

  const pressed=new Set();let tap=null;
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0 || !canInput())return;
    pressed.add(e.pointerId);
    tap=pressed.size===1?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;
  });
  canvas.addEventListener('pointermove',e=>{
    if(document.pointerLockElement===canvas)return;
    if(tap?.id===e.pointerId && Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>(e.pointerType==='touch'?10:5))tap=null;
    if(pressed.size||!near||e.pointerType!=='mouse')return;
    hover=canReach() && !swing?hitTest(e.clientX,e.clientY,2):null;
    canvas.style.cursor=hover?'pointer':'';showTarget(now());
  });
  canvas.addEventListener('pointerup',e=>{
    const clicked=tap?.id===e.pointerId;pressed.delete(e.pointerId);tap=null;
    if(!clicked||!canInput())return;
    const locked=document.pointerLockElement===canvas;
    const hit=hitTest(locked?null:e.clientX,locked?null:e.clientY,e.pointerType==='touch'?9:3);
    if(hit?.kind==='axe'?pickup():hit?.kind==='round' && strike(hit))canvas.focus({preventScroll:true});
  });
  canvas.addEventListener('pointerleave',()=>{canvas.style.cursor='';hover=null;showTarget(now());});
  function cancel(e){pressed.delete(e.pointerId);tap=null;}
  canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',cancel);
  function clearPointers(){pressed.clear();tap=null;hover=null;canvas.style.cursor='';}
  window.addEventListener('blur',clearPointers);
  document.addEventListener('pointerlockchange',()=>{clearPointers();refresh();});
  action.addEventListener('click',()=>{
    if(!canInput()||!canReach())return;
    if(!equipped)pickup();
    else if(!reticle.hidden)strike(document.pointerLockElement===canvas?hitTest(null,null):guidedAim());
    canvas.focus({preventScroll:true});
  });
  clear.addEventListener('click',()=>{
    if(!canInput() || !equipped || swing || loading || station.round.visible || distance>swingReach)return;
    physics.clearBlock(true);clearing=true;preferred=notch=null;hint='';lastClear=now();
    canvas.focus({preventScroll:true});refresh();
  });
  collect.addEventListener('click',()=>{
    if(!canInput()||distance>pickupReach||swing||!physics.count)return;
    if(!handsBusy() && physics.take(takeSplitLog)){
      returnAxe();hint='Take your wood to the fire pit.';
    }else hint='Your hands are full.';
    canvas.focus({preventScroll:true});refresh();
  });
  document.addEventListener('keydown',e=>{
    if(!canInput()||e.defaultPrevented||e.repeat||e.altKey||e.ctrlKey||e.metaKey)return;
    if(document.pointerLockElement!==canvas && ![canvas,document.body].includes(e.target))return;
    if(e.code==='KeyE'){
      if(equipped){returnAxe();hint='';refresh();}else pickup();
      e.preventDefault();
    }else if(e.code==='Space' && equipped){
      const aim=hitTest(null,null);if(aim?.kind==='round')strike(aim);
      e.preventDefault();
    }
  });
  return {view,
    blocksStep(wx,wz,footY){
      if(!physics.count)return false;
      root.worldToLocal(p.set(wx,footY,wz));return physics.blocksStep(p.x,p.z,p.y);
    },
    update(activeView,seconds,moving){
      const dt=Math.max(0,seconds-lastTick);
      const activePhysics=physics.step(dt);
      distance=Math.hypot(camera.position.x-x,camera.position.z-z);
      const here=activeView!=='property' && distance<2.25 && Math.abs(camera.position.y-root.position.y-1.55)<1.25;
      if(near!==here){near=here;hint='';clearPointers();}
      if(equipped && (!near || distance>returnDistance)){returnAxe();hint='';}
      if(queuedHit && phase(seconds)==='ready'){
        const aim=queuedHit;queuedHit=null;strike(aim);
      }
      if(swing)advanceSwing(seconds);
      reload(seconds);
      if(strength<1 && !moving){
        strength=Math.min(1,strength+Math.max(0,seconds-Math.max(lastTick,recoverAt))/fullRestSeconds);
        if(exhausted && strength>=restedEnough)exhausted=false;
      }
      lastTick=seconds;
      if(equipped && !swing){
        const lift=reduced.matches?1:clamp((seconds-drawnAt)/drawSeconds,0,1);
        station.hold(camera,seconds,reduced.matches,strength,lift);
      }
      if(distance<9 && (activePhysics || loading || swing) && seconds-lastShadow>=.12){dirty();lastShadow=seconds;}
      hud(seconds);showTarget(seconds);
      return activePhysics || clearing || !!loading || reloadAfter!==null || !!swing || (strength<1&&!moving) || phase(seconds)==='drawing';
    }
  };
}
