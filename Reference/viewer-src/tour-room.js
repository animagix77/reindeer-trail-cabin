import Peer from 'peerjs';

// The link contains a separate random admission key. Only the host forwards
// authenticated connections. PeerJS introduces browsers; chat uses WebRTC.
const newKey=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
const validName=s=>typeof s==='string' && s.trim().length>0 && s.trim().length<=28;
const validPose=p=>p && typeof p.view==='string' && /^[a-z]{1,18}$/.test(p.view) &&
  [p.x,p.y,p.z,p.yaw].every(n=>Number.isFinite(n) && Math.abs(n)<500);
const validScene=s=>s && Number.isFinite(s.hour) && s.hour>=0 && s.hour<=23.75 &&
  ['clear','rain','snow','cloudy'].includes(s.weather) && typeof s.furnace==='boolean' && typeof s.fire==='boolean';
const validChat=s=>typeof s==='string' && s.trim().length>0 && s.length<=360;
const safeSend=(conn,message)=>{if(conn?.open)conn.send(JSON.stringify(message));};
export function readRoom(){
  const value=new URLSearchParams(location.hash.split('?')[1]).get('room')||'';
  return /^[a-z0-9-]{1,80}\.[a-f0-9]{32}$/i.test(value)?value:'';
}

export function openTourRoom({invite,name,onReady,onEnd,onRoster,onMessage,onScene,onPose,snapshot}){
  const isHost=!invite;
  const key=isHost?newKey():invite.split('.')[1];
  const peer=new Peer({secure:true,debug:0});
  const members=new Map(),links=new Map(),pending=new Set(),messages=[];
  let id='',uplink=null,ended=false,lastPose=null;
  const timers=new Set();
  function later(fn,delay){const t=setTimeout(()=>{timers.delete(t);fn();},delay);timers.add(t);return t;}
  function finish(reason){
    if(ended)return;
    ended=true;
    for(const t of timers)clearTimeout(t);
    peer.destroy();
    onEnd(reason);
  }
  function broadcast(m){for(const c of links.values())safeSend(c,m);}
  function roster(){const list=Array.from(members.values());onRoster(list,id);broadcast({t:'roster',list});}
  function chat(from,text){
    const item={from:members.get(from).name,text:text.trim()};
    messages.push(item);if(messages.length>45)messages.shift();
    onMessage(item);broadcast({t:'chat',item});
  }
  function recordPose(from,p){
    const member=members.get(from);if(!member)return;
    member.pose=p;onPose(from,p);broadcast({t:'pose',id:from,p});
  }
  function packet(raw){if(typeof raw!=='string'||raw.length>65536)return null;try{return JSON.parse(raw);}catch{return null;}}
  function attach(c){
    if(!isHost || ended || pending.size+links.size>=7 || c.label!=='cabin-tour'){c.close();return;}
    pending.add(c);let admitted=false,lastChat=-1000,lastMove=-1000;
    later(()=>{if(!admitted)c.close();},12000);
    c.on('data',raw=>{
      const m=packet(raw);if(!m||ended)return;
      if(!admitted){
        if(m.t!=='hello'||m.key!==key||!validName(m.name)||members.has(c.peer)){c.close();return;}
        admitted=true;pending.delete(c);links.set(c.peer,c);members.set(c.peer,{id:c.peer,name:m.name.trim(),pose:null});
        safeSend(c,{t:'welcome',messages,scene:snapshot()});roster();return;
      }
      const now=performance.now();
      if(m.t==='say' && validChat(m.text) && now-lastChat>=350){lastChat=now;chat(c.peer,m.text);}
      if(m.t==='move' && validPose(m.p) && now-lastMove>=70){lastMove=now;recordPose(c.peer,m.p);}
      if(m.t==='scene' && validScene(m.scene)){onScene(m.scene);broadcast(m);}
    });
    const drop=()=>{pending.delete(c);if(links.get(c.peer)===c){links.delete(c.peer);members.delete(c.peer);if(!ended)roster();}};
    c.on('close',drop);c.on('error',drop);
  }
  peer.on('connection',attach);
  let ready=false;
  later(()=>{if(!ready)finish('The group could not connect. Check that the host still has the cabin open, then try again.');},25000);
  peer.on('open',own=>{
    if(ended || id)return;
    id=own;
    if(isHost){ready=true;members.set(id,{id,name,pose:null});onReady(id+'.'+key);roster();return;}
    uplink=peer.connect(invite.split('.')[0],{label:'cabin-tour',serialization:'raw',reliable:true});
    uplink.on('open',()=>safeSend(uplink,{t:'hello',key,name}));
    uplink.on('close',()=>finish('The connection to the host closed. You can keep exploring on your own.'));
    uplink.on('error',()=>finish('Your connection to the host was interrupted.'));
    uplink.on('data',raw=>{
      const m=packet(raw);if(!m||ended)return;
      if(m.t==='welcome' && !ready){ready=true;onReady(invite);if(validScene(m.scene))onScene(m.scene);
        for(const msg of (Array.isArray(m.messages)?m.messages:[]).slice(-45))if(validName(msg.from)&&validChat(msg.text))onMessage(msg);return;}
      if(!ready)return;
      if(m.t==='roster' && Array.isArray(m.list)){
        const list=m.list.slice(0,8).filter(v=>v&&typeof v.id==='string'&&v.id.length<81&&validName(v.name));
        onRoster(list.map(v=>({...v,pose:validPose(v.pose)?v.pose:null})),id);
      }
      if(m.t==='chat' && validName(m.item?.from) && validChat(m.item?.text))onMessage(m.item);
      if(m.t==='pose' && validPose(m.p))onPose(m.id,m.p);
      if(m.t==='scene' && validScene(m.scene))onScene(m.scene);
    });
  });
  peer.on('error',e=>{
    if(!ready || !isHost && e.type!=='network')finish(e.type==='peer-unavailable'?'This group has closed. You can start a new one.':'The group could not connect. Please try again.');
  });
  peer.on('disconnected',()=>{if(!ended&&!peer.destroyed)later(()=>{if(peer.disconnected && !peer.destroyed)peer.reconnect();},1500);});
  return {
    send(text){if(!ready || ended || !validChat(text))return;isHost?chat(id,text):safeSend(uplink,{t:'say',text});},
    move(p){if(!ready||ended||!validPose(p))return;const next=JSON.stringify(p);if(next===lastPose)return;lastPose=next;
      isHost?recordPose(id,p):safeSend(uplink,{t:'move',p});},
    conditions(scene){if(!ready || ended || !validScene(scene))return;const m={t:'scene',scene};isHost?broadcast(m):safeSend(uplink,m);},
    leave(){finish('You left the group.');}
  };
}
