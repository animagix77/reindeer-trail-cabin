import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {fuelDuration} from './fires.js';
import {makeOfferingHand} from './wildlife-model.js';
import {createTossMotion,tossArc} from './toss-motion.js';

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
function splitLog(){
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
  const stations=[-.203,-.127,-.034,.057,.142,.205],sides=13;
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
      const bands=[0,.25,.32,.55,.60,.81,.86,1];
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

export function installFirewood(scene,model,space,camera,fires,onChange=()=>{},onFuelAdded=()=>{}){
  model.updateMatrixWorld(true);
  const ringObject=model.getObjectByName('WalkBlock_FireRing');
  if(!ringObject)throw Error('The firewood activity needs the fire ring.');
  const bounds=new T.Box3().setFromObject(ringObject,true),ring=bounds.getCenter(v());
  ring.y=bounds.min.y+.010;
  const ringRadius=.5*Math.min(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z);
  const looseGravel=[],obstacles=[],floorRay=new T.Raycaster(),down=v(0,-1,0);
  let barkPhoto,stackEnds;
  model.traverse(o=>{
    if(!o.isMesh)return;
    if(o.material.name==='Hardwood bark')barkPhoto=o.material.map;
    if(o.material.name==='Firewood · weathered split face')stackEnds=o;
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
  entry.y+=1.59;look.y+=.19;
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
    stock[k]=new T.InstancedMesh(geometry[k],wood,32);stock[k].name='Gatherable '+k;
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
  const palm=new T.Group();palm.name='Carrying firewood';palm.add(makeOfferingHand());scene.add(palm);palm.visible=false;
  const carry={};
  for(const k of kinds){
    const obj=new T.Mesh(geometry[k],wood);obj.name='Held '+k;
    obj.rotation.set(k==='logs'?.36:0,-.54,-.20);obj.position.set(-.005,k==='logs'?.051:.012,-.026);
    carry[k]=obj;obj.visible=false;palm.add(obj);
  }
  let held=null,inFlight=null,body=null,currentView='property',message='Gather loose wood at the foot of the woodpile.';
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
  function snapshot(){return {counts:{...counts},held,nearby:[...nearby],canToss,inFlight:!!inFlight,nearPit,nearStockpile,message};}
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
    for(const k of kinds)carry[k].visible=k===held;
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
        carry[held].getWorldPosition(arcHand);
        if(cachedHand.distanceToSquared(arcHand)>.04**2){
          cachedHand.copy(arcHand);
          cachedClear=clearArc(arcHand,arcEnd.copy(ring).addScaledVector(up,.20));
        }
        canToss=cachedClear;
      }
    }
  }
  function result(ok,text){lastDrop=null;measure();notify(text);return ok;}
  function pickUp(k){
    if(!kinds.includes(k))return false;
    if(held||inFlight)return result(false,'Finish with the wood in your hand first.');
    if(!nearby.includes(k))return result(false,'Walk closer to the '+names[k]+' at the woodpile.');
    if(!counts[k])return result(false,'You have gathered all the '+k+' here.');
    held=k;stock[k].count=--counts[k];
    return result(true,'Carrying a '+names[k]+'. Take it to the fire pit.');
  }
  function takeSplitLog(){
    if(held||inFlight)return result(false,'Finish with the wood in your hand first.');
    held='logs';return result(true,'Carrying your freshly split log. Take it to the fire pit.');
  }
  function putBack(){
    if(!held||inFlight)return false;
    const k=held;
    if(!nearby.includes(k))return result(false,'Return to the woodpile to put this wood back.');
    if(counts[k]>=stock[k].instanceMatrix.count)return result(false,'The woodpile is full.');
    stock[k].count=++counts[k];held=null;return result(true,'The '+names[k]+' is back on the pile.');
  }
  function stackedPose(kind,i){
    const a=i*2.39996+kinds.indexOf(kind)*2.03,r=.08+.047*(i%3);
    form.position.set(ring.x+Math.cos(a)*r,ring.y+.171+(i%4)*.032,ring.z+Math.sin(a)*r);
    form.rotation.set(.10*Math.sin(a),a,.13*Math.cos(a));
    form.scale.setScalar(1);
    return form;
  }
  function toss(){
    if(!held||inFlight)return false;
    if(offeringFood)return result(false,'Put the deer food away before tossing firewood.');
    measure();
    if(!canToss)return result(false,'Stand near the fire pit and turn toward the ring.');
    const kind=held,mesh=carry[kind].clone();
    mesh.visible=true;scene.add(mesh);
    carry[kind].getWorldPosition(mesh.position);carry[kind].getWorldQuaternion(mesh.quaternion);
    const stockAtPit=fires.fuelSnapshot()[kind];
    const index=Math.min(7,Math.ceil(stockAtPit/fuelDuration[kind]));
    const destination=stackedPose(kind,index);
    if(!clearArc(mesh.position,destination.position)){
      scene.remove(mesh);return result(false,'Step around the chair or railing for a clear toss.');
    }
    const contact=destination.position.clone(),duration=flightDuration(mesh.position,contact);
    // Keep the entire piece inside the steel rim as it rolls across the ember bed.
    const clearance=ringRadius-(kind==='twigs'?.16:.23);
    const motion=createTossMotion({kind,start:mesh.position,contact,duration,orientation:mesh.quaternion,
      groundAt:(x,z)=>Math.hypot(x-ring.x,z-ring.z)<=clearance?contact.y:null});
    inFlight={kind,mesh,motion,start:clock};
    held=null;return result(true,'Tossing the '+names[kind]+'.');
  }
  function settleFuel(){
    const banks=fires.fuelSnapshot();
    for(const kind of kinds){
      const bank=banks[kind],last=lastFuel[kind];
      if(Math.abs(last-bank)<.30 && Math.ceil(last/fuelDuration[kind])===Math.ceil(bank/fuelDuration[kind]))continue;
      lastFuel[kind]=bank;
      const total=bank/fuelDuration[kind],count=Math.ceil(total);
      const mesh=laid[kind];mesh.count=count;
      restPoses[kind].length=count;
      for(let i=0;i<count;i++){
        const pose=stackedPose(kind,i);
        const resting=restPoses[kind][i];
        if(resting){pose.position.copy(resting.position);pose.quaternion.copy(resting.quaternion);}
        const intact=clamp(total-i,0,1);
        pose.scale.setScalar(.42+.58*Math.sqrt(intact));
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
        scene.remove(f.mesh);inFlight=null;
        fires.addFuel(f.kind);
        const slot=Math.ceil(fires.fuelSnapshot()[f.kind]/fuelDuration[f.kind])-1;
        restPoses[f.kind][slot]={position:f.mesh.position.clone(),quaternion:f.mesh.quaternion.clone()};
        lastFuel[f.kind]=-1;
        onFuelAdded(f.kind);
        lastDrop=f.kind;
        measure();
      }
    }
    if(lastDrop){
      if(fires.fuelLevel<=.001){message='Gather more wood at the woodpile.';lastDrop=null;}
      else message=fires.lit?'The fire is lit. Add more wood to build it up.':'The '+names[lastDrop]+' is in the ring. Light the fire when you’re ready.';
    }
    settleFuel();
    notify();
    return Boolean(inFlight);
  }
  return {view,update,snapshot,pickUp,takeSplitLog,putBack,toss,targets:anchors,get state(){return reportedState;}};
}
