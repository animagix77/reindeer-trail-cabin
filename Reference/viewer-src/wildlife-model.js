// White-tailed deer are built at life size. All articulated parts share one skin,
// so the shoulders, eyelids, antlers and all four legs cost one draw per animal.
import * as T from 'three';
import {skinGeometry} from './wildlife-coat.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const v=(x,y,z)=>new T.Vector3(x,y,z);
const mix=T.MathUtils.lerp, tau=2*Math.PI;
const color=(hex)=>new T.Color(hex);
const ellipsoid=new T.SphereGeometry(1,20,14);
const HIGH=new T.Vector3(0,1,0);
// One stride from touchdown to the next touchdown of the same hoof. Channels
// are forward placement (m), clearance (m), hoof pitch and cannon pitch (rad).
// During stance the hoof travels backwards at the ground speed of that gait.
const WALK=[
  [0,    .238,0,    0,    .04],
  [.16,  .105,0,    0,   -.02],
  [.36, -.061,0,    0,   -.04],
  [.57, -.235,0,    .07, -.10],
  [.65, -.267,.039, .43, -.12],
  [.77, -.075,.112, .28,  .19],
  [.89,  .194,.074,-.16,  .23],
  [.96,  .263,.027,-.09,  .10],
  [1,    .238,0,    0,    .04]
];
const BOUND=[
  [0,    .26,0,    -.06, -.10],
  [.09,  .11,0,     .02, -.15],
  [.26, -.174,0,    .05, -.12],
  [.34, -.308,.014, .27, -.20],
  [.45, -.337,.092, .66, -.28],
  [.62, -.099,.216, .81,  .33],
  [.77,  .212,.167, .18,  .40],
  [.90,  .355,.081,-.31,  .19],
  [1,    .26,0,    -.06, -.10]
];
function bakeStride(keys){
  const samples=96,clip=new Float32Array(samples*4);
  for(let i=0;i<samples;i++){
    const t=i/samples,k=keys.findIndex((key,j)=>j>0&&key[0]>=t);
    const a=keys[k-1],b=keys[k],prev=keys[k-2]||keys.at(-2),next=keys[k+1]||keys[1];
    const span=b[0]-a[0],u=(t-a[0])/span;
    for(let c=1;c<=4;c++){
      const left=span*(b[c]-prev[c])/(b[0]-prev[0]+(k===1?1:0));
      const right=span*(next[c]-a[c])/(next[0]-a[0]+(k===keys.length-1?1:0));
      const flat=a[c]===b[c];
      clip[4*i+c-1]=flat?a[c]:mix(a[c],b[c],u*u*(3-2*u))+
        left*u*(1-u)**2-right*u*u*(1-u);
    }
  }
  return clip;
}
const walkClip=bakeStride(WALK),boundClip=bakeStride(BOUND);
function sampleStride(clip,phase,out){
  const n=clip.length/4,pos=(phase-Math.floor(phase))*n,i=Math.floor(pos),blend=pos-i;
  for(let c=0;c<4;c++)out[c]=mix(clip[i*4+c],clip[(i+1)%n*4+c],blend);
}
function makeGrain() {
  const w=128,p=new Uint8Array(w*w*4);
  let seed=47;
  const samples=Array.from({length:w*w},()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;});
  for(let y=0;y<w;y++)for(let x=0;x<w;x++){
    const at=(dx,dy)=>samples[((y+dy+w)%w)*w+(x+dx+w)%w];
    const grain=173+40*at(0,0)+24*at(1,1)+12*at(1,2)+6*at(2,3);
    p.set([grain,grain,grain,255],(y*w+x)*4);
  }
  const tex=new T.DataTexture(p,w,w);tex.wrapS=tex.wrapT=T.RepeatWrapping;
  tex.magFilter=T.LinearFilter;tex.minFilter=T.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.needsUpdate=true;
  return tex;
}
let coat;
function coatMaterial(){
  if(!coat)coat=new T.MeshStandardMaterial({name:'Winter guard hairs',vertexColors:true,map:makeGrain(),roughness:.84});
  return coat;
}
function ell(g,center,scale,rot=[0,0,0]){
  g.applyMatrix4(new T.Matrix4().compose(center,new T.Quaternion().setFromEuler(new T.Euler(...rot)),scale));
  return g;
}
function swept(points,steps=18) {
  // A ring follows the tangent of the spine. Radii can flatten a hoof or
  // broaden a rib cage without visible seams between stacked primitives.
  const pos=[],uv=[],ix=[],rings=[];
  for(let j=0;j<points.length;j++){
    const p=points[j],prev=points[Math.max(0,j-1)],next=points[Math.min(points.length-1,j+1)];
    const axis=v(next[0]-prev[0],next[1]-prev[1],next[2]-prev[2]).normalize();
    const along=Math.abs(axis.x)<.9?v(1,0,0):v(0,1,0);
    along.addScaledVector(axis,-along.dot(axis)).normalize();const across=axis.clone().cross(along);
    for(let i=0;i<=steps;i++){
      const a=i/steps*tau,s=Math.sin(a),c=Math.cos(a);
      const q=v(...p).addScaledVector(along,p[3]*s).addScaledVector(across,p[4]*c);
      pos.push(q.x,q.y,q.z);uv.push(i/steps*3,j/(points.length-1)*2);rings.push([j,i/steps,c,s]);
      if(j && i<steps){
        const k=(j-1)*(steps+1)+i,b=k+steps+1;
        ix.push(k,b,b+1,k,b+1,k+1);
      }
    }
  }
  const geo=new T.BufferGeometry();
  geo.setIndex(ix);geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
  const normals=geo.getAttribute('normal'),n=v(0,0,0),m=v(0,0,0);
  for(let j=0;j<points.length;j++){
    const i=j*(steps+1);n.fromBufferAttribute(normals,i).add(m.fromBufferAttribute(normals,i+steps)).normalize();
    normals.setXYZ(i,n.x,n.y,n.z);normals.setXYZ(i+steps,n.x,n.y,n.z);
  }
  return {geo,rings};
}
function smoothRings(rows,sub=3){
  const centers=new T.CatmullRomCurve3(rows.map(p=>v(...p)),false,'centripetal');
  const widths=new T.CatmullRomCurve3(rows.map((p,i)=>v(p[3],p[4],i)),false,'catmullrom',.45);
  return Array.from({length:(rows.length-1)*sub+1},(_,i)=>{
    const t=i/((rows.length-1)*sub),p=centers.getPoint(t),r=widths.getPoint(t);
    return [p.x,p.y,p.z,Math.max(.002,r.x),Math.max(.002,r.y)];
  });
}
export function makeDeer({buck=false,young=false,phase=0}={}){
  const bones=[],joints=[],parts=[],fields=[];
  const deep=color(buck?0x645040:0x775842),buff=color(young?0xb88352:0xa48566),cream=color(0xe5dece);
  const edge=color(0x423930),nose=color(0x302b28),iris=color(0x422f24),dark=color(0x18191a);
  const bone=(name,parent,x,y,z)=>{
    const b=new T.Bone();b.name=name;const rest=v(x,y,z);
    b.position.copy(rest);if(parent!==null){b.position.sub(joints[parent]);bones[parent].add(b);}
    joints.push(rest);bones.push(b);return bones.length-1;
  };
  const root=bone('Body',null,0,0,0),neck=bone('Neck',root,0,.887,.366),head=bone('Poll',neck,0,1.297,.625);
  const tail=bone('Tail',root,0,.904,-.512);
  function add(geo,joint,tint,rgba=null){
    const p=geo.attributes.position,n=p.count,col=new Float32Array(3*n),weights=new Float32Array(4*n),ids=new Uint16Array(4*n),q=v(0,0,0);
    for(let i=0;i<n;i++){
      q.fromBufferAttribute(p,i);const c=rgba?rgba(q,i):tint;col.set(c.toArray(),i*3);
      ids[i*4]=joint;weights[i*4]=1;
    }
    geo.setAttribute('color',new T.BufferAttribute(col,3));geo.setAttribute('skinIndex',new T.BufferAttribute(ids,4));geo.setAttribute('skinWeight',new T.BufferAttribute(weights,4));parts.push(geo);
  }
  function pelt(type,joint,rows){
    fields.push({rows:smoothRings(rows,2),type,joint});
  }
  function shape(rows,joint,tint,gradient,segments=18){
    const {geo,rings}=swept(smoothRings(rows),segments);
    add(geo,joint,tint,gradient?(q,i)=>gradient(q,rings[i]):null);
  }
  function oval(joint,origin,scale,tint,rot){
    add(ell(ellipsoid.clone(),v(...origin),v(...scale),rot),joint,tint);
  }
  pelt('body',root,[[0,.83,-.57,.008,.013],[0,.815,-.51,.138,.172],[0,.804,-.38,.212,.237],
    [0,.792,-.12,.216,.215],[0,.776,.13,.205,.230],[0,.77,.316,.208,.250],[0,.786,.422,.178,.227],
    [0,.824,.483,.105,.155],[0,.828,.495,.025,.042]]);
  pelt('neck',neck,[[0,.819,.332,.151,.168],[0,.922,.404,.154,.160],[0,1.046,.478,.115,.138],
    [0,1.182,.555,.084,.109],[0,1.290,.627,.078,.092],[0,1.327,.655,.065,.070]]);
  pelt('head',head,[[0,1.313,.552,.031,.054],[0,1.340,.607,.083,.118],[0,1.338,.688,.109,.127],
    [0,1.300,.767,.079,.102],[0,1.237,.850,.057,.072],[0,1.217,.906,.052,.050],[0,1.214,.933,.033,.033]]);
  oval(head,[0,1.217,.918],[.052,.038,.034],nose);
  const jaw=bone('Lower jaw',head,0,1.247,.772);
  oval(jaw,[0,1.187,.871],[.047,.023,.069],cream,[-.20,0,0]);
  const ears=[];
  for(const side of [-1,1]){
    oval(head,[.041*side,1.224,.935],[.012,.007,.004],dark,[0,side*.37,-side*.17]);
    oval(head,[.089*side,1.34,.753],[.009,.024,.054],buff.clone().lerp(cream,.58),[.34,0,0]);
    oval(head,[.097*side,1.352,.740],[.014,.021,.037],edge,[.24,0,0]);
    oval(head,[.108*side,1.353,.742],[.010,.018,.027],iris,[.20,0,0]);
    oval(head,[.115*side,1.354,.745],[.006,.006,.021],dark,[.1,0,0]);
    oval(head,[.120*side,1.36,.754],[.002,.004,.004],cream);
    // The pinna has a tapered rim around a recessed, lighter auditory cup.
    const base=v(side*.057,1.398,.627),ear=bone('Ear '+side,head,...base.toArray());ears.push(bones[ear]);
    const pinna=[[0,0,0,.019,.014],[.038,.047,-.017,.044,.017],[.072,.089,-.025,.046,.015],[.104,.134,-.031,.030,.011],[.126,.174,-.027,.002,.003]];
    function leaf(inner){
      const rows=pinna.map(([x,y,z,w,h],i)=>[base.x+x*side,base.y+y,base.z+z+(inner?.013:0),
        inner?w*.70:w,inner?.006:h]);
      shape(rows,ear,inner?color(0xc3a998):deep,null,14);
    }leaf(false);leaf(true);
    if(buck){
      const horn=color(0x947553),ivory=color(0xcaba96);
      const antler=(rows)=>shape(rows.map(([x,y,z,r])=>[side*x,y,z,r,r*.89]),head,horn,
        q=>horn.clone().lerp(ivory,T.MathUtils.smoothstep(q.y,1.52,1.77)),10);
      antler([[.040,1.423,.654,.021],[.065,1.484,.609,.024],[.112,1.557,.553,.021],[.194,1.625,.511,.019],[.240,1.687,.541,.015],[.251,1.713,.616,.009],[.228,1.727,.696,.001]]);
      antler([[.074,1.503,.590,.012],[.063,1.566,.619,.010],[.065,1.601,.646,.002]]);
      antler([[.179,1.613,.516,.014],[.165,1.685,.527,.010],[.149,1.751,.551,.002]]);
      antler([[.235,1.678,.537,.011],[.221,1.738,.547,.008],[.211,1.770,.570,.002]]);
    }
  }
  shape([[0,.901,-.495,.046,.036],[0,.879,-.563,.059,.049],[0,.814,-.621,.069,.046],[0,.746,-.648,.051,.041],[0,.686,-.651,.008,.014]],
    tail,deep,(q,r)=>deep.clone().lerp(cream,T.MathUtils.smoothstep(r[2],-.44,.36)),18);
  const legs=[];
  for(const side of [-1,1])for(const hind of [true,false]){
    const x=side*(hind?.128:.145),baseY=hind?.816:.802,baseZ=hind?-.37:.335;
    const midY=hind?.452:.447,midZ=hind?-.242:.307,hockY=hind?.285:.154,hockZ=hind?-.437:.302;
    const ankleY=.115,ankleZ=hind?-.404:.325;
    const upper=bone('Upper leg '+side+hind,root,x,baseY,baseZ),mid=bone('Knee '+side+hind,upper,x,midY,midZ);
    const hock=bone('Hock '+side+hind,mid,x,hockY,hockZ),foot=bone('Pastern '+side+hind,hock,x,ankleY,ankleZ);
    pelt('leg',upper,[[x,baseY+.094,baseZ,hind?.089:.072,.089],[x,baseY,baseZ,hind?.111:.081,hind?.153:.099],
      [x,(baseY+midY)/2,(baseZ+midZ)/2,.070,hind?.106:.072],[x,midY,midZ,.045,.055]]);
    pelt('leg',mid,[[x,midY+.030,midZ,.045,.054],[x,midY,midZ,.051,.056],
      [x,mix(midY,hockY,.47),mix(midZ,hockZ,.47),.035,hind?.049:.037],[x,hockY,hockZ,.028,.035]]);
    pelt('leg',hock,[[x,hockY+.024,hockZ,.029,.035],[x,hockY,hockZ-.008,.034,.037],[x,ankleY,ankleZ,.020,.026]]);
    pelt('leg',foot,[[x,ankleY+.019,ankleZ,.024,.028],[x,ankleY,ankleZ,.027,.033],
      [x,.049,ankleZ+.037,.023,.030],[x,.025,ankleZ+.040,.020,.026]]);
    for(const toe of [-1,1]) oval(foot,[x+toe*.012,.026,ankleZ+.051],[.016,.026,.047],edge,[.18,0,toe*.025]);
    legs.push({hind,side,x,toeZ:ankleZ+.052,baseY,baseZ,ankleY,hockDY:ankleY-hockY,hockDZ:ankleZ-hockZ,
      upperLength:Math.hypot(baseY-midY,midZ-baseZ),midLength:Math.hypot(midY-hockY,hockZ-midZ),
      upperRest:Math.atan2(midZ-baseZ,baseY-midY),midRest:Math.atan2(hockZ-midZ,midY-hockY),
      walk:new Float32Array(4),bound:new Float32Array(4),reach:0,lift:0,toePitch:0,cannonPitch:0,
      upper:bones[upper],mid:bones[mid],hock:bones[hock],foot:bones[foot]});
  }
  // Each yearling keeps a short, dusky coat. An older juvenile has lost its fawn spots.
  parts.push(skinGeometry(fields,{buff,deep,cream}));
  const geometry=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());
  const mesh=new T.SkinnedMesh(geometry,coatMaterial());mesh.name=buck?'White-tailed buck':young?'White-tailed yearling':'White-tailed doe';
  mesh.add(bones[root]);mesh.bind(new T.Skeleton(bones));mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.frustumCulled=false;
  const object=new T.Group();object.name=mesh.name;object.add(mesh);
  object.scale.setScalar(young?.79:buck?1.08:1);
  const muzzle= new T.Object3D();muzzle.name='Muzzle';muzzle.position.copy(v(0,1.217,.943).sub(joints[head]));bones[head].add(muzzle);
  const localTarget=v(0,0,0),inverse=new T.Quaternion();
  let walk=0,flag=0,earsUp=0,lastPose=null,bodyPitch=0,bodyRoll=0,slopePitch=0,slopeRoll=0;
  // Place each sole on the sampled terrain throughout stance. The upper leg
  // and knee solve for the hock while the hoof rolls off at the end of contact.
  function fitHooves(ground,shadow,dt){
    const s=object.scale.x,sin=Math.sin(object.rotation.y),cos=Math.cos(object.rotation.y);
    let along=0,across=0;
    for(const leg of legs){
      const toe=leg.toeZ+leg.reach;
      const x=object.position.x+s*(cos*leg.x+sin*toe);
      const z=object.position.z+s*(cos*toe-sin*leg.x);
      const h=ground(x,z)??object.position.y;
      const dy=h-object.position.y;
      leg.height=dy/s;
      along+=dy*(leg.hind?-1:1);
      across+=dy*leg.side;
    }
    const pitch=-Math.atan(along/(1.46*s)),roll=Math.atan(across/(.55*s));
    shadow.rotation.set(pitch,object.rotation.y,roll,'YXZ');
    slopePitch=T.MathUtils.damp(slopePitch,T.MathUtils.clamp(pitch,-.29,.29)*walk,11,dt);
    slopeRoll=T.MathUtils.damp(slopeRoll,T.MathUtils.clamp(roll,-.15,.15)*walk,11,dt);
    mesh.rotation.set(bodyPitch+slopePitch,0,bodyRoll+slopeRoll);
    inverse.copy(mesh.quaternion).invert();
    for(const leg of legs){
      localTarget.set(leg.x,leg.height+leg.lift-mesh.position.y,leg.toeZ+leg.reach).applyQuaternion(inverse);
      const cannon=leg.cannonPitch-mesh.rotation.x,toe=leg.toePitch-mesh.rotation.x;
      const ankleY=-leg.ankleY,ankleZ=.052;
      const hockY=localTarget.y-(leg.hockDY*Math.cos(cannon)-leg.hockDZ*Math.sin(cannon))-(ankleY*Math.cos(toe)-ankleZ*Math.sin(toe));
      const hockZ=localTarget.z-(leg.hockDZ*Math.cos(cannon)+leg.hockDY*Math.sin(cannon))-(ankleZ*Math.cos(toe)+ankleY*Math.sin(toe));
      const down=leg.baseY-hockY,forward=hockZ-leg.baseZ,L=leg.upperLength,M=leg.midLength;
      const distance=T.MathUtils.clamp(Math.hypot(down,forward),Math.abs(L-M)+.001,L+M-.0005);
      const bend=Math.acos(T.MathUtils.clamp((L*L+distance*distance-M*M)/(2*L*distance),-1,1));
      const aim=Math.atan2(forward,down),upper=aim+(leg.hind?bend:-bend);
      const mid=Math.atan2(distance*Math.sin(aim)-L*Math.sin(upper),distance*Math.cos(aim)-L*Math.cos(upper));
      leg.upper.rotation.x=leg.upperRest-upper;
      leg.mid.rotation.x=leg.midRest-mid-leg.upper.rotation.x;
      leg.hock.rotation.x=cannon-leg.upper.rotation.x-leg.mid.rotation.x;
      leg.foot.rotation.x=toe-cannon;
    }
  }
  return {object,muzzle,fitHooves,pose(time,stride,speed,lower,chew,look=0,alarmed=false,listening=false) {
    const dt=lastPose===null?0:Math.min(.14,Math.max(0,time-lastPose));
    lastPose=time;
    flag=T.MathUtils.damp(flag,alarmed?1:0,alarmed?11:2.2,dt);
    earsUp=T.MathUtils.damp(earsUp,listening||alarmed?1:0,7,dt);
    walk=T.MathUtils.smoothstep(speed,0,.38);
    const bound=T.MathUtils.smoothstep(speed,.95,2.4);
    const cyc=stride*tau,breath=Math.sin(time*2.05+phase);
    const lift=Math.max(0,Math.sin(cyc));
    // At a walk each foot lands in sequence. In flight, the hind legs gather
    // and push together, with the forelegs reaching to catch the body.
    mesh.position.y=.0028*breath+walk*mix(-.033+.011*Math.sin(2*cyc),-.067+.132*lift*lift,bound);
    bodyPitch=bound*(.102*Math.cos(cyc)-.025);
    bodyRoll=.014*walk*Math.sin(cyc)*(1-bound);
    const listen=1-lower;
    bones[neck].rotation.x=mix(.025+.025*Math.sin(time*.97+phase)+.026*Math.sin(cyc)*walk-.16*earsUp+.115*bound*Math.cos(cyc),2.29,lower);
    bones[neck].rotation.y=look*listen*.60+.035*Math.sin(time*.63+phase)*listen;
    bones[head].rotation.x=mix(.018*Math.sin(time*1.42+phase)-.07*bound*Math.cos(cyc),-.62,lower);
    const chewing=chew||T.MathUtils.smoothstep(lower,.83,.95);
    bones[jaw].rotation.x=chewing*.15*(.5+.5*Math.sin(time*7.4+phase));
    bones[jaw].rotation.z=chewing*.047*Math.cos(time*7.4+phase);
    bones[head].rotation.y=look*listen*.30;
    ears.forEach((ear,i)=>{
      const side=i?1:-1,beat=time*(i?1.31:1.07)+phase+i*2.2;
      const swivel=Math.max(0,Math.sin(beat))**7;
      ear.rotation.y=side*(.27*swivel+.14*Math.sin(time*.78+phase+i))*(1-earsUp)+look*.4*listen;
      ear.rotation.z=side*(.055*Math.sin(beat)+.16*swivel-.21*earsUp);
    });
    bones[tail].rotation.x=1.58*flag+.14*bound*Math.cos(cyc);
    bones[tail].rotation.z=.10*Math.sin(time*.75+phase)+.32*Math.pow(Math.max(0,Math.sin(time*1.16+phase)),18);
    for(const l of legs){
      sampleStride(walkClip,stride+(l.side>0?.5:0)+(l.hind?0:.76),l.walk);
      sampleStride(boundClip,stride+(l.side>0?.075:0)+(l.hind?0:.48),l.bound);
      l.reach=walk*mix(l.walk[0],l.bound[0],bound);
      l.lift=walk*Math.max(0,mix(l.walk[1],l.bound[1],bound));
      l.toePitch=walk*mix(l.walk[2],l.bound[2],bound);
      l.cannonPitch=walk*mix(l.walk[3],l.bound[3],bound);
    }
  }};
}

