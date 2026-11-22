import * as T from 'three';
import {STANDING_EYE_HEIGHT} from './walking.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {fuelDuration} from './fires.js';
import {makeOfferingHand} from './wildlife-model.js';
import {createThrowColliders} from './throw-colliders.js';
import {createThrowMotion,tossArc} from './toss-motion.js';

const kinds=Object.keys(fuelDuration);
const initial={twigs:6,sticks:5,logs:4};
const names={twigs:'handful of twigs',sticks:'stick',logs:'split log'};
const floorLabel=/^WalkSurface_(ParcelGround|FireCircleGravel|PergolaGravel)$/i;
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const up=v(0,1,0), feet=.3048, angle=5.4*Math.PI/180;
const clamp=T.MathUtils.clamp;
function plan(x,y){
  const c=Math.cos(angle),s=Math.sin(angle);
  return v(4.65-feet*(c*x+s*y),0,-8.5+feet*(c*y-s*x));
}
function tint(geo,hex){
  const rgb=new T.Color(hex),values=[];
  for(let i=0;i<geo.attributes.position.count;i++)values.push(rgb.r,rgb.g,rgb.b);
  geo.setAttribute('color',new T.Float32BufferAttribute(values,3));
  geo.setAttribute('woodSurface',new T.Float32BufferAttribute(new Float32Array(values.length/3),1));
  return geo;
}
function branch(a,b,radius,end,color){
  const axis=v().subVectors(b,a);
  const g=new T.CylinderGeometry(end,radius,axis.length(),7,1).toNonIndexed();
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(up,axis.normalize()));
  g.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);
  return tint(g,color);
}
function branches(bundle) {
  const parts=[];
  function fork(x,y,z,length,r,turn,wood){
    const p=(u,h,d)=>v(x+u*length,y+h,z+turn*u+d);
    const a=p(-.49,.006,0),b=p(-.15,.001,-.009),c=p(.19,.013,.007),d=p(.51,.025,0);
    parts.push(branch(a,b,r,r*.89,wood),branch(b,c,r*.90,r*.67,wood),branch(c,d,r*.68,r*.32,wood));
    parts.push(branch(c,p(.37,.045,.045),r*.54,r*.14,wood));
    if(bundle)parts.push(branch(b,p(.02,.026,-.035),r*.49,r*.13,wood));
    else parts.push(branch(b,p(-.04,.041,-.071),r*.65,r*.19,wood));
  }
  if(bundle){
    fork(-.015,.002,-.018,.265,.0057,.073,0x6c5141);
    fork(.013,.001,.024,.245,.0071,-.055,0x574232);
    fork(-.019,.014,.005,.278,.0050,.015,0x806347);
    fork(.027,.012,.008,.224,.0047,-.082,0x68523e);
  }else fork(0,0,0,.414,.017,.023,0x6e5947);
  const g=mergeGeometries(parts);
  parts.forEach(p=>p.dispose());
  return g;
}
function splitLog(stacked=false){
  // Half a round, with ridged bark, a pale split face, and end-grain
  // following the arc of the original trunk.
  const positions=[],colors=[],surfaces=[];
  const ring=(x,theta,r=1)=>v(x,Math.sin(theta)*.079*r-.031,
    Math.cos(theta)*.076*r*(1.+.034*Math.cos(theta*9.)));
  const strip=[0x544333,0x67503b,0x433c32,0x705942,0x574939];
  function triangle(a,b,c,color,surface){
    const m=new T.Color(color);
    for(const p of [a,b,c]){positions.push(p.x,p.y,p.z);colors.push(m.r,m.g,m.b);surfaces.push(surface);}
  }
  function quad(a,b,c,d,color,surface=0){triangle(a,b,c,color,surface);triangle(a,c,d,color,surface);}
  const stations=stacked?[-.203,.012,.205]:[-.203,-.127,-.034,.057,.142,.205];
  const sides=stacked?7:13;
  for(let j=0;j<stations.length-1;j++){
    const a=stations[j],b=stations[j+1];
    for(let i=0;i<sides;i++){
      const t=i*Math.PI/sides,n=(i+1)*Math.PI/sides;
      quad(ring(a,t),ring(a,n),ring(b,n),ring(b,t),strip[(i+Number(j===2&&i%3===0))%strip.length]);
    }
    for(let i=0;i<5;i++){
      const z=-.076+i*.0304,y=-.031+.002*Math.sin(i*3.1);
      quad(v(a,y,z),v(b,y,z),v(b,-.032,z+.0304),v(a,-.032,z+.0304),
        [0xb08a62,0xbb9973,0xc19f76,0xbd9570,0xaa825c][i],1);
    }
  }
  for(const end of [stations[0],stations.at(-1)]){
    for(let i=0;i<sides;i++){
      const t=i*Math.PI/sides,n=(i+1)*Math.PI/sides;
      const bands=stacked?[0,.55,.60,1]:[0,.25,.32,.55,.60,.81,.86,1];
      for(let j=0;j<bands.length-1;j++){
        const a=ring(end,t,bands[j]),b=ring(end,n,bands[j]),c=ring(end,n,bands[j+1]),d=ring(end,t,bands[j+1]);
        quad(a,b,c,d,[0xae8760,0x98714e,0xb8926b,0xa37e59,0xbe9b74,0xab855c,0xc1a07a][j],2);
      }
    }
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  g.setAttribute('woodSurface',new T.Float32BufferAttribute(surfaces,1));
  g.computeVertexNormals();
  return g;
}

function grainOnStackEnds(mesh,barkPhoto){
  // Flat-shaded glTF faces have separate vertices at each normal. Weld their
  // positions for this lookup so each cut round has its own pith and rings.
  const g=mesh.geometry,a=g.attributes.position,parent=Int32Array.from({length:a.count},(_,i)=>i);
  const unique=new Map(),centers=new Map(),local=v();
  function root(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
  for(let i=0;i<a.count;i++){
    local.fromBufferAttribute(a,i);
    const key=[local.x,local.y,local.z].map(n=>Math.round(n*10000)).join(',');
    if(unique.has(key))parent[i]=unique.get(key);else unique.set(key,i);
  }
  const index=g.index;
  for(let j=0;j<(index?.count??a.count);j+=3){
    const i=index?index.getX(j):j,b=index?index.getX(j+1):j+1,c=index?index.getX(j+2):j+2;
    parent[root(b)]=root(i);parent[root(c)]=root(i);
  }
  for(const i of unique.values()){
    const id=root(i);
    if(!centers.has(id))centers.set(id,{point:v(),count:0});
    const ctr=centers.get(id);ctr.point.add(local.fromBufferAttribute(a,i));ctr.count++;
  }
  for(const c of centers.values())c.point.divideScalar(c.count);
  const uv=new Float32Array(a.count*3);
  for(let i=0;i<a.count;i++){
    const id=root(i);local.fromBufferAttribute(a,i).sub(centers.get(id).point);
    uv[3*i]=local.z*.9956-local.x*.0941;uv[3*i+1]=local.y;uv[3*i+2]=(id*.618034)%1;
  }
  g.setAttribute('roundGrain',new T.BufferAttribute(uv,3));
  const mat=mesh.material,old=mat.onBeforeCompile,priorKey=mat.customProgramCacheKey();
  mat.onBeforeCompile=(shader,renderer)=>{
    old.call(mat,shader,renderer);shader.uniforms.stackGrainTexture={value:barkPhoto};
    shader.vertexShader='attribute vec3 roundGrain; varying vec3 endGrain;\n'+shader.vertexShader
      .replace('#include <begin_vertex>','#include <begin_vertex>\nendGrain=roundGrain;');
    shader.fragmentShader='uniform sampler2D stackGrainTexture; varying vec3 endGrain;\n'+shader.fragmentShader
      .replace('#include <color_fragment>',`#include <color_fragment>
        vec2 wood=endGrain.xy+vec2(.012*sin(endGrain.z*21.),.008*cos(endGrain.z*17.));
        float ang=atan(wood.y,wood.x),r=length(wood);
        float grain=texture2D(stackGrainTexture,endGrain.xy*3.+endGrain.z).g;
        float ring=r*(680.+85.*endGrain.z)+.68*sin(3.*ang+r*32.)+.41*sin(ang*6.+endGrain.z*11.);
        float rings=.80+.20*smoothstep(-.85,.78,sin(ring));
        rings=mix(rings,.90,smoothstep(.8,2.8,fwidth(ring)));
        float split=abs(sin(ang-5.4*endGrain.z+.045*sin(r*105.)))*r;
        float crack=(1.-smoothstep(.0004,.0022+fwidth(r),split))*smoothstep(.03,.08,r);
        diffuseColor.rgb*=vec3(1.16,1.05,.88)*rings*(.78+.70*sqrt(grain))*(1.-.59*crack);`);
  };
  mat.customProgramCacheKey=()=>priorKey+'|individual-cut-rounds';mat.needsUpdate=true;
}

export function installFirewood(scene,model,space,camera,fires,onChange=()=>{},onFuelAdded=()=>{},colliders=createThrowColliders(space,model)){
  model.updateMatrixWorld(true);
  const ringObject=model.getObjectByName('WalkBlock_FireRing');
  if(!ringObject)throw Error('The firewood activity needs the fire ring.');
  const bounds=new T.Box3().setFromObject(ringObject,true),ring=bounds.getCenter(v());
  ring.y=bounds.min.y+.010;
  const ringRadius=colliders.ringInnerRadius??.473;
  const looseGravel=[],obstacles=[],floorRay=new T.Raycaster(),down=v(0,-1,0);
  let barkPhoto,stackEnds;
  const stackedBark=[];
  model.traverse(o=>{
    if(!o.isMesh)return;
    if(o.material.name==='Hardwood bark')barkPhoto=o.material.map;
    if(o.material.name==='Firewood · weathered split face')stackEnds=o;
    if(o.material.name==='Weathered timber ties')stackedBark.push(o);
    for(let p=o;p;p=p.parent){
      if(/^Rear[ _]garden[ _]path/i.test(p.name)){looseGravel.push(o);break;}
      if(/^WalkBlock_/.test(p.name)){
        if(p!==ringObject){
          const box=new T.Box3().setFromObject(o,true);
          if(box.distanceToPoint(ring)<6.2)obstacles.push(box.expandByScalar(.035));
        }
        break;
      }
    }
  });
  if(stackEnds&&barkPhoto)grainOnStackEnds(stackEnds,barkPhoto);
  function floorAt(point){
    const hit=space.heights(point.x,point.z).filter(h=>floorLabel.test(h.label)).sort((a,b)=>b.y-a.y)[0];
    if(!hit)throw Error('Firewood activity has no supported ground.');
    point.y=hit.y;
    return point;
  }
  function supplyFloor(point){
    floorAt(point);
    floorRay.set(v(point.x,point.y+.52,point.z),down);
    const surface=floorRay.intersectObjects(looseGravel,false)[0];
    if(surface)point.y=Math.max(point.y,surface.point.y);
    return point;
  }
  // The near end of the split-wood stack in IMG_3353 is behind the swinging
  // chairs. These loose pieces lie on its open approach, just short of the drain.
  const anchors={twigs:supplyFloor(plan(38.25,47.35)),sticks:supplyFloor(plan(38.55,48.75)),logs:supplyFloor(plan(38.70,50.0))};
  const entry=floorAt(plan(34.65,46.92)),look=anchors.sticks.clone();
  entry.y+=STANDING_EYE_HEIGHT;look.y+=.19;
  const view={eye:entry.toArray(),target:look.toArray(),fov:63};
  const geometry={twigs:branches(true),sticks:branches(false),logs:splitLog()};
  // Split-log cut surfaces and end grain are two-sided, including the fresh cut
  // visible when a piece rolls over on its way into the ring.
  const wood=new T.MeshStandardMaterial({vertexColors:true,color:0xffffff,side:T.DoubleSide,roughness:.94});
  if(barkPhoto){
    // Use the photographed hardwood bark from the property model around the
    // round side. Sawn ends retain staggered growth rings and the split face grain.
    wood.onBeforeCompile=shader=>{
      shader.uniforms.firewoodBark={value:barkPhoto};
      shader.vertexShader='attribute float woodSurface; varying float cut; varying vec3 woodLocal;\n'+shader.vertexShader
        .replace('#include <begin_vertex>','#include <begin_vertex>\ncut=woodSurface; woodLocal=position;');
      shader.fragmentShader='uniform sampler2D firewoodBark; varying float cut; varying vec3 woodLocal;\n'+shader.fragmentShader
        .replace('#include <color_fragment>',`#include <color_fragment>
          float a=atan(woodLocal.y+.029,woodLocal.z);
          vec2 grainUV=vec2(a*.29,woodLocal.x*2.72+.13*sin(a*2.));
          vec3 fibre=texture2D(firewoodBark,grainUV).rgb;
          float grain=dot(fibre,vec3(.2126,.7152,.0722));
          float roughBark=clamp(.27+2.45*sqrt(grain),.34,1.85);
          float striation=sin(woodLocal.z*770.+2.*sin(woodLocal.x*27.+woodLocal.z*58.));
          float radial=length(woodLocal.zy+vec2(0,.030));
          float rings=sin(radial*875.+1.4*sin(a*3.+radial*55.));
          float cutGrain=cut>1.5?1.+.11*rings+.13*(roughBark-1.):.94+.08*striation+.24*(roughBark-1.);
          diffuseColor.rgb*=cut<.5?roughBark:cutGrain;`);
    };
    wood.customProgramCacheKey=()=>'property-bark-cut-firewood';
  }
  const pieces=new T.Group();pieces.name='Firewood · loose supplies and laid fuel';scene.add(pieces);
  const stock={},laid={},counts={...initial};
  const restPoses={twigs:[],sticks:[],logs:[]};
  const form=new T.Object3D(),tintValue=new T.Color(),white=new T.Color(1,1,1),charcoal=new T.Color(.21,.16,.12);
  for(const k of kinds){
    stock[k]=new T.InstancedMesh(geometry[k],wood,32);stock[k].name='Gatherable '+k;stock[k].userData.throwKind=k;
    laid[k]=new T.InstancedMesh(geometry[k],wood,8);laid[k].name='Firewood in the ring · '+k;
    for(const mesh of [stock[k],laid[k]]){mesh.receiveShadow=true;pieces.add(mesh);}
    for(let i=0;i<stock[k].instanceMatrix.count;i++){
      const row=Math.floor(i/3),col=i%3;
      const p=anchors[k].clone();
      p.x+=(col-1)*(k==='logs'?.13:.085);p.z+=(row%2)*.065;
      supplyFloor(p);
      form.position.copy(p);
      form.position.y+=(k==='logs'?.035:.015)+row*(k==='logs'?.040:.014);
      form.rotation.set(k==='logs'?.11:.04,.93+(i%3)*.10-Math.floor(row%2)*.42,k==='twigs'?.02:0);
      form.scale.setScalar(.93+.047*(i%3));form.updateMatrix();stock[k].setMatrixAt(i,form.matrix);
    }
    stock[k].computeBoundingSphere();
    laid[k].boundingSphere=new T.Sphere(ring.clone().addScaledVector(up,.19),.65);
    stock[k].count=counts[k];laid[k].count=0;
  }
  // The photographed stack is two ranks deep, with sloping ends. Fresh wood
  // builds in short tapered bays on its crown, inside its existing walk blocker.
  const freshWood=new T.InstancedMesh(splitLog(true),wood,150);
  freshWood.name='Fresh split wood behind the swings';
  freshWood.count=0;freshWood.visible=false;freshWood.castShadow=freshWood.receiveShadow=true;
  pieces.add(freshWood);
  let stackBuilt=false;
  function buildStack(){
    const ray=new T.Raycaster(),pose=new T.Object3D();
    let index=0;
    for(let rank=0;rank<2;rank++)for(let bay=0;bay<3;bay++){
      const x=40.5+rank*1.48,start=49.10+bay*3.62,spacing=.51;
      let below=[];
      for(let row=0;row<5;row++){
        const heights=[];
        for(let col=0;col<7-row;col++){
          const y=start+(col+row*.5)*spacing;
          const at=plan(x,y);
          if(row===0){
            // Sample both sides of a valley between two existing logs so a
            // fresh billet bridges the bark even where the hill slopes.
            let height=-Infinity;
            for(const offset of [-.13,0,.13]){
              const point=plan(x,y+offset);point.y=ring.y+3;
              ray.set(point,down);
              const hit=ray.intersectObjects(stackedBark,false)[0];
              if(hit)height=Math.max(height,hit.point.y);
            }
            at.y=Number.isFinite(height)?height:floorAt(at).y+.89;
          }else at.y=Math.max(below[col],below[col+1])-.012;
          const variation=Math.sin((index+1)*19.2),scale=.97+.045*variation;
          pose.position.set(at.x+.012*variation,at.y+.031*scale,at.z);
          pose.rotation.set(.025*Math.cos(index),-angle+.038*variation,.018*Math.sin(index*3.7),'YXZ');
          pose.scale.set(.93+.12*Math.cos(index*1.7),scale,scale);
          pose.updateMatrix();freshWood.setMatrixAt(index++,pose.matrix);
          heights.push(at.y+.079*scale);
        }
        below=heights;
      }
    }
    freshWood.count=index;freshWood.computeBoundingSphere();freshWood.instanceMatrix.needsUpdate=true;
    stackBuilt=true;
  }
  function setRestocked(total){
    if(!Number.isSafeInteger(total)||total<0)return;
    const count=Math.min(total,freshWood.instanceMatrix.count);
    if(count===freshWood.count)return;
    if(count&&!stackBuilt)buildStack();
    freshWood.count=count;freshWood.visible=count>0;
    model.userData.lightRevision=(model.userData.lightRevision||0)+1;
  }
  const palm=new T.Group();palm.name='Carrying firewood';palm.add(makeOfferingHand());scene.add(palm);palm.visible=false;
  const carry={};
  for(const k of kinds){
    const obj=new T.Mesh(geometry[k],wood);obj.name='Held '+k;
    obj.rotation.set(k==='logs'?.36:0,-.54,-.20);obj.position.set(-.005,k==='logs'?.051:.012,-.026);
    carry[k]=obj;obj.visible=false;palm.add(obj);
  }
  let held=null,heldSplit=null,inFlight=null,body=null,currentView='property',message='Gather loose wood at the foot of the woodpile.';
  const dropped=new Map(),falling=new Map();
  let heldMass,heldScale=1;
  let lastDrop=null,reportedState,clock=performance.now()*.001;
  let offeringFood=false;
  let nearPit=false,nearStockpile=false,canToss=false,nearby=[],lastReport='';
  const forward=v(),toward=v(),lastFuel={twigs:-1,sticks:-1,logs:-1};
  const arcRay=new T.Ray(),probe=v(),hit=v(),arcEnd=v(),arcHand=v(),cachedHand=v(Infinity,0,0);
  let cachedClear=false;
  function flightDuration(start,end){return clamp(.47+.082*Math.hypot(end.x-start.x,end.z-start.z),.53,.93);}
  function clearArc(start,end){
    const duration=flightDuration(start,end);arcRay.origin.copy(start);
    for(let i=1;i<=14;i++){
      tossArc(probe,start,end,duration,i/14);
      const length=probe.distanceToSquared(arcRay.origin);
      arcRay.direction.subVectors(probe,arcRay.origin).normalize();
      if(obstacles.some(box=>box.containsPoint(arcRay.origin) ||
        (arcRay.intersectBox(box,hit)&&hit.distanceToSquared(arcRay.origin)<=length)))return false;
      arcRay.origin.copy(probe);
    }
    return true;
  }
  const token=()=>[...kinds.map(k=>counts[k]),held||'',!!inFlight,nearPit,nearStockpile,canToss,nearby.join(),message].join('|');
  function snapshot(){return {counts:{...counts},held,heldName:heldSplit && held!=='logs'?'kindling':null,nearby:[...nearby],canToss,inFlight:!!inFlight,nearPit,nearStockpile,message};}
  function notify(text){
    if(text!==undefined)message=text;
    const changed=token();if(changed===lastReport)return;
    lastReport=changed;reportedState=snapshot();onChange(reportedState);
  }
  function measure(){
    const yard=body&&floorLabel.test(body.label);
    const distance=p=>Math.hypot(body.x-p.x,body.z-p.z);
    nearPit=Boolean(yard&&Math.abs(body.y-ring.y)<.92&&distance(ring)<=5.5);
    nearStockpile=Boolean(yard&&distance(anchors.sticks)<3.4&&Math.abs(body.y-anchors.sticks.y)<.70);
    nearby=nearStockpile?kinds.filter(k=>distance(anchors[k])<=1.65):[];
    for(const k of kinds)carry[k].visible=k===held && !heldSplit;
    palm.visible=!!held&&!!body&&currentView!=='property'&&!offeringFood;
    if(palm.visible){
      const rightEdge=Math.tan(T.MathUtils.degToRad(camera.fov)*.5)*Math.min(camera.aspect,1.5);
      palm.position.set(.55*rightEdge*.68,-.23,-.55).applyQuaternion(camera.quaternion).add(camera.position);
      palm.quaternion.copy(camera.quaternion);
      palm.updateMatrixWorld(true);
    }
    canToss=false;
    if(nearPit&&held&&!inFlight&&!offeringFood){
      camera.getWorldDirection(forward);forward.y=0;forward.normalize();
      toward.set(ring.x-body.x,0,ring.z-body.z).normalize();
      if(distance(ring)<2.0 || forward.dot(toward)>.25){
        (heldSplit||carry[held]).getWorldPosition(arcHand);
        if(cachedHand.distanceToSquared(arcHand)>.04**2){
          cachedHand.copy(arcHand);
          cachedClear=clearArc(arcHand,arcEnd.copy(ring).addScaledVector(up,.20));
        }
        canToss=cachedClear;
      }
    }
  }
  function result(ok,text){lastDrop=null;measure();notify(text);return ok;}
  function pickUp(k,index=counts[k]-1){
    if(!kinds.includes(k))return false;
    if(offeringFood||held||inFlight)return result(false,'Finish with the wood in your hand first.');
    if(!nearby.includes(k))return result(false,'Walk closer to the '+names[k]+' at the woodpile.');
    if(!counts[k])return result(false,'You have gathered all the '+k+' here.');
    if(!Number.isInteger(index)||index<0||index>=counts[k])return false;
    const supply=stock[k],last=counts[k]-1,selected=new T.Matrix4();
    supply.getMatrixAt(index,selected);
    if(index!==last){
      supply.getMatrixAt(last,form.matrix);
      supply.setMatrixAt(index,form.matrix);supply.setMatrixAt(last,selected);
      supply.instanceMatrix.needsUpdate=true;
    }
    selected.decompose(form.position,form.quaternion,form.scale);
    heldScale=form.scale.x;carry[k].scale.setScalar(heldScale);
    heldMass=undefined;held=k;supply.count=--counts[k];
    return result(true,'Carrying a '+names[k]+'. Aim and throw, or carry it to the fire pit.');
  }
  function takeSplitLog(massKg=2,mesh){
    if(offeringFood||held||inFlight)return result(false,'Finish with the wood in your hand first.');
    heldMass=massKg;heldScale=1;
    held=massKg<.22?'twigs':massKg<1?'sticks':'logs';
    carry[held].scale.setScalar(1);
    if(mesh){
      // The pile can dispose its geometry as soon as it is picked up. Keep the
      // exact cut faces and bark and turn the upright billet across the palm.
      const cut=mesh.geometry.clone().center().rotateZ(-Math.PI/2);
      heldSplit=new T.Mesh(cut,mesh.material);
      heldSplit.name='Freshly split oak';
      heldSplit.position.copy(carry[held].position);
      heldSplit.rotation.copy(carry[held].rotation);
      palm.add(heldSplit);
    }
    return result(true,held==='logs'?'Carrying your freshly split log.':'Carrying your split kindling.');
  }
  function hitWood(raycaster){
    if(!body||held||inFlight||offeringFood)return null;
    const candidates=nearby.filter(k=>counts[k]>0).map(k=>stock[k]);
    for(const mesh of dropped.keys()){
      if(mesh.position.distanceToSquared(camera.position)<3.1**2)candidates.push(mesh);
    }
    if(!candidates.length)return null;
    const match=raycaster.intersectObjects(candidates,false)[0];
    if(!match || match.distance>2.8 || Math.hypot(match.point.x-body.x,match.point.z-body.z)>1.85)return null;
    match.kind=match.object.userData.throwKind;
    return match;
  }
  function pickUpHit(hit){
    if(!hit||!body||held||inFlight||offeringFood||camera.position.distanceTo(hit.point)>2.8||
      Math.hypot(hit.point.x-body.x,hit.point.z-body.z)>1.85)return false;
    const {object,kind}=hit;
    if(stock[kind]===object)return pickUp(kind,hit.instanceId);
    if(!dropped.delete(object))return false;
    releaseSupportedWood(object);
    held=kind;heldMass=object.userData.massKg;heldScale=object.scale.x;
    object.removeFromParent();
    if(object.userData.freshCut){
      heldSplit=object;heldSplit.position.copy(carry[kind].position);heldSplit.rotation.copy(carry[kind].rotation);
      palm.add(heldSplit);
    }else carry[kind].scale.setScalar(heldScale);
    return result(true,'Carrying the '+names[kind]+'.');
  }
  function discardSplit(mesh){
    if(mesh){mesh.removeFromParent();mesh.geometry.dispose();}
  }
  function putBack(){
    if(!held||inFlight)return false;
    const k=held;
    if(!nearby.includes(k))return result(false,'Return to the woodpile to put this wood back.');
    if(counts[k]>=stock[k].instanceMatrix.count)return result(false,'The woodpile is full.');
    stock[k].count=++counts[k];held=null;discardSplit(heldSplit);heldSplit=null;
    return result(true,'The wood is back on the pile.');
  }
  function stackedPose(kind,i){
    const a=i*2.39996+kinds.indexOf(kind)*2.03,r=.08+.047*(i%3);
    form.position.set(ring.x+Math.cos(a)*r,ring.y+.171+(i%4)*.032,ring.z+Math.sin(a)*r);
    form.rotation.set(.10*Math.sin(a),a,.13*Math.cos(a));
    form.scale.setScalar(1);
    return form;
  }
  function neighborsOf(mesh){
    const neighbors=[];
    const nearby=p=>p.position.distanceToSquared(mesh.position)<11**2;
    for(const [piece,supports] of dropped){
      if(piece!==mesh && !supports.has(mesh) && nearby(piece))neighbors.push(piece);
    }
    for(const poses of Object.values(restPoses))for(const pose of poses){
      if(pose?.collider && nearby(pose.collider))neighbors.push(pose.collider);
    }
    return neighbors;
  }
  function releaseSupportedWood(support){
    // Reuse the solver's actual contacts. Nearby pieces on bare ground sleep.
    for(const [mesh,supports] of dropped){
      if(!supports.has(support))continue;
      dropped.delete(mesh);
      const motion=createThrowMotion({mesh,kind:mesh.userData.throwKind,massKg:mesh.userData.massKg,
        velocity:v(),spin:false,colliders,obstacles:neighborsOf(mesh)});
      falling.set(mesh,{motion,start:clock,origin:mesh.position.clone()});
    }
  }
  function updateFalling(){
    for(const [mesh,fall] of falling){
      if(!fall.motion.sample(clock-fall.start,mesh))continue;
      falling.delete(mesh);
      if(fall.motion.lost){
        // A displaced piece can leave the grounds while the hand is occupied.
        // Return its own mesh to the supply, including any unique split faces.
        mesh.position.copy(anchors[mesh.userData.throwKind]);mesh.updateMatrixWorld(true);
        const bottom=new T.Box3().setFromObject(mesh,true).min.y;
        mesh.position.y+=mesh.position.y-bottom;
      }
      mesh.updateMatrixWorld(true);
      if(mesh.position.distanceToSquared(fall.origin)>.002**2)releaseSupportedWood(mesh);
      dropped.set(mesh,fall.motion.lost?new Set():fall.motion.supports);
    }
  }
  function launch(direction){
    if(!held||inFlight||offeringFood||!body)return false;
    measure();
    const assisted=!direction;
    if(assisted&&!canToss)return result(false,'Stand near the fire pit and turn toward the ring.');
    const kind=held,source=heldSplit||carry[kind],mesh=source.clone();
    mesh.visible=true;source.getWorldPosition(mesh.position);source.getWorldQuaternion(mesh.quaternion);
    mesh.scale.setScalar(heldScale);
    // A hand near a wall can project beyond it. Release from the visitor's side.
    if(colliders.blockedSegment(camera.position,mesh.position))mesh.position.copy(camera.position);
    const velocity=v();
    if(assisted){
      const index=Math.min(7,Math.ceil(fires.fuelSnapshot()[kind]/fuelDuration[kind]));
      const contact=stackedPose(kind,index).position;
      if(!clearArc(mesh.position,contact))return result(false,'Step around the chair or railing for a clear toss.');
      const duration=flightDuration(mesh.position,contact);
      velocity.subVectors(contact,mesh.position).divideScalar(duration);
      velocity.y+=.5*9.81*duration;
    }else{
      if(!Number.isFinite(direction.lengthSq())||direction.lengthSq()<.01)return false;
      const mass=heldMass??({twigs:.055,sticks:.18,logs:2.1})[kind];
      velocity.copy(direction).normalize().multiplyScalar(5.15/Math.pow(1+mass,.33));
      velocity.y+=1.05;
    }
    mesh.userData={throwKind:kind,freshCut:!!heldSplit,massKg:heldMass};
    scene.add(mesh);mesh.updateMatrixWorld(true);
    const motion=createThrowMotion({kind,mesh,velocity,massKg:heldMass,colliders,obstacles:neighborsOf(mesh)});
    const label=heldSplit && kind!=='logs'?'kindling':names[kind];
    inFlight={kind,mesh,motion,start:clock,fromBlock:!!heldSplit,label};
    heldSplit?.removeFromParent();heldSplit=null;
    held=null;return result(true,'Tossing the '+label+'.');
  }
  function toss(){return launch(null);}
  function throwWood(direction){return launch(direction);}
  function settleFuel(){
    const banks=fires.fuelSnapshot();
    for(const kind of kinds){
      const bank=banks[kind],last=lastFuel[kind];
      if(Math.abs(last-bank)<.30 && Math.ceil(last/fuelDuration[kind])===Math.ceil(bank/fuelDuration[kind]))continue;
      lastFuel[kind]=bank;
      const total=bank/fuelDuration[kind],count=Math.ceil(total);
      const mesh=laid[kind];mesh.count=count;
      for(const old of restPoses[kind].splice(count)){
        if(old?.collider)releaseSupportedWood(old.collider);
        discardSplit(old?.mesh);
      }
      restPoses[kind].length=count;
      for(let i=0;i<count;i++){
        const pose=stackedPose(kind,i);
        let resting=restPoses[kind][i];
        if(!resting){
          // A remote fuel update has no local throw trajectory. Match its
          // collision shape to the same instance the visitor actually sees.
          const collider=new T.Mesh(geometry[kind],wood);
          collider.position.copy(pose.position);collider.quaternion.copy(pose.quaternion);
          collider.userData.throwKind=kind;
          resting=restPoses[kind][i]={collider,mesh:null,scale:1};
        }
        pose.position.copy(resting.collider.position);pose.quaternion.copy(resting.collider.quaternion);
        const intact=clamp(total-i,0,1);
        const scale=resting.scale*(.42+.58*Math.sqrt(intact));
        resting.collider.scale.setScalar(scale);
        pose.scale.setScalar(resting.mesh?0:scale);
        pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);
        const char=.84*(1.-intact);
        mesh.setColorAt(i,tintValue.copy(white).lerp(charcoal,char));
      }
      mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    }
  }
  function update(newBody,viewName,time=performance.now()*.001,foodInHand=false){
    clock=time;body=newBody;currentView=viewName;offeringFood=!!foodInHand;measure();
    if(inFlight){
      const f=inFlight;
      if(f.motion.sample(time-f.start,f.mesh)){
        inFlight=null;
        const p=f.mesh.position;
        if(f.motion.lost){
          held=f.kind;heldMass=f.mesh.userData.massKg;heldScale=f.mesh.scale.x;
          f.mesh.removeFromParent();
          if(f.fromBlock){
            heldSplit=f.mesh;heldSplit.position.copy(carry[held].position);heldSplit.rotation.copy(carry[held].rotation);
            palm.add(heldSplit);
          }else carry[held].scale.setScalar(heldScale);
          message='That throw went beyond the grounds. The '+f.label+' is back in your hand.';
        }else if(Math.hypot(p.x-ring.x,p.z-ring.z)<ringRadius && p.y>=ring.y-.12 && p.y<ring.y+.52){
          if(!f.fromBlock)scene.remove(f.mesh);
          fires.addFuel(f.kind);
          const slot=Math.ceil(fires.fuelSnapshot()[f.kind]/fuelDuration[f.kind])-1;
          const replaced=restPoses[f.kind][slot];
          restPoses[f.kind][slot]={mesh:f.fromBlock?f.mesh:null,collider:f.mesh,scale:f.mesh.scale.x};
          if(replaced?.collider)releaseSupportedWood(replaced.collider);
          discardSplit(replaced?.mesh);
          lastFuel[f.kind]=-1;
          onFuelAdded(f.kind);lastDrop=f.label;
        }else{
          f.mesh.updateMatrixWorld(true);dropped.set(f.mesh,f.motion.supports);
          message='The '+f.label+' has settled.';
        }
        measure();
      }
    }
    if(lastDrop){
      if(fires.fuelLevel<=.001){message='Gather more wood at the woodpile.';lastDrop=null;}
      else message=fires.lit?'The fire is lit. Add more wood to build it up.':'The '+lastDrop+' is in the ring. Light the fire when you’re ready.';
    }
    settleFuel();updateFalling();
    notify();
    return Boolean(inFlight || falling.size);
  }
  return {view,update,snapshot,pickUp,hitWood,pickUpHit,takeSplitLog,putBack,toss,throwWood,setRestocked,targets:anchors,get state(){return reportedState;}};
}
