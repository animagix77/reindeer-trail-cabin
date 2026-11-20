import * as THREE from 'three';

// Project the actual roof, skylight glazing and porch canopies onto a small height
// field. This keeps weather outside at doorways while letting guests see it through glass.
function roofCover(model) {
  const triangles=[];
  const bounds=new THREE.Box3();
  const point=new THREE.Vector3();
  model.traverse(mesh=>{
    if(!mesh.isMesh) return;
    let node=mesh;
    while(node && !/^Roof.*(?:North.wing|north.pitch.to.entry|entry.cross.gable.shingles|South.wing|covered.deck.canopy|entry.gable.canopy)|^Skylight.*opal.daylight.glazing/i.test(node.name)) node=node.parent;
    if(!node) return;
    const {index,attributes:{position}}=mesh.geometry;
    for(let i=0;i<(index?.count??position.count);i+=3) {
      const tri=[];
      for(let j=0;j<3;j++){
        point.fromBufferAttribute(position,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld);
        bounds.expandByPoint(point);
        tri.push(point.clone());
      }
      triangles.push(tri);
    }
  });
  if(bounds.isEmpty()) bounds.set(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,1,1));
  bounds.expandByScalar(.12);
  const span=bounds.getSize(new THREE.Vector3());
  const width=256,height=256;
  const pixels=new Uint8Array(width*height);
  for(const tri of triangles) {
    const [a,b,c]=tri.map(p=>new THREE.Vector3((p.x-bounds.min.x)*width/span.x,p.y,(p.z-bounds.min.z)*height/span.z));
    const cross=(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
    if(Math.abs(cross)<1e-7) continue;
    const x0=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),x1=Math.min(width-1,Math.ceil(Math.max(a.x,b.x,c.x)));
    const z0=Math.max(0,Math.floor(Math.min(a.z,b.z,c.z))),z1=Math.min(height-1,Math.ceil(Math.max(a.z,b.z,c.z)));
    for(let z=z0;z<=z1;z++) for(let x=x0;x<=x1;x++) {
      const dx=x+.5-a.x,dz=z+.5-a.z;
      const u=(dx*(c.z-a.z)-dz*(c.x-a.x))/cross;
      const v=((b.x-a.x)*dz-(b.z-a.z)*dx)/cross;
      if(u<-.00001 || v<-.00001 || u+v>1.00001) continue;
      const y=a.y+u*(b.y-a.y)+v*(c.y-a.y);
      const offset=z*width+x;
      pixels[offset]=Math.max(pixels[offset],Math.round((y-bounds.min.y)*254/span.y)+1);
    }
  }
  const map=new THREE.DataTexture(pixels,width,height,THREE.RedFormat);
  map.needsUpdate=true;
  return {
    coverMap:{value:map},
    coverUV:{value:new THREE.Vector4(bounds.min.x,bounds.min.z,1/span.x,1/span.z)},
    coverY:{value:new THREE.Vector2(bounds.min.y,span.y)}
  };
}

const shelterGLSL=`
uniform sampler2D coverMap;
uniform vec4 coverUV;
uniform vec2 coverY;
bool sheltered(vec3 worldPos, float tolerance) {
  vec2 uv=(worldPos.xz-coverUV.xy)*coverUV.zw;
  if (any(lessThan(uv,vec2(0.))) || any(greaterThan(uv,vec2(1.)))) return false;
  float sampleHeight=texture2D(coverMap,uv).r;
  float height=coverY.x+(sampleHeight*255.-1.)*coverY.y/254.;
  return sampleHeight>0. && worldPos.y<height+tolerance;
}`;

function applySurfaceWeather(material,uniforms) {
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
      '#include <common>\nvarying vec3 weatherWorldPosition;')
      .replace('#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nweatherWorldPosition=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
      '#include <common>\nvarying vec3 weatherWorldPosition;\nuniform float wetness;\nuniform float snowCover;\n'+shelterGLSL)
      .replace('#include <roughnessmap_fragment>',`
        #include <roughnessmap_fragment>
        if ((snowCover+wetness)>0. && !sheltered(weatherWorldPosition,-.09)) {
          float slope=abs(normalize(cross(dFdx(weatherWorldPosition),dFdy(weatherWorldPosition))).y);
          float coverage=smoothstep(.48,.92,slope);
          diffuseColor.rgb*=1.-wetness*coverage*.29;
          roughnessFactor=mix(roughnessFactor,.37,wetness*coverage*.76);
          float texturePattern=dot(diffuseColor.rgb,vec3(.24,.57,.19));
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.73,.79,.83),
            snowCover*coverage*(.42+.49*smoothstep(.005,.28,texturePattern)));
        }`);
  };
  material.customProgramCacheKey=()=>'exterior-weather-v1';
}

