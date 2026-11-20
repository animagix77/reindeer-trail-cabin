// Scene settings follow the visitor between destinations for the current tour.
export function installSceneControls({setConditions,setFurnace,setFirePit,setSound,viewStars,stopMovement}) {
  const get=id=>document.getElementById(id);
  const toggle=get('scene-toggle'), panel=get('scene-panel'), hour=get('scene-hour');
  const time=get('scene-clock'), weather=get('scene-weather'), furnace=get('scene-furnace');
  const pit=get('scene-fire'), nearby=get('nearby-fire');
  const sound=get('scene-sound');
  const yardStars=get('yard-stars');
  let burning=false,nearPit=false,lookingUp=false,soundRevision=0;
  function syncFire() {
    const label=burning?'Extinguish fire':'Start fire';
    pit.textContent=nearby.textContent=label;
    nearby.hidden=!nearPit || !panel.hidden;
    yardStars.hidden=nearby.hidden || lookingUp;
  }
  function displayPanel(open,restoreFocus=false) {
    panel.hidden=!open;
    toggle.setAttribute('aria-expanded',String(open));
    if(open){
      stopMovement();
      if(document.pointerLockElement) document.exitPointerLock();
      hour.focus({preventScroll:true});
    } else if(restoreFocus) toggle.focus({preventScroll:true});
    syncFire();
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
  get('scene-stars').addEventListener('click',()=>viewStars());
  yardStars.addEventListener('click',()=>viewStars());
  sound.addEventListener('click',async()=>{
    const ticket=++soundRevision;
    const on=sound.getAttribute('aria-checked')!=='true';
    sound.setAttribute('aria-checked',String(on));
    sound.textContent=on?'On':'Off';
    const enabled=await setSound(on);
    if(ticket!==soundRevision)return;
    sound.setAttribute('aria-checked',String(enabled));
    sound.textContent=enabled?'On':on?'Unavailable':'Off';
  });
  hour.addEventListener('input',changeWeather);
  weather.addEventListener('change',changeWeather);
  furnace.addEventListener('click',()=>{
    const on=furnace.getAttribute('aria-checked')!=='true';
    furnace.setAttribute('aria-checked',String(on));
    furnace.textContent=on?'On':'Off';
    setFurnace(on);
  });
  toggle.addEventListener('click',()=>displayPanel(panel.hidden));
  pit.addEventListener('click',changeFire);
  nearby.addEventListener('click',changeFire);
  document.addEventListener('pointerdown',event=>{
    if(!panel.hidden && !panel.contains(event.target) && !toggle.contains(event.target))displayPanel(false);
  },true);
  document.addEventListener('focusin',event=>{
    if(!panel.hidden && !panel.contains(event.target) && event.target!==toggle)displayPanel(false);
  });
  document.addEventListener('keydown',event=>{
    if(!panel.hidden && event.key==='Escape'){
      event.preventDefault();displayPanel(false,true);
    } else if(panel.hidden && nearPit && event.code==='KeyE' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey &&
      (event.target===document.body || event.target.id==='view')){
      event.preventDefault();changeFire();
    }
  });
  return {
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
    get open(){return !panel.hidden;},
    close(){if(!panel.hidden)displayPanel(false);},
    setNearFire(near,atStars){if(nearPit!==near || lookingUp!==atStars){nearPit=near;lookingUp=atStars;syncFire();}}
  };
}
