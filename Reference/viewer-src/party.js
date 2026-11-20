import {guestMarker} from './guest-marker.js';
import {openTourRoom,readRoom} from './tour-room.js';

export function installParty({world,getPose,joined,meet,snapshot,apply,solo,snapshotFuel,applyFuel,addRemoteFuel,stop,schedule}){
  const get=id=>document.getElementById(id);
  const dialog=get('party'),button=get('party-toggle'),start=get('party-start'),notice=get('party-status');
  const details=get('party-details'),join=get('party-join'),share=get('party-link'),log=get('party-log');
  const input=get('party-input'),markers=new Map(),speakerLabels=new Map();
  let room=null,own='',slot=0,active='',invite=readRoom(),pulse=null,lastTick=null,unread=0,ready=false,applying=false,isHost=false;
  const neighbors=()=>Array.from(markers.values(),m=>m.target).filter(Boolean);
  function meetAt(p){meet(p,{index:slot,occupied:neighbors()});}
  function lobby(){
    get('party-solo').hidden=!invite;
    start.textContent=invite?'Join group':'Create group';
    get('party-note').textContent=invite?'Choose an avatar to join your friend at the cabin.':'Invite up to seven friends to explore with you. Keep this tab open while they visit.';
    details.hidden=true;join.hidden=false;start.disabled=false;
  }
  function open(){
    if(dialog.open)return;stop();if(document.pointerLockElement)document.exitPointerLock();
    unread=0;badge();dialog.showModal();
    (ready?input:get('party-name')).focus({preventScroll:true});
  }
  function badge(){button.textContent=unread?'Chat ('+unread+')':ready?'Group chat':'Friends';}
  function address(token){
    const base=location.hash.split('?')[0]||'#driveway';
    history.replaceState(null,'',base+(token?'?room='+token:''));
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
      if(isHost){
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
    clearInterval(pulse);pulse=null;lastTick=null;
    const hadRoom=ready;
    ready=false;own='';room=null;unread=0;active='';if(hadRoom){invite='';address('');}
    for(const m of markers.values())removeMarker(m);markers.clear();speakerLabels.clear();
    log.replaceChildren();share.value='';get('party-people').replaceChildren();badge();lobby();
    solo();notice.textContent=reason;if(!dialog.open&&hadRoom)open();schedule();
  }
  function begin(e){
    e.preventDefault();if(room)return;
    if(location.protocol==='file:'){notice.textContent='Open the public cabin tour to invite friends.';return;}
    const name=get('party-name').value.trim(),avatar=join.elements.avatar.value;
    if(!name){get('party-name').focus();return;}
    if(!avatar){join.querySelector('input[name=avatar]').focus();return;}
    isHost=!invite;notice.textContent='Connecting…';start.disabled=true;
    try{
      room=openTourRoom({name,avatar,invite,snapshot,onEnd:end,onRoster:members,onPose:pose,onMessage:message,
        snapshotFuel,onFuelState:applyFuel,onAddFuel:addRemoteFuel,
        onPlace(p){if(dialog.open)dialog.close();meetAt(p);},
        onScene(s){applying=true;try{apply(s,!isHost);}finally{applying=false;}},
        async onReady(token,arrival){
          ready=true;slot=arrival.index;active=token;address(token);
          // The first shared pose must be at the guest's assigned arrival slot.
          const session=room;
          await joined(arrival);
          if(room!==session||!ready)return;
          room.move(getPose());pulse=setInterval(()=>room?.move(getPose()),160);
          share.value=location.href.split('#')[0]+'#driveway?room='+active;
          join.hidden=true;details.hidden=false;notice.textContent=isHost?'Your group is open. Share the invitation below.':'You joined the group.';
          badge();if(isHost)input.focus();else if(dialog.open)dialog.close();
          schedule();
        }
      });
    }catch{end('This browser could not open a group connection. Try again in the public tour.');}
  }
  button.addEventListener('click',open);get('party-close').onclick=()=>dialog.close();
  get('party-solo').onclick=()=>{room?.leave();invite='';address('');lobby();dialog.close();};
  join.addEventListener('submit',begin);
  get('party-chat').addEventListener('submit',e=>{e.preventDefault();if(!input.value.trim())return;room?.send(input.value.trim());input.value='';});
  get('party-copy').onclick=async()=>{
    try{await navigator.clipboard.writeText(share.value);notice.textContent='Invitation copied.';}
    catch{share.focus();share.select();notice.textContent='Copy the selected invitation link.';}
  };
  get('party-leave').onclick=()=>room?.leave();
  window.addEventListener('pagehide',()=>{if(room){ready=false;room.leave();}});
  lobby();
  return {
    neighbors,
    seatOccupied(seat,resolveTie=false){
      for(const [id,guest] of markers){
        // Peers can choose at the same instant. Both sides use the same ID order.
        if(guest.target?.seated && guest.target.seat===seat && (!resolveTie || id<own))return true;
      }
      return false;
    },
    initial(){if(invite)open();},
    get open(){return dialog.open;},
    get suffix(){const value=active||invite;return value?'?room='+value:'';},
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
