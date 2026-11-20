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
    // All chairs are physical blockers. Sit at the blocker, stand on a valid floor.
    for(let i=0;i<4;i++){
      const chair=center('WalkBlock_YardChair0'+i);approach(chair,'Sit by the fire');
      const before={...body};pointer('pointerdown');pointer('pointermove',440,330);pointer('pointerup',440,330);update();
      assert(!controls.seated,'A look gesture cannot sit');
      tap();assert.equal(controls.seatId,i);assert(body.eye<before.eye-.35);
      assert(Math.hypot(body.x-chair.x,body.z-chair.z)<.001);
      assert.equal(label.textContent,'Stand up');
      tap();assert(controls.seated,'Free look while seated stays seated');
      if(i===1){taken=i;tie=true;controls.update();taken=-1;tie=false;}
      else key('KeyE');
      assert(!controls.seated);assert.deepEqual(body,before);
    }
    const chair=center('WalkBlock_YardChair00');approach(chair,'Sit by the fire');
    taken=0;update();assert.notEqual(label.textContent,'Sit by the fire');
    taken=-1;update();const departure={...body};tap();
    neighbors=[departure];key('KeyE');assert(Math.hypot(body.x-departure.x,body.z-departure.z)>.5);
    assert(space.spawn(body.x,body.z,body.y+body.eye,body.y));neighbors=[];
    for(const [k,singular] of Object.entries({twigs:'twigs',sticks:'stick',logs:'split log'})){
      approach(wood.targets[k],'Pick up '+singular);tap();assert.equal(wood.state.held,k);
      assert.equal(label.textContent,'Put back '+singular);key('KeyE');assert.equal(wood.state.held,null);
    }
    const ring=center('WalkBlock_FireRing');
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
  console.log('All four fire-circle seats, standing clearance, occupied chairs, loose wood, fire, grill and furnace passed direct interaction checks.');
}
