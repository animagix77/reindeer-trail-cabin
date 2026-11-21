import * as T from 'three';
import {assemble,ovalPart,stem} from './wildlife-model.js';

const vec=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const smooth=t=>t*t*(3-2*t);
const mix=T.MathUtils.lerp;
const edge=vec(0,-.117,-.657);
const edgeEnds=[vec(0,edge.y+.006,edge.z-.06),vec(0,edge.y+.006,edge.z+.06)];

// Integrate the rotating tool about the lower hand. Gravity's moment grows
// as the head passes the top of its arc. Keep this common trajectory independent
// of rendering rate so collision substeps and visible poses always agree.
function downswing(){
  const headMass=3.15,haftMass=.66,lever=.58,haftLength=.69;
  const inertia=headMass*lever**2+haftMass*haftLength**2/3;
  const weightMoment=9.81*(headMass*lever+haftMass*haftLength*.5);
  const step=1/480,arc=2.02,samples=[0];
  let angle=0,velocity=.23;
  while(angle<arc){
    // The wrists turn the head over first. The strongest pull comes once
    // the handle has travelled far enough for the shoulders to help.
    const leverage=Math.min(1,angle/.72);
    const pull=19+17*smooth(leverage)+5*Math.sin(Math.PI*angle/arc);
    const acceleration=(pull+weightMoment*Math.sin(.24+angle)-.18*velocity)/inertia;
    velocity+=acceleration*step;angle+=velocity*step;samples.push(angle);
  }
  const duration=(samples.length-2+(arc-samples.at(-2))/(angle-samples.at(-2)))*step;
  return {duration,progress(seconds){
    if(seconds<=0)return 0;
    if(seconds>=duration)return 1;
    const index=seconds/step,i=Math.floor(index);
    return mix(samples[i],samples[i+1],index-i)/arc;
  }};
}
const drop=downswing(),liftDuration=.30,releaseDuration=.33;
const impactAt=liftDuration+drop.duration;
const swingDuration=impactAt+releaseDuration,impactFraction=impactAt/swingDuration;

function hickory(){
  const width=128,height=256,bytes=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const a=x*Math.PI*2/width,h=y/height;
    const grain=Math.sin(33*a+.95*Math.sin(3*a+4*h)+2.8*h);
    const pores=Math.sin(83*a+.5*Math.sin(7*a+9*h));
    const shade=1-.09*Math.pow(.5+.5*grain,7)-.055*Math.pow(.5+.5*pores,4)+.045*Math.sin(9*a+3*h);
    bytes.set([192*shade,142*shade,92*shade,255],(y*width+x)*4);
  }
  const map=new T.DataTexture(bytes,width,height);
  map.colorSpace=T.SRGBColorSpace;map.wrapS=T.RepeatWrapping;
  map.generateMipmaps=true;map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;map.needsUpdate=true;
  const shape=[[0,0],[.023,.004],[.025,.014],[.023,.047],[.017,.15],[.018,.37],[.022,.53],[.021,.62],[.018,.709],[0,.716]];
  const g=new T.LatheGeometry(shape.map(p=>new T.Vector2(...p)),24);
  g.scale(1,1,.78);g.rotateX(-Math.PI/2);
  return new T.Mesh(g,new T.MeshStandardMaterial({map,roughness:.62}));
}

