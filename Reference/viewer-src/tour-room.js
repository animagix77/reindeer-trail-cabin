import Peer from 'peerjs';
import {roomStock,validCount} from './room-stock.js';

// PeerJS introduces browsers. The host assigns each visitor a driveway slot.
const newKey=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
const validId=s=>typeof s==='string' && /^[a-z0-9_-]{1,80}$/i.test(s);
const validName=s=>typeof s==='string' && s.trim().length>0 && s.length<=28;
const validAvatar=a=>a==='man'||a==='woman';
const validPose=p=>p && typeof p.view==='string' && /^[a-z]{1,18}$/.test(p.view) &&
  (p.seated===undefined || typeof p.seated==='boolean') &&
  (p.seat==null || (Number.isInteger(p.seat) && p.seat>=0 && p.seat<4)) &&
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

// All views of one published tour meet at one signaling address. Different
// deployments (including local previews) get their own room.
export function publicRoomId(url=new URL(location.href)){
  const address=url.origin+url.pathname.replace(/\/(?:index\.html)?$/i,'');
  let hash=2166136261;
  for(const letter of address)hash=Math.imul(hash^letter.charCodeAt(0),16777619);
  return 'reindeer-trail-open-v1-'+(hash>>>0).toString(36);
}

const createPeer=id=>id?new Peer(id,{secure:true,debug:0}):new Peer({secure:true,debug:0});

export function openTourRoom(options,makePeer=createPeer){
  if(!validName(options.name)||!validAvatar(options.avatar))throw Error('A name and avatar are required');
  const stock=roomStock(options.startingStock,options.onStockTotal);
  options={...options,stock};
  if(!options.publicRoom)return connectTourRoom(options,makePeer);

  // Exactly one browser can register the public address. The others join it.
  // When that browser leaves, the remaining visitors elect another the same way.
  const stockSession={key:newKey()};
  const address=publicRoomId(),visitor='visitor-'+newKey();
  let current=null,retry=null,closed=false,entered=false,waiting=false,attempts=0;
  const connectionExpired=()=>end('The open house could not connect. Check your connection and try again.');
  let timeout=setTimeout(connectionExpired,25000);
  function end(reason){
    if(closed)return;
    closed=true;clearTimeout(retry);clearTimeout(timeout);current?.leave();current=null;options.onEnd(reason);
  }
  function connect(asHost){
    if(closed)return;
    try{
      current=connectTourRoom({
        ...options,
        onReady(token,arrival){
          clearTimeout(timeout);
          const reconnected=entered;
          entered=true;waiting=false;attempts=0;
          options.onReady('',{...arrival,reconnected});
        },
        onEnd(reason,code){
          current=null;
          if(closed)return;
          if(code==='full'||code==='unsupported'){end(reason);return;}
          if(entered&&!waiting){
            waiting=true;timeout=setTimeout(connectionExpired,40000);
            options.onReconnecting?.('Reconnecting to the open house…');
          }
          if(asHost&&code==='unavailable-id'){
            retry=setTimeout(()=>connect(false),0);
          }else{
            attempts++;
            const backoff=Math.min(4000,350*2**Math.min(attempts,4));
            retry=setTimeout(()=>connect(true),backoff+Math.random()*350);
          }
        }
      },makePeer,{address,visitor,asHost,stockSession});
    }catch{end('This browser could not open a multiplayer connection.');}
  }
  connect(true);
  return {
    stock(amount){
      if(!entered||closed||!validCount(amount)||!amount)return false;
      if(stock.merge(visitor,stock.count(visitor)+amount))current?.publishStock();
      return true;
    },
    send(text){current?.send(text);},move(p){current?.move(p);},
    fuel(kind){current?.fuel(kind);},conditions(scene){current?.conditions(scene);},
    place(){return false;},
    leave(){end('You left the open house.');}
  };
}