export function assemble(name,parts,roughness=.73){
  const geos=parts.map(([geo,c])=>{
    const attr=geo.getAttribute('position'),rgb=new Float32Array(3*attr.count),col=color(c);
    for(let i=0;i<attr.count;i++)col.toArray(rgb,i*3);
    geo.setAttribute('color',new T.BufferAttribute(rgb,3));return geo.index?geo.toNonIndexed():geo;
  });
  const mesh=new T.Mesh(mergeGeometries(geos,false),new T.MeshStandardMaterial({vertexColors:true,roughness}));
  mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true; geos.forEach(g=>g.dispose());parts.forEach(([g])=>g.dispose());return mesh;
}
export const ovalPart=(x,y,z,sx,sy,sz,tint,rot)=>[ell(ellipsoid.clone(),v(x,y,z),v(sx,sy,sz),rot),tint];
export function stem(a,b,r1,r2,tint,sides=10){
  const A=v(...a),B=v(...b),d=B.clone().sub(A),g=new T.CylinderGeometry(r2,r1,d.length(),sides);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(HIGH,d.clone().normalize()));g.translate(...A.lerp(B,.5).toArray());return [g,tint];
}
export function makeFoodTemplates() {
  const apple=new T.LatheGeometry([[0,-.034],[.010,-.040],[.027,-.038],[.037,-.025],[.044,-.002],[.043,.017],[.037,.032],[.025,.037],[.011,.032],[.004,.023],[0,.022]].map(p=>new T.Vector2(...p)),32);
  const attr=apple.attributes.position;
  for(let i=0;i<attr.count;i++){
    const a=Math.atan2(attr.getX(i),attr.getZ(i)),y=attr.getY(i),lobe=Math.cos(5*a)*.0018*(.32+Math.abs(y)*13);
    attr.setY(i,y+lobe);
  }
  apple.computeVertexNormals();
  const carrot=swept([[0,-.095,0,.002,.002],[.002,-.069,0,.004,.006],[.005,-.03,0,.012,.012],[0,.027,0,.019,.016],[0,.068,0,.018,.018],[0,.074,0,.008,.008]],14).geo;
  const appleParts=[[apple,0xb33321],stem([.003,.02,0],[.009,.054,.005],.0035,.002,0x654832),ovalPart(.014,.044,.002,.014,.002,.007,0x657736,[0,.2,.25])];
  const carrotParts=[[carrot,0xe48238]];
  const greens=[];
  for(let i=0;i<6;i++){
    const a=tau*i/6,c=Math.cos(a),s=Math.sin(a);
    carrotParts.push(stem([0,.069,0],[c*.023,.109,s*.018],.0027,.0007,0x577e39,6));
    greens.push(ovalPart(c*.023,.012+(i%2)*.010,s*.020,.026,.031,.018,i%2?0x627e3f:0x789249,[s*.52,a,c*.51]));
    greens.push(stem([0,-.041,0],[c*.021,.018,s*.019],.006,.002,0x9ba754,6));
  }
  return {apple:assemble('Apple',appleParts,.51),carrot:assemble('Carrot',carrotParts),vegetables:assemble('Leafy vegetables',greens)};
}
export function makeOfferingHand(){
  const skin=0xc69376,light=0xd3a78a,parts=[];
  // The wrist enters from the lower right. The curled distal joints point
  // away from the visitor and leave the ball of the palm open to the animal.
  parts.push(stem([.085,-.26,.16],[.032,-.068,.045],.063,.040,0x4e5954,18));
  parts.push(stem([.042,-.106,.073],[.027,-.054,.039],.049,.043,0x56635d,18));
  parts.push(ovalPart(.013,-.032,-.005,.055,.025,.080,skin,[-.24,-.24,.1]));
  for(let i=0;i<4;i++){
    const x=-.031+i*.0205,len=[.059,.074,.068,.055][i],a=[x,-.025,-.050];
    const b=[x-.006,-.026,-.050-len*.58],c=[x-.007,-.014,-.050-len*.96];
    parts.push(stem(a,b,.010,.0088,skin),stem(b,c,.0088,.0063,light),ovalPart(...c,.0065,.007,.0085,light));
  }
  parts.push(stem([-.031,-.025,.016],[-.062,-.014,-.003],.015,.0115,skin),stem([-.062,-.014,-.003],[-.066,0,-.032],.0115,.009,light),
    ovalPart(-.066,0,-.032,.009,.009,.011,light));
  return assemble('Outstretched hand',parts);
}
