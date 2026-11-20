import Peer from 'peerjs';

// PeerJS introduces browsers. The host admits each WebRTC connection using
// the random key in the invitation and assigns its identity and driveway slot.
const newKey=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
const validId=s=>typeof s==='string' && /^[a-z0-9_-]{1,80}$/i.test(s);
const validName=s=>typeof s==='string' && s.trim().length>0 && s.length<=28;
const validAvatar=a=>a==='man'||a==='woman';
const validPose=p=>p && typeof p.view==='string' && /^[a-z]{1,18}$/.test(p.view) &&
  [p.x,p.y,p.z,p.yaw].every(n=>Number.isFinite(n) && Math.abs(n)<500);
const weatherPreset=w=>['clear','rain','snow','cloudy'].includes(w);
const validReport=r=>r==null || (['ready','loading','stale','unavailable'].includes(r.status) &&
  typeof r.label==='string' && r.label.length<=200 && (r.observedAt===null ||
    (typeof r.observedAt==='string' && r.observedAt.length<=40 && Number.isFinite(Date.parse(r.observedAt)))));
const validScene=s=>s && Number.isFinite(s.hour) && s.hour>=0 && s.hour<24 &&
  weatherPreset(s.weather) && typeof s.furnace==='boolean' && typeof s.fire==='boolean' &&
  (s.localTime===undefined || typeof s.localTime==='boolean') && (s.localWeather===undefined || typeof s.localWeather==='boolean') &&
  (s.manualHour===undefined || (Number.isFinite(s.manualHour) && s.manualHour>=0 && s.manualHour<=23.75)) &&
  (s.manualWeather===undefined || weatherPreset(s.manualWeather)) && validReport(s.weatherReport);
const fuelLimit={twigs:176,sticks:440,logs:960};
const validWood=kind=>typeof kind==='string' && Object.hasOwn(fuelLimit,kind);
const validFuel=f=>f && Object.entries(fuelLimit).every(([kind,limit])=>
  Number.isFinite(f[kind]) && f[kind]>=0 && f[kind]<=limit);
const validChat=s=>typeof s==='string' && s.trim().length>0 && s.length<=360;
const validItem=m=>m && validId(m.fromId)&&validName(m.from)&&validChat(m.text);
function safeSend(conn,msg){
  if(conn?.open){try{conn.send(JSON.stringify(msg));}catch{conn.close();}}
}
function packet(raw){
  if(typeof raw!=='string' || raw.length>65536)return null;
  try{return JSON.parse(raw);}catch{return null;}
}
function readRoster(list,host,self){
  if(!Array.isArray(list)||list.length<1||list.length>8)return null;
  const slots=new Set(),ids=new Set(),people=[];
  for(const m of list){
    if(!m||!validId(m.id)||ids.has(m.id)||!validName(m.name)||!validAvatar(m.avatar)||
       !Number.isInteger(m.slot)||m.slot<0||m.slot>7||slots.has(m.slot)||(m.slot===0)!==(m.id===host)||
       (m.pose!==null&&!validPose(m.pose)))return null;
    slots.add(m.slot);ids.add(m.id);
    people.push({id:m.id,name:m.name.trim(),avatar:m.avatar,slot:m.slot,pose:m.pose});
  }
  return ids.has(self)&&ids.has(host)?people:null;
}
export function readRoom(){
  const token=new URLSearchParams(location.hash.split('?')[1]).get('room')||'';
  return /^[a-z0-9_-]{1,80}\.[a-f0-9]{32}$/i.test(token)?token:'';
}

