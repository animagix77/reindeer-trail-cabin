import * as T from 'three';
import {coatOutdoorMaterial} from './tour-weather.js';

// Surface heights are metres. Keep existing normal maps for masonry joints,
// roof courses and milled boards; these values describe the finer photo detail.
const surfaces={
  litter:{relief:.012,scatter:true,exterior:true},
  aggregate:{relief:.006,scatter:true,exterior:true},
  paving:{relief:.0035,exterior:true},
  masonry:{relief:.004,exterior:true},
  stone:{relief:.004},
  slate:{relief:.00008},
  porcelain:{relief:.00028},
  cedar:{relief:.0013,exterior:true},
  bark:{relief:.006,exterior:true},
  oak:{relief:.0009,grain:true},
  satin:{relief:.00045,grain:true}
};
function surfaceType(name){
  if(/^(Leaf litter|Cool-season fescue)/i.test(name))return 'litter';
  if(/^(Fire circle · pale|Fine crushed gravel|Entry · blue-gray crushed)/i.test(name))return 'aggregate';
  if(/^(Paved public road|Front motor court|Street gate and upper court|Uphill front court|Concrete stairs · exposed|Rear landing · weathered concrete)/i.test(name))return 'paving';
  if(/^(Roadside masonry|Painted block|Asphalt shingle|Weathered fieldstone|Fieldstone shadows|Weathered stone highlights|Glacial boulder|Fire pit · (photographed aggregate|tumbled stone)|Utility apron · flagstone)/i.test(name))return 'masonry';
  if(name==='Room detail | Entry hall · charcoal-gray tile')return 'slate';
  if(name==='Bathroom · brushed greige floor porcelain')return 'porcelain';
  if(/split.face (shower|ledgestone)|Ledgestone split face/i.test(name))return 'stone';
  if(/^(Porch · natural sawn timber|Blue lap siding|Midnight blue siding|Entry wing · blue cedar shakes|Deck boards|Timber$|Adirondack slat|Weathered railing timber|Weathered timber ties|Garage · weathered timber|Entry · weathered cedar)/i.test(name))return 'cedar';
  if(/^(Hardwood bark|Oak and maple branchwood)/i.test(name))return 'bark';
  if(/^(Floor · photograph of clear-finished|Living · gray boards|Cabin furnishing • Storage table|Room detail \| Island · dark stained)/i.test(name))return 'satin';
  if(/knotty pine|Joinery · amber oak|Loft · stained|honey pine boarding|photographed walnut drawer|photographed weathered mirror|Media console · dark weathered grain|Master · weathered timber/i.test(name))return 'oak';
  return null;
}

function addMetricUV(mesh,wood){
  if(mesh.geometry.attributes.uv)return;
  const src=mesh.geometry,g=src.index?src.toNonIndexed():src.clone();
  const pos=g.attributes.position,uv=new Float32Array(2*pos.count);
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),u=new T.Vector3(),v=new T.Vector3(),normal=new T.Vector3();
  const edges=[new T.Vector3(),new T.Vector3(),new T.Vector3()];
  const points=[a,b,c];
  function axisSign(dir){
    const k=Math.abs(dir.x)>Math.abs(dir.y)?(Math.abs(dir.x)>Math.abs(dir.z)?'x':'z'):(Math.abs(dir.y)>Math.abs(dir.z)?'y':'z');
    if(dir[k]<0)dir.negate();
  }
  for(let i=0;i<pos.count;i+=3){
    for(let j=0;j<3;j++)points[j].fromBufferAttribute(pos,i+j).applyMatrix4(mesh.matrixWorld);
    edges[0].subVectors(b,a);edges[1].subVectors(c,b);edges[2].subVectors(a,c);
    normal.crossVectors(edges[0],edges[1]).normalize();
    if(wood){
      // Faces of the source posts, chairs and rails are triangulated quads.
      // Their longest triangle edge is the diagonal; the next edge is the grain.
      edges.sort((x,y)=>y.lengthSq()-x.lengthSq());u.copy(edges[1]).normalize();
      axisSign(u);v.crossVectors(normal,u).normalize();axisSign(v);
    }else{
      if(Math.abs(normal.y)>.68){u.set(1,0,0);v.set(0,0,1);}
      else{u.crossVectors(normal,new T.Vector3(0,1,0)).normalize();axisSign(u);v.set(0,1,0);}
    }
    for(let j=0;j<3;j++){uv[2*(i+j)]=points[j].dot(u)/(wood?2.6:.72);uv[2*(i+j)+1]=points[j].dot(v)/(wood?.36:.72);}
  }
  g.setAttribute('uv',new T.BufferAttribute(uv,2));mesh.geometry=g;
}