function forgedHead(){
  // Successive rounded cross-sections taper from the square poll to a convex,
  // polished edge. That edge shares its center with the swing's contact point.
  const sections=[[.082,.025,.038],[.078,.029,.041],[.014,.040,.043],[-.038,.031,.048],[-.079,.018,.055],[-.101,.009,.059],[-.117,.001,.060]];
  const pos=[],g=new T.BufferGeometry();
  function rim([y,w,d]){
    return [[.72,-1],[1,-.72],[1,.72],[.72,1],[0,1],[-.72,1],[-1,.72],[-1,-.72],[-.72,-1],[0,-1]].map(([u,v])=>[
      w*u,y+(y<-.10?.006*Math.abs(v):0),edge.z+d*v]);
  }
  const rings=sections.map(rim);
  function triangle(a,b,c){pos.push(...a,...b,...c);}
  for(let j=0;j<rings.length-1;j++){
    const begin=pos.length/3;
    for(let i=0;i<10;i++){
      const n=(i+1)%10,top=rings[j],bottom=rings[j+1];
      triangle(top[i],top[n],bottom[i]);triangle(top[n],bottom[n],bottom[i]);
    }
    g.addGroup(begin,pos.length/3-begin,j>=4?1:0);
  }
  const start=pos.length/3;
  for(let i=0;i<10;i++){
    const n=(i+1)%10;
    triangle([0,sections[0][0],edge.z],rings[0][n],rings[0][i]);
    triangle(edge.toArray(),rings.at(-1)[i],rings.at(-1)[n]);
  }
  g.addGroup(start,pos.length/3-start,0);
  g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();
  const forged=new T.MeshStandardMaterial({color:0x5e6566,roughness:.51,metalness:.46});
  const bevel=new T.MeshStandardMaterial({color:0xc9cdc8,roughness:.34,metalness:.55});
  return new T.Mesh(g,[forged,bevel]);
}

function workGlove(side){
  const tan=0xad7950,palm=0xb58a5d,seam=0x896445;
  const parts=[ovalPart(side*.034,.001,.005,.024,.040,.057,palm,[0,side*.1,0])];
  // Four curled fingers and an opposing thumb grip the oval haft.
  for(let i=0;i<4;i++){
    const z=(i-1.5)*.019,r=.010-i*.00045;
    const knuckle=[side*.027,.030,z],bend=[-side*.006,.034,z-.004],tip=[-side*.021,.010,z-.007];
    parts.push(stem(knuckle,bend,r*1.10,r,tan),ovalPart(...knuckle,r*1.15,r,r,tan),
      ovalPart(...bend,r,r,r,tan),stem(bend,tip,r,r*.84,palm),ovalPart(...tip,r*.83,r*.9,r*.8,palm));
  }
  const thumb=[side*.018,-.023,-.030],joint=[-side*.007,-.026,-.040],tip=[-side*.024,-.005,-.043];
  parts.push(stem(thumb,joint,.015,.013,palm),stem(joint,tip,.013,.009,palm),ovalPart(...tip,.010,.011,.010,palm),
    ovalPart(side*.053,.005,.009,.006,.027,.038,seam,[0,.08*side,.03]));
  return assemble(side>0?'Right work glove':'Left work glove',parts,.90);
}

function workSleeve(){
  // Sleeve length is fitted between the actual wrist and the visitor's elbow.
  const profile=[[.030,0],[.038,.035],[.041,.105],[.039,.13],[.050,.158],[.053,.21],[.049,.24],[.056,.36],[.054,.39],[.061,.64],[.058,.69],[.069,.95],[.066,1]];
  const g=new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),16);
  const colors=[],color=new T.Color();
  for(let i=0;i<g.attributes.position.count;i++){
    const y=g.attributes.position.getY(i);color.setHex(y<=.13?0x49493e:0x536058);colors.push(color.r,color.g,color.b);
  }
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const mesh=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:.97}));
  mesh.name='Canvas work sleeve';return mesh;
}