export function installWeather(scene,model) {
  const weatherSurface={
    ...roofCover(model),
    wetness:{value:0},
    snowCover:{value:0}
  };
  const treated=new Set();
  model.traverse(mesh=>{
    if(!mesh.isMesh) return;
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    for(const m of materials){
      if(treated.has(m) || !m.isMeshStandardMaterial) continue;
      if(/^(?:Asphalt shingle|Leaf litter|Cool-season fescue|Fine crushed gravel|Fire circle · pale|Paved public road|Porch · natural sawn timber|Entry · blue-gray crushed|Backdrop_Woodland floor)/i.test(m.name)) {
        applySurfaceWeather(m,weatherSurface);
        treated.add(m);
      }
    }
  });

  // Each instance is a world-anchored drop or flake in a repeating outdoor volume.
  // Wrapping around the eye avoids new particle allocations or sudden camera-relative motion.
  const count=5200;
  const geom=new THREE.InstancedBufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,1,-1,0,-1,1,0,1,1,0],3));
  geom.setIndex([0,1,2,2,1,3]);
  const seeds=new Float32Array(count*4);
  let state=296113;
  for(let i=0;i<seeds.length;i++) {
    state=(Math.imul(1664525,state)+1013904223)>>>0;
    seeds[i]=state/4294967296;
  }
  geom.setAttribute('seed',new THREE.InstancedBufferAttribute(seeds,4));
  geom.instanceCount=count;
  const uniforms={...weatherSurface,
    anchor:{value:new THREE.Vector3()},time:{value:0},snow:{value:0},
    skyBrightness:{value:1},pixelHeight:{value:800},extent:{value:23}
  };
  const material=new THREE.ShaderMaterial({
    uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,
    vertexShader:`
      attribute vec4 seed;
      uniform vec3 anchor; uniform float time,snow,pixelHeight,extent;
      varying vec2 vUv; varying float vAlpha; varying vec3 weatherPosition;
      void main(){
        float speed=mix(5.6+3.2*seed.w,.56+.47*seed.w,snow);
        float t=time+77.*seed.w;
        vec3 size=vec3(extent,14.,extent);
        vec2 drift=mix(vec2(.49,.21)*t,
          vec2(.26*t+.46*sin(t*.85+12.*seed.x),.10*t+.33*cos(t*.67+8.*seed.z)),snow);
        vec3 p=seed.xyz*size+vec3(drift.x,-speed*t,drift.y);
        p=anchor+mod(p-anchor+.5*size,size)-.5*size;
        vec4 clip=viewMatrix*vec4(p,1.);
        float depth=max(.01,-clip.z);
        float pixel=2.*depth/(pixelHeight*projectionMatrix[1][1]);
        vec3 right=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
        vec3 up=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
        float radius=min(.048,max(.009+.012*seed.w,pixel*.77));
        vec3 offset=mix(right*position.x*max(.0048,.83*pixel)+vec3(-.022,.16+.09*seed.z,-.011)*position.y,
          radius*(right*position.x+up*position.y),snow);
        weatherPosition=p+offset;
        vUv=position.xy;
        float edge=max(abs(p.x-anchor.x),abs(p.z-anchor.z))/(.5*extent);
        vAlpha=(1.-smoothstep(.76,1.,edge))*smoothstep(.22,.9,depth);
        gl_Position=projectionMatrix*viewMatrix*vec4(weatherPosition,1.);
      }`,
    fragmentShader:`
      ${shelterGLSL}
      uniform float skyBrightness,snow;
      varying vec2 vUv; varying float vAlpha; varying vec3 weatherPosition;
      void main(){
        if(vAlpha<=.008 || sheltered(weatherPosition,.025))discard;
        float rainAlpha=(1.-smoothstep(.12,1.,abs(vUv.x)))*(1.-vUv.y*vUv.y)*.45;
        float flakeAlpha=(1.-smoothstep(.38,1.,length(vUv)))*.82;
        float alpha=vAlpha*mix(rainAlpha,flakeAlpha,snow);
        if(alpha<.009)discard;
        vec3 light=mix(vec3(.24,.33,.43),vec3(.75,.83,.89),skyBrightness);
        gl_FragColor=vec4(light,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const particles=new THREE.Mesh(geom,material);
  particles.name='Weather outside the cabin';
  particles.visible=false;particles.frustumCulled=false;
  scene.add(particles);
  return {
    set(weather,brightness) {
      uniforms.wetness.value=weather==='rain'?1:0;
      uniforms.snowCover.value=weather==='snow'?1:0;
      uniforms.skyBrightness.value=brightness;
      uniforms.snow.value=weather==='snow'?1:0;
      particles.visible=weather==='rain'||weather==='snow';
    },
    update(eye,overview,seconds,bufferHeight) {
      if(!particles.visible) return;
      uniforms.time.value=seconds%86400;
      uniforms.pixelHeight.value=Math.max(1,bufferHeight);
      if(overview) uniforms.anchor.value.set(0,5,0);
      else uniforms.anchor.value.copy(eye);
      uniforms.extent.value=overview?40:23;
    },
    get animated(){return particles.visible;}
  };
}
