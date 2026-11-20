import {installSceneEnvironment} from './scene-environment.js';

export function installSceneControls({setConditions,share,setFurnace,setFirePit,setSound,stopMovement}) {
  const get=id=>document.getElementById(id);
  const environment=installSceneEnvironment({setConditions,share});
  const panel=get('scene-panel');
  const sound=get('scene-sound'), soundState=get('scene-sound-status');
  const mutePreference='reindeer-woodland-sound';
  let burning=false,furnaceOn=true;
  let wantsSound=true, soundRevision=0, soundStateName='ready';
  try { wantsSound=localStorage.getItem(mutePreference)!=='off'; } catch {}

  function showSound(state) {
    soundStateName=state;
    sound.setAttribute('aria-checked',String(wantsSound));
    const messages={
      ready:['On','Sound is enabled and will start with your first interaction.'],
      on:['On','Woodland ambience, fire and footsteps are on.'],
      off:['Off','Woodland ambience, fire and footsteps are muted.'],
      unavailable:['Unavailable','This browser could not play audio. Select Sound to retry.']
    };
    soundState.textContent=messages[state][0];
    sound.title=messages[state][1];
    sound.dataset.state=state;
  }
  async function changeSound(on) {
    const revision=++soundRevision;
    if(on) {
      showSound('ready');
      soundStateName='starting';
    } else showSound('off');
    try {
      const active=await setSound(on);
      if(soundRevision!==revision)return;
      if(on && !active)wantsSound=false;
      showSound(active?'on':on?'unavailable':'off');
    } catch {
      if(soundRevision===revision){wantsSound=false;showSound('unavailable');}
    }
  }
  function unlock(event) {
    if(!wantsSound || soundStateName!=='ready' || !event.isTrusted ||
       event.composedPath().includes(sound) || navigator.userActivation?.isActive===false)return;
    void changeSound(true);
  }
  showSound(wantsSound?'ready':'off');
  // Touchscreens grant activation on release. Keyboard and assistive clicks also unlock audio.
  for(const type of ['pointerup','keydown','click'])window.addEventListener(type,unlock,{capture:true,passive:true});
  sound.addEventListener('click',()=>{
    wantsSound=!wantsSound;
    try { localStorage.setItem(mutePreference,wantsSound?'on':'off'); } catch {}
    void changeSound(wantsSound);
  });

  function toggleFire(){
    burning=!burning;
    setFirePit(burning);
  }
  function toggleFurnace(){
    furnaceOn=!furnaceOn;
    setFurnace(furnaceOn);
  }
  panel.addEventListener('focusin',stopMovement);
  panel.addEventListener('keydown',e=>{
    if(e.key==='Escape')get('view').focus({preventScroll:true});
  });
  get('scene-stars').addEventListener('click',environment.stargaze);
  return {
    contains:target=>panel.contains(target),
    conditions:environment.settings,solo:environment.solo,
    snapshot(){return {...environment.snapshot(),furnace:furnaceOn,fire:burning};},
    apply(s,guest){
      environment.apply(s,guest);
      if(furnaceOn!==s.furnace)toggleFurnace();
      if(burning!==s.fire)toggleFire();
    },
    toggleFurnace,toggleFire,isFireLit:()=>burning,isFurnaceOn:()=>furnaceOn
  };
}
