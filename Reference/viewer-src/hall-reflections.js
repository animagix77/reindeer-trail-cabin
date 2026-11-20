import * as THREE from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';

const tileName=/(?:^|\| )Entry hall · charcoal-gray tile(?:\.\d+)?$/i;
const reflectionLayer=6;
const hallFittings=/front[ _]hall|shoe[ _](?:rack|bench)|front[ _](?:entrance|screen|door)/i;
const roomFinishes=/hall|entry runner|front (?:door|entrance|screen|sash)|room fabric|front bedroom|bedroom · muted|painted (?:cream casing|paneling|wood)|painted fascia|floor · photograph|clear glass|interior ·|barn doors|joinery ·|loft exposed|warm (?:opal shade|white worktop)|pendant · warm|island · (?:dark stained|honey pine)|kitchen (?:gable|worktops|shaker)|shutters ·|blue cedar shakes/i;

// Only the glazed tile samples this image. Grout, the striped runner and pine
// threshold retain their own materials and occlude the tile through the depth buffer.
function glaze(material,uniforms){
  const before=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,renderer){
    before.call(this,shader,renderer);
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nuniform mat4 hallProjection; varying vec4 hallPosition;')
      .replace('#include <project_vertex>','#include <project_vertex>\nhallPosition=hallProjection*modelMatrix*vec4(transformed,1.);');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nuniform sampler2D hallImage; uniform float hallVisible; varying vec4 hallPosition;')
      .replace('#include <opaque_fragment>',`
        if(hallVisible>0. && hallPosition.w>0.){
          vec2 uv=hallPosition.xy/hallPosition.w;
          vec2 margin=min(uv,1.-uv);
          float border=smoothstep(.002,.055,min(margin.x,margin.y));
          float grazing=1.-clamp(dot(normal,normalize(vViewPosition)),0.,1.);
          float glazeFresnel=.06+.84*pow(grazing,5.);
          // The satin glaze spreads the reflected doorway and baseboard edges.
          float mip=1.+3.1*roughnessFactor;
          vec3 reflected=textureLod(hallImage,clamp(uv,0.,1.),mip).rgb;
          outgoingLight=mix(outgoingLight,reflected,border*glazeFresnel*(1.-.50*roughnessFactor)*hallVisible);
        }
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=>key+'|local-hall-glaze';material.needsUpdate=true;
}

export function installHallReflections(world,model,renderer){
  if(!renderer.extensions.has('EXT_color_buffer_float'))return null;
  model.updateMatrixWorld(true);
  const tileBounds=new THREE.Box3(),bounds=new THREE.Box3(),materials=new Set();
  model.traverseVisible(mesh=>{
    if(!mesh.isMesh)return;
    const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    if(!list.some(m=>tileName.test(m.name)))return;
    if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
    tileBounds.union(bounds.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld));
    for(const m of list)if(tileName.test(m.name)&&m.isMeshStandardMaterial)materials.add(m);
  });
  if(!materials.size||tileBounds.isEmpty())return null;

  // A private camera layer contains the real door, trim, furniture, walls and
  // fixtures at this entrance. Animated doors retain their live transforms.
  const room=tileBounds.clone().expandByVector(new THREE.Vector3(2.2,3.2,3.2));
  room.min.y=tileBounds.max.y-.04;
  const size=new THREE.Vector3();
  model.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    if(list.some(m=>materials.has(m)) || (!hallFittings.test(mesh.name) && !list.some(m=>roomFinishes.test(m.name))))return;
    for(let owner=mesh;owner&&owner!==model;owner=owner.parent){
      if(/^(?:Walk(?:Surface|Block|Spawn)|Backdrop_|Canopy|Tax[ _]parcel|Site[ _]section)/i.test(owner.name))return;
    }
    if(!mesh.visible)return;
    if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
    bounds.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
    if(!room.intersectsBox(bounds))return;
    bounds.getSize(size);
    if(Math.max(size.x,size.z)>17.5 || size.y>7)return;
    mesh.layers.enable(reflectionLayer);
  });
  world.traverse(o=>{if(o.isLight)o.layers.enable(reflectionLayer);});

  const mobile=matchMedia('(pointer: coarse)').matches;
  // Reflector supplies an oblique near plane at the finished floor, excluding
  // the foundation underneath it. Its helper plane stays outside the scene.
  const mirror=new Reflector(new THREE.PlaneGeometry(1,1),{
    textureWidth:mobile?160:320,textureHeight:mobile?112:224,multisample:0,clipBias:.0001
  });
  mirror.rotation.x=-Math.PI/2;mirror.position.y=tileBounds.max.y;mirror.updateMatrixWorld(true);
  const target=mirror.getRenderTarget();
  target.texture.name='Entrance reflected above the tile';
  target.texture.generateMipmaps=true;target.texture.minFilter=THREE.LinearMipmapLinearFilter;
  const inversePlane=mirror.matrixWorld.clone().invert(),projection=new THREE.Matrix4();
  const uniforms={hallImage:{value:target.texture},hallProjection:{value:projection},hallVisible:{value:0}};
  for(const m of materials)glaze(m,uniforms);

  const eye=new THREE.Vector3(),rotation=new THREE.Quaternion(),frustum=new THREE.Frustum(),clip=new THREE.Matrix4();
  const hinges=['FrontDoorHinge','FrontScreenHinge'].map(name=>model.getObjectByName(name)).filter(Boolean)
    .map(hinge=>({hinge,closed:hinge.quaternion.clone(),captured:hinge.quaternion.clone()}));
  const sun=world.children.find(o=>o.isDirectionalLight),sunPosition=new THREE.Vector3();
  const flashlight=world.getObjectByName('Handheld flashlight');
  const floods=world.children.filter(o=>o.isSpotLight && o.name.endsWith(' motion flood')).map(lamp=>({lamp,power:0}));
  let last=-Infinity,fov=0,aspect=0,light=-1,flashPower=-1,skyColor=-1,sunPower=-1,refreshShadows=false;
  return {update(camera,walking,seconds,daylight){
    if(!walking || camera.position.y<=tileBounds.max.y+.08 || camera.position.y>tileBounds.max.y+2.45 ||
       tileBounds.distanceToPoint(camera.position)>4.5){uniforms.hallVisible.value=0;return;}
    camera.updateMatrixWorld();
    clip.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(clip);
    if(!frustum.intersectsBox(tileBounds)){uniforms.hallVisible.value=0;return;}
    const age=seconds-last,interval=(mobile || renderer.getPixelRatio()<.9) ? .24 : .12;
    const roomColor=world.fog?.color.getHex()??0,beam=flashlight?.intensity??0;
    const lightingChanged=beam!==flashPower || roomColor!==skyColor || daylight!==light ||
      (sun && (sunPower!==sun.intensity || !sunPosition.equals(sun.position)));
    let doorMoved=false,doorStopped=false;
    for(const leaf of hinges){
      const hinge=leaf.hinge.quaternion;
      if(leaf.captured.angleTo(hinge)<.002)continue;
      doorMoved=true;
      const opening=hinge.angleTo(leaf.closed);
      if(opening<.0001 || Math.abs(opening-Math.PI/2)<.0001)doorStopped=true;
    }
    const changed=doorMoved || (refreshShadows && !renderer.shadowMap.needsUpdate) ||
      floods.some(f=>Math.abs(f.lamp.intensity-f.power)>.08) ||
      eye.distanceToSquared(camera.position)>.000025 || rotation.angleTo(camera.quaternion)>.006 ||
      fov!==camera.fov || aspect!==camera.aspect;
    // A switched lamp, a new sky or a door reaching its stop must be visible
    // even if this input is the last frame rendered. A still room reuses its image.
    if(uniforms.hallVisible.value && !lightingChanged && !doorStopped && (!changed || age<interval))return;
    const shadowPending=renderer.shadowMap.needsUpdate,background=world.background;
    try{
      // Preserve pending shadow work for the main camera. A missed ray through
      // the open door sees the current outdoor haze beyond the local room.
      renderer.shadowMap.needsUpdate=false;
      if(world.fog?.color)world.background=world.fog.color;
      mirror.getReflectionCamera(camera).layers.set(reflectionLayer);
      mirror.onBeforeRender(renderer,world,camera);
    }finally{
      renderer.shadowMap.needsUpdate=shadowPending;world.background=background;
    }
    projection.copy(mirror.material.uniforms.textureMatrix.value).multiply(inversePlane);
    eye.copy(camera.position);rotation.copy(camera.quaternion);aspect=camera.aspect;fov=camera.fov;
    for(const leaf of hinges)leaf.captured.copy(leaf.hinge.quaternion);
    for(const f of floods)f.power=f.lamp.intensity;
    if(sun){sunPosition.copy(sun.position);sunPower=sun.intensity;}
    // The main view may update the daylight shadow immediately after this pass.
    refreshShadows=shadowPending;flashPower=beam;skyColor=roomColor;
    last=seconds;light=daylight;uniforms.hallVisible.value=1;
  }};
}
