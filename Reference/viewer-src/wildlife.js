import * as T from 'three';
import {STANDING_EYE_HEIGHT} from './walking.js';
import {makeDeer,makeFoodTemplates,makeOfferingHand} from './wildlife-model.js';
import {createThrowColliders} from './throw-colliders.js';
import {createThrowMotion} from './toss-motion.js';

const cell=.32, feet=.3048, angle=5.4*Math.PI/180, C=Math.cos(angle), S=Math.sin(angle);
const clamp=T.MathUtils.clamp, damp=T.MathUtils.damp;
const stock={apple:5,carrot:4,vegetables:4};
const labels={apple:'apple',carrot:'carrot',vegetables:'greens'};
const steps=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const plan=(x,y)=>new T.Vector3(4.65-feet*(C*x+S*y),0,-8.5+feet*(C*y-S*x));
const horizontal=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const floorLabel=/^WalkSurface_(ParcelGround|FireCircleGravel|PergolaGravel)$/i;

function deerRange(space){
  // Sample the exported walk geometry so the herd shares the visitor's ground
  // and obstacles. A connected grid keeps a herd on the land behind the deck.
  const corners=[plan(-40,3),plan(61,3),plan(61,80),plan(-40,80)];
  const x0=Math.min(...corners.map(p=>p.x)),z0=Math.min(...corners.map(p=>p.z));
  const nx=Math.ceil((Math.max(...corners.map(p=>p.x))-x0)/cell)+1;
  const nz=Math.ceil((Math.max(...corners.map(p=>p.z))-z0)/cell)+1;
  const nodes=new Array(nx*nz).fill(null);
  function ground(x,z){
    const hits=space.heights(x,z);let floor=null;
    for(const hit of hits)if(floorLabel.test(hit.label)&&(!floor||hit.y>floor.y))floor=hit;
    return floor && space.settle(x,z,floor,hits) ? floor.y:null;
  }
  // A browsing buck can sweep his muzzle beyond a metre from his hips.
  // Reserve the entire turning circle on transit paths. Visitor clearance
  // alone lets the neck cut across furniture even when the hooves stay clear.
  const turnRadius=1.40;
  const obstacleBins=new Map(),bin=(x,z)=>Math.floor(x/2)+','+Math.floor(z/2);
  const obstacles=new Set();
  for(const entries of space.blocks.values())for(const b of entries)obstacles.add(b);
  for(const b of obstacles){
    const xs=b.polygon.map(p=>p.x),zs=b.polygon.map(p=>p.z);
    const l=Math.min(...xs)-turnRadius,r=Math.max(...xs)+turnRadius;
    const a=Math.min(...zs)-turnRadius,f=Math.max(...zs)+turnRadius;
    if(l>x0+nx*cell||r<x0||a>z0+nz*cell||f<z0)continue;
    for(let i=Math.floor(l/2);i<=Math.floor(r/2);i++)for(let j=Math.floor(a/2);j<=Math.floor(f/2);j++){
      const k=i+','+j;if(!obstacleBins.has(k))obstacleBins.set(k,[]);
      obstacleBins.get(k).push(b);
    }
  }
  function clear(x,z,y){
    const near=obstacleBins.get(bin(x,z));
    if(!near)return true;
    for(const b of near){
      if(b.maxY<y+.015||b.minY>y+1.96)continue;
      const radius=b.maxY-y>1.16?turnRadius:1.06;
      const poly=b.polygon;let inside=true;
      for(let i=0;i<poly.length;i++){
        const a=poly[i],q=poly[(i+1)%poly.length],dx=q.x-a.x,dz=q.z-a.z;
        const px=x-a.x,pz=z-a.z;
        if(dx*pz-dz*px<0)inside=false;
        const t=clamp((px*dx+pz*dz)/(dx*dx+dz*dz||1),0,1);
        if((px-t*dx)**2+(pz-t*dz)**2<radius**2)return false;
      }
      if(inside)return false;
    }
    return true;
  }
  function safeGround(x,z){
    const y=ground(x,z);
    return y!==null&&clear(x,z,y)?y:null;
  }
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const x=x0+i*cell,z=z0+j*cell,dx=(x-4.65)/feet,dz=(z+8.5)/feet;
    const px=-C*dx-S*dz,py=-S*dx+C*dz;
    // The paved motor court and cabin occupy the middle of the lot. Its two
    // wooded shoulders join the broader forest behind the fire circle.
    if(px< -40||px>61||py>80||py<3 || (py<32 && !(px>49 || (px< -31 && py>15))))continue;
    const y=safeGround(x,z);
    if(y===null||[[.16,0],[-.16,0],[0,.16],[0,-.16]].some(([dx,dz])=>ground(x+dx,z+dz)===null))continue;
    // Approximate tax edges in the appraisal's feet (Reference/Map layers.json).
    // The front is road. The two back corners have cover and lie well outside
    // the circle of chairs. A deer follows the larger graph only for a reason.
    const edge=Math.min(px+39.75,60.2-px,78.65-py);
    const cover=edge<11 && py>40 && (px< -7 || px>46);
    const n=i+j*nx;nodes[n]={n,i,j,p:V(x,y,z),edges:[],cover,habitat:0};
  }
  for(const a of nodes)if(a){
    for(const [dx,dz] of steps){
      const i=a.i+dx,j=a.j+dz,b=nodes[i+j*nx];
      if(i<0||j<0||i>=nx||j>=nz||!b||b.n<=a.n||Math.abs(b.p.y-a.p.y)>.28)continue;
      if(dx&&dz&&(!nodes[i+a.j*nx]||!nodes[a.i+j*nx]))continue;
      // A tree or exposed rock on a side slope can clip a tiny part of the
      // segment even when the midpoint and both hooves have clear ground.
      let passable=true;
      for(let k=1;k<12;k++){
        if(safeGround(a.p.x+dx*cell*k/12,a.p.z+dz*cell*k/12)===null){passable=false;break;}
      }
      if(passable){a.edges.push(b.n);b.edges.push(a.n);}
    }
  }
  function point(x,z,r=Infinity,accept=null){
    let best=null,dBest=r*r;
    const i=Math.round((x-x0)/cell),j=Math.round((z-z0)/cell),within=Number.isFinite(r)?Math.ceil(r/cell):Math.max(nx,nz);
    for(let b=Math.max(0,j-within);b<=Math.min(nz-1,j+within);b++)for(let a=Math.max(0,i-within);a<=Math.min(nx-1,i+within);a++){
      const node=nodes[a+b*nx];if(!node || (accept && !accept(node)))continue;
      const d=(x-node.p.x)**2+(z-node.p.z)**2;
      if(d<dBest){best=node;dBest=d;}
    }
    return best;
  }
  const origin=plan(11.1,60.2),first=point(origin.x,origin.z);
  if(!first)throw new Error('Missing backyard walkable terrain');
  const pending=[first.n],visited=new Set(pending);
  for(let i=0;i<pending.length;i++)for(const n of nodes[pending[i]].edges)if(!visited.has(n)){visited.add(n);pending.push(n);}
  for(let i=0;i<nodes.length;i++)if(!visited.has(i))nodes[i]=null;
  let habitat=0;
  for(const node of nodes)if(node?.cover && !node.habitat){
    const patch=[node];node.habitat=++habitat;
    for(let j=0;j<patch.length;j++)for(const k of patch[j].edges){
      const next=nodes[k];
      if(next?.cover&&!next.habitat){next.habitat=habitat;patch.push(next);}
    }
  }
  // Reverse breadth-first trees are reused while a deer approaches an offering.
  const cache=new Map();
  function toward(from,to,home=0){
    if(from.n===to.n)return null;
    const key=to.n+':'+home;
    let next=cache.get(key);
    if(!next){
      const queue=[to.n];next=new Int32Array(nodes.length).fill(-1);next[to.n]=to.n;
      for(let j=0;j<queue.length;j++){
        const n=queue[j];for(const k of nodes[n].edges)if(nodes[k]&&(!home||nodes[k].habitat===home)&&next[k]<0){next[k]=n;queue.push(k);}
      }
      if(cache.size>=20)cache.delete(cache.keys().next().value);
      cache.set(key,next);
    }
    return nodes[next[from.n]]||null;
  }
  function escape(start,visitor,bias,home) {
    // Seek reachable cover along a route that starts away from the visitor.
    // Different flight bearings fan the herd out even on a narrow clearing.
    const from=start.p,heading=Math.atan2(from.x-visitor.x,from.z-visitor.z)+bias;
    let best=start,score=0;
    const queue=[start],seen=new Set([start.n]),initialDistance=horizontal(from,visitor);
    for(let i=0;i<queue.length;i++){
      const a=queue[i],dx=a.p.x-from.x,dz=a.p.z-from.z,length=Math.hypot(dx,dz);
      const gain=horizontal(a.p,visitor)-initialDistance;
      const value=gain+.75*(dx*Math.sin(heading)+dz*Math.cos(heading))-.8*Math.abs(length-5);
      if(value>score){best=a;score=value;}
      if(length>6)continue;
      for(const k of a.edges){
        const b=nodes[k];if(!b||seen.has(k)||(start.habitat===home&&b.habitat!==home)||horizontal(b.p,visitor)<initialDistance-.28)continue;
        seen.add(k);queue.push(b);
      }
    }
    return best;
  }
  return {ground,safeGround,point,toward,escape};
}
function mouthPose(size,goalY){
  function position(t) {
    const a=.025+(2.29-.025)*t,b=.018+(-.62-.018)*t;
    return {y:size*(.887+.410*Math.cos(a)-.259*Math.sin(a)-.080*Math.cos(a+b)-.318*Math.sin(a+b)),
      z:size*(.366+.410*Math.sin(a)+.259*Math.cos(a)-.080*Math.sin(a+b)+.318*Math.cos(a+b))};
  }
  let lo=0,hi=1;
  for(let i=0;i<9;i++){
    const mid=(lo+hi)/2;if(position(mid).y>goalY)lo=mid;else hi=mid;
  }
  const lower=(lo+hi)/2;const result=position(lower);return {lower,reach:result.z,height:result.y};
}
function contactShadow(){
  const size=48,bytes=new Uint8Array(4*size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const d=((x+.5)/size*2-1)**2+((y+.5)/size*2-1)**2;
    bytes.set([55,39,31,Math.round(80*Math.max(0,1-d)**2)],4*(y*size+x));
  }
  const tex=new T.DataTexture(bytes,size,size);tex.magFilter=tex.minFilter=T.LinearFilter;tex.needsUpdate=true;
  return new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
}

