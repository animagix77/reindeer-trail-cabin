import * as THREE from 'three';
import {installCafeLights} from './cafe-lights.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

import {atmosphere,createSky,validWeather} from './tour-sky.js';
import {installNightSky} from './night-sky.js';
import {installWeather} from './tour-weather.js';

// Capture the property's photo-textured roof, timber, tree crowns and ground once.
// Use albedo and a sky fill for the capture, so the probe cannot sample itself.
const reflectingSurfaces=/^(Grill ·|Front sash glass|Front basement window · glazing|Rear basement window · glazing|Fire ring · galvanized|Garden drain · galvanized|Patio stove · galvanized|Rear landing · galvanized|Propane cylinders|Suspension chains|Garden · steel|Path lights · aged pewter)/;
const scenery=/^(Backdrop_|Light.*broadleaf|Daylight broadleaf|Hardwood bark|Oak and maple|Leaf litter|Cool-season|Paved public road|Street gate|Uphill front court|Front motor court|Blue lap siding|Midnight blue siding|Entry wing|Entry ·|Garage ·|Asphalt shingle|Porch ·|Timber$|Deck boards|Rainwater goods|Painted (?:block|fascia)|Weathered (?:fieldstone|timber|railing)|Fire circle|Firewood|Fire pit|Glacial boulder|Adirondack|Roadside masonry|Fine crushed gravel|Rear landing · weathered|Utility apron)/i;

function yardReflection(model,renderer,point) {
  const proxy=new THREE.Scene(),swatches=new Map(),reflectors=new Set();
  const probeSky=createSky(proxy),air=atmosphere(13.5,'clear');
  // Put no second solar image in the polished grill. Actual direct light supplies the moving glint.
  probeSky.set({...air,direction:new THREE.Vector3(0,-1,0)});
  probeSky.place(point,true);
  const fill=new THREE.HemisphereLight(0xf2f7ff,0xa99a88,1.40);
  const key=new THREE.DirectionalLight(0xffedce,1.30);
  key.position.copy(air.direction);
  proxy.add(fill,key);
  function swatch(source) {
    if(!swatches.has(source)){
      const material=new THREE.MeshLambertMaterial({
        color:source.color,map:source.map,alphaMap:source.alphaMap,
        side:source.side,vertexColors:source.vertexColors,
        alphaTest:Math.max(source.alphaTest||0,source.transparent?.32:0)
      });
      swatches.set(source,material);
    }
    return swatches.get(source);
  }
  model.updateMatrixWorld(true);
  model.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const source=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    for(const mat of source)if(mat.isMeshStandardMaterial && reflectingSurfaces.test(mat.name))reflectors.add(mat);
    if(!source.every(mat=>scenery.test(mat.name)))return;
    // The diagram hides the woodland backdrop. It still surrounds the cabin when walking.
    for(let node=mesh;node && node!==model;node=node.parent)
      if(!node.visible && !/^Backdrop_/i.test(node.name))return;
    const part=new THREE.Mesh(mesh.geometry,Array.isArray(mesh.material)?source.map(swatch):swatch(source[0]));
    part.matrixAutoUpdate=false;
    part.matrix.copy(mesh.matrixWorld);
    proxy.add(part);
  });
  const generator=new THREE.PMREMGenerator(renderer);
  try{
    const target=generator.fromScene(proxy,0,.10,500,{size:256,position:point});
    target.texture.name='Rear deck and woodland reflection';
    return {target,reflectors};
  }finally{
    generator.dispose();
    probeSky.dispose();
    for(const material of swatches.values())material.dispose();
    proxy.clear();
  }
}

