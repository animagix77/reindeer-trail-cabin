import assert from 'node:assert/strict';
import * as T from 'three';
import {installFirewood} from './firewood.js';
import {installTourFires} from './fires.js';
import {installWorldActions} from './world-actions.js';
import {makeHiker} from './hiker.js';

class Element extends EventTarget {
  hidden=true; textContent=''; classList={add(){},remove(){}};
  contains(node){return node===this;}
  getBoundingClientRect(){return {left:0,top:0,width:800,height:600};}
  focus(){} toggleAttribute(){}
}
export function checkWorldActions(model,space){
  const canvas=new Element(),button=new Element(),label=new Element();
  const doc=new Element();doc.body=doc;doc.documentElement=new Element();
  doc.getElementById=id=>id==='world-action'?button:label;doc.querySelector=()=>null;
  const previousDocument=globalThis.document,previousWindow=globalThis.window;
  globalThis.document=doc;globalThis.window=new Element();
  try{
    const world=new T.Scene(),camera=new T.PerspectiveCamera(64,4/3,.035,200);
    const fires=installTourFires(world,model);
    const wood=installFirewood(world,model,space,camera,fires);
    let body,fire=false,furnace=true,taken=-1,tie=false,neighbors=[],clock=performance.now()*.001;
    const activities={open:false,grillInReach:true,offeringFood:false,openGrill(){this.open=true;}};
    const sceneControls={isFireLit:()=>fire,toggleFire(){fire=!fire;},
      isFurnaceOn:()=>furnace,toggleFurnace(){furnace=!furnace;}};
    const place=spot=>{body=spot;camera.position.set(spot.x,spot.y+spot.eye,spot.z);};
    const controls=installWorldActions({model,camera,canvas,activities,sceneControls,space,firewood:wood,
      getBody:()=>body,neighbors:()=>neighbors,seatOccupied:(id,resolving)=>id===taken && (!resolving||tie),
      seat(next,yaw){place(next);if(yaw!=null)camera.rotation.set(-.1,yaw,0,'YXZ');},schedule(){}});
    function update(){wood.update(body,'yard',clock,activities.offeringFood);controls.update();}
    function key(code){doc.dispatchEvent(Object.assign(new Event('keydown',{cancelable:true}),{code}));update();}
    function pointer(event,x=400,y=300,type='touch'){
      canvas.dispatchEvent(Object.assign(new Event(event),{pointerId:1,pointerType:type,button:0,clientX:x,clientY:y}));
    }
    function tap(){pointer('pointerdown');pointer('pointerup');update();}
    function center(name){return new T.Box3().setFromObject(model.getObjectByName(name),true).getCenter(new T.Vector3());}
    function approach(target,expected){
      for(const distance of [.97,1.32,1.55,1.8,2.1]){
        for(let i=0;i<30;i++){
          const angle=i*2*Math.PI/30,x=target.x+distance*Math.cos(angle),z=target.z+distance*Math.sin(angle);
          const spot=space.spawn(x,z,target.y+1.59,target.y);
          if(!spot || Math.abs(spot.y-target.y)>1.3)continue;
          place(spot);camera.lookAt(target);update();
          if(!button.hidden && label.textContent===expected)return;
        }
      }
      assert.fail('No usable approach to '+expected+' at '+target.toArray());
    }
    const ring=center('WalkBlock_FireRing'),chairBoards=[],finishes=[];
    model.traverse(o=>{if(o.isMesh && /^Adirondack slat timber/.test(o.material.name))chairBoards.push(o);});
    const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
    // Exercise the visible seat and fan back of each chair, its facing and its walk blocker.
    for(let i=0;i<4;i++){
      const chair=center('WalkBlock_YardChair0'+i);approach(chair,'Sit by the fire');
      const anchor=model.getObjectByName('YardChairSeat0'+i);
      assert(anchor,'Missing seat pan anchor for chair '+i);
      const pan=anchor.getWorldPosition(new T.Vector3());
      const forward=ring.clone().sub(pan);forward.y=0;forward.normalize();
      const origin=pan.clone();origin.y+=.12;
      ray.set(origin,down);
      const slat=ray.intersectObjects(chairBoards,false)[0];
      assert(slat && Math.abs(slat.point.y-pan.y)<.025,'Seated position must meet the slats on chair '+i);
      const finish=slat.object.material.name.includes('burgundy')?'burgundy':'wood';
      if(finish==='burgundy'){
        const {r,g,b}=slat.object.material.color.clone().convertLinearToSRGB();
        assert(r>g*1.6 && b>g && r>b*1.25 && r<.68,'Expected a dark wine-red finish on chair '+i);
      }
      finishes.push(finish);
      origin.copy(pan).addScaledVector(forward,.35);origin.y+=.42;
      ray.set(origin,forward.clone().negate());
      const back=ray.intersectObjects(chairBoards,false)[0];
      assert(back && back.distance<1.02,'Expected a backrest behind the seated hiker on chair '+i);
      assert.equal(back.object.material.name.includes('burgundy'),finish==='burgundy','The back and seat finishes must match');
      const before={...body};pointer('pointerdown');pointer('pointermove',440,330);pointer('pointerup',440,330);update();
      assert(!controls.seated,'A look gesture cannot sit');
      tap();assert.equal(controls.seatId,i);assert(body.eye<before.eye-.35);
      assert(Math.hypot(body.x-pan.x,body.z-pan.z)<.001);
      assert(Math.abs(camera.position.y-pan.y-.82)<.001,'Eye height must follow the authored seat pan');
      assert(!space.spawn(pan.x,pan.z,body.y+1.59,body.y),'A visitor cannot stand inside a chair');
      const gaze=camera.getWorldDirection(new T.Vector3());gaze.y=0;gaze.normalize();
      assert(gaze.dot(forward)>.999,'The seated hiker must face the ring');
      assert.equal(label.textContent,'Stand up');
      tap();assert(controls.seated,'Free look while seated stays seated');
      if(i===1){taken=i;tie=true;controls.update();taken=-1;tie=false;}
      else key('KeyE');
      assert(!controls.seated);assert.deepEqual(body,before);
    }
    assert.deepEqual(finishes.sort(),['burgundy','burgundy','wood','wood']);
    const chair=center('WalkBlock_YardChair00');approach(chair,'Sit by the fire');
    taken=0;update();assert.notEqual(label.textContent,'Sit by the fire');
    taken=-1;update();const departure={...body};tap();
    neighbors=[departure];key('KeyE');assert(Math.hypot(body.x-departure.x,body.z-departure.z)>.5);
    assert(space.spawn(body.x,body.z,body.y+body.eye,body.y));neighbors=[];
    for(const [k,singular] of Object.entries({twigs:'twigs',sticks:'stick',logs:'split log'})){
      approach(wood.targets[k],'Pick up '+singular);tap();assert.equal(wood.state.held,k);
      assert.equal(label.textContent,'Put back '+singular);key('KeyE');assert.equal(wood.state.held,null);
    }
    approach(wood.targets.sticks,'Pick up stick');key('KeyE');
    approach(ring,'Toss stick into fire');tap();assert(wood.state.inFlight);assert.equal(fires.fuelSnapshot().sticks,0);
    clock+=2;update();assert(fires.fuelSnapshot().sticks>0);assert(!fire);
    approach(ring,'Light fire');button.dispatchEvent(new Event('click'));update();assert(fire);
    assert.equal(label.textContent,'Put out fire');key('KeyE');assert(!fire);
    const grate=model.getObjectByName('GrillSurface').getWorldPosition(new T.Vector3());
    approach(grate,'Use grill');tap();assert(activities.open);assert(button.hidden);activities.open=false;
    let glass;model.traverse(o=>{if(o.material?.name==='Cabin furnishing • Charcoal firebox glazing')glass=o;});
    const firebox=new T.Box3().setFromObject(glass,true).getCenter(new T.Vector3());
    approach(firebox,'Turn furnace off');doc.pointerLockElement=canvas;
    pointer('pointerdown',18,15,'mouse');pointer('pointerup',18,15,'mouse');update();
    assert(!furnace,'Captured mouse uses the center of the view');assert.equal(label.textContent,'Turn furnace on');
    doc.pointerLockElement=null;
    for(const gender of ['man','woman']){
      const hiker=makeHiker('friend',gender),standingHeight=hiker.height;
      hiker.pose(0,0,true);assert(hiker.seated && hiker.height<standingHeight-.4);
      hiker.pose(0,0,false);assert(!hiker.seated && hiker.height===standingHeight);hiker.dispose();
    }
  }finally{globalThis.document=previousDocument;globalThis.window=previousWindow;}
  console.log('Two burgundy and two natural chairs passed seat-pan, backrest, eye height, fire-facing and standing clearance checks. Occupancy, loose wood, fire, grill and furnace interactions passed.');
}
