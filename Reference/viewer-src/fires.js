import * as THREE from 'three';

// Both effects locate their fixtures in the exported model. Capture these faces
// before static batching so the glass and the top of the steel lip stay aligned.
function meshWithMaterial(model, name) {
  let result;
  model.traverse(mesh=>{
    if (mesh.isMesh && mesh.material?.name===name) result=mesh;
  });
  return result;
}

function seededRandom(seed) {
  return ()=>{
    seed=(Math.imul(1664525,seed)+1013904223)>>>0;
    return seed/4294967296;
  };
}

function fitHearth(scene,glass,clock) {
  const material=glass.material;
  const baseEmission=material.emissiveIntensity;
  // The owner's lit-window photograph supplies the logs, flame and blue gas
  // jets. Ripple only the emission channel, leaving the glass/Fresnel and metal
  // trim stationary. glTF UVs run from zero at the top to one at the bottom.
  material.onBeforeCompile=shader=>{
    shader.uniforms.burnerTime=clock;
    shader.fragmentShader='uniform float burnerTime;\n'+shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#ifdef USE_EMISSIVEMAP
        vec2 uv=vEmissiveMapUv;
        float fuel=sin(uv.x*24.0+burnerTime*2.95)*sin(uv.x*13.0-burnerTime*3.7);
        float mask=(1.0-smoothstep(.72,.985,uv.y))*smoothstep(.008,.092,uv.y);
        uv.x+=mask*(.0018*sin(uv.y*13.0+burnerTime*3.1)+.0009*fuel);
        uv.y+=mask*(.004*sin(uv.x*21.0-burnerTime*2.5)+.0028*fuel);
        vec3 bed=texture2D(emissiveMap,clamp(uv,.001,.999)).rgb;
        totalEmissiveRadiance*=bed*(1.0+mask*.118*fuel);
      #endif`
    );
  };
  material.customProgramCacheKey=()=>'inset-propane-burner-1';
  material.needsUpdate=true;
  const center=new THREE.Box3().setFromObject(glass,true).getCenter(new THREE.Vector3());
  const normal=new THREE.Vector3().fromBufferAttribute(glass.geometry.attributes.normal,0)
    .transformDirection(glass.matrixWorld);
  const glow=new THREE.PointLight(0xff9944,.45,1.8,2);
  glow.position.copy(center).addScaledVector(normal,-.06);
  scene.add(glow);
  return {center,update(on,pulse) {
    material.emissiveIntensity=on?baseEmission:0;
    glow.intensity=on ? .45*pulse : 0;
  }};
}

// Compact, repeatable noise for rising gas. A 2D lookup interpolated between
// neighboring slices gives the flame depth from every direction around the pit.
const flameVertex=`
  varying vec3 entryPoint;
  void main() {
    entryPoint=position;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
  }`;
