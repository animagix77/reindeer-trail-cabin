import test from 'node:test';
import assert from 'node:assert/strict';
import {createSledTracks} from './sled-tracks.js';

function sample(tracks,x,d){
  const {data,width,height}=tracks.texture.image;
  const col=Math.floor((x-tracks.uv.x)*tracks.uv.z*width);
  const row=Math.floor((d-tracks.uv.y)*tracks.uv.w*height);
  return data.slice(4*(row*width+col),4*(row*width+col)+3);
}
test('two runner grooves and their displaced edges follow a moving sled',()=>{
  const tracks=createSledTracks();
  tracks.beginRun(0,0);
  tracks.record(0,0,0);
  tracks.flush();
  assert.equal(tracks.texture.updateRanges.length,0);
  tracks.record(0,3,0);
  for(let d=.5;d<3;d+=.09){
    assert.ok(sample(tracks,-.14,d)[0]>200);
    assert.ok(sample(tracks,.14,d)[0]>200);
    assert.deepEqual([...sample(tracks,0,d)],[0,0,255]);
    assert.ok(sample(tracks,.20,d)[1]>150);
    assert.deepEqual([...sample(tracks,.35,d)],[0,0,0]);
  }
  tracks.flush();
  const ranges=tracks.texture.updateRanges;
  assert.ok(ranges.length>0 && ranges.length<100);
  assert.ok(ranges.every(({start,count})=>start%4===0 && count%4===0 && count<80));
});
test('replays keep previous runs, with no line drawn across the reset',()=>{
  const tracks=createSledTracks(),pixels=tracks.texture.image.data;
  tracks.beginRun(0,0);
  tracks.record(0,3,0);
  tracks.beginRun(5,1,Math.PI/2);
  tracks.record(7,1,Math.PI/2);
  assert.ok(sample(tracks,0.14,2)[0]>200);
  assert.ok(sample(tracks,6,1.14)[0]>200);
  assert.ok(sample(tracks,6,.86)[0]>200);
  assert.deepEqual([...sample(tracks,3,2)],[0,0,0]);
  const first=pixels.slice();
  tracks.beginRun(5,1,Math.PI/2);
  tracks.record(7,1,Math.PI/2);
  assert.equal(tracks.texture.image.data,pixels);
  assert.deepEqual(first,pixels);
});
test('sideways slip sweeps the shell footprint across the snow',()=>{
  const tracks=createSledTracks();
  tracks.beginRun(0,1,0);
  tracks.record(1,1,0);
  // The shell still points downhill while its velocity carries it across-slope.
  assert.ok(sample(tracks,.5,1)[2]>200);
  assert.ok(sample(tracks,.5,1.29)[2]>45);
  assert.equal(sample(tracks,.5,1.53)[2],0);
});