function connectTourRoom({invite='',name,avatar,onReady,onEnd,onRoster,onMessage,onScene,onPose,onPlace,snapshot,snapshotFuel,onFuelState,onAddFuel,stock,onStockTotal},makePeer,publicSession){
  const isHost=publicSession?publicSession.asHost:!invite;
  const hostId=publicSession?.address||invite.split('.')[0];
  const key=publicSession?'':isHost?newKey():invite.split('.')[1];
  const stockSession=publicSession?.stockSession||{key:newKey()};
  const peer=makePeer(publicSession?(isHost?hostId:publicSession.visitor):undefined);
  let hostMember=hostId;
  const members=new Map(),links=new Map(),pending=new Set(),messages=[],timers=new Set();
  let id='',uplink=null,ended=false,ready=false,lastPose='';
  function later(fn,delay){const t=setTimeout(()=>{timers.delete(t);if(!ended)fn();},delay);timers.add(t);return t;}
  function finish(reason,code){
    if(ended)return;
    ended=true;for(const timer of timers)clearTimeout(timer);
    peer.destroy();onEnd(reason,code);
  }
  function broadcast(m){for(const c of links.values())safeSend(c,m);}
  function publishStock(){
    if(!ready||ended)return;
    const count=stock.count(id);
    if(count>0){
      if(isHost)broadcast({t:'stock',id,count});
      else safeSend(uplink,{t:'stock',count});
    }
  }
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
    if(!publicSession){messages.push(item);if(messages.length>45)messages.shift();}
    onMessage(item,false);broadcast({t:'chat',item});
  }
  function recordPose(from,p){
    const member=members.get(from);if(!member)return;
    member.pose=p;onPose(from,p);broadcast({t:'pose',id:from,p});
  }
  function replaceRoster(list){
    const people=readRoster(list,hostMember,id);
    if(!people)return false;
    members.clear();for(const m of people)members.set(m.id,m);
    onRoster(people,id);return true;
  }
  function watchConnection(c){
    // Wi-Fi changes may disconnect ICE briefly. Re-elect only after the
    // channel has stayed unreachable long enough for a normal recovery.
    if(!publicSession)return;
    let lost=null;
    c.on('iceStateChanged',state=>{
      clearTimeout(lost);timers.delete(lost);
      if(state==='disconnected')lost=later(()=>c.close(),10000);
    });
  }
  function attach(c){
    if(!isHost||ended||pending.size>=16||!validId(c.peer)||c.label!=='cabin-tour'){c.close();return;}
    watchConnection(c);
    pending.add(c);let admitted=false,lastMove=-1000,lastWood=-1000,chatTokens=5,chatClock=performance.now();
    later(()=>{if(!admitted){pending.delete(c);c.close();}},12000);
    c.on('data',raw=>{
      const m=packet(raw);if(!m||ended)return;
      if(!admitted){
        if(!pending.has(c)||m.t!=='hello'||m.key!==key||!validName(m.name)||!validAvatar(m.avatar)||members.has(c.peer)){pending.delete(c);c.close();return;}
        if(members.size>=8){
          safeSend(c,{t:'full'});pending.delete(c);later(()=>c.close(),500);return;
        }
        const used=new Set(Array.from(members.values(),p=>p.slot));
        let slot=1;while(used.has(slot))slot++;
        admitted=true;pending.delete(c);links.set(c.peer,c);
        members.set(c.peer,{id:c.peer,name:m.name.trim(),avatar:m.avatar,slot,pose:null});
        safeSend(c,{t:'welcome',stockKey:stockSession.key,stockBase:stock.base,hostMember:id,list:Array.from(members.values()),messages,scene:snapshot(),fuel:snapshotFuel?.()});
        const stockEntries=stock.snapshot();
        for(let i=0;i<stockEntries.length;i+=64)safeSend(c,{t:'stockSnapshot',entries:stockEntries.slice(i,i+64)});
        publishRoster();return;
      }
      if(links.get(c.peer)!==c)return;
      const now=performance.now();
      if(m.t==='say' && validChat(m.text)){
        chatTokens=Math.min(5,chatTokens+(now-chatClock)/350);chatClock=now;
        if(chatTokens>=1){chatTokens--;chat(c.peer,m.text);}
      }
      if(m.t==='move' && validPose(m.p) && now-lastMove>=70){lastMove=now;recordPose(c.peer,m.p);}
      if(m.t==='stock'&&validCount(m.count)&&m.count-stock.count(c.peer)<=256&&stock.merge(c.peer,m.count)){
        broadcast({t:'stock',id:c.peer,count:m.count});
      }
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
  later(()=>{if(!ready)finish('The group could not connect. Check that the host still has the cabin open, then try again.');},publicSession?12000:25000);
  peer.on('open',own=>{
    if(ended||id)return;
    id=publicSession?.visitor||own;
    if(isHost){
      members.set(id,{id,name:name.trim(),avatar,slot:0,pose:null});
      onStockTotal?.(stock.total);publishRoster();joined(publicSession?'':id+'.'+key);if(snapshotFuel)later(alignBurn,15000);return;
    }
    uplink=peer.connect(hostId,{label:'cabin-tour',serialization:'raw',reliable:true});
    watchConnection(uplink);
    uplink.on('open',()=>safeSend(uplink,{t:'hello',key,name,avatar}));
    uplink.on('close',()=>finish('The connection to the host closed. You can keep exploring on your own.'));
    uplink.on('error',()=>finish('Your connection to the host was interrupted.'));
    uplink.on('data',raw=>{
      const m=packet(raw);if(!m||ended)return;
      if(m.t==='full'&&!ready){
        finish(publicSession?'The open house is full (8 visitors). Try again in a little while.':'The group is full (8 visitors).','full');return;
      }
      if(m.t==='welcome'&&!ready){
        if(publicSession){
          if(!validId(m.hostMember))return;
          hostMember=m.hostMember;
        }
        if(!replaceRoster(m.list))return;
        if(validCount(m.stockBase)&&typeof m.stockKey==='string'&&/^[a-f0-9]{32}$/.test(m.stockKey)){
          if(stockSession.key!==m.stockKey)stock.start(m.stockBase);
          stockSession.key=m.stockKey;
        }
        if(validScene(m.scene))onScene(m.scene);
        if(validFuel(m.fuel))onFuelState?.(m.fuel);
        joined(invite);publishStock();
        for(const item of (Array.isArray(m.messages)?m.messages:[]).slice(-45))if(validItem(item))onMessage(item,true);
        return;
      }
      if(!ready)return;
      if(m.t==='stockSnapshot'&&Array.isArray(m.entries)&&m.entries.length<=64){
        for(const entry of m.entries)if(Array.isArray(entry)&&entry.length===2)stock.merge(entry[0],entry[1]);
      }
      if(m.t==='stock')stock.merge(m.id,m.count);
      if(m.t==='roster')replaceRoster(m.list);
      if(m.t==='chat'&&validItem(m.item)&&members.get(m.item.fromId)?.name===m.item.from)onMessage(m.item,false);
      if(m.t==='pose'&&members.has(m.id)&&validPose(m.p)){members.get(m.id).pose=m.p;onPose(m.id,m.p);}
      if(m.t==='scene'&&validScene(m.scene))onScene(m.scene);
      if(m.t==='fuelState'&&validFuel(m.fuel))onFuelState?.(m.fuel);
      if(!publicSession&&m.t==='place'&&validPose(m.p)&&m.p.view!=='property')onPlace(m.p);
    });
  });
  peer.on('error',e=>{
    if(ended)return;
    if(e.type==='browser-incompatible'){finish('This browser does not support multiplayer.','unsupported');return;}
    if(!ready || e.type==='unavailable-id' || !isHost&&e.type!=='network'){
      finish(e.type==='peer-unavailable'?'This group has closed. You can start a new one.':'The group could not connect. Please try again.',e.type);
    }
  });
  peer.on('disconnected',()=>{if(!ended&&!peer.destroyed)later(()=>{if(peer.disconnected&&!peer.destroyed)peer.reconnect();},1500);});
  return {
    publishStock,
    stock(amount){
      if(!ready||ended||!validCount(amount)||!amount)return false;
      if(stock.merge(id,stock.count(id)+amount))publishStock();
      return true;
    },
    send(text){if(!ready||ended||!validChat(text))return;isHost?chat(id,text):safeSend(uplink,{t:'say',text});},
    move(p){if(!ready||ended||!validPose(p))return;const next=JSON.stringify(p);if(next===lastPose)return;lastPose=next;
      isHost?recordPose(id,p):safeSend(uplink,{t:'move',p});},
    fuel(kind){if(!ready||ended||!validWood(kind))return;
      // The local animation has already landed; only the host broadcasts totals.
      if(isHost)publishFuel();else safeSend(uplink,{t:'addWood',kind});},
    conditions(scene){if(!ready||ended||!validScene(scene))return;const m={t:'scene',scene};isHost?broadcast(m):safeSend(uplink,m);},
    place(guestId,p){if(publicSession||!isHost||!ready||ended||!links.has(guestId)||!validPose(p)||p.view==='property')return false;
      safeSend(links.get(guestId),{t:'place',p});return true;},
    leave(){finish('You left the group.');}
  };
}
