import * as T from 'three';
import {assemble,ovalPart,stem} from './wildlife-model.js';

const vec=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const smooth=t=>t*t*(3-2*t);
const mix=T.MathUtils.lerp;
const edge=vec(0,-.117,-.657);
const impactFraction=.59;

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
  const parked=pose(),ready=pose(),loaded=pose(),high=pose(),contact=pose(),bite=pose(),tired=pose(),current=pose();
  const delta=vec(),eye=vec(),wrist=vec(),elbow=vec(),up=vec(0,1,0);
  const cameraInRoot=new T.Matrix4(),cameraRotation=new T.Quaternion(),euler=new T.Euler(0,0,0,'YXZ');
  function edgeAt(out,x,y,z){
    out.p.set(x,y,z).sub(delta.copy(edge).applyQuaternion(out.q));
  }
  // Park the tool with its poll and bit clearly visible beside the loaded round.
  parked.q.setFromEuler(euler.set(-.78,1.64,.08));
  edgeAt(parked,.075,.462,.215);
  let held;
  function equip(enabled){
    if(held===enabled)return;
    held=enabled;
    handle.castShadow=head.castShadow=!held;
    handle.receiveShadow=head.receiveShadow=true;
    for(const {glove,sleeve} of hands)glove.visible=sleeve.visible=held;
  }
  function rest(){equip(false);maul.position.copy(parked.p);maul.quaternion.copy(parked.q);maul.updateMatrixWorld(true);}
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
  function place(slide){
    equip(true);maul.position.copy(current.p);maul.quaternion.copy(current.q);
    for(const {side,glove,sleeve} of hands){
      // The guide hand slides toward the butt as momentum takes the head forward.
      glove.position.z=side>0?-mix(.415,.206,slide):-.095;
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
    cameraFrame(camera);atRest(camera,reduced?0:Math.sin(seconds*1.8)*.008);
    interpolate(tired,ready,smooth(T.MathUtils.clamp(strength,0,1)));
    if(!reduced && draw<1){
      const t=1-smooth(T.MathUtils.clamp(draw,0,1));current.p.lerp(parked.p,t);current.q.slerp(parked.q,t);
    }
    place(0);
  }
  const cut={x:0,z:0,nx:1,nz:0};
  function stroke(t,good,reduced,camera,aim){
    cameraFrame(camera);atRest(camera,0);
    const ax=aim?.x??0,az=aim?.z??0,radius=Math.hypot(ax,az);
    const inset=radius>.112?.112/radius:1;
    const x=good?ax*inset:0,z=good?az*inset:0;
    const approach=Math.atan2(eye.x-x,eye.z-z);
    const nx=Math.cos(approach),nz=-Math.sin(approach);
    cut.x=x;cut.z=z;cut.nx=nx;cut.nz=nz;
    contact.q.copy(currentRotation(-.44,approach,good?.04:-.18));
    const offset=good?0:.126;
    edgeAt(contact,x+nx*offset,.755,z+nz*offset);
    bite.q.copy(currentRotation(good?-.59:-.55,approach,good?.05:-.34));
    const follow=good?.006:.17;
    edgeAt(bite,x+nx*follow,good?.69:.68,z+nz*follow);
    let slide=0;
    if(reduced){
      const striking=t>=impactFraction && t<.84;
      const still=striking?contact:t>=.84?tired:ready;
      interpolate(still,still,0);slide=striking?1:0;
    }else{
      viewPose(loaded,camera,.43,-.01,.80,.88,-.12,-.28);
      viewPose(high,camera,.68,1.44,.54,1.80,.12,-.36);
      if(t<.1)interpolate(ready,loaded,smooth(t/.1));
      else if(t<.40)interpolate(loaded,high,smooth((t-.1)/.30));
      else if(t<impactFraction){
        const u=(t-.40)/(impactFraction-.40);
        interpolate(high,contact,u*u);slide=smooth(u);
      }else if(t<.73){
        const u=(t-impactFraction)/(.73-impactFraction);
        interpolate(contact,bite,1-(1-u)**3);slide=1;
      }else{
        const u=smooth((t-.73)/.27);
        interpolate(bite,tired,u);slide=1-u;
      }
    }
    place(slide);
  }
  rest();
  return {maul,hold,stroke,rest,cut,impactFraction,swingDuration:1.12};
}
