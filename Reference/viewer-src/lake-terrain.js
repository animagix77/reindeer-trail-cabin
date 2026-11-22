import * as T from 'three';
import survey from './lake-superior.json' with {type:'json'};

const xs=survey.x,ds=survey.d;
const bytes=Uint8Array.from(atob(survey.heightCm),c=>c.charCodeAt(0));
const cm=new DataView(bytes.buffer);
const height=(i,j)=>cm.getInt16((j*xs.length+i)*2,true)/100;
function interval(axis,x){
  let lo=0,hi=axis.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(axis[mid]<=x)lo=mid;else hi=mid;}
  return lo;
}
// The renderer and ride interpolate the same triangles on the USGS ground surface.
export function surface(x,d){
  const i=interval(xs,x),j=interval(ds,d);
  const u=T.MathUtils.clamp((x-xs[i])/(xs[i+1]-xs[i]),0,1);
  const v=T.MathUtils.clamp((d-ds[j])/(ds[j+1]-ds[j]),0,1);
  if(u+v<=1)return (1-u-v)*height(i,j)+u*height(i+1,j)+v*height(i,j+1);
  return (u+v-1)*height(i+1,j+1)+(1-v)*height(i+1,j)+(1-u)*height(i,j+1);
}
function drawTerrain(scene,tracks){
  const positions=[],colors=[],indices=[];
  ds.forEach((d,j)=>xs.forEach((x,i)=>{
    const y=height(i,j),lake=1-T.MathUtils.smoothstep(y,.015,.16);
    const far=T.MathUtils.smoothstep(d,120,260)*(1-lake);
    const edge=1-.86*far,shade=edge*(.98+.014*Math.sin(x*.49+d*.1));
    colors.push(shade*(.87-.28*lake),shade*(.91-.19*lake),shade*(.97-.09*lake));
    positions.push(x,y,-d);
    if(i+1<xs.length&&j+1<ds.length){const k=j*xs.length+i;indices.push(k,k+1,k+xs.length,k+1,k+xs.length+1,k+xs.length);}
  }));
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const snow=new T.MeshStandardMaterial({vertexColors:true,roughness:.98});
  snow.onBeforeCompile=s=>{
    s.vertexShader='varying vec3 hillPoint;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nhillPoint=position;');
    s.uniforms.runnerMarks={value:tracks.texture};
    s.uniforms.runnerUV={value:tracks.uv};
    s.fragmentShader='varying vec3 hillPoint; uniform sampler2D runnerMarks; uniform vec4 runnerUV;\n'+s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float d=-hillPoint.z, x=hillPoint.x;
      float lane=floor((x+0.75)/1.5);
      float bent=x-lane*1.5+.36*sin(d*.12+lane*2.)+.19*sin(d*.34+lane);
      float groove=abs(abs(bent)-.17);
      float edge=max(fwidth(bent),.012);
      float tracks=(1.-smoothstep(.022,.04+edge,groove))*(1.-smoothstep(8.,16.,abs(x)))*(1.-smoothstep(57.,73.,d));
      float grains=sin(x*13.1+d*1.1)*sin(d*8.1-x*3.3)/(1.+12.*length(fwidth(hillPoint.xz)));
      float broken=smoothstep(-.7,.6,sin(d*.53+lane)*.6+cos(d*.19-lane)*.7);
      float stepRow=floor(d/.70);
      float bootX=x+3.3+1.23*sin(d*.061)+.67*cos(d*.13)+.15*cos(stepRow*3.14159);
      float boot=1.-smoothstep(.72,1.1,length(vec2(bootX/.13,(fract(d/.70)-.5)*.70/.16)));
      diffuseColor.rgb*=1.-.04*tracks*(.25+.75*broken)-.15*boot*(1.-smoothstep(55.,68.,d))+.030*grains;
      vec3 mark=texture2D(runnerMarks,(vec2(x,d)-runnerUV.xy)*runnerUV.zw).rgb;
      diffuseColor.rgb*=1.-mark.r*vec3(.42,.34,.27)-mark.b*.08;
      diffuseColor.rgb+=vec3(.11,.12,.14)*mark.g*(1.-mark.b);
    `);
  };
  const mesh=new T.Mesh(geometry,snow);mesh.receiveShadow=true;scene.add(mesh);
}
function winterSky(scene){
  const sky=new T.Mesh(new T.SphereGeometry(830,32,18),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,
    vertexShader:`varying vec3 vSky;void main(){vSky=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 vSky;
      float hash(vec2 p){return fract(sin(dot(mod(p,256.),vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
      void main(){
        vec3 n=normalize(vSky);float h=max(0.,n.y);vec2 p=n.xz/(h+.17)*2.6;
        float f=noise(p)*.53+noise(p*2.12)*.27+noise(p*4.3)*.13+noise(p*8.7)*.07;
        vec3 color=mix(vec3(.83,.79,.70),vec3(.23,.39,.58),smoothstep(0.,.72,h));
        color=mix(color,mix(vec3(.47,.52,.57),vec3(.98,.93,.83),f),smoothstep(.32,.65,f)*.86);
        float sun=max(0.,dot(n,normalize(vec3(-.47,.20,-1.))));
        color+=vec3(.30,.20,.09)*pow(sun,18.)+vec3(1.7,1.32,.78)*smoothstep(.99985,.99997,sun);
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }`
  }));sky.renderOrder=-1;scene.add(sky);
}
function woodland(scene){
  let state=1546;
  const rand=()=>((state=(Math.imul(1664525,state)+1013904223)>>>0)/4294967296);
  // Side profiles preserve the fine branching of leafless hardwoods at lake scale.
  const dummy=new T.Object3D();
  for(let variant=0;variant<6;variant++){
    const canvas=document.createElement('canvas');canvas.width=384;canvas.height=512;
    const ctx=canvas.getContext('2d');ctx.lineCap='round';
    function branch(x,y,len,angle,width,level){
      const mid=angle+(rand()-.5)*.24,tip=mid+(rand()-.5)*.25;
      const mx=x+Math.sin(mid)*len*.55,my=y-Math.cos(mid)*len*.55;
      const tx=mx+Math.sin(tip)*len*.45,ty=my-Math.cos(tip)*len*.45;
      ctx.strokeStyle=level>3?'#463e38':'#544b43';ctx.lineWidth=Math.max(.57,width);
      ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(mx,my,tx,ty);ctx.stroke();
      if(level===0)return;
      branch(tx,ty,len*(.63+.10*rand()),tip+(rand()-.5)*.34,width*.68,level-1);
      const sign=rand()<.5?-1:1;
      branch(mx,my,len*(.55+.24*rand()),mid+sign*(.32+.49*rand()),width*.52,level-1);
      if(level>=5)branch(tx,ty,len*(.51+.18*rand()),tip-sign*(.32+.49*rand()),width*.47,level-1);
    }
    branch(192,509,135,(rand()-.5)*.12,7,8);
    for(let limb=0;limb<4;limb++){
      const side=limb%2?-1:1;
      branch(192,430-limb*27,70+rand()*19,side*(.51+rand()*.30),2.8-limb*.25,5);
    }
    const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;
    const subset=survey.canopies.filter((_,i)=>i%6===variant);
    const plane=new T.PlaneGeometry(.87,1);plane.translate(0,.5,0);
    const trees=new T.InstancedMesh(plane,new T.MeshBasicMaterial({map:tex,side:T.DoubleSide,alphaTest:.19}),subset.length*2);
    subset.forEach(([x,d,h],i)=>{
      const angle=rand()*Math.PI,spread=.89+rand()*.25;
      dummy.position.set(x,surface(x,d),-d);dummy.scale.set(h*spread,h*1.17,h*spread);
      for(let k=0;k<2;k++){dummy.rotation.y=angle+k*Math.PI/2;dummy.updateMatrix();trees.setMatrixAt(i*2+k,dummy.matrix);}
    });
    trees.castShadow=true;scene.add(trees);
  }
}
function beachBuilding(scene){
  const corners=survey.roof;
  const x=corners.reduce((n,p)=>n+p[0],0)/4,d=corners.reduce((n,p)=>n+p[1],0)/4;
  const length=Math.hypot(corners[1][0]-corners[2][0],corners[1][1]-corners[2][1]);
  const width=Math.hypot(corners[1][0]-corners[0][0],corners[1][1]-corners[0][1]);
  const building=new T.Group();building.position.set(x,surface(x,d),-d);
  building.rotation.y=Math.atan2(corners[1][1]-corners[2][1],corners[1][0]-corners[2][0]);scene.add(building);
  const timber=new T.MeshStandardMaterial({color:0x4d392f}),roof=new T.MeshStandardMaterial({color:0xe2e7e9}),trim=new T.MeshStandardMaterial({color:0x574c43});
  function box(w,h,b,x,y,z,mat){
    const part=new T.Mesh(new T.BoxGeometry(w,h,b),mat);part.position.set(x,y,z);
    part.castShadow=part.receiveShadow=true;building.add(part);return part;
  }
  box(length*.78,3.15,width-2,0,.95,0,timber);
  for(const sign of [-1,1]){
    const rise=1.65,half=width/2;
    box(length,.22,Math.hypot(half,rise),0,3.3,sign*half/2,roof).rotation.x=sign*Math.atan2(rise,half);
    for(const end of [-1,1])box(.22,3.4,.22,end*(length/2-1),.85,sign*(half-.7),trim);
  }
  box(.4,.8,.4,length*.21,4.15,-.8,trim);
  const railX=x-2,railD=d-9;
  for(let i=0;i<5;i++){
    const px=railX+i*2.25,pd=railD+i*.32,y=surface(px,pd);
    const p=new T.Mesh(new T.BoxGeometry(.16,1.1,.16),timber);p.position.set(px,y+.55,-pd);scene.add(p);
    if(i<4)for(const high of [.48,.95]){
      const r=new T.Mesh(new T.BoxGeometry(2.30,.12,.10),trim);r.position.set(px+1.12,y+high,-pd-.16);r.rotation.y=.14;scene.add(r);
    }
  }
}
export function makeHill(tracks){
  const scene=new T.Scene();scene.background=new T.Color(0xc6ccd1);scene.fog=new T.FogExp2(0xb9c2c7,.0019);
  scene.onBeforeRender=tracks.flush;
  winterSky(scene);drawTerrain(scene,tracks);woodland(scene);beachBuilding(scene);
  scene.add(new T.HemisphereLight(0xe4edff,0xa9b3c2,1.7));
  const sun=new T.DirectionalLight(0xffe4b9,1.6);sun.position.set(-56,30,-92);sun.target.position.set(0,0,-27);
  sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-70,right:70,top:58,bottom:-58,near:.5,far:215});sun.shadow.bias=-.001;
  scene.add(sun,sun.target);return scene;
}
