// Walking help is always available from Guide, even after the first walk.
export function installTourInterface({stopMovement,resume,isOutside}){
  const get=id=>document.getElementById(id);
  const guide=get('tour-guide'),canvas=get('view'),cue=get('sky-cue');
  const scenePanel=get('scene-panel');
  let travelled=0,hasWalked=false,cueTimer;
  // Pointer adjustments finish in the scene; keyboard users can keep editing with arrows.
  let pointedControl=null;
  scenePanel.addEventListener('pointerdown',event=>{pointedControl=event.target;});
  scenePanel.addEventListener('keydown',()=>{pointedControl=null;});
  scenePanel.addEventListener('focusout',()=>{pointedControl=null;});
  scenePanel.addEventListener('change',event=>{
    if(pointedControl===event.target)canvas.focus({preventScroll:true});
  });
  get('scene-sound').addEventListener('click',event=>{
    if(event.detail>0)canvas.focus({preventScroll:true});
  });
  function clearCue(){
    clearTimeout(cueTimer);
    cue.textContent='';
  }
  get('guide-open').addEventListener('click',()=>{
    if(guide.open)return;
    if(document.pointerLockElement)document.exitPointerLock();
    stopMovement();
    guide.showModal();
    get('guide-close').focus({preventScroll:true});
  });
  get('guide-close').addEventListener('click',()=>guide.close());
  // Close first so mouse capture and zoom take effect on the active walking scene.
  guide.addEventListener('click',event=>{
    if(event.target.closest('#lock,#far,#near,#reset')){
      guide.close();
      canvas.focus({preventScroll:true});
    }
  },true);
  guide.addEventListener('close',resume);
  window.addEventListener('hashchange',()=>{
    if(guide.open)guide.close();
    clearCue();
  });
  get('scene-stars').addEventListener('click',()=>{
    clearCue();
    cue.textContent=isOutside()?'Look up through the trees to see the stars.':'Step outside and look up to see the stars.';
    cueTimer=setTimeout(clearCue,7500);
    canvas.focus({preventScroll:true});
  });
  get('scene-hour').addEventListener('input',clearCue);
  get('scene-weather').addEventListener('change',clearCue);
  return {
    get open(){return guide.open;},
    walked(metres){
      if(hasWalked)return;
      travelled+=metres;
      if(travelled<1.5)return;
      hasWalked=true;
      document.documentElement.classList.add('has-walked');
    }
  };
}
