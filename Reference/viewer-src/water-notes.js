import {readGroundwater,wellSource} from './groundwater.js';

const quarterHour=15*60*1000;
const day=24*60*60*1000;
const cacheKey='reindeer-water-Sv535-v1';
const localDate=new Intl.DateTimeFormat('en-US',{
  timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',
  hour:'numeric',minute:'2-digit',timeZoneName:'short'
});

function savedObservation(){
  try{
    const entry=JSON.parse(localStorage.getItem(cacheKey));
    const observed=Date.parse(entry?.reading?.observedAt);
    if(Number.isFinite(entry?.checkedAt) && Number.isFinite(observed) &&
       observed<=entry.checkedAt && entry.checkedAt<=Date.now() &&
       Number.isFinite(entry.reading.feet) && typeof entry.reading.provisional==='boolean')return entry;
  }catch{}
  return null;
}

export function installWaterNotes({pause,resume,visitWell}){
  const get=id=>document.getElementById(id);
  const dialog=get('water-notes'),open=get('water-open'),close=get('water-close');
  const level=get('water-level'),depth=get('water-depth'),unit=get('water-unit');
  const observed=get('water-observed'),status=get('water-status'),retry=get('water-retry');
  get('water-station').href=wellSource;
  let saved=null,request=null,refreshTimer;

  function show(state){
    const reading=saved?.reading;
    level.hidden=observed.hidden=!reading;
    let note='';
    if(reading){
      const measured=Date.parse(reading.observedAt);
      depth.textContent=Math.abs(reading.feet).toFixed(2);
      unit.textContent=reading.feet<0?'ft above ground':'ft below ground';
      observed.textContent=localDate.format(measured)+(reading.provisional?' · Provisional':'');
      if(Date.now()-measured>=day)note='This observation is at least a day old.';
    }
    if(state==='loading')note+=(note?' ':'')+'Checking the USGS station…';
    if(state==='error')note+=(note?' ':'')+(reading?'Showing the last saved reading. A newer reading is unavailable.':'The USGS reading is unavailable.');
    status.textContent=note;status.hidden=!note;
    retry.hidden=state==='loading'||(state!=='error' && !note);
  }

  function queueRefresh(delay){
    clearTimeout(refreshTimer);
    if(dialog.open && !document.hidden)refreshTimer=setTimeout(()=>void refresh(),delay);
  }
  async function refresh(force=false){
    if(!dialog.open || request || document.hidden)return;
    clearTimeout(refreshTimer);
    const age=saved?Date.now()-saved.checkedAt:Infinity;
    if(!force && age>=0 && age<quarterHour){
      show('ready');queueRefresh(quarterHour-age);return;
    }
    const controller=new AbortController();
    request=controller;
    const deadline=setTimeout(()=>controller.abort(),10000);
    show('loading');
    try{
      const reading=await readGroundwater({signal:controller.signal});
      if(request!==controller || !dialog.open)return;
      saved={reading,checkedAt:Date.now()};
      try{localStorage.setItem(cacheKey,JSON.stringify(saved));}catch{}
      show('ready');
    }catch{
      if(request===controller && dialog.open)show('error');
    }finally{
      clearTimeout(deadline);
      if(request===controller){request=null;queueRefresh(quarterHour);}
    }
  }
  function stopRequests(){
    clearTimeout(refreshTimer);
    request?.abort();request=null;
  }
  open.addEventListener('click',()=>{
    if(dialog.open)return;
    if(document.pointerLockElement)document.exitPointerLock();
    pause();dialog.showModal();open.setAttribute('aria-expanded','true');
    close.focus({preventScroll:true});
    saved??=savedObservation();
    void refresh();
  });
  retry.addEventListener('click',()=>void refresh(true));
  get('water-visit').addEventListener('click',()=>dialog.close('visit'));
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const box=dialog.getBoundingClientRect();
    if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();
  });
  dialog.addEventListener('close',()=>{
    if(dialog.open)return;
    stopRequests();open.setAttribute('aria-expanded','false');
    const visit=dialog.returnValue==='visit';
    dialog.returnValue='';
    if(visit)visitWell();
    else open.focus({preventScroll:true});
    resume();
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)stopRequests();
    else if(dialog.open)void refresh();
  });
  return {get open(){return dialog.open;}};
}
