import {guestMarker} from './guest-marker.js';
import {openTourRoom,readRoom} from './tour-room.js';

export function installParty({world,getPose,joined,meet,snapshot,apply,solo,snapshotFuel,applyFuel,addRemoteFuel,stop,schedule}){
  const get=id=>document.getElementById(id);
  const dialog=get('party'),button=get('party-toggle'),notice=get('party-status'),rejoin=get('party-rejoin');
  const details=get('party-details'),share=get('party-link'),log=get('party-log'),input=get('party-input');
  const markers=new Map(),speakerLabels=new Map();
  const invite=readRoom(),publicRoom=!invite,offline=location.protocol==='file:';
  let profile=null,room=null,own='',slot=0,pulse,lastTick=null,unread=0,ready=false,applying=false,isHost=false;
  let pendingEntry=null,departing=false,hasEntered=false;
  const neighbors=()=>Array.from(markers.values(),m=>m.target).filter(Boolean);
  function meetAt(p){meet(p,{index:slot,occupied:neighbors()});}
  function open(){
    if(dialog.open)return;stop();if(document.pointerLockElement)document.exitPointerLock();
    unread=0;badge();dialog.showModal();
    (ready?input:rejoin.hidden?get('party-close'):rejoin).focus({preventScroll:true});
  }
  function badge(){
    button.textContent=unread?'Chat ('+unread+')':'Cabin chat';
    button.setAttribute('aria-label',unread?'Cabin chat, '+unread+' unread messages':'Cabin chat');
  }
  function canChat(value){
    input.disabled=!value;
    get('party-chat').querySelector('button').disabled=!value;
  }
  function removeMarker(marker){world.remove(marker.root);marker.dispose();}
  function members(list,local){
    own=local;const ids=new Set(list.map(v=>v.id));
    const nameCounts=new Map();
    for(const guest of list)nameCounts.set(guest.name,(nameCounts.get(guest.name)||0)+1);
    speakerLabels.clear();
    for(const guest of list){
      const role=guest.slot===0?'host':'guest '+guest.slot;
      speakerLabels.set(guest.id,nameCounts.get(guest.name)>1?guest.name+' ('+role+')':guest.name);
    }
    for(const [id,m] of markers)if(!ids.has(id)){removeMarker(m);markers.delete(id);}
    const people=get('party-people');people.replaceChildren();
    for(const guest of list){
      const row=document.createElement('div');row.className='party-person';people.append(row);
      if(guest.id===own){
        const self=document.createElement('span');self.textContent=speakerLabels.get(own)+' (you)';row.append(self);continue;
      }
      let m=markers.get(guest.id);
      if(m&&(m.name!==guest.name||m.avatar!==guest.avatar)){removeMarker(m);markers.delete(guest.id);m=null;}
      if(!m){
        m=guestMarker(guest.name,guest.id,guest.avatar);
        m.name=guest.name;m.avatar=guest.avatar;markers.set(guest.id,m);world.add(m.root);
      }
      m.displayName=speakerLabels.get(guest.id);
      const chip=document.createElement('button');chip.type='button';chip.textContent=m.displayName;row.append(chip);m.chip=chip;
      chip.onclick=()=>{if(m.target&&m.target.view!=='property'){dialog.close();meetAt({...m.target});}};
      if(isHost&&!publicRoom){
        const place=document.createElement('button');place.type='button';place.className='place';place.textContent='Place nearby';
        place.setAttribute('aria-label','Place '+m.displayName+' nearby');row.append(place);
        place.onclick=()=>{
          if(room?.place(guest.id,getPose()))notice.textContent='Placed '+m.displayName+' near you.';
          else notice.textContent='Your friend could not be placed nearby. Try again in a moment.';
        };
      }
      pose(guest.id,guest.pose||m.target);
      if(!m.target)chip.disabled=true;
    }
    schedule();
  }
  function pose(id,p){
    const m=markers.get(id);if(!m||!p)return;
    if(m.chip&&(m.target?.view!==p.view||m.target?.seated!==p.seated||!m.chip.title)){
      m.chip.title='Meet '+m.displayName+(p.seated?' by the fire':' where they are standing');
      m.chip.disabled=p.view==='property';
      m.chip.setAttribute('aria-label',m.chip.title);
    }
    m.root.userData.destination=p.view;
    if(!m.target||Math.hypot(p.x-m.target.x,p.y-m.target.y,p.z-m.target.z)>2)m.root.position.set(p.x,p.y,p.z);
    m.target=p;m.root.rotation.y=p.yaw;schedule();
  }
  function message(item,history){
    const row=document.createElement('p'),by=document.createElement('strong');by.textContent=speakerLabels.get(item.fromId)||item.from;
    row.append(by,document.createTextNode(' '+item.text));log.append(row);
    while(log.childElementCount>45)log.firstChild.remove();
    log.scrollTop=log.scrollHeight;
    if(history||item.fromId===own)return;
    markers.get(item.fromId)?.say(item.text);
    if(!dialog.open){unread=Math.min(99,unread+1);badge();}
    schedule();
  }
  function end(reason){
    clearInterval(pulse);lastTick=null;
    ready=false;own='';room=null;unread=0;
    for(const m of markers.values())removeMarker(m);
    markers.clear();speakerLabels.clear();log.replaceChildren();get('party-people').replaceChildren();
    details.hidden=true;rejoin.hidden=offline;canChat(false);badge();solo();
    notice.textContent=reason;
    if(pendingEntry){pendingEntry.reject(new Error(reason));pendingEntry=null;}
    else if(hasEntered&&!departing&&!dialog.open)open();
    schedule();
  }
  function connect(){
    if(room||!profile)return Promise.reject(new Error('A connection is already in progress.'));
    rejoin.hidden=true;notice.textContent='Connecting…';
    return new Promise((resolve,reject)=>{
      pendingEntry={resolve,reject};
      try{
        const handle=openTourRoom({...profile,invite,publicRoom,snapshot,onEnd:end,onRoster:members,onPose:pose,onMessage:message,
          snapshotFuel,onFuelState:applyFuel,onAddFuel:addRemoteFuel,
          onPlace(p){if(dialog.open)dialog.close();meetAt(p);},
          onScene(s){applying=true;try{apply(s,!isHost);}finally{applying=false;}},
          onReconnecting(reason){
            ready=false;isHost=false;canChat(false);clearInterval(pulse);lastTick=null;
            notice.textContent=reason;button.textContent='Chat reconnecting…';schedule();
          },
          onReady(token,arrival){
            isHost=arrival.isHost;slot=arrival.index;ready=true;hasEntered=true;
            if(isHost)solo();
            if(!arrival.reconnected)joined(arrival);
            room.move(getPose());clearInterval(pulse);pulse=setInterval(()=>room?.move(getPose()),160);
            share.value=location.origin+location.pathname+(publicRoom?'':'#driveway?room='+token);
            details.hidden=false;canChat(true);notice.textContent='';badge();schedule();
            pendingEntry?.resolve();pendingEntry=null;
          }
        });
        // A browser without WebRTC can fail during construction.
        if(pendingEntry)room=handle;
      }catch{end('The cabin could not connect. Try again or explore on your own.');}
    });
  }
  button.addEventListener('click',open);get('party-close').onclick=()=>dialog.close();
  rejoin.onclick=()=>{connect().catch(()=>{});};
  get('party-chat').addEventListener('submit',e=>{
    e.preventDefault();if(!ready||!input.value.trim())return;room.send(input.value.trim());input.value='';
  });
  get('party-copy').onclick=async()=>{
    try{await navigator.clipboard.writeText(share.value);notice.textContent='Cabin link copied.';}
    catch{share.focus();share.select();notice.textContent='Copy the selected cabin link.';}
  };
  get('party-leave').onclick=()=>room?.leave();
  if(invite)get('party-note').textContent='Everyone in this invited group can see your messages.';
  window.addEventListener('pagehide',()=>{departing=true;room?.leave();});
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
  return {
    invite,offline,
    enter(person,alone){
      profile=person;
      if(!alone)return connect();
      hasEntered=true;details.hidden=true;rejoin.hidden=offline;
      notice.textContent=offline?'Cabin chat is available in the online tour.':'You’re exploring on your own.';
      joined({index:0,people:[]});
    },
    neighbors,
    seatOccupied(seat,resolveTie=false){
      for(const [id,guest] of markers){
        // Peers can choose at the same instant. Both sides use the same ID order.
        if(guest.target?.seated && guest.target.seat===seat && (!resolveTie || id<own))return true;
      }
      return false;
    },
    get open(){return dialog.open;},
    get suffix(){return invite?'?room='+invite:'';},
    fuel(kind){if(ready)room.fuel(kind);},
    conditions(){if(ready&&!applying)room.conditions(snapshot());},
    update(seconds){
      if(!ready)return false;
      const local=getPose(),dt=lastTick===null?0:Math.max(0,seconds-lastTick);
      lastTick=seconds;
      const k=1-Math.exp(-Math.min(.15,dt)*17);
      let animated=false;
      for(const m of markers.values()){
        const t=m.target;
        m.root.visible=!!t&&t.view!=='property'&&local.view!=='property'&&Math.hypot(local.x-t.x,local.z-t.z)>.38;
        let walking=false;
        if(t){
          const pos=m.root.position;
          walking=Math.hypot(pos.x-t.x,pos.z-t.z)>.014;
          if(Math.hypot(pos.x-t.x,pos.y-t.y,pos.z-t.z)>.006){
            pos.x+=(t.x-pos.x)*k;pos.y+=(t.y-pos.y)*k;pos.z+=(t.z-pos.z)*k;
            animated=true;
          }
        }
        if(m.update(dt,walking&&!t?.seated,Boolean(t?.seated)))animated=true;
      }
      return animated;
    }
  };
}