export function makeSplittingMaul(root){
  const maul=new T.Group();maul.name='Splitting maul';root.add(maul);
  const handle=hickory(),head=forgedHead();handle.name='Oiled hickory handle';head.name='Forged wedge head';
  maul.add(handle,head);
  const hands=[-1,1].map(side=>{
    const glove=workGlove(side),sleeve=workSleeve();glove.castShadow=false;
    maul.add(glove);root.add(sleeve);
    return {side,glove,sleeve};
  });
  const pose=()=>({p:vec(),q:new T.Quaternion()});
  const parked=pose(),ready=pose(),tired=pose(),opening=pose(),loaded=pose(),high=pose(),contact=pose();
  const bite=pose(),rebound=pose(),settled=pose(),pried=pose(),guard=pose(),current=pose();
  const delta=vec(),eye=vec(),wrist=vec(),elbow=vec(),up=vec(0,1,0);
  const crown=vec(),butt=vec(),tangent=vec(),sideways=vec();
  const cameraInRoot=new T.Matrix4(),cameraRotation=new T.Quaternion(),euler=new T.Euler(0,0,0,'YXZ');
  function edgeAt(out,x,y,z){
    out.p.set(x,y,z).sub(delta.copy(edge).applyQuaternion(out.q));
  }
  // Park the tool with its poll and bit clearly visible beside the loaded round.
  parked.q.setFromEuler(euler.set(-.78,1.64,.08));
  edgeAt(parked,.075,.462,.215);
  let held,prepared=false,preparedAim=null;
  function equip(enabled){
    if(held===enabled)return;
    held=enabled;
    handle.castShadow=head.castShadow=!held;
    handle.receiveShadow=head.receiveShadow=true;
    for(const {glove,sleeve} of hands)glove.visible=sleeve.visible=held;
  }
  function rest(){prepared=false;equip(false);maul.position.copy(parked.p);maul.quaternion.copy(parked.q);maul.updateMatrixWorld(true);}
  function cameraFrame(camera){
    camera.updateWorldMatrix(true,false);root.updateWorldMatrix(true,false);
    cameraInRoot.copy(root.matrixWorld).invert().multiply(camera.matrixWorld);
    cameraRotation.setFromRotationMatrix(cameraInRoot);eye.setFromMatrixPosition(cameraInRoot);
  }
  function viewPose(out,camera,x,y,depth,pitch,yaw,roll){
    // Frame the tool at a similar location on phones and wide screens.
    const halfHeight=depth*Math.tan(camera.fov*Math.PI/360);
    delta.set(x*halfHeight*Math.min(1.60,camera.aspect),y*halfHeight,-depth).applyMatrix4(cameraInRoot);
    out.p.copy(delta);out.q.copy(cameraRotation).multiply(currentRotation(pitch,yaw,roll));
    out.p.sub(delta.copy(edge).applyQuaternion(out.q));
  }
  const rotation=new T.Quaternion();
  function currentRotation(pitch,yaw,roll){return rotation.setFromEuler(euler.set(pitch,yaw,roll));}
  function interpolate(a,b,t){
    current.p.lerpVectors(a.p,b.p,t);current.q.slerpQuaternions(a.q,b.q,t);
  }
  const firstEdge=vec(),lastEdge=vec();
  function moveEdge(a,b,t){
    // At impact the head determines the path. Let the hands pivot around
    // the embedded bit while the haft flexes back toward the visitor.
    firstEdge.copy(edge).applyQuaternion(a.q).add(a.p);
    lastEdge.copy(edge).applyQuaternion(b.q).add(b.p);
    current.q.slerpQuaternions(a.q,b.q,t);
    current.p.lerpVectors(firstEdge,lastEdge,t).sub(delta.copy(edge).applyQuaternion(current.q));
  }
  function place(slide){
    equip(true);maul.position.copy(current.p);maul.quaternion.copy(current.q);
    for(const {side,glove,sleeve} of hands){
      // The guide hand slides toward the butt as momentum takes the head forward.
      glove.position.z=side>0?-mix(.442,.175,slide):-.095;
      wrist.set(side*.043,-.014,glove.position.z+.025).applyQuaternion(current.q).add(current.p);
      elbow.set(side*.40,-.46,.12).applyMatrix4(cameraInRoot);
      delta.subVectors(elbow,wrist);
      sleeve.position.copy(wrist);sleeve.scale.y=delta.length();sleeve.quaternion.setFromUnitVectors(up,delta.normalize());
    }
  }
  function atRest(camera,wave){
    viewPose(ready,camera,.42,.08+wave,.82,.97,-.08,-.26);
    viewPose(tired,camera,.50,-.23+wave,.78,.69,-.13,-.35);
  }
  function hold(camera,seconds,reduced,strength=1,draw=1){
    prepared=false;cameraFrame(camera);atRest(camera,reduced?0:Math.sin(seconds*1.8)*.008);
    interpolate(tired,ready,smooth(T.MathUtils.clamp(strength,0,1)));
    if(!reduced && draw<1){
      const t=1-smooth(T.MathUtils.clamp(draw,0,1));current.p.lerp(parked.p,t);current.q.slerp(parked.q,t);
    }
    place(0);
  }
  const cut={x:0,y:.76,z:0,nx:1,nz:0};
  let heading=0;
  function prepare(camera,aim){
    atRest(camera,0);
    opening.p.copy(held?maul.position:ready.p);
    opening.q.copy(held?maul.quaternion:ready.q);
    cut.x=aim?.x??0;cut.y=aim?.y??.76;cut.z=aim?.z??0;
    const toward=Math.atan2(eye.x-cut.x,eye.z-cut.z);
    const length=Math.hypot(aim?.nx??0,aim?.nz??0);
    cut.nx=length?aim.nx/length:Math.cos(toward);
    cut.nz=length?aim.nz/length:-Math.sin(toward);
    heading=Math.atan2(-cut.nz,cut.nx);
    if(Math.cos(heading-toward)<0)heading+=Math.PI;
    tangent.set(-Math.sin(heading),0,-Math.cos(heading));
    sideways.set(Math.cos(heading),0,-Math.sin(heading));
    // The hands take the load before the head lifts: curl the lower grip up
    // while the bit hangs back beside the shoulder. Keep the handle rigid.
    crown.copy(edge).applyQuaternion(opening.q).add(opening.p).addScaledVector(sideways,.015);
    loaded.q.copy(opening.q).multiply(currentRotation(-.19,-.025,-.035));
    edgeAt(loaded,crown.x,crown.y-.03,crown.z);
    // The raising hand transfers the load over the shoulder. Fix the hit and
    // the loaded pose in the station frame when the swing begins.
    crown.copy(eye).addScaledVector(tangent,.33).addScaledVector(sideways,.22);
    crown.y+=.25;
    high.q.copy(currentRotation(1.94,heading+.14,-.19));
    edgeAt(high,crown.x,crown.y,crown.z);
    contact.q.copy(currentRotation(-.082,heading,0));
    edgeAt(contact,cut.x,cut.y,cut.z);
    prepared=true;preparedAim=aim;
  }
  function impactPose(out,height,forward,skid,pitch,roll=0){
    out.q.copy(currentRotation(pitch,heading,roll));
    edgeAt(out,cut.x+tangent.x*forward+sideways.x*skid,cut.y+height,cut.z+tangent.z*forward+sideways.z*skid);
  }
  function stroke(t,good,reduced,camera,aim){
    if(!camera)return;
    cameraFrame(camera);
    if(!prepared || preparedAim!==aim)prepare(camera,aim);
    const duration=aim?.duration??swingDuration,seconds=t*duration;
    const contactTime=duration*impactFraction;
    // Fatigue stretches the lift and the recovery more than the falling head.
    // Every duration hits the raycast's exact normalized contact frame.
    const descent=drop.duration*(1+.26*(duration/swingDuration-1));
    const lift=contactTime-descent;
    const outcome=aim?.outcome||(good?'split':'glance');
    let slide=0;
    if(t<impactFraction && reduced){
      interpolate(opening,opening,0);
    }else if(seconds<lift*.24){
      moveEdge(opening,loaded,smooth(seconds/(lift*.24)));
    }else if(seconds<lift){
      const u=smooth((seconds/lift-.24)/.76);
      // The elbows lead the lift. The head takes longer to turn overhead.
      current.p.lerpVectors(loaded.p,high.p,u);
      current.q.slerpQuaternions(loaded.q,high.q,u*u*(1.8-.8*u));
    }else if(t<impactFraction){
      const u=drop.progress((seconds-lift)/descent*drop.duration);
      interpolate(high,contact,u);
      // Rotate the head around a moving grip. This sweeps a curved edge path
      // even for an off-center strike or a visitor standing beside the stump.
      butt.subVectors(contact.p,high.p);
      current.p.copy(high.p).addScaledVector(butt,u+.13*Math.sin(Math.PI*u));
      slide=smooth(Math.min(1,u*1.23));
    }else{
      const elapsed=Math.max(0,seconds-contactTime),recovery=duration-contactTime;
      atRest(camera,0);
      const reserve=smooth(T.MathUtils.clamp(aim?.endStamina??1,0,1));
      guard.p.lerpVectors(tired.p,ready.p,reserve);guard.q.slerpQuaternions(tired.q,ready.q,reserve);
      if(reduced){
        const atHit=elapsed<Math.min(.10,recovery*.45);
        interpolate(atHit?contact:guard,atHit?contact:guard,0);slide=atHit?1:0;
      }else{
        const split=outcome==='split',glance=outcome==='glance';
        const response=Math.min(split?.102:.142,recovery*.55);
        // A thin piece can sit just above the chopping face. Limit the
        // follow-through and embed to the available wood in that case.
        const clearance=aim?.blockTop==null?Infinity:Math.max(0,cut.y-aim.blockTop-.002);
        // A split follows the opening fibres. Resisting wood arrests the
        // head in centimetres, returns it once, then damps the rebound.
        if(split){
          impactPose(settled,-Math.min(.15,clearance),.038,0,-.40);
          if(elapsed<response)moveEdge(contact,settled,1-(1-elapsed/response)**2);
        }else{
          impactPose(bite,-Math.min(glance?.006:.019,clearance),.004,glance?.009:0,-.15);
          impactPose(rebound,glance?.065:.047,-.01,glance?.076:.006,.035,glance?-.14:.035);
          impactPose(settled,glance?.044:-Math.min(.005,clearance),-.008,glance?.081:.003,-.044,glance?-.11:.015);
          const u=elapsed/response;
          if(u<.18)moveEdge(contact,bite,1-(1-u/.18)**2);
          else if(u<.62)moveEdge(bite,rebound,smooth((u-.18)/.44));
          else if(u<1)moveEdge(rebound,settled,smooth((u-.62)/.38));
        }
        slide=1;
        if(elapsed>=response){
          // Choke up and lever the haft while the head is still low.
          // The edge only rises freely after the wrists take its weight.
          const u=T.MathUtils.clamp((elapsed-response)/(recovery-response),0,1);
          const lever=split?.32:glance?.16:.28;
          firstEdge.copy(edge).applyQuaternion(settled.q).add(settled.p);
          pried.q.copy(settled.q).multiply(currentRotation(.14,0,.018));
          edgeAt(pried,firstEdge.x,firstEdge.y+.009,firstEdge.z);
          if(u<lever){
            const pull=smooth(u/lever);
            moveEdge(settled,pried,pull);slide=1-.36*pull;
          }else{
            const rise=smooth((u-lever)/(1-lever));
            moveEdge(pried,guard,rise);slide=.64*(1-rise);
          }
        }
      }
    }
    // The corners of a tilted cutting edge can reach the block before its
    // center. Stop the whole bit on the stump beneath low, fallen kindling.
    if(t>impactFraction && Number.isFinite(aim?.blockTop)){
      let lowest=delta.copy(edge).applyQuaternion(current.q).y;
      for(const tip of edgeEnds)lowest=Math.min(lowest,delta.copy(tip).applyQuaternion(current.q).y);
      current.p.y+=Math.max(0,aim.blockTop+.001-current.p.y-lowest);
    }
    place(slide);
  }
  rest();
  return {maul,hold,stroke,rest,edge,cut,impactFraction,swingDuration};
}
