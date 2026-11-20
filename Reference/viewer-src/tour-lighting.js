import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

import {atmosphere,createSky,validWeather} from './tour-sky.js';
import {installWeather} from './tour-weather.js';

// RoomEnvironment gives the brushed metal, glazing and table edges genuine reflected highlights.
export function installTourLighting(scene,renderer,model) {
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
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  const sky=createSky(scene);
  const weatherFX=installWeather(scene,model);
  const air=new THREE.FogExp2(0xd9e4e7,.0022);
  const hemisphere=new THREE.HemisphereLight(0xfff6e8,0xb3a28f,.91);
  scene.add(hemisphere);
  const sun=new THREE.DirectionalLight(0xfff0d3,2.19);
  sun.position.set(22,36,-17);sun.target.position.set(0,.8,0);
  sun.castShadow=true;
  Object.assign(sun.shadow.camera,{left:-29,right:29,top:29,bottom:-29,near:3,far:85});
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.normalBias=.023;sun.shadow.bias=-.00017;
  scene.add(sun,sun.target);
  const daylightMaterials=new Map(),lampMaterials=new Map();
  const hiddenGeometry=/^(Walk(?:Surface|Block|Spawn)|Canopy|Backdrop)/i;
  model.traverse(obj=>{
    if(!obj.isMesh)return;
    const mats=Array.isArray(obj.material)?obj.material:[obj.material];
    for(const mat of mats) {
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
  const lamps=Array.from({length:3},()=>{const l=new THREE.PointLight(0xffffff,0,4,2);scene.add(l);return l;});
  let zoneKey=null,stateKey='',lampGain=1;
  let hour=14,weather='clear';
  function setConditions(conditions={}) {
    if(Number.isFinite(conditions.hour))hour=(conditions.hour%24+24)%24;
    if(validWeather(conditions.weather))weather=conditions.weather;
    const a=atmosphere(hour,weather);
    sky.set(a);
    air.color.copy(a.horizon);
    air.density=a.fog;
    const availableLight=a.day*a.light;
    scene.environmentIntensity=.065+.275*availableLight;
    hemisphere.color.copy(a.skyTint);
    hemisphere.groundColor.set(0x586581).lerp(new THREE.Color(0xb3a28f),a.day);
    hemisphere.intensity=.15+a.day*(.76+.18*a.clouds);
    const lunar=a.direction.y<0;
    const lightDirection=a.direction.clone().multiplyScalar(lunar?-1:1);
    lightDirection.y=Math.max(lightDirection.y,.07);
    sun.position.copy(lightDirection.normalize().multiplyScalar(44)).add(sun.target.position);
    sun.color.copy(lunar?new THREE.Color(0xadc8f4):a.sunTint);
    sun.intensity=lunar
      ? .22*(1-a.day)*(1-.76*a.clouds)
      : 2.19*a.day*(1-.91*a.clouds)*THREE.MathUtils.smoothstep(a.direction.y,-.04,.20);
    for(const [m,base] of daylightMaterials)m.emissiveIntensity=base*(.04+.96*availableLight);
    for(const [m,base] of lampMaterials)m.emissiveIntensity=base*(1+1.65*(1-availableLight));
    lampGain=1+.55*(1-availableLight);
    weatherFX.set(weather,.08+.92*availableLight);
    zoneKey=null;
    renderer.shadowMap.needsUpdate=true;
  }
  setConditions();
  return {
    setConditions,
    get animated(){return weatherFX.animated;},
    update(eye,mode,seconds=performance.now()/1000){
      const walking=mode!=='property';
      sky.place(eye,walking);
      // In the cutaway the eye orbits high above the landscape. Keep plan details legible.
      scene.fog=walking?air:null;
      weatherFX.update(eye,!walking,seconds,renderer.domElement.height);
      const k=mode+'|'+(model.userData.lightRevision||0);
      if(k!==stateKey){renderer.shadowMap.needsUpdate=true;stateKey=k;}
      const nearest=walking?zones.map((z,i)=>[i,z.p.distanceToSquared(eye)]).filter(pair=>pair[1]<58)
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
