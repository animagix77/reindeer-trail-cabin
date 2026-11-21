import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const ft=.3048,angle=5.4*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
const holdSeconds=25,fadeSeconds=1.4,warmupSeconds=.16;
const lampColor=0xffe8c3;
function plan(x,y,height){
  return new THREE.Vector3(4.65-ft*(c*x+s*y),2.88+height,-8.5+ft*(-s*x+c*y));
}

// L1040560 shows the twin heads and sensor beside the front bedroom window.
// Use the same compact fitting on the solid rear wall beside the patio slider.
function wallFixture(scene,name,position,rotation){
  const fixture=new THREE.Group(),casting=[],glass=[];
  fixture.name=name+' · twin motion floodlight';
  fixture.position.copy(position);
  fixture.rotation.y=rotation; // Local -Z faces away from the mounting wall.
  function part(geometry,x,y,z,rx=0,ry=0,bucket=casting){
    geometry.rotateX(rx).rotateY(ry).translate(x,y,z);
    bucket.push(geometry);
  }
  part(new THREE.BoxGeometry(.11,.14,.039),0,0,-.016);
  part(new THREE.BoxGeometry(.18,.033,.05),0,.014,-.055);
  const glassFace=new THREE.PlaneGeometry(.105,.075);
  for(const side of [-1,1]){
    const tilt=-.56,yaw=-.22+side*.43;
    const p=new THREE.Vector3(side*.087,.035,-.087);
    part(new THREE.BoxGeometry(.126,.097,.049),p.x,p.y,p.z,tilt,yaw);
    const lens=glassFace.clone().rotateY(Math.PI).translate(0,0,-.0253);
    part(lens,p.x,p.y,p.z,tilt,yaw,glass);
  }
  glassFace.dispose();
  part(new THREE.SphereGeometry(.031,10,6),0,-.062,-.048);
  const enamel=new THREE.MeshStandardMaterial({color:0x252725,roughness:.55,metalness:.35});
  const lens=new THREE.MeshStandardMaterial({color:0xd2cdb4,roughness:.39,emissive:lampColor,emissiveIntensity:0});
  for(const [parts,material] of [[casting,enamel],[glass,lens]]){
    const combined=mergeGeometries(parts);
    const mesh=new THREE.Mesh(combined,material);mesh.receiveShadow=true;
    fixture.add(mesh);parts.forEach(g=>g.dispose());
  }
  scene.add(fixture);
  return lens;
}

export function installMotionFloodlights(scene,model,schedule){
  const entryLens=wallFixture(scene,'Front entry',plan(39.07,-.08,1.81),-angle);
  const rearLens=wallFixture(scene,'Rear deck',plan(37.9,26.08,2.13),Math.PI-angle);
  const garageLenses=new Set();
  // This is the opal glass on the twin heads already present in the cabin GLB.
  model.traverse(object=>{
    if(!object.isMesh)return;
    for(const m of Array.isArray(object.material)?object.material:[object.material]){
      if(m.name==='Garage · opal lamp faces'){
        m.emissive.setHex(lampColor);m.emissiveIntensity=0;garageLenses.add(m);
      }
    }
  });
  function station(name,position,aim,outward,range,power,lenses,{shadow=true,fanEdge=.27}={}){
    // The rear cone faces out from the wall like the two LED heads. Keep the
    // two existing shadow maps across all three fixtures for mobile GPUs.
    const light=new THREE.SpotLight(lampColor,0,range+5,.93,.65,2);
    light.name=name+' motion flood';light.position.copy(position);light.target.position.copy(aim);
    light.castShadow=shadow;light.shadow.mapSize.set(512,512);
    light.shadow.camera.near=.16;light.shadow.normalBias=.018;light.shadow.bias=-.00035;
    light.shadow.autoUpdate=false;light.shadow.needsUpdate=true;
    scene.add(light,light.target);
    return {light,outward,range,power,lenses,fanEdge,lastX:NaN,lastZ:NaN,until:-Infinity,onAt:-Infinity,initial:0,level:0};
  }
  // Aim the central ray between the gravel arrival and toe of the retaining
  // steps. The garage head can rake the stairs along its own exterior wall.
  const garage=station('Driveway',plan(-.66,15.75,-2.72+2.151*1.08),plan(-5,-4,-2.45),
    new THREE.Vector3(c,0,s),11.6,285,garageLenses);
  const front=station('Front entry',plan(39.07,-.50,1.83),plan(31,-7.2,-.36),
    new THREE.Vector3(s,0,-c),10.3,205,[entryLens]);
  const rear=station('Rear deck',plan(37.9,26.51,2.13),plan(32,46,-1.5),
    new THREE.Vector3(-s,0,c),14.2,305,[rearLens],{shadow:false,fanEdge:.08});
  const stations=[garage,front,rear];
  let timer=null,wakeAt=Infinity;
  function wakeForFade(deadline,seconds){
    if(deadline===Infinity){clearTimeout(timer);timer=null;wakeAt=Infinity;return;}
    // An earlier timer also works. Its callback rechecks any extended hold.
    if(timer!==null && wakeAt<=deadline)return;
    clearTimeout(timer);wakeAt=deadline;
    timer=setTimeout(()=>{timer=null;wakeAt=Infinity;schedule();},Math.ceil(1000*(deadline-seconds))+1);
  }
  return {
    update(eye,walkingOutside,daylight,seconds,walkView){
      const darkness=walkView?1-THREE.MathUtils.smoothstep(daylight,.08,.29):0;
      let animating=false,deadline=Infinity;
      for(const sensor of stations){
        const {light,outward,range}=sensor;
        const dx=eye.x-light.position.x,dz=eye.z-light.position.z,dy=eye.y-light.position.y;
        const distance=Math.hypot(dx,dz),ahead=dx*outward.x+dz*outward.z;
        // The outward-facing fan ends at the wall. The supplied floor test also
        // excludes nearby people standing inside the cabin at a window.
        const seen=walkingOutside && darkness>0 && Math.abs(dy)<4 && distance<range &&
          ahead>distance*sensor.fanEdge;
        if(seen){
          if(!Number.isFinite(sensor.lastX) || Math.hypot(eye.x-sensor.lastX,eye.z-sensor.lastZ)>.10){
            if(seconds>=sensor.until){
              sensor.initial=sensor.level;sensor.onAt=seconds;
            }
            sensor.until=seconds+holdSeconds;sensor.lastX=eye.x;sensor.lastZ=eye.z;
          }
        }else{sensor.lastX=NaN;sensor.lastZ=NaN;}
        if(darkness===0){
          sensor.until=-Infinity;sensor.level=0;
        }else if(seconds<sensor.until){
          sensor.level=sensor.initial+(1-sensor.initial)*THREE.MathUtils.smoothstep(seconds-sensor.onAt,0,warmupSeconds);
          animating ||= sensor.level<1;
          deadline=Math.min(deadline,sensor.until);
        }else{
          sensor.level=1-THREE.MathUtils.smoothstep(seconds-sensor.until,0,fadeSeconds);
          animating ||= sensor.level>0;
        }
        const gain=darkness*sensor.level;
        light.intensity=sensor.power*gain;
        for(const material of sensor.lenses)material.emissiveIntensity=gain*5.6;
      }
      wakeForFade(deadline,seconds);
      return animating;
    },
    dispose(){clearTimeout(timer);}
  };
}
