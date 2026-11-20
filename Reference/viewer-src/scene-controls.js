// Scene settings follow the visitor between destinations for the current tour.
export function installSceneControls({setConditions,setFurnace,setFirePit,setSound,viewStars,stopMovement}) {
  const get=id=>document.getElementById(id);
  const panel=get('scene-panel'), hour=get('scene-hour'), time=get('scene-clock');
  const weather=get('scene-weather'), furnace=get('scene-furnace');
  const pit=get('scene-fire');
  const sound=get('scene-sound'), soundState=get('scene-sound-status');
  const mutePreference='reindeer-woodland-sound';
  let burning=false,nearPit=false,lookingUp=false;
  let wantsSound=true, soundRevision=0, soundStateName='ready';
  try { wantsSound=localStorage.getItem(mutePreference)!=='off'; } catch {}

  function showSound(state) {
    soundStateName=state;
    sound.setAttribute('aria-checked',String(wantsSound));
    const messages={
      ready:['Ready','Sound is enabled and will start with your first interaction.'],
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

  function syncFire() {
    pit.textContent=burning?'Put out fire':'Light fire';
    pit.title=burning?'Extinguish the outdoor fire pit':'Start the outdoor fire pit';
    pit.setAttribute('aria-pressed',String(burning));
  }
  function changeWeather() {
    const h=Number(hour.value), whole=Math.floor(h);
    const label=(whole%12||12)+':'+String(Math.round((h-whole)*60)).padStart(2,'0')+(whole>=12?' PM':' AM');
    time.value=label;
    hour.setAttribute('aria-valuetext',label);
    setConditions({hour:h,weather:weather.value});
  }
  function changeFire() {
    burning=!burning;
    syncFire();
    setFirePit(burning);
  }
  panel.addEventListener('focusin',stopMovement);
  panel.addEventListener('keydown',e=>{
    if(e.key==='Escape')get('view').focus({preventScroll:true});
  });
  get('scene-stars').addEventListener('click',()=>viewStars());
  hour.addEventListener('input',changeWeather);
  weather.addEventListener('change',changeWeather);
  furnace.addEventListener('click',()=>{
    const on=furnace.getAttribute('aria-checked')!=='true';
    furnace.setAttribute('aria-checked',String(on));
    get('scene-furnace-status').textContent=on?'On':'Off';
    setFurnace(on);
  });
  pit.addEventListener('click',changeFire);
  document.addEventListener('keydown',event=>{
    if(nearPit && event.code==='KeyE' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey &&
       (event.target===document.body || event.target===get('view'))){
      event.preventDefault();changeFire();
    }
  });
  syncFire();
  return {
    contains:target=>panel.contains(target),
    snapshot(){return {hour:Number(hour.value),weather:weather.value,furnace:furnace.getAttribute('aria-checked')==='true',fire:burning};},
    apply(s){
      if(Number(hour.value)!==s.hour || weather.value!==s.weather){hour.value=s.hour;weather.value=s.weather;changeWeather();}
      if((furnace.getAttribute('aria-checked')==='true')!==s.furnace)furnace.click();
      if(burning!==s.fire)changeFire();
    },
    stargaze(){
      const h=Number(hour.value);
      if(h>=5 && h<20)hour.value='22';
      weather.value='clear';changeWeather();
    },
    setNearFire(near,atStars){
      if(nearPit!==near || lookingUp!==atStars){
        nearPit=near;
        lookingUp=atStars;
        get('scene-stars').setAttribute('aria-current',atStars?'location':'false');
      }
    }
  };
}