// Three textureGrad taps from the same photograph. Triangular blending removes
// the repeated square of stones/leaves; rotated derivatives keep correct mips.
const tileNoise=`
vec2 patchHash(vec2 id){
  return fract(sin(vec2(dot(id,vec2(27.17,113.61)),dot(id,vec2(317.89,17.43))))*42539.68);
}
vec4 patchSample(vec2 id,vec2 uv,vec2 dx,vec2 dy){
  vec2 seed=patchHash(id);float a=floor(seed.x*4.)*1.5707963;
  vec2 cs=vec2(cos(a),sin(a));mat2 rot=mat2(cs.x,cs.y,-cs.y,cs.x);
  return textureGrad(map,rot*uv+seed*5.17,rot*dx,rot*dy);
}
vec4 groundPhoto(vec2 uv){
  vec2 skew=vec2(uv.x+.57735*uv.y,1.15470*uv.y)*.73;
  vec2 id=floor(skew),f=fract(skew),dx=dFdx(uv),dy=dFdy(uv);
  float upper=step(1.,f.x+f.y);
  vec2 corner=id+vec2(upper);
  vec3 w=mix(vec3(1.-f.x-f.y,f.x,f.y),vec3(f.x+f.y-1.,1.-f.y,1.-f.x),upper);
  w*=w;w/=max(.0001,w.x+w.y+w.z);
  return w.x*patchSample(corner,uv,dx,dy)+w.y*patchSample(id+vec2(1,0),uv,dx,dy)+w.z*patchSample(id+vec2(0,1),uv,dx,dy);
}`;
function addRelief(m,type,substitute){
  const profile=surfaces[type];
  const previous=m.onBeforeCompile,key=m.customProgramCacheKey();
  m.onBeforeCompile=(shader,renderer)=>{
    previous.call(m,shader,renderer);
    if(profile.scatter)shader.fragmentShader=shader.fragmentShader.replace('#include <map_pars_fragment>','#include <map_pars_fragment>\n#ifdef USE_MAP\n'+tileNoise+'\n#endif');
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      float photoHeight=0.;
      #ifdef USE_MAP
        vec4 photo=${profile.scatter?'groundPhoto(vMapUv)':'texture2D(map,vMapUv)'};
        float photoLuma=dot(photo.rgb,vec3(.2126,.7152,.0722));
        photoHeight=clamp(log2(max(.022,photoLuma))*.31,-1.45,.12);
        ${substitute?'diffuseColor.rgb*=clamp(.99+.38*(photoHeight+.60),.72,1.23);':'diffuseColor*=photo;'}
      #endif`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        #ifdef USE_MAP
          ${type==='slate'
            ? 'roughnessFactor=clamp(roughnessFactor-.22*(photoHeight+1.01),.18,.32);'
            : 'roughnessFactor=clamp(roughnessFactor-.080*(photoHeight+.60),.17,1.);'}
        #endif`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        #ifdef USE_MAP
          // Screen-space height derivatives and position derivatives in metres
          // produce a scale-correct perturbation without uploading duplicate maps.
          vec3 px=dFdx(-vViewPosition),py=dFdy(-vViewPosition);
          vec3 r1=cross(py,normal),r2=cross(normal,px);
          float photoDet=dot(px,r1);
          vec3 slope=(dFdx(photoHeight)*r1+dFdy(photoHeight)*r2)*
            (${profile.relief.toFixed(6)}*sign(photoDet)/max(1.e-9,abs(photoDet)));
          normal=normalize(normal-slope*min(1.,.46/max(.001,length(slope))));
          // Fold subpixel normal variation into the microfacet width. Sharp
          // highlights on grain and stone then stay stable as the walker moves.
          vec3 normalDx=dFdx(normal),normalDy=dFdy(normal);
          float variance=min(.035,.20*(dot(normalDx,normalDx)+dot(normalDy,normalDy)));
          float alpha=roughnessFactor*roughnessFactor;
          roughnessFactor=sqrt(sqrt(alpha*alpha+variance));
        #endif`);
  };
  m.customProgramCacheKey=()=>key+'|surface-'+type+'-'+Number(substitute);
  m.needsUpdate=true;
}

