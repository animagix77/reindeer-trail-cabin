import assert from 'node:assert/strict';
import {setTimeout as wait} from 'node:timers/promises';
import {installWoodlandSound} from './woodland-sound.js';

const sources=[],events=[],parameter=()=>({
  value:0,lastTarget:null,setTargetAtTime(target,time,lag){this.lastTarget={target,time,lag};},cancelScheduledValues(){}
});
const connectable=data=>Object.assign({connect(to){this.output=to;},disconnect(){}},data);
class Audio {
  constructor(){this.currentTime=0;this.destination={};this.state='suspended';}
  async resume(){this.state='running';events.push('resume');}
  async suspend(){this.state='suspended';events.push('suspend');}
  createGain(){return connectable({gain:parameter()});}
  createBiquadFilter(){return connectable({frequency:parameter()});}
  createBufferSource(){
    const source=connectable({start(){this.started=true;},playbackRate:parameter()});
    sources.push(source);return source;
  }
  createBuffer(channels,count,rate){
    const tracks=Array.from({length:channels},()=>new Float32Array(count));
    return {duration:count/rate,getChannelData:i=>tracks[i]};
  }
}
globalThis.AudioContext=Audio;
globalThis.document={hidden:false,addEventListener(){}};
globalThis.window={addEventListener(){}};
const sound=installWoodlandSound();
sound.update({},false,true,null,0);
assert.equal(sources.length,0,'Audio waits for the existing activation gesture');
assert(await sound.enable(true));
const ambience=sources.length;
sound.update({},true,true,null,0);
assert.equal(sources.length,ambience,'An outdoor arrival starts with the woods alone');
sound.update({},false,true,null,0);
sound.update({},false,true,null,0);
const melody=sources.at(-1),roomGain=melody.output.gain;
for(let i=0;!melody.started && i<160;i++)await wait(10);
assert(melody.started && melody.loop);
assert(roomGain.lastTarget.target>0 && roomGain.lastTarget.target<=.2);
assert(roomGain.lastTarget.lag>=.25,'Entering the cabin fades in the music');
const pcm=melody.buffer.getChannelData(0);
let power=0,peak=0;
for(const v of pcm){power+=v*v;peak=Math.max(peak,Math.abs(v));}
assert(power/pcm.length>.002 && peak<.9);
assert(Math.abs(pcm[0]-pcm.at(-1))<.0001,'The loop has a quiet, continuous seam');
sound.update({},true,true,null,0);
assert.equal(roomGain.lastTarget.target,0,'Walking out fades the carol away');
assert(roomGain.lastTarget.lag>=.15);
sound.update({},false,true,null,0);
assert(!await sound.enable(false));
assert.equal(events.at(-1),'suspend','The shared Sound control mutes cabin music');
assert(await sound.enable(true));
sound.update({},false,false,null,0);
assert.equal(roomGain.lastTarget.target,0,'Leave the cabin carol out of overview mode');
assert.equal(sources.length,ambience+1,'Changing rooms or toggling sound never doubles the music');
console.log('Checked cabin carol activation, loop, level, indoor fades and mute.');