export function openTourRoom({invite,name,avatar,onReady,onEnd,onRoster,onMessage,onScene,onPose,onPlace,snapshot,snapshotFuel,onFuelState,onAddFuel}){
  if(!validName(name)||!validAvatar(avatar))throw Error('A name and avatar are required');
  const isHost=!invite,hostId=invite.split('.')[0];
  const key=isHost?newKey():invite.split('.')[1];
  const peer=new Peer({secure:true,debug:0});
  const members=new Map(),links=new Map(),pending=new Set(),messages=[],timers=new Set();
  let id='',uplink=null,ended=false,ready=false,lastPose='';
  function later(fn,delay){const t=setTimeout(()=>{timers.delete(t);if(!ended)fn();},delay);timers.add(t);return t;}
  function finish(reason){
    if(ended)return;
    ended=true;for(const timer of timers)clearTimeout(timer);
    peer.destroy();onEnd(reason);
  }
  function broadcast(m){for(const c of links.values())safeSend(c,m);}
  function publishFuel(){
    const state=snapshotFuel?.();
    if(validFuel(state))broadcast({t:'fuelState',fuel:state});
  }
  // Browsers can suspend the burn between visits. Bring everyone back to the
  // host's remaining seconds periodically, including the final empty state.
  let wasBurning=false;
  function alignBurn(){
    if(links.size){
      const state=snapshotFuel?.();
      if(validFuel(state)){
        const burning=state.twigs+state.sticks+state.logs>0;
        if(burning||wasBurning)broadcast({t:'fuelState',fuel:state});
        wasBurning=burning;
      }
    }
    later(alignBurn,15000);
  }
  function publishRoster(){
    const list=Array.from(members.values());
    onRoster(list,id);broadcast({t:'roster',list});
  }
  function joined(token){
    ready=true;
    onReady(token,{isHost,index:members.get(id).slot,people:Array.from(members.values())});
  }
  function chat(from,text){
    const item={fromId:from,from:members.get(from).name,text:text.trim()};
    messages.push(item);if(messages.length>45)messages.shift();
    onMessage(item,false);broadcast({t:'chat',item});
  }
  function recordPose(from,p){
    const member=members.get(from);if(!member)return;
    member.pose=p;onPose(from,p);broadcast({t:'pose',id:from,p});
  }
  function replaceRoster(list){
    const people=readRoster(list,hostId,id);
    if(!people)return false;
    members.clear();for(const m of people)members.set(m.id,m);
    onRoster(people,id);return true;
  }
  function attach(c){
    if(!isHost||ended||pending.size+links.size>=7||!validId(c.peer)||c.label!=='cabin-tour'){c.close();return;}
    pending.add(c);let admitted=false,lastMove=-1000,lastWood=-1000,chatTokens=5,chatClock=performance.now();
    later(()=>{if(!admitted){pending.delete(c);c.close();}},12000);
    c.on('data',raw=>{
      const m=packet(raw);if(!m||ended)return;
      if(!admitted){
        if(!pending.has(c)||m.t!=='hello'||m.key!==key||!validName(m.name)||!validAvatar(m.avatar)||members.has(c.peer)){pending.delete(c);c.close();return;}
        const used=new Set(Array.from(members.values(),p=>p.slot));
        let slot=1;while(used.has(slot))slot++;
        admitted=true;pending.delete(c);links.set(c.peer,c);
        members.set(c.peer,{id:c.peer,name:m.name.trim(),avatar:m.avatar,slot,pose:null});
        safeSend(c,{t:'welcome',list:Array.from(members.values()),messages,scene:snapshot(),fuel:snapshotFuel?.()});
        publishRoster();return;
      }
      if(links.get(c.peer)!==c)return;
      const now=performance.now();
      if(m.t==='say' && validChat(m.text)){
        chatTokens=Math.min(5,chatTokens+(now-chatClock)/350);chatClock=now;
        if(chatTokens>=1){chatTokens--;chat(c.peer,m.text);}
      }
      if(m.t==='move' && validPose(m.p) && now-lastMove>=70){lastMove=now;recordPose(c.peer,m.p);}
      if(m.t==='addWood' && validWood(m.kind) && onAddFuel){
        if(now-lastWood>=300){lastWood=now;onAddFuel(m.kind);publishFuel();}
        else safeSend(c,{t:'fuelState',fuel:snapshotFuel?.()});
      }
      if(m.t==='scene' && validScene(m.scene)){onScene(m.scene);broadcast({t:'scene',scene:snapshot()});}
    });
    const drop=()=>{pending.delete(c);if(links.get(c.peer)===c){links.delete(c.peer);members.delete(c.peer);if(!ended)publishRoster();}};
    c.on('close',drop);c.on('error',drop);
  }
  peer.on('connection',attach);
  later(()=>{if(!ready)finish('The group could not connect. Check that the host still has the cabin open, then try again.');},25000);
  peer.on('open',own=>{
    if(ended||id)return;
    id=own;
    if(isHost){
      members.set(id,{id,name:name.trim(),avatar,slot:0,pose:null});
      publishRoster();joined(id+'.'+key);if(snapshotFuel)later(alignBurn,15000);return;
    }
    uplink=peer.connect(hostId,{label:'cabin-tour',serialization:'raw',reliable:true});
    uplink.on('open',()=>safeSend(uplink,{t:'hello',key,name,avatar}));
    uplink.on('close',()=>finish('The connection to the host closed. You can keep exploring on your own.'));
    uplink.on('error',()=>finish('Your connection to the host was interrupted.'));
    uplink.on('data',raw=>{
      const m=packet(raw);if(!m||ended)return;
      if(m.t==='welcome'&&!ready){
        if(!replaceRoster(m.list))return;
        if(validScene(m.scene))onScene(m.scene);
        if(validFuel(m.fuel))onFuelState?.(m.fuel);
        joined(invite);
        for(const item of (Array.isArray(m.messages)?m.messages:[]).slice(-45))if(validItem(item))onMessage(item,true);
        return;
      }
      if(!ready)return;
      if(m.t==='roster')replaceRoster(m.list);
      if(m.t==='chat'&&validItem(m.item)&&members.get(m.item.fromId)?.name===m.item.from)onMessage(m.item,false);
      if(m.t==='pose'&&members.has(m.id)&&validPose(m.p)){members.get(m.id).pose=m.p;onPose(m.id,m.p);}
      if(m.t==='scene'&&validScene(m.scene))onScene(m.scene);
      if(m.t==='fuelState'&&validFuel(m.fuel))onFuelState?.(m.fuel);
      if(m.t==='place'&&validPose(m.p)&&m.p.view!=='property')onPlace(m.p);
    });
  });
  peer.on('error',e=>{
    if(!ready || !isHost&&e.type!=='network')finish(e.type==='peer-unavailable'?'This group has closed. You can start a new one.':'The group could not connect. Please try again.');
  });
  peer.on('disconnected',()=>{if(!ended&&!peer.destroyed)later(()=>{if(peer.disconnected&&!peer.destroyed)peer.reconnect();},1500);});
  return {
    send(text){if(!ready||ended||!validChat(text))return;isHost?chat(id,text):safeSend(uplink,{t:'say',text});},
    move(p){if(!ready||ended||!validPose(p))return;const next=JSON.stringify(p);if(next===lastPose)return;lastPose=next;
      isHost?recordPose(id,p):safeSend(uplink,{t:'move',p});},
    fuel(kind){if(!ready||ended||!validWood(kind))return;
      // The local animation has already landed; only the host broadcasts totals.
      if(isHost)publishFuel();else safeSend(uplink,{t:'addWood',kind});},
    conditions(scene){if(!ready||ended||!validScene(scene))return;const m={t:'scene',scene};isHost?broadcast(m):safeSend(uplink,m);},
    place(guestId,p){if(!isHost||!ready||ended||!links.has(guestId)||!validPose(p)||p.view==='property')return false;
      safeSend(links.get(guestId),{t:'place',p});return true;},
    leave(){finish('You left the group.');}
  };
}