// The room environment supplies close indoor reflections, with a separate outdoor probe.
export function installTourLighting(scene,renderer,model,arrival) {
  const textureGenerator=new THREE.PMREMGenerator(renderer);
  const studio=new RoomEnvironment();
  const environment=textureGenerator.fromScene(studio,.045);
  studio.dispose();
  textureGenerator.dispose();
  scene.environment=environment.texture;
  scene.environmentIntensity=.34;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate=false;
  const sky=createSky(scene);
  const stars=installNightSky(scene);
  const weatherFX=installWeather(scene,model);
  const air=new THREE.FogExp2(0xd9e4e7,.0022);
  const hemisphere=new THREE.HemisphereLight(0xfff6e8,0xb3a28f,.91);
  scene.add(hemisphere);
  const sun=new THREE.DirectionalLight(0xfff0d3,2.19);
  sun.position.set(22,36,-17);sun.target.position.set(0,.8,0);
  sun.castShadow=true;
  Object.assign(sun.shadow.camera,{left:-29,right:29,top:29,bottom:-29,near:3,far:85});
  sun.shadow.camera.updateProjectionMatrix();
  const shadowSize=matchMedia('(pointer: coarse)').matches?2048:Math.min(4096,renderer.capabilities.maxTextureSize);
  sun.shadow.mapSize.set(shadowSize,shadowSize);
  sun.shadow.radius=1.35;
  sun.shadow.normalBias=.023;sun.shadow.bias=-.00017;
  scene.add(sun,sun.target);
  const daylightMaterials=new Map(),lampMaterials=new Map();
  const hiddenGeometry=/^(Walk(?:Surface|Block|Spawn)|Canopy|Backdrop)/i;
  model.traverse(obj=>{
    if(!obj.isMesh)return;
    const mats=Array.isArray(obj.material)?obj.material:[obj.material];
    for(const mat of mats) {
      if(mat.name==='Front sash glass · shaded street exposure'){
        // Outward faces show the darker street exposure in the owner photo.
        // Looking out from inside, preserve the original clear pane transmission.
        mat.side=THREE.DoubleSide;
        mat.forceSinglePass=true;
        mat.onBeforeCompile=shader=>{
          shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>',
            '#include <alphamap_fragment>\nif (!gl_FrontFacing) diffuseColor.a = 0.085;');
        };
      }
      if(/Backdrop_Hardwood cutouts|Daylight through rooflights|Kitchen fabric/i.test(mat.name))daylightMaterials.set(mat,mat.emissiveIntensity);
      if(/Warm opal shade|Frosted sconce shade|amber wire filaments|String bulbs|warm milk.glass shades/i.test(mat.name))lampMaterials.set(mat,mat.emissiveIntensity);
    }
    if(hiddenGeometry.test(obj.name))return;
    const isPane=mats.every(m=>m.transparent || /clear glass|sky glazing|window view/i.test(m.name));
    obj.castShadow=!isPane;
    obj.receiveShadow=true;
  });
  // Fixed light sources in plan feet; heights in metres relative to the finished floor.
  function fromPlan(x,y,h) {
    return new THREE.Vector3(4.65-.3048*(.995562*x+.094108*y),2.88+h,-8.5-.3048*(.094108*x-.995562*y));
  }
  const zones=[
    [10,26,2.25,0xffedd5,12,5.2],[4,16,3.12,0xffdfba,4,2.6],
    [25.3,25.2,1.69,0xfff0dc,8,4.5],
    [32.82,18.40,1.83,0xffe4bc,10,4.7],[32.82,21.70,1.83,0xffe4bc,10,4.7],
    [36.5,7.9,1.91,0xffe2ba,9,3.8],[5,7,1.89,0xffedcf,10,3.5],
    [16,7,1.92,0xffe7c8,10,3.5],[26.25,5.65,2.02,0xffedda,6,2.7],
    [30,2.8,1.96,0xffe2b8,8,3],[30,32,2.0,0xffd5a2,6,3.4]
  ].map(([x,y,z,color,power,range])=>({p:fromPlan(x,y,z),color,power,range}));
  const cafeLights=installCafeLights(scene,model);
  const lamps=Array.from({length:3},()=>{const l=new THREE.PointLight(0xffffff,0,4,2);scene.add(l);return l;});
  let zoneKey=null,stateKey='',lampGain=1,daylight=1,lowSun=0;
  let {hour,weather}=arrival;
  let yard=null,outdoor=false,roomGain=.34,skyGain=.62,metalGain=1;
  const reflectedSky={value:new THREE.Color(1,1,1)};
  function applyEnvironment(){
    scene.environment=outdoor && yard?yard.target.texture:environment.texture;
    scene.environmentIntensity=outdoor && yard?skyGain:roomGain;
  }
  function captureExterior(){
    if(yard)return;
    yard=yardReflection(model,renderer,fromPlan(34.9,39.2,.70));
    for(const m of yard.reflectors){
      m.envMap=yard.target.texture;
      m.envMapIntensity=metalGain;
      const previous=m.onBeforeCompile,cacheKey=m.customProgramCacheKey();
      m.onBeforeCompile=(shader,r)=>{
        previous.call(m,shader,r);
        shader.uniforms.cabinReflectedSky=reflectedSky;
        const ibl=THREE.ShaderChunk.envmap_physical_pars_fragment
          .replaceAll('envMapColor.rgb * envMapIntensity','envMapColor.rgb * cabinReflectedSky * envMapIntensity');
        shader.fragmentShader=shader.fragmentShader.replace('#include <envmap_physical_pars_fragment>',
          'uniform vec3 cabinReflectedSky;\n'+ibl);
      };
      m.customProgramCacheKey=()=>cacheKey+'|local-yard-reflection';
      m.needsUpdate=true;
    }
    applyEnvironment();
    renderer.shadowMap.needsUpdate=true;
  }
  function setConditions(conditions={}) {
    if(Number.isFinite(conditions.hour))hour=(conditions.hour%24+24)%24;
    if(validWeather(conditions.weather))weather=conditions.weather;
    const a=atmosphere(hour,weather);
    sky.set(a);stars.set(hour,a);
    lowSun=a.golden*(1-a.clouds);
    air.color.copy(a.horizon).lerp(a.sunTint,.42*lowSun);
    air.density=a.fog+.004*lowSun;
    renderer.toneMappingExposure=1.05+.16*lowSun;
    const availableLight=a.day*a.light;
    daylight=a.direction.y>0?availableLight:0;
    roomGain=.105+.36*availableLight;
    skyGain=.065+.78*availableLight+.13*a.blueHour*(1-a.clouds);
    metalGain=.075+1.24*availableLight+.16*a.blueHour*(1-a.clouds);
    reflectedSky.value.setRGB(1,1,1).lerp(new THREE.Color('#ffccb3'),a.golden*(1-.70*a.clouds)*.78)
      .lerp(new THREE.Color('#aabdff'),Math.max(a.blueHour,.72*(1-a.day)));
    if(yard)for(const m of yard.reflectors)m.envMapIntensity=metalGain;
    applyEnvironment();
    hemisphere.color.copy(a.skyTint);
    hemisphere.groundColor.copy(a.groundTint);
    hemisphere.intensity=.19+a.day*(.83+.28*a.clouds-.13*lowSun)+.22*a.blueHour*(1-.66*a.clouds);
    const lunar=a.direction.y<0;
    const lightDirection=a.direction.clone().multiplyScalar(lunar?-1:1);
    lightDirection.y=Math.max(lightDirection.y,.07);
    sun.position.copy(lightDirection.normalize().multiplyScalar(44)).add(sun.target.position);
    sun.color.copy(lunar?new THREE.Color(0xadc8f4):a.sunTint);
    sun.intensity=lunar
      ? .22*(1-a.day)*(1-.76*a.clouds)
      : (2.60+1.28*lowSun)*a.day*(1-.91*a.clouds)*THREE.MathUtils.smoothstep(a.direction.y,-.06,.16);
    for(const [m,base] of daylightMaterials)m.emissiveIntensity=base*(.04+.96*availableLight);
    for(const [m,base] of lampMaterials)m.emissiveIntensity=base*(1+1.65*(1-availableLight));
    cafeLights.set(availableLight);
    lampGain=1+.55*(1-availableLight);
    weatherFX.set(weather,.08+.92*availableLight);
    zoneKey=null;
    renderer.shadowMap.needsUpdate=true;
  }
  setConditions();
  return {
    sun,setConditions,captureExterior,
    get daylight(){return daylight;},
    get goldenHour(){return lowSun;},
    get animated(){return weatherFX.animated || stars.animated;},
    update(eye,mode,seconds=performance.now()/1000,camera,outdoors=false){
      const walking=mode!=='property';
      if((walking && outdoors)!==outdoor){outdoor=walking && outdoors;applyEnvironment();}
      sky.place(eye,walking);
      cafeLights.update(walking,renderer.domElement.height);
      if(camera)stars.update(camera,mode,seconds,renderer.getPixelRatio(),outdoors);
      // In the cutaway the eye orbits high above the landscape. Keep plan details legible.
      scene.fog=walking?air:null;
      weatherFX.update(eye,!walking,seconds,renderer.domElement.height);
      const k=mode+'|'+(model.userData.lightRevision||0);
      if(k!==stateKey){renderer.shadowMap.needsUpdate=true;stateKey=k;}
      const nearest=walking?zones.map((z,i)=>[i,z.p.distanceToSquared(eye)]).filter(([,d])=>d<58)
        .sort((a,b)=>a[1]-b[1]).slice(0,3).map(pair=>pair[0]):[];
      const key=nearest.join('/');
      if(key!==zoneKey) {
        zoneKey=key;
        lamps.forEach((l,i)=>{
          const z=zones[nearest[i]];
          l.intensity=z?z.power*lampGain:0;
          if(z){l.position.copy(z.p);l.color.set(z.color);l.distance=z.range;}
        });
      }
    }
  };
}
