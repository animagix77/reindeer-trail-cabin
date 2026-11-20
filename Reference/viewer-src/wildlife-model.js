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
  oval(head,[0,1.187,.871],[.047,.023,.069],cream,[-.20,0,0]);
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
    legs.push({hind,side,x,toeZ:ankleZ+.052,shoulderY:baseY,upper:bones[upper],mid:bones[mid],hock:bones[hock],foot:bones[foot]});
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
  // Resolve the four contact heights independently. The pastern follows the
  // local slope beneath that hoof while the gait still supplies its swing.
  function fitHooves(ground,shadow,dt){
    const s=object.scale.x,sin=Math.sin(object.rotation.y),cos=Math.cos(object.rotation.y);
    let along=0,across=0;
    for(const leg of legs){
      const x=object.position.x+s*(cos*leg.x+sin*leg.toeZ);
      const z=object.position.z+s*(cos*leg.toeZ-sin*leg.x);
      const h=ground(x,z)??object.position.y;
      const dy=h-object.position.y;
      const reach=T.MathUtils.clamp(1-dy/(s*leg.shoulderY),.74,1.28);
      leg.upper.scale.y=dt?T.MathUtils.damp(leg.upper.scale.y,reach,18,dt):reach;
      along+=dy*(leg.hind?-1:1);
      across+=dy*leg.side;
    }
    shadow.rotation.set(-Math.atan(along/(1.46*s)),object.rotation.y,Math.atan(across/(.55*s)),'YXZ');
  }
  return {object,muzzle,fitHooves,pose(time,stride,speed,lower,chew,look=0) {
    const walk=Math.min(1,speed/.63);
    const cyc=stride*tau,breath=Math.sin(time*2.05+phase);
    mesh.position.y=walk*.016*Math.sin(cyc*2)+.0028*breath;
    bones[neck].rotation.x=mix(.025+.025*Math.sin(time*.97+phase)+.026*Math.sin(cyc)*walk,2.29,lower);
    bones[neck].rotation.y=look*(1-lower)*.60+.035*Math.sin(time*.63+phase);
    bones[head].rotation.x=mix(.018*Math.sin(time*1.42+phase),-.62,lower)+chew*.047*(.5+.5*Math.sin(time*8));
    bones[head].rotation.y=look*(1-lower)*.30;
    ears.forEach((ear,i)=>{ear.rotation.z=.045*Math.sin(time*1.7+phase+i)+.20*Math.pow(Math.max(0,Math.sin(time*1.14+phase+i*2.2)),18);ear.rotation.y=.11*Math.sin(time*.8+i*2.6+phase);});
    bones[tail].rotation.z=.10*Math.sin(time*.75+phase)+.32*Math.pow(Math.max(0,Math.sin(time*1.16+phase)),18);
    for(const l of legs){
      const t=cyc+(l.side>0?Math.PI:0)+(l.hind?-.46:Math.PI*.73);
      const lift=Math.max(0,Math.cos(t));
      l.upper.rotation.x=.34*walk*Math.sin(t);
      l.mid.rotation.x=walk*(l.hind?-.34:.28)*lift;
      l.hock.rotation.x=walk*(l.hind?.48:.33)*lift;
      l.foot.rotation.x=-.17*walk*Math.sin(t)-.13*walk*lift;
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
