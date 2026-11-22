import assert from 'node:assert/strict';
import * as T from 'three';
import {installSmartTV} from './smart-tv.js';

export function checkSmartTV(model,space){
  const originalDocument=globalThis.document,originalImage=globalThis.Image;
  const brush=new Proxy({}, {get:(_,key)=>key==='createLinearGradient'?()=>({addColorStop(){}}):()=>{}});
  globalThis.document={
    createElement:()=>({getContext:()=>brush}),
    querySelector:()=>({naturalWidth:100,naturalHeight:75}),
    getElementById:()=>({textContent:'{"images":{"aerial":""}}'})
  };
  globalThis.Image=class {};
  try{
    const tv=installSmartTV(model,()=>{});
    const panel=model.getObjectByName('Living room smart TV display');
    assert(panel && tv,'The actual living room TV has a display');
    const point=(x,y,z)=>panel.localToWorld(new T.Vector3(x,y,z));
    const eye=point(0,.28,1.3),foot=space.spawn(eye.x,eye.z,eye.y);
    assert(/^WalkSurface_MainFloor/.test(foot?.label),'The TV can be reached on the living room floor');
    eye.y=foot.y+foot.eye;
    let time=0;
    function visit(at,label){for(let i=0;i<18;i++)tv.update(at,label,time+=1/30);}
    visit(point(0,.3,-.3),foot.label);assert(!panel.visible,'The TV stays off through its back wall');
    visit(eye,'WalkSurface_Loft');assert(!panel.visible,'A visitor directly above cannot wake the TV');
    visit(eye,foot.label);assert.equal(panel.material.opacity,1);
    const ray=new T.Raycaster(eye,point(0,0,0).sub(eye).normalize());
    let hit=tv.hit(ray);
    assert(hit?.uv);assert(tv.select(hit.uv),'The winter photograph opens on the TV');
    assert(!tv.hit(ray),'The middle of a full-screen photo is not a control');
    assert(tv.select(new T.Vector2(.1,.9)),'Home reopens the two photo channels');
    assert(tv.select(new T.Vector2(.75,.4)),'The aerial photograph can also open');
    visit(point(0,.25,3.15),foot.label);assert(panel.visible,'One step back keeps the picture on');
    visit(point(0,.25,4.3),foot.label);assert(!panel.visible);assert(!tv.hit(ray));
    visit(point(0,.25,3.15),foot.label);assert(!panel.visible,'Standby has a wider exit band');
    visit(eye,foot.label);assert(tv.hit(ray),'The next approach starts at Home');
    panel.removeFromParent();panel.geometry.dispose();panel.material.map.dispose();panel.material.dispose();
  }finally{
    globalThis.document=originalDocument;globalThis.Image=originalImage;
  }
}
