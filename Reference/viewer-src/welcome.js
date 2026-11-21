export function installWelcome({pause,resume,enter,invite,offline}){
  const get=id=>document.getElementById(id);
  const dialog=get('welcome'),form=get('welcome-form'),start=get('welcome-start');
  const name=get('welcome-name'),avatar=get('welcome-avatar'),feedback=get('welcome-feedback');
  const identity=get('welcome-identity'),note=get('welcome-note');
  const close=get('welcome-close'),revisit=get('welcome-again'),solo=get('welcome-solo');
  let loadState='loading',entered=false,connecting=false;
  if(offline)note.textContent='You’re exploring this saved walkthrough on your own.';
  else if(invite)note.textContent='Friends on this walk can see your hiker’s name.';
  function refresh(){
    identity.hidden=note.hidden=loadState!=='ready'||entered;
    start.disabled=loadState!=='ready'||connecting||(!entered&&!name.value.trim());
    start.firstElementChild.textContent=loadState==='error'?'Walkthrough unavailable':
      loadState!=='ready'?'Loading…':connecting?'Starting walkthrough…':entered?'Return to walkthrough':'Start 3D walkthrough';
    name.disabled=avatar.disabled=connecting;
  }
  function open(){
    if(dialog.open)return;
    if(document.pointerLockElement)document.exitPointerLock();
    pause();refresh();dialog.showModal();
    get('welcome-title').focus({preventScroll:true});
  }
  async function submit(alone){
    if(entered){dialog.close();return;}
    const displayName=name.value.trim();
    if(loadState!=='ready'||connecting||!displayName)return;
    connecting=true;solo.hidden=true;feedback.textContent='';refresh();
    try{
      await enter({name:displayName,avatar:avatar.value},alone||offline);
      entered=true;
      close.hidden=false;dialog.setAttribute('closedby','closerequest');dialog.close();
    }catch(error){
      feedback.textContent=error.message||'Couldn’t connect to the cabin. Please try again.';
      solo.hidden=false;
    }finally{connecting=false;refresh();}
  }
  name.addEventListener('input',refresh);
  form.addEventListener('submit',e=>{e.preventDefault();void submit(false);});
  solo.addEventListener('click',()=>{void submit(true);});
  close.addEventListener('click',()=>{if(entered)dialog.close();});
  revisit.addEventListener('click',open);
  dialog.addEventListener('cancel',e=>{if(!entered)e.preventDefault();});
  dialog.addEventListener('keydown',e=>{
    if(!entered&&e.key==='Escape')e.preventDefault();
    e.stopPropagation();
  });
  dialog.addEventListener('close',()=>{
    if(!entered){open();return;}
    (get('tour-guide').open?revisit:get('view')).focus({preventScroll:true});
    resume();
  });
  open();
  return {get open(){return dialog.open;},setLoadState(state){loadState=state;refresh();}};
}
