import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as turn} from 'node:timers/promises';
import {modelPartBytes,readModel,ModelDownloadError} from './model-loading.js';

function testBytes(length){
  const b=new Uint8Array(length);
  b.set([0x67,0x6c,0x54,0x46,2,0,0,0]);
  new DataView(b.buffer).setUint32(8,length,true);
  for(let i=12;i<length;i++)b[i]=(i%239)+1;
  return b;
}
function modelElement(length,names){
  return {dataset:{bytes:String(length),parts:names},remove(){this.removed=true;}};
}

test('parallel byte progress, transfer estimate, stalls and out-of-order responses',async t=>{
  const bytes=testBytes(modelPartBytes+96*1024);
  const element=modelElement(bytes.length,'first last');
  const streams=new Map(),events=[];
  let now=0,tick,stopped=false;
  t.mock.method(performance,'now',()=>now);
  t.mock.method(globalThis,'setInterval',callback=>{tick=callback;return 1;});
  t.mock.method(globalThis,'clearInterval',()=>{stopped=true;});
  t.mock.method(globalThis,'fetch',async name=>new Response(new ReadableStream({
    start(controller){streams.set(name,controller);}
  })));
  const result=readModel(element,e=>events.push(e));
  assert(element.removed);
  assert.equal(streams.size,2);
  assert.deepEqual(events[0],{source:'download',loaded:0,total:bytes.length,remainingSeconds:null,stalled:false});
  now=4000;tick();
  assert(events.at(-1).stalled,'Waiting for first byte should be visible');
  now=4200;
  streams.get('last').enqueue(bytes.subarray(modelPartBytes));streams.get('last').close();
  await turn();tick();
  assert.equal(events.at(-1).loaded,96*1024);
  assert.equal(events.at(-1).stalled,false);
  now=5400;
  streams.get('first').enqueue(bytes.subarray(0,2*1024*1024));
  await turn();tick();
  assert(events.at(-1).remainingSeconds>0);
  now=9500;tick();
  assert(events.at(-1).stalled);
  assert.equal(events.at(-1).remainingSeconds,null);
  streams.get('first').enqueue(bytes.subarray(2*1024*1024,modelPartBytes));streams.get('first').close();
  assert.deepEqual(new Uint8Array(await result),bytes);
  assert(stopped);
  assert.equal(events.at(-1).loaded,bytes.length);
  assert.equal(events.at(-1).stalled,false);
  assert.equal(events.at(-1).remainingSeconds,null);
  assert(events.every((e,i)=>!i || e.loaded>=events[i-1].loaded));
});

test('fallback for responses without a readable stream',async t=>{
  const b=testBytes(100);
  t.mock.method(globalThis,'fetch',async()=>({ok:true,arrayBuffer:async()=>b.buffer}));
  assert.deepEqual(new Uint8Array(await readModel(modelElement(b.length,'file'))),b);
});

test('a failed part aborts pending requests and a truncated GLB is rejected',async t=>{
  let pendingSignal;
  const fetch=t.mock.method(globalThis,'fetch',async(name,{signal})=>{
    if(name==='missing')return new Response(null,{status:404});
    pendingSignal=signal;
    return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
  });
  await assert.rejects(readModel(modelElement(modelPartBytes+10,'pending missing')),error=>
    error instanceof ModelDownloadError && /HTTP 404/.test(error.cause.message));
  assert(pendingSignal.aborted);
  const b=testBytes(80);
  fetch.mock.mockImplementation(async()=>new Response(b));
  await assert.rejects(readModel(modelElement(128,'short')),error=>/Incomplete model part/.test(error.cause.message));
  await assert.rejects(readModel(modelElement(64,'oversize')),error=>/Oversized model part/.test(error.cause.message));
  b[0]=0;
  await assert.rejects(readModel(modelElement(b.length,'broken')),error=>/Invalid or incomplete GLB/.test(error.cause.message));
});

test('embedded file reads across base64 boundaries, with byte progress and no transfer ETA',async t=>{
  const b=testBytes(2*1024*1024+2),events=[];
  let time=0;
  t.mock.method(performance,'now',()=>time+=24);
  const el=modelElement(0,undefined);el.textContent=Buffer.from(b).toString('base64');
  assert.deepEqual(new Uint8Array(await readModel(el,e=>events.push(e))),b);
  assert.equal(el.textContent,'');
  assert(events.some(e=>e.loaded>0 && e.loaded<b.length));
  assert(events.every(e=>e.source==='embedded' && e.remainingSeconds===null));
  assert.equal(events.at(-1).loaded,b.length);
  el.textContent='broken';
  await assert.rejects(readModel(el),error=>error instanceof ModelDownloadError && /saved cabin file/.test(error.message));
});
