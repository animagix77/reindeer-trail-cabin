import * as THREE from 'three';

export const fuelDuration=Object.freeze({twigs:22,sticks:55,logs:120});
const fuelKinds=Object.keys(fuelDuration);

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
        // Only the hot, saturated parts of the photograph feed the halo. Its
        // dark logs, reflections in the glass and blue jets retain their color.
        float hot=smoothstep(.25,.91,bed.r)*smoothstep(.10,.37,bed.r-bed.b);
        float jet=smoothstep(.01,.19,bed.b-bed.g)*smoothstep(.62,.90,uv.y);
        float shimmer=.10*fuel+.06*sin(37.*uv.x-4.8*burnerTime);
        totalEmissiveRadiance*=bed*(.78+hot*.86+jet*.39)*(1.+mask*shimmer);
      #endif`
    );
  };
  material.customProgramCacheKey=()=>'inset-propane-burner-2';
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
  uniform float breeze;
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
      vec2 bend=vec2(.080*sin(h*6.4-fireTime*1.7)+.11*low,
                     .070*cos(h*5.1-fireTime*1.3)+.08*fine)*h;
      bend.x+=breeze*h*h;
      vec2 p=pos.xz-bend;
      float field=tongue(p,h,vec2(.025,.017),.91+.077*sin(fireTime*2.3),.166);
      field=max(field,tongue(p,h,vec2(-.135,.107),.71+.13*low,.114));
      field=max(field,tongue(p,h,vec2(.15,-.107),.77-.12*low,.127));
      field=max(field,tongue(p,h,vec2(-.133,-.11),.59+.062*sin(fireTime*2.9),.117));
      field+=(low*.152+fine*.085)*(.48+h);
      // Rolling sheets get thin at a turbulent fold. Gaps between them show
      // the other tongues and the charred logs through the orange fringes.
      float fold=.5+.5*sin(44.*p.x+27.*p.y+5.8*h+low*7.-fireTime*1.65);
      float shell=1.-smoothstep(.018,.083,field);
      float body=smoothstep(-.012,.041,field)*smoothstep(0.,.068,h)*(1.-smoothstep(.78,1.,h));
      float density=body*(.27+.73*shell)*(1.-.74*fold*fold*smoothstep(.10,.58,h));
      float opacity=1.-exp(-density*stepSize*15.*ignition);
      float hot=smoothstep(-.025,.125,field+.022-.046*h);
      float core=hot*hot*(1.-smoothstep(.11,.47,h))*(.59+.41*fold);
      vec3 color=mix(vec3(.89,.042,.007),vec3(3.15,.64,.035),hot);
      color+=vec3(3.0,2.16,.59)*core;
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
  const uniforms={fireTime:clock,ignition:{value:0},breeze:{value:0},localEye:{value:new THREE.Vector3()},noiseField:{value:texture}};
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

