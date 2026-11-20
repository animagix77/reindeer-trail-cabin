import {guestMarker} from './guest-marker.js';
import {openTourRoom,readRoom} from './tour-room.js';

export function installParty({world,getPose,choose,meet,label,snapshot,apply,stop,schedule}){
  const get=id=>document.getElementById(id);
  const dialog=get('party'),button=get('party-toggle'),start=get('party-start'),notice=get('party-status');
  const details=get('party-details'),join=get('party-join'),share=get('party-link'),log=get('party-log');
  const input=get('party-input'),markers=new Map();
  let room=null,own='',active='',invite=readRoom(),pulse=null,lastTick=0,unread=0,ready=false,applying=false;
  function lobby(){
    get('party-solo').hidden=!invite;
    start.textContent=invite?'Join group':'Create group';
    get('party-note').textContent=invite?'A friend invited you to explore the cabin together.':'Create a link for up to eight people. Keep this tab open while your friends visit.';
    details.hidden=true;join.hidden=false;start.disabled=false;
  }
  function open(){
    if(dialog.open)return;stop();if(document.pointerLockElement)document.exitPointerLock();
    unread=0;badge();dialog.showModal();
    (ready?input:get('party-name')).focus({preventScroll:true});
  }
  function badge(){button.textContent=unread?'Chat ('+unread+')':ready?'Group chat':'Friends';}
  function address(token){
    const base=location.hash.split('?')[0]||'#front-entry';
    const hash=base+(token?'?room='+token:'');history.replaceState(null,'',hash);
  }
  function members(list,local){
    own=local;const ids=new Set(list.map(v=>v.id));
    for(const [id,m] of markers)if(!ids.has(id)){world.remove(m.root);m.dispose();markers.delete(id);}
    get('party-people').replaceChildren();
    for(const guest of list){
      const chip=document.createElement(guest.id===own?'span':'button');chip.textContent=guest.name+(guest.id===own?' (you)':'');get('party-people').append(chip);
      if(guest.id===own)continue;
      let m=markers.get(guest.id);
      if(!m){m=guestMarker(guest.name,guest.id);m.chip=chip;markers.set(guest.id,m);world.add(m.root);}else m.chip=chip;
      m.name=guest.name;chip.onclick=()=>{if(m.target){dialog.close();meet({...m.target});}};
      pose(guest.id,guest.pose||m.target);
    }
    schedule();
  }
  function pose(id,p){
    const m=markers.get(id);if(!m||!p)return;
    if(m.chip && (m.target?.view!==p.view || !m.chip.title)){
      const place=label(p.view);m.chip.title='Meet '+m.name+' at '+place;
      m.chip.textContent=m.name+' · '+place;m.chip.setAttribute('aria-label',m.chip.title);
    }
    m.root.userData.destination=p.view;
    if(!m.target || Math.hypot(p.x-m.target.x,p.z-m.target.z)>2)m.root.position.set(p.x,p.y,p.z);
    m.target=p;m.root.rotation.y=p.yaw;schedule();
  }
  function message(item){
    const row=document.createElement('p'),by=document.createElement('strong');by.textContent=item.from;
    row.append(by,document.createTextNode(' '+item.text));log.append(row);
    while(log.childElementCount>45)log.firstChild.remove();
    log.scrollTop=log.scrollHeight;if(!dialog.open){unread=Math.min(99,unread+1);badge();}
  }
  function end(reason){
    clearInterval(pulse);pulse=null;
    const hadRoom=ready;
    ready=false;own='';room=null;unread=0;active='';if(hadRoom){invite='';address('');}
    for(const m of markers.values()){world.remove(m.root);m.dispose();}markers.clear();
    log.replaceChildren();share.value='';get('party-people').replaceChildren();badge();lobby();
    notice.textContent=reason;if(!dialog.open && hadRoom)open();schedule();
  }
  function begin(e){
    e.preventDefault();if(room)return;
    if(location.protocol==='file:'){notice.textContent='Open the public cabin tour to invite friends.';return;}
    const name=get('party-name').value.trim();if(!name){get('party-name').focus();return;}
    notice.textContent='Connecting…';start.disabled=true;
    try{room=openTourRoom({name,invite,snapshot,onEnd:end,onRoster:members,onPose:pose,onMessage:message,
      onScene(s){applying=true;try{apply(s);}finally{applying=false;}},
      onReady(token){
        ready=true;pulse=setInterval(()=>room?.move(getPose()),160);active=token;address(token);share.value=location.href;
        if(getPose().view==='property')choose('entry');
        join.hidden=true;details.hidden=false;notice.textContent=invite?'You joined the group.':'Your group is open. Share the invitation below.';
        badge();input.focus();schedule();
      }
    });}catch{end('This browser could not open a group connection. Try the public tour in a current browser.');}
  }
  button.addEventListener('click',open);get('party-close').onclick=()=>dialog.close();
  get('party-solo').onclick=()=>{room?.leave();invite='';address('');lobby();dialog.close();};
  join.addEventListener('submit',begin);
  get('party-chat').addEventListener('submit',e=>{e.preventDefault();if(!input.value.trim())return;room?.send(input.value.trim());input.value='';});
  get('party-copy').onclick=async()=>{
    const url=location.href.split('#')[0]+'#'+(location.hash.slice(1).split('?')[0]||'front-entry')+'?room='+active;
    share.value=url;try{await navigator.clipboard.writeText(url);notice.textContent='Invitation copied.';}
    catch{share.focus();share.select();notice.textContent='Copy the selected invitation link.';}
  };
  get('party-leave').onclick=()=>room?.leave();
  window.addEventListener('pagehide',()=>{if(room){ready=false;room.leave();}});
  lobby();
  return {
    initial(){if(invite)open();},
    get open(){return dialog.open;},
    get suffix(){const value=active||invite;return value?'?room='+value:'';},
    conditions(){if(ready && !applying)room.conditions(snapshot());},
    update(seconds){
      if(!ready)return false;
      const p=getPose();

      const k=1-Math.exp(-Math.min(.12,seconds-lastTick)*17);lastTick=seconds;
      let moving=false;
      for(const m of markers.values()){
        if(!m.target)continue;
        const t=m.target;m.root.visible=t.view!=='property' && p.view!=='property' && Math.hypot(p.x-t.x,p.z-t.z)>.38;
        if(!m.root.visible)continue;
        const pos=m.root.position;if(Math.hypot(pos.x-t.x,pos.y-t.y,pos.z-t.z)>.008){
          pos.x+=(t.x-pos.x)*k;pos.y+=(t.y-pos.y)*k;pos.z+=(t.z-pos.z)*k;moving=true;
        }
      }
      return moving;
    }
  };
}
