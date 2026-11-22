import assert from 'node:assert/strict';
import test from 'node:test';
import {surface} from './lake-terrain.js';
import {SledMotion} from './sled-motion.js';

function ride(terrain=surface){
  const sled=new SledMotion(terrain);sled.pushOff();return sled;
}
function run(sled,input,seconds,fps=60){
  for(let i=0;i<seconds*fps;i++)sled.advance(1/fps,input);
}

test('the same push accelerates with the measured pitch under the runners',()=>{
  const steep=ride((x,d)=>-d*.21),gentle=ride((x,d)=>-d*.08),flat=ride(()=>0);
  for(const sled of [steep,gentle,flat])run(sled,0,2);
  assert.ok(steep.vd>gentle.vd+2);
  assert.ok(gentle.vd>2.2 && flat.vd<2.2);
});
test('the hull turns first and keeps sliding when steering reverses',()=>{
  const sled=ride((x,d)=>-.19*d);run(sled,0,2);
  run(sled,1,1);
  const course=Math.atan2(sled.vx,sled.vd);
  assert.ok(course>.09 && course<sled.heading-.04);
  // Nose crosses the fall line first; the old velocity still moves it right.
  run(sled,-1,.2);
  assert.ok(sled.heading<0 && sled.vx>.05);
  run(sled,-1,1);
  assert.ok(sled.vx<-.3);
});
test('replays at different refresh rates follow the same line and coast to rest on shore',()=>{
  for(const input of [-1,0,1]){
    const states=[20,60,120].map(fps=>{
      const sled=ride();let maxSpeed=0,lastSpeed=0;
      for(let i=0;i<30*fps && !sled.finished;i++){
        lastSpeed=Math.hypot(sled.vx,sled.vd);maxSpeed=Math.max(lastSpeed,maxSpeed);
        sled.advance(1/fps,input);
        assert.ok(Math.abs(sled.x)<8.2);
      }
      assert.ok(sled.finished && lastSpeed<.35);
      assert.ok(sled.d>54 && sled.d<73);
      assert.ok(maxSpeed>6.5);
      const d=sled.d;run(sled,1,1);assert.equal(sled.d,d);
      return [sled.x,sled.d];
    });
    for(const [x,d] of states)assert.ok(Math.hypot(x-states[0][0],d-states[0][1])<1e-8);
  }
});