// The firewood in the export shares a finish with other outdoor objects.
// Keep the heat confined to the actual log surfaces inside the steel liner.
function fitLogEmbers(model,center,clock,heat) {
  for(const name of ['Charred wood','Fire pit · exposed split wood']){
    const material=meshWithMaterial(model,name)?.material;
    if(!material)continue;
    const compile=material.onBeforeCompile,cacheKey=material.customProgramCacheKey();
    material.onBeforeCompile=(shader,renderer)=>{
      compile.call(material,shader,renderer);
      Object.assign(shader.uniforms,{pitCenter:{value:center},coalTime:clock,coalHeat:heat});
      shader.vertexShader='varying vec3 logPosition;\nuniform vec3 pitCenter;\n'+shader.vertexShader
        .replace('#include <project_vertex>',`#include <project_vertex>
          logPosition=(modelMatrix*vec4(transformed,1.)).xyz-pitCenter;`);
      shader.fragmentShader='varying vec3 logPosition;\nuniform float coalTime,coalHeat;\n'+shader.fragmentShader
        .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
          if(coalHeat>.001 && dot(logPosition,logPosition)<.21){
            vec3 p=logPosition;
            // The lower pair and the upper pair lie across each other.
            vec2 grain=p.y<.098?vec2(.953,-.302):vec2(-.438,-.899);
            float u=dot(p.xz,grain),v=dot(p.xz,vec2(-grain.y,grain.x))+.72*p.y;
            vec2 fissure=vec2(u*12.+.18*sin(v*49.),v*57.+.24*sin(u*45.)+.16*sin(u*89.+v*13.));
            vec2 edge=abs(fract(fissure+.5)-.5),aa=clamp(fwidth(fissure),.01,.72);
            vec2 line=1.-smoothstep(vec2(.018)-aa*.28,vec2(.055)+aa*.40,edge);
            float cracks=max(line.y,.59*line.x);
            cracks=mix(cracks,.12,smoothstep(.25,.70,max(aa.x,aa.y)));
            float pockets=.43+.20*sin(u*25.+v*43.)+.17*cos(v*38.-u*16.)+.19*sin(v*76.+u*43.+sin(u*79.));
            float pulse=.88+.12*sin(coalTime*1.75+u*20.+v*46.);
            float glowing=smoothstep(.22,.83,pockets)*pulse*coalHeat;
            totalEmissiveRadiance+=glowing*(vec3(.25,.019,.004)+vec3(2.75,.42,.023)*cracks);
          }`);
    };
    material.customProgramCacheKey=()=>cacheKey+'|smoldering-log-grain';
    material.needsUpdate=true;
  }
}

function sparkStreak() {
  const profile=[[0,-1],[.48,-.56],[.88,-.12],[1,0],[0,.17]];
  const geometry=new THREE.LatheGeometry(profile.map(([r,h])=>new THREE.Vector2(r,h)),5);
  const position=geometry.getAttribute('position'), colors=[];
  for(let i=0;i<position.count;i++){
    const t=THREE.MathUtils.clamp(1.+position.getY(i),0,1);
    colors.push(1,.18+.82*t,.09+.91*t*t,t*t);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
  return geometry;
}

function fitFirePit(scene,model,ring,clock) {
  const bounds=new THREE.Box3().setFromObject(ring,true);
  const center=bounds.getCenter(new THREE.Vector3());
  center.y=bounds.min.y-.008;
  const group=new THREE.Group();
  group.position.copy(center);group.name='Outdoor fire';
  group.visible=false;scene.add(group);
  const rng=seededRandom(23150);
  const {flame,uniforms}=fireVolume(clock,group,rng);
  const puffs=smokePuffs(group,rng);
  const coalHeat={value:0};
  fitLogEmbers(model,center,clock,coalHeat);
  let skylight;
  const smokeTint=new THREE.Color();

  // Low glowing coals sit between the crossed charred logs that are already
  // present in the GLB. Additional tiny fragments break up the ember bed.
  const coalMat=new THREE.MeshBasicMaterial({color:0xffffff});
  const charcoal=new THREE.Color(0x30231e),amber=new THREE.Color(2.85,.41,.034),emberTint=new THREE.Color();
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
  const sparkMat=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
  const sparks=new THREE.InstancedMesh(sparkStreak(),sparkMat,13);
  sparks.name='Fire pit · sparks';sparks.frustumCulled=false;group.add(sparks);
  const seeds=Array.from({length:sparks.count},()=>({x:rng()*.32-.16,z:rng()*.32-.16,
    duration:2.2+rng()*3.9,offset:rng()*6,apex:.47+rng()*.84,radius:.0028+rng()*.004}));
  const tangent=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  const glow=new THREE.PointLight(0xff8632,0,4.8,2);
  glow.position.copy(center);glow.position.y+=.54;scene.add(glow);
  return {center,update(amount,heat,eye,time,pulse,weather,extraFuel) {
    group.visible=amount>.001 || heat>.006;
    glow.intensity=amount*(2.25+.26*pulse)*(1.+1.05*extraFuel)+heat*.23;
    coalHeat.value=heat;
    if(!group.visible)return;
    flame.visible=amount>.002;
    const wind=weather==='rain'?.76:weather==='snow'?.42:.30;
    uniforms.ignition.value=amount;
    uniforms.breeze.value=wind*.21;
    flame.scale.set(.80+.16*extraFuel,.94+.79*extraFuel,.80+.16*extraFuel);
    flame.updateWorldMatrix(true,false);
    flame.worldToLocal(uniforms.localEye.value.copy(eye));
    for(let i=0;i<flecks.length;i++){
      const [phase,brightness]=flecks[i];
      const flicker=.71+.20*Math.sin(2.6*time+phase)+.09*Math.cos(time*.94+3*phase);
      coals.setColorAt(i,emberTint.copy(charcoal).lerp(amber,heat*brightness*brightness*flicker));
    }
    coals.instanceColor.needsUpdate=true;
    const smoke=Math.max(amount*.66,heat*(1.15-.45*amount))*(1.+.46*extraFuel);
    smokeTint.set(0x9ea4a7);
    skylight??=scene.children.find(light=>light.isHemisphereLight);
    if(skylight)smokeTint.multiply(skylight.color).multiplyScalar(skylight.intensity);
    puffs.forEach(({puff,phase,drift})=>{
      const t=(time*.17+phase)%1;
      const curl=3.7*t+time*.44+drift*9;
      puff.position.set(wind*t*t+.18*Math.sin(curl)*t,
        .30+.17*amount+(1.72+.62*extraFuel)*t,.13*Math.cos(curl)*t+.08*t*t);
      puff.scale.setScalar(.14+1.03*t);
      puff.material.rotation=drift*9+Math.sin(curl)*.48;
      const scatter=amount*.16/(.12+puff.position.y*puff.position.y);
      puff.material.color.setRGB(smokeTint.r+scatter,smokeTint.g+scatter*.42,smokeTint.b+scatter*.14);
      puff.material.opacity=.22*smoke*Math.sin(t*Math.PI)**1.18;
    });
    seeds.forEach((seed,i)=>{
      const age=(time+seed.offset)%seed.duration;
      const t=Math.min(1,age/(seed.duration*.46));
      const size=t<1?seed.radius*amount*Math.sin(Math.PI*t)*(1.+.26*extraFuel):0;
      const xWave=t*7.+seed.offset,zWave=t*6.+seed.x*21;
      piece.position.set(seed.x+wind*.77*t*t+.037*Math.sin(xWave),
        .18+t*seed.apex*(1.+.48*extraFuel),seed.z+.045*Math.sin(zWave));
      tangent.set(wind*1.54*t+.259*Math.cos(xWave),seed.apex,.270*Math.cos(zWave)).normalize();
      piece.quaternion.setFromUnitVectors(up,tangent);
      piece.scale.set(size,size*(3.+4.*(1.-t)),size);piece.updateMatrix();
      sparks.setMatrixAt(i,piece.matrix);
      sparks.setColorAt(i,emberTint.setRGB(3.8-2.8*t,1.60*(1.-t)**2+.09,.31*(1.-t)**3+.008));
    });
    sparks.instanceMatrix.needsUpdate=true;
    sparks.instanceColor.needsUpdate=true;
  }};
}

export function installTourFires(scene,model) {
  model.updateMatrixWorld(true);
  const glass=meshWithMaterial(model,'Cabin furnishing • Charcoal firebox glazing');
  const ring=meshWithMaterial(model,'Fire ring · galvanized steel');
  const clock={value:0};
  const hearth=glass?fitHearth(scene,glass,clock):null;
  const pit=ring?fitFirePit(scene,model,ring,clock):null;
  const forward=new THREE.Vector3(),offset=new THREE.Vector3();
  let furnaceOn=true,pitOn=false,amount=0,from=0,startTime=null,heat=0,plume=0,previous=null,weather='clear';
  const fuel={twigs:0,sticks:0,logs:0};
  let fuelTime=null;
  function burnFuel(time=performance.now()*.001){
    time=Math.max(time,fuelTime??time);
    if(fuelTime!==null && pitOn){
      const elapsed=Math.max(0,time-fuelTime);
      for(const kind of fuelKinds)fuel[kind]=Math.max(0,fuel[kind]-elapsed);
    }
    fuelTime=time;
  }
  function fuelLevel(){
    const equivalent=kind=>Math.min(4,fuel[kind]/fuelDuration[kind]);
    return 1.-Math.exp(-(.23*equivalent('twigs')+.49*equivalent('sticks')+.87*equivalent('logs')));
  }
  function inView(camera,where,near,far,overview) {
    offset.subVectors(where,camera.position);
    const dist=offset.length();
    return dist<near || (dist<(overview?90:far) && offset.dot(forward)>.40*dist);
  }
  return {
    get energy(){return Math.min(1,amount+.12*heat);},
    get fuelLevel(){return fuelLevel();},
    get lit(){return pitOn;},
    addFuel(kind){
      if(!Object.hasOwn(fuelDuration,kind))return false;
      burnFuel();
      fuel[kind]=Math.min(8*fuelDuration[kind],fuel[kind]+fuelDuration[kind]);
      return true;
    },
    fuelSnapshot(){burnFuel();return {...fuel};},
    applyFuel(value){
      if(!value||!fuelKinds.every(k=>Number.isFinite(value[k])&&value[k]>=0))return false;
      for(const k of fuelKinds)fuel[k]=Math.min(8*fuelDuration[k],value[k]);
      fuelTime=performance.now()*.001;
      return true;
    },
    setWeather(value){weather=value;},
    setFurnaceOn(value){furnaceOn=!!value;},
    setFirePitOn(value){
      if(pitOn===!!value)return;
      burnFuel();
      pitOn=!!value;from=amount;startTime=null;
    },
    update(camera,mode,time=performance.now()*.001) {
      clock.value=time;
      burnFuel(time);
      const pulse=.58*Math.sin(8.9*time)+.26*Math.sin(12.3*time+.37)+.16*Math.sin(4.8*time);
      if(hearth)hearth.update(furnaceOn,1+.045*pulse);
      if(startTime===null)startTime=time;
      const progress=THREE.MathUtils.clamp((time-startTime)/(pitOn?1.45:.91),0,1);
      amount=THREE.MathUtils.lerp(from,Number(pitOn),progress*progress*(3-2*progress));
      const dt=previous===null?0:Math.max(0,time-previous);previous=time;
      heat=THREE.MathUtils.damp(heat,amount,amount>=heat?1.8:.58,dt);
      const targetPlume=pitOn?fuelLevel():0;
      plume=THREE.MathUtils.damp(plume,targetPlume,targetPlume>plume?1.35:.65,dt);
      if(!pitOn && amount===0 && heat<.006)heat=0;
      pit?.update(amount,heat,camera.position,time,pulse,weather,plume);
      camera.getWorldDirection(forward);
      return (hearth && furnaceOn && mode!=='property' && inView(camera,hearth.center,2.4,9,false))
        || (pit && ((progress<1 && from!==Number(pitOn))
          || ((pitOn || heat>.006) && inView(camera,pit.center,5.8,27,mode==='property')))) || false;
    }
  };
}
