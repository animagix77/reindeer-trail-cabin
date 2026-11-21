// Walking help is always available from Guide, even after the first walk.
export function installTourInterface({stopMovement,resume,isOutside}){
  const get=id=>document.getElementById(id);
  const guide=get('tour-guide'),stay=get('stay-dialog'),canvas=get('view'),cue=get('sky-cue');
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
  for(const [dialog,open,close] of [[guide,get('guide-open'),get('guide-close')],[stay,get('stay-open'),get('stay-close')]]){
    open.addEventListener('click',()=>{
      if(dialog.open)return;
      if(document.pointerLockElement)document.exitPointerLock();
      stopMovement();
      dialog.showModal();
      (dialog.querySelector('.stay-option')||close).focus({preventScroll:true});
    });
    close.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',resume);
  }
  // Close first so mouse capture and zoom take effect on the active walking scene.
  guide.addEventListener('click',event=>{
    if(event.target.closest('#lock,#far,#near,#reset')){
      guide.close();
      canvas.focus({preventScroll:true});
    }
  },true);
  window.addEventListener('hashchange',()=>{
    if(guide.open)guide.close();
    if(stay.open)stay.close();
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
    get open(){return guide.open||stay.open;},
    walked(metres){
      if(hasWalked)return;
      travelled+=metres;
      if(travelled<1.5)return;
      hasWalked=true;
      document.documentElement.classList.add('has-walked');
    }
  };
}