// The exported sprays and distant crown atlases both have authored UV tangents.
// Use that direction to shade across the branch rather than across the carrier quad.
const canopyVertex=`
  #ifndef USE_TANGENT
    attribute vec4 tangent;
  #endif
  varying vec3 canopyAcross;
`;
const canopyFrame='canopyAcross=normalize(mat3(modelViewMatrix)*tangent.xyz);';

function distantCrowns(m){
  // The atlas already contains detail in the shade. Let the light define the
  // shape without adding the full baked color to every side of every tree.
  m.emissiveIntensity*=.48;
  const previous=m.onBeforeCompile,key=m.customProgramCacheKey();
  m.onBeforeCompile=(shader,renderer)=>{
    previous.call(m,shader,renderer);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>'+canopyVertex)
      .replace('#include <begin_vertex>','#include <begin_vertex>\n'+canopyFrame);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 canopyAcross;')
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        // Three trees share this atlas. Curve the light across the leafy crown,
        // preserving the original response on the trunk below the branches.
        float leafMask=smoothstep(.012,.07,sampledDiffuseColor.g-sampledDiffuseColor.b);
        float rim=fract(vMapUv.x*3.)*2.-1.;
        float height=1.-vMapUv.y;
        vec3 up=viewMatrix[1].xyz;
        vec3 crown=normalize(normal*(1.-.52*rim*rim)+canopyAcross*rim*1.4
                         +up*(height-.49)*2.2);
        normal=normalize(mix(normal,crown,leafMask*smoothstep(.19,.48,height)));
      `);
  };
  m.customProgramCacheKey=()=>key+'|rounded-hardwood-crown';m.needsUpdate=true;
}

function foliage(m,uniforms){
  m.transparent=false;m.depthWrite=true;m.alphaTest=.34;m.alphaToCoverage=true;
  m.forceSinglePass=true;
  const previous=m.onBeforeCompile,key=m.customProgramCacheKey();
  m.onBeforeCompile=(shader,renderer)=>{
    previous.call(m,shader,renderer);Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
      '#include <common>'+canopyVertex+'\nuniform float forestClock,branchBend;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        ${canopyFrame}
        vec3 p=(modelMatrix*vec4(position,1.)).xyz;
        float range=1.-smoothstep(17.,29.,distance(p,cameraPosition));
        float stem=clamp(1.-uv.y,0.,1.); // glTF V=1 is the twig end fixed to the tree
        float gust=sin(dot(p.xz,vec2(.24,.18))+forestClock*.94)+.31*sin(p.y*.82-forestClock*1.73);
        float flutter=sin(dot(p,vec3(2.3,1.7,.87))+2.9*forestClock);
        transformed+=range*branchBend*stem*vec3(.041*gust+.011*flutter,.008*flutter,.022*gust);
      `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 canopyAcross;')
      .replace('#include <map_fragment>',`#include <map_fragment>
        // Six green leaf colors and a brown twig are painted into each spray.
        // The palette provides stable blade orientations without another texture.
        float blade=smoothstep(.056,.13,sampledDiffuseColor.g-sampledDiffuseColor.b);
        float tone=clamp((sampledDiffuseColor.g-.19)*5.1,0.,1.);
      `)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=mix(roughnessFactor,mix(.62,.44,tone),blade);
      `)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec3 up=viewMatrix[1].xyz;
        float fold=sin(10.*tone+1.3)*(1.-smoothstep(.13,.48,fwidth(tone)));
        vec3 bladeNormal=normalize(normal+up*(.18+.40*tone)
          +canopyAcross*(.43*fold+.42*(vMapUv.x-.5)));
        normal=normalize(mix(normal,bladeNormal,blade));
      `)
      .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
        #if NUM_DIR_LIGHTS == 1 && defined(RE_Direct)
          // The cabin sun is the last punctual light accumulated by Three. Its
          // color already has the shadow at this leaf, including nearby branches.
          vec3 sunDir=directLight.direction;
          float back=smoothstep(-.16,.88,dot(-normal,sunDir));
          float towardSun=smoothstep(-.25,.92,dot(-normalize(vViewPosition),sunDir));
          // Thin leaf tissue transmits the warm part of incident sunlight.
          // Twigs are opaque, and overcast and moonlight follow their source intensity.
          reflectedLight.indirectDiffuse+=diffuseColor.rgb*directLight.color
            *vec3(.29,.33,.13)*blade*back*(.34+.66*towardSun);
        #endif`);
  };
  m.customProgramCacheKey=()=>key+'|folded-broadleaf-spray';m.needsUpdate=true;
}