export function installWildlife(scene,space,camera,{onChange=()=>{},colliders=createThrowColliders(space,scene)}={}){
  const range=deerRange(space),food=makeFoodTemplates(),inventory={...stock},items=[],herd=[];
  const set=new T.Group();set.name='Backyard wildlife';scene.add(set);
  const hand=makeOfferingHand(),palm=new T.Group();palm.name='Offering';palm.add(hand);scene.add(palm);palm.visible=false;
  const shadowMat=contactShadow(),shadowGeo=new T.PlaneGeometry(.80,1.52);shadowGeo.rotateX(-Math.PI/2);
  const groundAt=p=>range.ground(p.x,p.z)??range.point(p.x,p.z)?.p.y??0;
  const p0=plan(11.1,60.2),look=plan(15.4,46.5);
  p0.y=groundAt(p0)+STANDING_EYE_HEIGHT;look.y=groundAt(look)+.82;
  const view={eye:p0.toArray(),target:look.toArray(),fov:62};
  // The doe and yearling browse the wooded strip outside the stored boat.
  // The buck follows a separate circuit on the opposite edge of the parcel.
  const routes=[
    [[-29,74],[-36,66],[-30,62],[-34,77]],
    [[55,68],[55,48],[57,58],[46,75]],
    [[-34,70],[-38,63],[-33,76],[-30,70]]
  ].map(route=>{
    let home=0;
    return route.map(([x,y])=>{
      const p=plan(x,y),node=range.point(p.x,p.z,Infinity,n=>home?n.habitat===home:n.cover);
      home=node.habitat;return node;
    });
  });
  for(const [i,route] of routes.entries()){
    const h=route[0],deer=makeDeer({buck:i===1,young:i===2,phase:i*2});
    const shadow=new T.Mesh(shadowGeo,shadowMat);shadow.scale.setScalar(deer.object.scale.x);
    set.add(deer.object,shadow);deer.object.position.copy(h.p);
    const yaw=[.74,-1.82,.91,-.44][i];deer.object.rotation.y=yaw;
    herd.push({...deer,shadow,id:i,route,home:h.habitat,returning:false,patch:0,resting:true,goal:h,p:deer.object.position,yaw,speed:0,stride:i*.31,
      lower:.12,chew:0,eat:0,change:2+i,abandon:Infinity,stanceAngle:null,lockKey:null,lastPose:-1,
      shy:[.20,.92,.58][i],trust:0,fleeUntil:0,waryUntil:0,calmUntil:0,replan:0,alarmAt:-10,noticeUntil:0});
  }
  const to=V(),forward=V(),right=V(),offering=V(),muzzle=V(),handForward=V();
  let near=false,holding=null,handOwner=null,heldMesh=null,blockedTime=0,message='Choose food and stand still. Let the deer come to you.',clock=null,time=0,nextId=0;
  let still=0,visitorSpeed=0,lastVisitor=null;
  function notify(msg){
    if(msg!==undefined)message=msg;
    onChange({near,holding,inventory:{...inventory},message});
  }
  function returnHeld(){
    if(!holding)return;
    inventory[holding]++;holding=null;handOwner=null;blockedTime=0;palm.remove(heldMesh);heldMesh=null;palm.visible=false;
  }
  function inYard(mode){
    if(mode==='property')return false;
    const p=camera.position,n=range.point(p.x,p.z,1.48),y=range.ground(p.x,p.z);
    return n && y!==null && p.y-y>.50 && p.y-y<2.18;
  }
  function poseHand(){
    camera.getWorldDirection(forward);forward.y=0;
    if(forward.lengthSq()<.0001)forward.set(0,0,-1);
    forward.normalize();right.set(-forward.z,0,forward.x);
    const ground=range.ground(camera.position.x,camera.position.z)??(camera.position.y-STANDING_EYE_HEIGHT);
    offering.copy(camera.position).addScaledVector(forward,.59).addScaledVector(right,.165);
    const gaze=camera.getWorldDirection(handForward).y;
    offering.y=clamp(camera.position.y-.29+gaze*.37,ground+.80,ground+1.26);
    // Lower the palm as a smaller animal approaches, including on sloping
    // ground. A yearling can reach a different height from a standing buck.
    if(handOwner){
      const close=1-T.MathUtils.smoothstep(horizontal(handOwner.p,offering),1.2,2.6);
      const reach=handOwner.p.y+handOwner.object.scale.y*1.17;
      offering.y=T.MathUtils.lerp(offering.y,Math.min(offering.y,reach),close);
    }
    palm.position.copy(offering);palm.rotation.y=Math.atan2(-forward.x,-forward.z);
    palm.visible=!!holding;
    if(heldMesh){heldMesh.position.y=holding==='carrot'?.029:.026;heldMesh.rotation.z=holding==='carrot'?1.13:0;}
  }
  function hold(kind){
    if(!Object.hasOwn(stock,kind)||!near)return false;
    if(holding===kind){returnHeld();notify('Food put back in your basket.');return true;}
    if(!inventory[kind]){notify('Your basket is out of '+labels[kind]+'.');return false;}
    poseHand();
    const nearby=[...herd].sort((a,b)=>horizontal(a.p,offering)-horizontal(b.p,offering));
    if(!nearby.some(d=>stance(d,offering,true))){notify('Face open ground so a deer has room to approach your hand.');return false;}
    returnHeld();inventory[kind]--;holding=kind;still=0;blockedTime=0;
    heldMesh=food[kind].clone();palm.add(heldMesh);poseHand();
    notify('Stand still with the '+labels[kind]+'. A curious deer may come closer.');return true;
  }
  function toss(kind){
    if(!Object.hasOwn(stock,kind)||!near)return false;
    if(holding!==kind&&!inventory[kind]){notify('Your basket is out of '+labels[kind]+'.');return false;}
    poseHand();
    // Aim a physically scaled, gravity-driven arc at open ground in front.
    // Look down for a short underhand toss. No food is spent on a blocked throw.
    const reach=clamp(3.2+handForward.y*2.45,1.2,4.7),start=offering.clone();
    let velocity=null;
    for(let dist=reach;dist>=.75&&!velocity;dist-=.20){
      const p=start.clone().addScaledVector(forward,dist),node=range.point(p.x,p.z,.32);
      if(!node||range.ground(p.x,p.z)===null)continue;
      p.y=range.ground(p.x,p.z)+.041;
      const trial=.41+dist*.085;
      let blocked=false;
      for(let j=1;j<16;j++){
        const t=j/16,probe=start.clone().lerp(p,t);probe.y+=4.905*trial*trial*t*(1-t);
        const floor=range.ground(probe.x,probe.z);
        if(floor===null||floor+.04>probe.y){blocked=true;break;}
      }
      if(!blocked && herd.some(d=>stance(d,p,true))){
        velocity=p.sub(start).divideScalar(trial);velocity.y+=4.905*trial;
      }
    }
    if(!velocity){notify('Face an open patch of ground to toss food.');return false;}
    returnHeld();inventory[kind]--;
    const mesh=food[kind].clone();mesh.name='Tossed '+kind;set.add(mesh);mesh.position.copy(start);
    const motion=createThrowMotion({kind,mesh,velocity,colliders,obstacles:items.filter(i=>i.landed).map(i=>i.mesh)});
    mesh.userData.throwKind=kind;
    items.push({id:++nextId,kind,mesh,end:mesh.position,motion,age:0,landed:false,owner:null,diners:[]});
    notify('Tossed '+labels[kind]+'. The herd can follow it.');return true;
  }
  function refill(){
    for(const kind of Object.keys(stock))inventory[kind]=stock[kind]-items.filter(i=>i.kind===kind).length-Number(holding===kind);
    notify('Basket refilled.');return true;
  }
  function updateFood(dt){
    for(const item of [...items]){
      if(item.landed)continue;
      item.age+=dt;
      item.landed=item.motion.sample(item.age,item.mesh);
      if(item.landed){
        // A rebound or a sideways roll can change which deer can actually
        // reach this serving. Aim each muzzle at the final physical position.
        item.diners=item.motion.lost?[]:herd.filter(d=>stance(d,item.end,true));
        item.motion=null;
        if(!item.diners.length){
          set.remove(item.mesh);items.splice(items.indexOf(item),1);inventory[item.kind]++;
          notify('That serving rolled out of reach. It is back in your basket.');
        }
      }
    }
  }
  function stance(d,target,preview=false){
    const defaultAngle=target===offering?Math.atan2(-forward.x,-forward.z):Math.atan2(target.x-d.p.x,target.z-d.p.z);
    const theta=preview?defaultAngle:d.stanceAngle??defaultAngle;
    const h=range.ground(target.x,target.z)??d.p.y;
    for(const offset of [0,.44,-.44,.88,-.88,1.5,-1.5,2.2,-2.2,Math.PI]){
      const a=theta+offset,s=Math.sin(a),c=Math.cos(a),scale=d.object.scale.y;
      let pose=mouthPose(scale,target.y-h),x,z,y;
      // On a slope the hoof height depends on the reach of the lowered neck.
      // Solve those together before asking the animal to stop and eat.
      for(let i=0;i<4;i++){
        x=target.x-s*pose.reach;z=target.z-c*pose.reach;y=range.safeGround(x,z);
        if(y===null)break;
        pose=mouthPose(scale,target.y-y);
      }
      if(y===null)continue;
      const heightError=y+pose.height-target.y;
      if(heightError>.133||(target!==offering&&heightError<-.133))continue;
      const node=range.point(x,z,.39);
      if(!node)continue;
      if(!preview&&herd.some(o=>o!==d&&o.lockKey!==null&&Math.hypot(o.p.x-x,o.p.z-z)<.42))continue;
      const aim=V(x,y,z);if(!preview)d.stanceAngle=a;return {node,aim,angle:a,lower:pose.lower};
    }
    return null;
  }
  function consume(d,item){
    if(item){
      set.remove(item.mesh);items.splice(items.indexOf(item),1);notify('A deer ate the '+labels[item.kind]+' you tossed.');
    }else{
      const meal=holding;palm.remove(heldMesh);heldMesh=null;holding=null;handOwner=null;palm.visible=false;
      notify('A deer ate the '+labels[meal]+' from your hand.');
    }
    d.trust=Math.min(1,d.trust+(item ? .16 : .32));
    if(!item)d.calmUntil=time+4.5;
    d.lockKey=null;d.stanceAngle=null;d.eat=0;d.chew=1.4;d.change=time+2.3;
  }
  function advance(d,goal,aim,dt,feeding,fleeing=false){
    const here=range.point(d.p.x,d.p.z,.60);if(!here)return;
    const home=(!feeding && here.habitat===d.home && goal.habitat===d.home)?d.home:0;
    const permitted=(x,z)=>!home || range.point(x,z,.38)?.habitat===home;
    const direct=horizontal(d.p,aim)<1.05 && [.2,.4,.6,.8].every(t=>
      range.safeGround(T.MathUtils.lerp(d.p.x,aim.x,t),T.MathUtils.lerp(d.p.z,aim.z,t))!==null);
    const next=direct?null:range.toward(here,goal,home);
    to.subVectors(next?next.p:aim,d.p);to.y=0;
    const distance=horizontal(d.p,aim),dirLength=to.length();
    const moving=dirLength>.010&&distance>.026;
    if(moving){
      to.multiplyScalar(1/dirLength);
      // Boid separation acts on the local steering vector. Alignment is gentle
      // during browsing, and a clear line to food takes precedence when close.
      for(const other of herd)if(other!==d){
        const dx=d.p.x-other.p.x,dz=d.p.z-other.p.z,gap=Math.hypot(dx,dz);
        if(gap>0.001&&gap<.92&&(distance>.75||!feeding)){
          const separation=clamp((.92-gap)*1.85,0,1.45);to.x+=dx/gap*separation;to.z+=dz/gap*separation;
        }else if(!feeding&&gap<2.8){
          to.x+=.07*Math.sin(other.yaw);to.z+=.07*Math.cos(other.yaw);
        }
      }
      if(near && !feeding && !fleeing){
        const x=d.p.x-camera.position.x,z=d.p.z-camera.position.z;
        const gap=Math.hypot(x,z);
        if(gap>.01 && gap<2.25){
          const weight=Math.min(2.2,(2.25-gap)*1.9);
          to.x+=x/gap*weight;to.z+=z/gap*weight;
        }
      }
      to.normalize();
    }
    const targetYaw=moving?Math.atan2(to.x,to.z):d.yaw;
    const delta=wrap(targetYaw-d.yaw);const turnRate=fleeing?5.2:2.65;d.yaw+=clamp(delta,-dt*turnRate,dt*turnRate);
    const speed=moving?Math.min(fleeing?3.35:feeding?.99:d.returning?.78:.43,Math.max(.11,distance*1.9))*Math.max(.10,Math.cos(delta)):0;
    d.speed=damp(d.speed,speed,6,dt);
    const step=Math.min(dirLength,d.speed*dt,distance);
    const dx=to.x*step,dz=to.z*step;
    const x=d.p.x+dx,z=d.p.z+dz,y=range.safeGround(x,z);
    const strideLength=d.object.scale.x*T.MathUtils.lerp(.83,1.67,T.MathUtils.smoothstep(d.speed,.95,2.4));
    if(y!==null && Math.abs(y-d.p.y)<.30 && permitted(x,z)){
      d.p.set(x,y,z);d.stride+=step/strideLength;
    }else if(next){
      // A sharp turn at a blocker can require rotating in place.
      const dir=to.subVectors(next.p,d.p);dir.y=0;
      const length=dir.length();dir.multiplyScalar(1/(length||1));
      const step=Math.min(length,.52*dt),x=d.p.x+dir.x*step,z=d.p.z+dir.z*step;
      const y=range.safeGround(x,z);
      if(y!==null && Math.abs(y-d.p.y)<.30 && permitted(x,z)){d.p.set(x,y,z);d.stride+=step/strideLength;}
    }
  }
  function browse(d,dt){
    if(d.returning){
      if(!d.route.includes(d.goal)){
        d.patch=d.route.reduce((best,n,i)=>horizontal(d.p,n.p)<horizontal(d.p,d.route[best].p)?i:best,0);
        d.goal=d.route[d.patch];
      }
      if(horizontal(d.p,d.goal.p)>.36){advance(d,d.goal,d.goal.p,dt,false);return;}
      d.returning=false;d.resting=true;d.change=time+2+d.shy*3;d.abandon=Infinity;
    }
    const distance=horizontal(d.p,d.goal.p);
    if(distance<.35 && !d.resting){
      d.resting=true;d.change=time+3+2*d.shy+1.5*Math.sin(d.patch+d.id);
    }
    if((d.resting && time>=d.change) || time>=d.abandon){
      d.patch=(d.patch+1)%d.route.length;
      d.goal=d.route[d.patch];d.resting=false;
      // A herd mate can temporarily occupy a narrow route around a tree.
      // After a long delay, seek the next patch without moving the deer there.
      d.abandon=time+24+3.5*horizontal(d.p,d.goal.p);
    }
    advance(d,d.goal,d.goal.p,dt,false);
  }
  function update(cameraNow,mode,seconds){
    if(cameraNow!==camera)camera=cameraNow;
    const wasNear=near;near=Boolean(inYard(mode));
    if(near!==wasNear){
      if(!near){returnHeld();lastVisitor=null;still=0;visitorSpeed=0;}
      notify(near?'Choose food, then hold it out or toss it. Give the herd room.':'Visit the backyard to feed the deer.');
    }
    set.visible=mode!=='property';
    const elapsed=clock===null?0:Math.max(0,seconds-clock);clock=seconds;
    const dt=Math.min(.10,elapsed);
    // An apple dropped just before leaving the yard still lands while away.
    updateFood(elapsed);
    // Travel continues when the visitor is on the driveway or inside. Only
    // distant joint animation is sampled less often, leaving the routes continuous.
    time+=dt;if(holding)poseHand();
    const visitor=camera.position;
    const travel=near&&lastVisitor?horizontal(lastVisitor,visitor):0;
    visitorSpeed=damp(visitorSpeed,dt>0&&travel<.85?travel/dt:0,8,dt);
    still=near&&visitorSpeed<.12?still+dt:0;
    if(near){if(!lastVisitor)lastVisitor=V();lastVisitor.copy(visitor);}else lastVisitor=null;

    const alarmed=herd.filter(d=>{
      if(!near)return false;
      const gap=horizontal(d.p,visitor);
      // A deer that elects to approach tolerates a quiet hand. Walking
      // into its space still startles it, even after previous feedings.
      if(visitorSpeed<.33 && ((d===handOwner && holding) || d.calmUntil>time))return false;
      const approaching=visitorSpeed>.12 || !wasNear || travel>.85;
      return (approaching && gap<1.75+.8*d.shy) ||
        (visitorSpeed>.33 && gap<2.9+1.8*d.shy+.40*visitorSpeed-.55*d.trust);
    });
    let scattered=false;
    for(const d of herd){
      const direct=alarmed.includes(d);
      if(direct)d.alarmAt=time;
      const danger=direct || (near && herd.some(a=>a!==d && time-a.alarmAt<.45 && horizontal(a.p,d.p)<3.5+d.shy));
      if(!danger)continue;
      if(d.fleeUntil<=time)scattered=true;
      if(d.replan<=time || d.fleeUntil<=time){
        const here=range.point(d.p.x,d.p.z,.6);
        if(here)d.goal=range.escape(here,visitor,[-.74,.67,.35][d.id],d.home);
        d.replan=time+1.15;
      }
      d.fleeUntil=time+1.8+.75*d.shy;d.waryUntil=d.fleeUntil+2+3*d.shy;
      d.returning=true;d.change=d.waryUntil;d.resting=true;d.abandon=Infinity;d.chew=0;
    }
    if(handOwner && (handOwner.fleeUntil>time || visitorSpeed>.33)){handOwner=null;blockedTime=0;}
    if(scattered)notify(holding?'The herd scattered. Keep your hand still and give them time.':'The deer startled and scattered. Give them space to settle.');
    if(holding && !handOwner && still>1.7){
      const candidates=herd.filter(d=>d.shy<.8 && d.waryUntil<=time &&
        still>1.7+2*d.shy-d.trust && stance(d,offering,true));
      candidates.sort((a,b)=>(a.shy-a.trust-b.shy+b.trust)*4+horizontal(a.p,visitor)-horizontal(b.p,visitor));
      if(candidates.length){handOwner=candidates[0];notify('A curious deer is coming closer. Keep your hand steady.');}
    }
    const handDeer=holding?handOwner:null;
    const occupied=new Set(handDeer?[handDeer]:[]);
    for(const item of items)if(item.landed){
      const willing=d=>d.waryUntil<=time && !occupied.has(d) &&
        !(near && d.shy>.8 && horizontal(item.end,visitor)<2.4-.6*d.trust);
      if(!item.owner||!willing(item.owner)){
        item.owner=null;
        for(const d of item.diners)if(willing(d)&&(!item.owner||horizontal(d.p,item.end)<horizontal(item.owner.p,item.end)))item.owner=d;
      }if(item.owner)occupied.add(item.owner);
    }
    for(const d of herd){
      const isHand=d===handDeer;
      const item=isHand?null:items.find(q=>q.landed&&q.owner===d);
      const target=isHand?offering:item?.end;
      const lock=isHand?'hand':item?.id??null;
      if(d.lockKey!==lock){
        d.lockKey=lock;d.stanceAngle=null;d.eat=0;
        if(target){
          d.returning=true;d.goal=null;
          d.noticeUntil=time+.45+.9*d.shy;
        }
      }
      const feed=target?stance(d,target):null;
      if(isHand){
        blockedTime=feed?0:blockedTime+dt;
        if(blockedTime>1.4){
          returnHeld();notify('Food put away. Face open ground so a deer can reach your hand.');
        }
      }
      let lower=0,turn=0,arrived=false,alert=false;
      if(d.fleeUntil>time){
        advance(d,d.goal,d.goal.p,dt,false,true);
      }else if(feed && time<d.noticeUntil){
        alert=true;d.speed=damp(d.speed,0,9,dt);
        turn=clamp(wrap(Math.atan2(target.x-d.p.x,target.z-d.p.z)-d.yaw),-.8,.8);
      }else if(feed){
        const error=horizontal(d.p,feed.aim);d.change=time+2;
        if(error>.045)advance(d,feed.node,feed.aim,dt,true);
        else d.speed=damp(d.speed,0,9,dt);
        if(error<.065){
          d.yaw+=wrap(feed.angle-d.yaw)*(1-Math.exp(-6*dt));arrived=true;
          lower=feed.lower;
        }
      }else if(d.chew>.6){
        d.speed=damp(d.speed,0,9,dt);
      }else if(near && (d.waryUntil>time || (horizontal(d.p,visitor)<6+2*d.shy && (visitorSpeed>.15 || (holding && d.shy>.8))))){
        alert=true;
        d.speed=damp(d.speed,0,9,dt);
        turn=clamp(wrap(Math.atan2(visitor.x-d.p.x,visitor.z-d.p.z)-d.yaw),-.7,.7);
      }else{
        browse(d,dt);
        if(d.speed<.09&&d.chew<=0)lower=.91*clamp((Math.sin(time*.75+d.id*2.75)+.45)*1.9,0,1);
        if(d.speed<.1&&near)turn=clamp(wrap(Math.atan2(camera.position.x-d.p.x,camera.position.z-d.p.z)-d.yaw),-.67,.67);
      }
      d.lower=damp(d.lower,lower,arrived?4:2.8,dt);
      d.chew=Math.max(0,d.chew-dt);d.object.rotation.y=d.yaw;
      const detailed=horizontal(d.p,visitor)<17 || arrived;
      if(arrived || (set.visible && (detailed || time-d.lastPose>=.12))){
        const poseDt=d.lastPose<0?dt:Math.min(.2,time-d.lastPose);d.lastPose=time;
        d.pose(time,d.stride,d.speed,d.lower,d.chew>0||d.eat>.2?1:0,turn,d.fleeUntil>time,alert);
        d.shadow.position.copy(d.p);d.shadow.position.y+=.017;d.fitHooves(range.ground,d.shadow,poseDt);
      }
      if(arrived){
        d.muzzle.getWorldPosition(muzzle);
        if(muzzle.distanceTo(target)<.18){d.eat+=dt;if(d.eat>.68)consume(d,item);}
        else d.eat=0;
      }
    }
    return set.visible;
  }
  notify();
  return {view,hold,toss,refill,update};
}
