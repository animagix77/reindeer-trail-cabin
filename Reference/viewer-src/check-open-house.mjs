import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {setTimeout as sleep} from 'node:timers/promises';
import {openTourRoom,publicRoomId} from './tour-room.js';

globalThis.location=new URL('https://example.test/tour/');
const pose={view:'driveway',x:1,y:2,z:3,yaw:0};
const scene={weather:'clear',hour:17,fire:false,furnace:true};

// A signaling address has a single owner. Messages between paired endpoints
// are asynchronous, and destroying a peer closes its open data channels.
function signaling(){
  const addresses=new Map();
  const makePeer=(id='private-'+crypto.randomUUID())=>{
    const peer=new EventEmitter(),channels=new Set();
    peer.destroy=()=>{
      if(peer.destroyed)return;
      peer.destroyed=true;
      if(addresses.get(id)===peer)addresses.delete(id);
      for(const channel of channels)channel.close();
    };
    peer.connect=(to,{label})=>{
      const target=addresses.get(to);
      const pair=[new EventEmitter(),new EventEmitter()];
      for(const [i,c] of pair.entries()){
        const other=pair[1-i];c.peer=i?id:to;c.label=label;c.open=false;
        c.send=raw=>queueMicrotask(()=>{if(other.open)other.emit('data',raw);});
        c.close=()=>{
          if(c.closed)return;
          c.closed=other.closed=true;c.open=other.open=false;
          c.emit('close');other.emit('close');
        };
      }
      channels.add(pair[0]);
      queueMicrotask(()=>{
        if(!target){peer.emit('error',{type:'peer-unavailable'});return;}
        target.emit('connection',pair[1]);
        pair[0].open=pair[1].open=true;
        pair[1].emit('open');pair[0].emit('open');
      });
      return pair[0];
    };
    // Incoming links close when their host goes away, too.
    peer.on('connection',c=>channels.add(c));
    queueMicrotask(()=>{
      if(peer.destroyed)return;
      if(addresses.has(id)){peer.emit('error',{type:'unavailable-id'});return;}
      addresses.set(id,peer);peer.emit('open',id);
    });
    return peer;
  };
  return {makePeer,addresses};
}

function visitor(t,network,name,options={}){
  const state={arrivals:[],roster:[],chat:[],poses:new Map(),ended:[],reconnects:0};
  state.room=openTourRoom({
    publicRoom:true,name,avatar:'man',snapshot:()=>scene,onScene(){},onPlace(){},
    onReady(token,arrival){state.token=token;state.arrivals.push(arrival);},
    onEnd(reason){state.ended.push(reason);},
    onReconnecting(){state.reconnects++;},
    onRoster(list,own){state.roster=list;state.own=own;},
    onMessage(message,history){state.chat.push({...message,history});},
    onPose(id,position){state.poses.set(id,position);},...options
  },network.makePeer);
  t.after(()=>state.room.leave());
  return state;
}

async function waitFor(fn){
  const limit=Date.now()+5500;
  while(!fn()){
    assert.ok(Date.now()<limit,'timed out waiting for room state');
    await sleep(10);
  }
}

test('every view of one deployment uses one public address',()=>{
  const address=path=>publicRoomId(new URL(path,'https://cabin.example/'));
  assert.equal(address('/cabin/'),address('/cabin/index.html?campaign=a#patio'));
  assert.equal(address('/cabin/'),address('/cabin#driveway'));
  assert.notEqual(address('/cabin/'),address('/preview/'));
  assert.notEqual(address('/cabin/'),address('https://other.example/cabin/'));
});

test('simultaneous arrivals meet, chat and retain identity through host replacement',async t=>{
  const network=signaling();
  const people=['Rowan','Rowan','Quinn'].map(name=>visitor(t,network,name));
  await waitFor(()=>people.every(p=>p.roster.length===3&&p.arrivals.length===1));
  const [host]=people.filter(p=>p.arrivals[0].isHost);
  const guests=people.filter(p=>p!==host);
  assert.equal(guests.length,2);
  assert.equal(new Set(people.map(p=>p.own)).size,3);
  assert.equal(new Set(people.map(p=>p.arrivals[0].index)).size,3);
  assert.ok(people.every(p=>p.token===''));
  guests[0].room.move(pose);guests[0].room.send('At the driveway');
  await waitFor(()=>people.every(p=>p.chat.length===1)&&host.poses.has(guests[0].own));
  assert.equal(guests[1].chat[0].fromId,guests[0].own);
  assert.equal(host.room.place(guests[0].own,pose),false);
  const ids=guests.map(p=>p.own);

  host.room.leave();
  await waitFor(()=>guests.every(p=>p.roster.length===2&&p.arrivals.length===2));
  assert.equal(guests.filter(p=>p.arrivals.at(-1).isHost).length,1);
  assert.deepEqual(guests.map(p=>p.own),ids);
  assert.ok(guests.every(p=>p.reconnects===1&&p.arrivals.at(-1).reconnected&&p.chat.length===1));

  const next=visitor(t,network,'Robin');
  await waitFor(()=>next.roster.length===3);
  assert.equal(next.chat.length,0);
  next.room.send('I found you');
  await waitFor(()=>guests.every(p=>p.chat.length===2));
});

test('the ninth visitor sees a full house and can join after a departure',async t=>{
  const network=signaling();
  const people=Array.from({length:9},(_,i)=>visitor(t,network,'Guest '+(i+1)));
  await waitFor(()=>people.filter(p=>p.arrivals.length).length===8&&people.some(p=>p.ended.length));
  const full=people.find(p=>p.ended.length);
  assert.match(full.ended[0],/full/i);
  assert.equal(network.addresses.size,8);
  const guest=people.find(p=>p.arrivals[0]&&!p.arrivals[0].isHost);
  guest.room.leave();
  const retry=visitor(t,network,'Returning guest');
  await waitFor(()=>retry.roster.length===8);
});

test('private invites still open the original private group with its chat history',async t=>{
  const network=signaling();
  const privateHost=visitor(t,network,'Host',{publicRoom:false});
  await waitFor(()=>privateHost.token);
  privateHost.room.send('Private hello');
  const open=visitor(t,network,'Public');
  const invited=visitor(t,network,'Invited',{publicRoom:false,invite:privateHost.token});
  await waitFor(()=>invited.chat.length===1&&open.arrivals.length===1);
  assert.equal(invited.chat[0].text,'Private hello');assert.equal(invited.chat[0].history,true);
  assert.equal(open.roster.length,1);assert.equal(open.chat.length,0);
});