const flameFragment=`
  uniform float fireTime;
  uniform float ignition;
  uniform vec3 localEye;
  uniform sampler2D noiseField;
  varying vec3 entryPoint;
  float noise3(vec3 p) {
    float slice=floor(p.y);
    vec2 shift=vec2(.367,.219);
    float a=texture2D(noiseField,p.xz+slice*shift).r;
    float b=texture2D(noiseField,p.xz+(slice+1.0)*shift).r;
    return mix(a,b,smoothstep(0.0,1.0,fract(p.y)));
  }
  float tongue(vec2 p,float h,vec2 foot,float height,float width) {
    return width*max(0.0,1.0-h/height)-length(p-foot)-max(0.0,h-height)*1.8;
  }
  void main() {
    vec3 dir=normalize(entryPoint-localEye);
    vec3 farWall=mix(vec3(-.5,0.,-.5),vec3(.5,1.,.5),step(vec3(0.),dir));
    vec3 inverseDir=vec3(1.0)/mix(vec3(-1.),vec3(1.),step(vec3(0.),dir))/max(abs(dir),vec3(.00001));
    vec3 distances=(farWall-entryPoint)*inverseDir;
    float end=min(distances.x,min(distances.y,distances.z));
    if (end<=0.0) discard;
    float stepSize=end/28.0;
    vec3 pos=entryPoint+dir*(stepSize*.5);
    float remaining=1.0;
    vec3 radiance=vec3(0.);
    for (int i=0;i<28;i++) {
      float h=pos.y/(.38+ignition*.62);
      vec3 advected=vec3(pos.x*.103,pos.y*5.2-fireTime*2.3,pos.z*.099);
      float low=noise3(advected)-.5;
      float fine=noise3(advected*2.13+vec3(.24,-fireTime*.37,.65))-.5;
      vec2 bend=vec2(.091*sin(h*6.4-fireTime*1.7)+.13*low,
                     .077*cos(h*5.1-fireTime*1.3)+.09*fine)*h;
      vec2 p=pos.xz-bend;
      float field=tongue(p,h,vec2(.025,.017),.91+.077*sin(fireTime*2.3),.166);
      field=max(field,tongue(p,h,vec2(-.135,.107),.71+.13*low,.114));
      field=max(field,tongue(p,h,vec2(.15,-.107),.77-.12*low,.127));
      field=max(field,tongue(p,h,vec2(-.133,-.11),.59+.062*sin(fireTime*2.9),.117));
      field+=(low*.194+fine*.108)*(.55+h);
      float density=smoothstep(-.010,.055,field)*smoothstep(0.,.065,h);
      float opacity=1.-exp(-density*stepSize*13.*ignition);
      float hot=smoothstep(-.042,.16,field+.027-.041*h);
      vec3 color=mix(vec3(1.52,.036,.002),vec3(2.75,.58,.018),hot);
      color=mix(color,vec3(4.10,1.57,.15),hot*hot*(1.-.62*h));
      radiance+=remaining*opacity*color;
      remaining*=1.-opacity;
      pos+=dir*stepSize;
    }
    float alpha=1.-remaining;
    if(alpha<.009)discard;
    gl_FragColor=vec4(radiance/max(.001,alpha),alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

function fireVolume(clock,group,rng) {
  const size=64;
  const pixels=Uint8Array.from({length:size*size},()=>Math.floor(rng()*256));
  const texture=new THREE.DataTexture(pixels,size,size,THREE.RedFormat);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=texture.minFilter=THREE.LinearFilter;
  texture.needsUpdate=true;
  const uniforms={fireTime:clock,ignition:{value:0},localEye:{value:new THREE.Vector3()},noiseField:{value:texture}};
  const material=new THREE.ShaderMaterial({uniforms,vertexShader:flameVertex,fragmentShader:flameFragment,
    transparent:true,depthWrite:false});
  const geometry=new THREE.BoxGeometry(1,1,1).translate(0,.5,0);
  const flame=new THREE.Mesh(geometry,material);
  flame.name='Fire pit · rising flame';
  flame.position.y=.066;
  flame.scale.set(.80,.94,.80);
  group.add(flame);
  return {flame,uniforms};
}

function smokePuffs(group,rng) {
  const size=64, pixels=new Uint8Array(size*size*4);
  // Overlapping feathered circles give the plume uneven, soft edges.
  const lobes=Array.from({length:13},()=>[rng()*.62-.31,rng()*.62-.31,.27+rng()*.30]);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const u=(x+.5)*2/size-1,v=(y+.5)*2/size-1;
    let alpha=0;
    for(const [dx,dy,r] of lobes) {
      const d=Math.max(0,1-((u-dx)**2+(v-dy)**2)/(r*r));
      alpha+=d*d*.42;
    }
    const i=4*(y*size+x);
    pixels.set([255,255,255,Math.round(255*Math.min(1,alpha))],i);
  }
  const texture=new THREE.DataTexture(pixels,size,size);
  texture.magFilter=texture.minFilter=THREE.LinearFilter;
  texture.needsUpdate=true;
  return Array.from({length:7},(_,i)=>{
    const mat=new THREE.SpriteMaterial({map:texture,color:0x9c9e98,transparent:true,depthWrite:false,rotation:rng()*6});
    const puff=new THREE.Sprite(mat);puff.name='Fire pit · smoke';
    group.add(puff);
    return {puff,phase:i/7,drift:rng()-.5};
  });
}

function fitFirePit(scene,ring,clock) {
  const bounds=new THREE.Box3().setFromObject(ring,true);
  const center=bounds.getCenter(new THREE.Vector3());
  center.y=bounds.min.y-.008;
  const group=new THREE.Group();
  group.position.copy(center);group.name='Outdoor fire';
  group.visible=false;scene.add(group);
  const rng=seededRandom(23150);
  const {flame,uniforms}=fireVolume(clock,group,rng);
  const puffs=smokePuffs(group,rng);

  // Low glowing coals sit between the crossed charred logs that are already
  // present in the GLB. Additional tiny fragments break up the ember bed.
  const coalMat=new THREE.MeshBasicMaterial({color:0xffffff});
  const charcoal=new THREE.Color(0x30231e),amber=new THREE.Color(0xff6d12),emberTint=new THREE.Color();
  const flecks=[];
  const coals=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),coalMat,35);
  const piece=new THREE.Object3D();
  for(let i=0;i<coals.count;i++){
    const angle=rng()*Math.PI*2,r=Math.sqrt(rng())*.275;
    piece.position.set(Math.cos(angle)*r,.038+rng()*.012,Math.sin(angle)*r);
    piece.rotation.set(rng()*.30,angle,rng()*.30);
    piece.scale.set(.014+rng()*.054,.013+rng()*.017,.015+rng()*.035);
    piece.updateMatrix();coals.setMatrixAt(i,piece.matrix);
    flecks.push([rng()*Math.PI*2,.33+.67*rng()]);coals.setColorAt(i,charcoal);
  }
  coals.name='Fire pit · ember bed';group.add(coals);
  const sparkMat=new THREE.MeshBasicMaterial({color:0xffbb54,depthWrite:false});
  const sparks=new THREE.InstancedMesh(new THREE.SphereGeometry(1,5,3),sparkMat,11);
  sparks.name='Fire pit · sparks';sparks.frustumCulled=false;group.add(sparks);
  const seeds=Array.from({length:sparks.count},()=>({x:rng()*.32-.16,z:rng()*.32-.16,
    duration:2.7+rng()*3.4,offset:rng()*6,apex:.65+rng()*.53}));
  const glow=new THREE.PointLight(0xff8632,0,4.8,2);
  glow.position.copy(center);glow.position.y+=.54;scene.add(glow);
  return {center,update(amount,heat,eye,time,pulse,weather) {
    group.visible=amount>.001 || heat>.006;
    glow.intensity=amount*(2.15+.32*pulse)+heat*.21;
    if(!group.visible)return;
    flame.visible=amount>.002;
    uniforms.ignition.value=amount;
    flame.worldToLocal(uniforms.localEye.value.copy(eye));
    for(let i=0;i<flecks.length;i++){
      const [phase,brightness]=flecks[i];
      const flicker=.71+.20*Math.sin(2.6*time+phase)+.09*Math.cos(time*.94+3*phase);
      coals.setColorAt(i,emberTint.copy(charcoal).lerp(amber,heat*brightness*flicker));
    }
    coals.instanceColor.needsUpdate=true;
    const wind=weather==='rain'?.76:weather==='snow'?.42:.30;
    const smoke=Math.max(amount*.66,heat*(1.15-.45*amount));
    puffs.forEach(({puff,phase,drift})=>{
      const t=(time*.17+phase)%1;
      const curl=3.7*t+time*.44+drift*9;
      puff.position.set(wind*t*t+.18*Math.sin(curl)*t,
        .30+.17*amount+1.72*t,.13*Math.cos(curl)*t+.08*t*t);
      puff.scale.setScalar(.14+1.03*t);
      puff.material.rotation=drift*9+Math.sin(curl)*.48;
      puff.material.opacity=.19*smoke*Math.sin(t*Math.PI)**1.35;
    });
    seeds.forEach((seed,i)=>{
      const age=(time+seed.offset)%seed.duration;
      const t=Math.min(1,age/(seed.duration*.57));
      const gust=Math.sin(.78*(time-age))*.5+.5;
      const size=t<1?(.0024+.0048*gust*gust)*Math.sin(Math.PI*t)*amount:0;
      piece.position.set(seed.x+wind*.77*t*t+.033*Math.sin(t*7+seed.offset),
        .18+t*seed.apex,seed.z+.045*Math.sin(t*6+seed.x*21));
      piece.rotation.set(0,0,.1*Math.sin(t*5));
      piece.scale.set(size,size*2.4,size);piece.updateMatrix();
      sparks.setMatrixAt(i,piece.matrix);
    });
    sparks.instanceMatrix.needsUpdate=true;
  }};
}

export function installTourFires(scene,model) {
  model.updateMatrixWorld(true);
  const glass=meshWithMaterial(model,'Cabin furnishing • Charcoal firebox glazing');
  const ring=meshWithMaterial(model,'Fire ring · galvanized steel');
  const clock={value:0};
  const hearth=glass?fitHearth(scene,glass,clock):null;
  const pit=ring?fitFirePit(scene,ring,clock):null;
  const forward=new THREE.Vector3(),offset=new THREE.Vector3();
  let furnaceOn=true,pitOn=false,amount=0,from=0,startTime=null,heat=0,previous=null,weather='clear';
  function inView(camera,where,near,far,overview) {
    offset.subVectors(where,camera.position);
    const dist=offset.length();
    return dist<near || (dist<(overview?90:far) && offset.dot(forward)>.40*dist);
  }
  return {
    get energy(){return Math.min(1,amount+.12*heat);},
    setWeather(value){weather=value;},
    setFurnaceOn(value){furnaceOn=!!value;},
    setFirePitOn(value){
      if(pitOn===!!value)return;
      pitOn=!!value;from=amount;startTime=null;
    },
    update(camera,mode,time=performance.now()*.001) {
      clock.value=time;
      const pulse=.58*Math.sin(8.9*time)+.26*Math.sin(12.3*time+.37)+.16*Math.sin(4.8*time);
      if(hearth)hearth.update(furnaceOn,1+.045*pulse);
      if(startTime===null)startTime=time;
      const progress=THREE.MathUtils.clamp((time-startTime)/(pitOn?1.45:.91),0,1);
      amount=THREE.MathUtils.lerp(from,Number(pitOn),progress*progress*(3-2*progress));
      const dt=previous===null?0:Math.max(0,time-previous);previous=time;
      heat=THREE.MathUtils.damp(heat,amount,amount>=heat?1.8:.58,dt);
      if(!pitOn && amount===0 && heat<.006)heat=0;
      pit?.update(amount,heat,camera.position,time,pulse,weather);
      camera.getWorldDirection(forward);
      return (hearth && furnaceOn && mode!=='property' && inView(camera,hearth.center,2.4,9,false))
        || (pit && ((progress<1 && from!==Number(pitOn))
          || ((pitOn || heat>.006) && inView(camera,pit.center,5.8,27,mode==='property')))) || false;
    }
  };
}