// L1040636 shows an eggshell painted hall, a flat ivory ceiling, satin trim
// and a polished gray entry floor. The runner and grout stay diffuse.
const finishRoughness=new Map([
  ['Room detail | Hall paint, warm straw',.82],
  ['Interior · soft ivory vault',.96],
  ['Room detail | Painted cream casing',.48],
  ['Window frames · painted wood',.52],
  ['Room detail | Entry hall · dark joints',.92],
  ['Entry runner · photographed woven stripes',.94],
  ['Room detail | Entry hall · charcoal-gray tile',.235],
  ['Bathroom · brushed greige floor porcelain',.62]
]);
const brushedMetal=/^(Room detail \| (?:Brushed stainless|Bath · satin nickel)|Cabin furnishing • Brushed metal trim)$/;
function physicalFinish(material){
  if(material.isMeshPhysicalMaterial)return material;
  const finish=new T.MeshPhysicalMaterial();
  T.MeshStandardMaterial.prototype.copy.call(finish,material);
  finish.defines={STANDARD:'',PHYSICAL:''};
  return finish;
}

function wellFinish(model,material){
  let finish=material;
  switch(material.name){
    case 'Water well · cobalt enamel cap':
      finish=physicalFinish(material);
      // L1040557 shows a deep blue painted casting with a glossy rim.
      finish.metalness=0;
      finish.roughness=.34;
      finish.clearcoat=.70;
      finish.clearcoatRoughness=.17;
      break;
    case 'Water well · black conduit and gasket':
      finish.metalness=0;
      finish.roughness=.50;
      finish.color.set('#252725');
      break;
    case 'Water well · oxidized steel casing': {
      finish.color.set('#584d46');
      finish.metalness=.30;
      finish.roughness=.78;
      const previous=finish.onBeforeCompile,key=finish.customProgramCacheKey();
      finish.onBeforeCompile=(shader,renderer)=>{
        previous.call(finish,shader,renderer);
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 casingPosition;')
          .replace('#include <begin_vertex>','#include <begin_vertex>\ncasingPosition=(modelMatrix*vec4(position,1.)).xyz;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
          varying vec3 casingPosition;
          float oxidePatch(vec2 p){
            vec2 cell=floor(p),f=fract(p);
            f=f*f*(3.-2.*f);
            return mix(mix(rand(cell),rand(cell+vec2(1.,0.)),f.x),
                       mix(rand(cell+vec2(0.,1.)),rand(cell+vec2(1.)),f.x),f.y);
          }`)
          .replace('#include <map_fragment>',`#include <map_fragment>
            vec2 grain=vec2(dot(casingPosition.xz,vec2(.83,.56)),casingPosition.y);
            float oxide=.72*oxidePatch(grain*vec2(34.,18.))
                      +.28*oxidePatch(vec2(casingPosition.z-casingPosition.x,casingPosition.y)*87.);
            diffuseColor.rgb*=mix(vec3(.52,.59,.65),vec3(1.38,1.10,.88),oxide);
          `);
      };
      finish.customProgramCacheKey=()=>key+'|well-casing-oxide';
      break;
    }
  }
  coatOutdoorMaterial(model,finish);
  finish.needsUpdate=true;
  return finish;
}

export function installCabinSurfaces(model,renderer){
  model.updateMatrixWorld(true);
  const textures=new Map(),done=new Map(),fallbacks=new Set(),leafCells=new Map();
  const maximum=Math.min(renderer.capabilities.getMaxAnisotropy(),matchMedia('(pointer:coarse)').matches?4:8);
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const uniforms={forestClock:{value:0},branchBend:{value:0}};
  let wind=1;
  function materials(mesh){return Array.isArray(mesh.material)?mesh.material:[mesh.material];}
  model.traverse(mesh=>{
    if(!mesh.isMesh)return;
    for(const m of materials(mesh)){
      if(m.map)textures.set(m.name,m.map);
      for(const tex of [m.map,m.normalMap,m.roughnessMap])if(tex?.isTexture && maximum>1 && tex.anisotropy<maximum){tex.anisotropy=maximum;tex.needsUpdate=true;}
    }
  });
  const timber=textures.get('Porch · natural sawn timber'),rock=textures.get('Roadside masonry · lichen and rock-faced block'),bark=textures.get('Hardwood bark');
  model.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const source=materials(mesh),changed=source.map(m=>{
      if(!m.isMeshStandardMaterial)return m;
      if(m.name.startsWith('Water well ·')){
        if(!done.has(m))done.set(m,wellFinish(model,m));
        return done.get(m);
      }
      if(m.name==='Backdrop_Hardwood cutouts'){
        if(!done.has(m)){distantCrowns(m);done.set(m,m);}
        return m;
      }
      if(m.name==='Daylight broadleaf sprays'){
        if(!done.has(m)){foliage(m,uniforms);done.set(m,m);}
        mesh.castShadow=true;mesh.receiveShadow=true;
        const a=mesh.geometry.attributes.position,p=new T.Vector3();
        for(let i=0;i<a.count;i+=4){
          p.fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld);
          const x=Math.floor(p.x/6),y=Math.floor(p.y/6),z=Math.floor(p.z/6),key=x+','+y+','+z;
          if(!leafCells.has(key))leafCells.set(key,new T.Sphere(new T.Vector3(x*6+3,y*6+3,z*6+3),6.5));
        }
        return m;
      }
      if(brushedMetal.test(m.name)){
        addMetricUV(mesh,true);
        if(done.has(m))return done.get(m);
        const finish=physicalFinish(m);
        finish.anisotropy=.43;
        finish.roughness=Math.max(.28,m.roughness);
        done.set(m,finish);return finish;
      }
      if(finishRoughness.has(m.name))m.roughness=finishRoughness.get(m.name);
      const type=surfaceType(m.name);if(!type)return m;
      const profile=surfaces[type],wood=type==='cedar'||type==='bark';
      const fallback=type==='cedar'?timber:type==='bark'?bark:type==='masonry'?rock:null;
      if((!m.map && fallback) || fallbacks.has(m))addMetricUV(mesh,wood);
      if(done.has(m))return done.get(m);
      const substitute=!m.map && !!fallback;
      if(substitute){fallbacks.add(m);m.map=fallback;}
      if(!m.map)return m;
      let dest=m;
      if(profile.grain){
        dest=physicalFinish(m);
        dest.anisotropy=type==='satin'?.27:.18;
        dest.roughness=Math.min(m.roughness,type==='satin'?.44:.68);
        // The owner's living-to-dining photograph catches exterior light on
        // the clear-finished boards. The smoother varnish sits over the grain.
        if(/^(Floor · photograph of clear-finished|Living · gray boards)/.test(m.name)){
          dest.clearcoat=.5;
          dest.clearcoatRoughness=.24;
        }
      }
      if(profile.exterior)coatOutdoorMaterial(model,dest);
      addRelief(dest,type,substitute);done.set(m,dest);return dest;
    });
    mesh.material=Array.isArray(mesh.material)?changed:changed[0];
  });
  const clusters=[...leafCells.values()],frustum=new T.Frustum(),matrix=new T.Matrix4();
  return {
    setWeather(value){wind=value==='rain'?1.65:value==='snow'?.52:value==='cloudy'?1.16:1;},
    update(camera,view,seconds,outdoors=true){
      const animate=!motion.matches && view!=='property';
      uniforms.branchBend.value=animate?wind:0;
      if(!animate || !clusters.length)return false;
      uniforms.forestClock.value=seconds%4096;
      if(!outdoors)return false;
      matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(matrix);
      for(const cluster of clusters)if(camera.position.distanceToSquared(cluster.center)<27**2 && frustum.intersectsSphere(cluster))return true;
      return false;
    }
  };
}
