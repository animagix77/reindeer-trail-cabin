export function installWelcome({pause,resume,enter,invite,offline}){
  const get=id=>document.getElementById(id);
  const dialog=get('welcome'),form=get('welcome-form'),start=get('welcome-start');
  const name=get('welcome-name'),avatar=get('welcome-avatar'),feedback=get('welcome-feedback');
  const close=get('welcome-close'),revisit=get('welcome-again'),solo=get('welcome-solo');
  let loadState='loading',entered=false,connecting=false;
  if(offline)get('welcome-note').textContent='Enter a name to explore this saved copy on your own.';
  else if(invite)get('welcome-note').textContent='Join this invited group. Other visitors in the group can see your name and chat with you.';
  function refresh(){
    start.disabled=loadState!=='ready'||connecting||(!entered&&!name.value.trim());
    start.firstElementChild.textContent=loadState==='error'?'Cabin unavailable':
      loadState!=='ready'?'Loading…':connecting?'Connecting…':entered?'Return to the cabin':
      offline?'Start exploring':invite?'Join group':'Enter open house';
    name.disabled=avatar.disabled=connecting;
  }
  function open(){
    if(dialog.open)return;
    if(document.pointerLockElement)document.exitPointerLock();
    pause();refresh();dialog.showModal();
    const focusTarget=!entered&&matchMedia('(pointer: fine)').matches?name:get('welcome-title');
    focusTarget.focus({preventScroll:true});
  }
  async function submit(alone){
    if(entered){dialog.close();return;}
    const displayName=name.value.trim();
    if(loadState!=='ready'||connecting||!displayName)return;
    connecting=true;solo.hidden=true;feedback.textContent='';refresh();
    try{
      await enter({name:displayName,avatar:avatar.value},alone||offline);
      entered=true;get('welcome-identity').hidden=get('welcome-note').hidden=true;
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
