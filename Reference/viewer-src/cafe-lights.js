import * as THREE from 'three';
import {bulbCenters} from './tree-lights.js';

// Mounts in Exterior site.py. Take the suspension heights from the exported
// fixture and pole markers so the motion follows the grade of the yard.
function cordMounts(model,fromPlan){
  const deck=model.getObjectByName('FestoonPool_Deck');
  const pergola=model.getObjectByName('FestoonPool_Pergola');
  if(!deck || !pergola)return [];
  const high=deck.getWorldPosition(new THREE.Vector3()).y+.20;
  const beam=pergola.getWorldPosition(new THREE.Vector3()).y+.20;
  const pins=[];
  function pin(x,y,height){
    const point=fromPlan(x,y,0);point.y=height;pins.push(point);
  }
  for(const x of [23.30,32.00,40.70]){
    pin(x,35.84,high);pin(x,35.89,high-1.146);
  }
  pin(23.30,35.87,high);
  for(const x of [34.71,35.29])
    for(const y of [48.325,54.1,59.875])pin(x,y,beam);
  for(const id of [0,1]){
    const post=model.getObjectByName('WalkBlock_LightPole'+id);
    if(!post)continue;
    const bounds=new THREE.Box3().setFromObject(post);
    const top=bounds.getCenter(new THREE.Vector3());top.y=bounds.max.y+.04;pins.push(top);
  }
  return pins;
}

// Bake two relative shapes into the existing meshes once. The renderer blends
// them from the rest pose. Its regular morph path also keeps them out of the
// static batch and works for both the amber filament and transparent glass.
function addSwayShapes(part,roots,pins){
  const geometry=part.geometry,positions=geometry.getAttribute('position');
  const targets=[new Float32Array(positions.count*3),new Float32Array(positions.count*3)];
  const point=new THREE.Vector3(),offset=new THREE.Vector3();
  const toLocal=new THREE.Matrix3().setFromMatrix4(part.matrixWorld).invert();
  const breeze=new THREE.Vector3(.029,0,.016).applyMatrix3(toLocal);
  for(let i=0;i<positions.count;i++){
    point.fromBufferAttribute(positions,i).applyMatrix4(part.matrixWorld);
    // The short drop, socket, glass, filament and halo all ride the same
    // attachment on the cord. Include the wire's cross-section at that joint.
    for(const root of roots){
      const dx=point.x-root.x,dz=point.z-root.z,dy=point.y-root.y;
      if(dx*dx+dz*dz<.026**2 && dy>=-.12 && dy<.005){point.copy(root);break;}
    }
    let distanceSq=Infinity;
    for(const pin of pins)distanceSq=Math.min(distanceSq,point.distanceToSquared(pin));
    const freedom=THREE.MathUtils.smoothstep(Math.sqrt(distanceSq),.012,2.6);
    const phase=.43*point.x+.27*point.z;
    offset.copy(breeze).multiplyScalar(freedom*Math.cos(phase)).toArray(targets[0],3*i);
    offset.copy(breeze).multiplyScalar(freedom*Math.sin(phase)).toArray(targets[1],3*i);
  }
  geometry.morphTargetsRelative=true;
  geometry.morphAttributes.position=targets.map(values=>new THREE.BufferAttribute(values,3));
  part.updateMorphTargets();
}

// The glass and filament remain in the model. A small halo preserves their
// brightness as a distant bulb shrinks below the size of a single pixel.
export function installCafeLights(scene,model,fromPlan,reducedMotion){
  const bulbs=[],parts=[];
  model.traverse(mesh=>{
    if(!mesh.isMesh)return;
    if(mesh.material.name==='String bulbs · amber filament')bulbs.push(...bulbCenters(mesh,.042));
    if(['Soft black cord','String bulbs · amber filament','Cafe lights · clear teardrop glass'].includes(mesh.material.name))parts.push(mesh);
  });
  const geometry=new THREE.BufferGeometry();
  geometry.setFromPoints(bulbs);
  const uniforms={height:{value:720},gain:{value:.1}};
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms,
    vertexShader:`
      uniform float height;
      #include <morphtarget_pars_vertex>
      void main(){
        #include <begin_vertex>
        #include <morphtarget_vertex>
        vec4 p=modelViewMatrix*vec4(transformed,1.);
        gl_Position=projectionMatrix*p;
        gl_PointSize=clamp(.15*height*projectionMatrix[1][1]/max(.1,-p.z),5.,78.);
      }`,
    fragmentShader:`
      uniform float gain;
      void main(){
        float r=length(2.*gl_PointCoord-1.);
        if(r>=1.)discard;
        float core=exp(-130.*r*r),halo=exp(-5.9*r)*(1.-smoothstep(.65,1.,r));
        gl_FragColor=vec4(vec3(1.,.64,.35)*halo+vec3(3.2,2.65,1.95)*core,gain);
      }`});
  const glow=new THREE.Points(geometry,mat);glow.name='Warm cafe lights · deck and pergola';glow.visible=false;scene.add(glow);
  parts.push(glow);
  const pins=bulbs.length?cordMounts(model,fromPlan):[];
  if(pins.length){
    const roots=bulbs.map(p=>new THREE.Vector3(p.x,p.y+.082,p.z));
    for(const part of parts)addSwayShapes(part,roots,pins);
  }
  const yard=new THREE.Sphere().setFromPoints(pins);
  yard.radius+=.4;
  const frustum=new THREE.Frustum(),view=new THREE.Matrix4();
  let wind=1;
  const pools=[];
  // Each emitter stands in for a run of several bulbs. Enough reach for the
  // warm pools to overlap on the route from the porch to the swing seats.
  for(const [name,power,reach] of [['Deck',38,8.9],['Pergola',30,8.4],['Picnic',28,9.1]]){
    const marker=model.getObjectByName('FestoonPool_'+name);
    if(!marker)continue;
    const lamp=new THREE.PointLight(0xffce91,0,reach,2);
    lamp.name='Light beneath the '+name.toLowerCase();marker.getWorldPosition(lamp.position);
    lamp.position.y-=.27;scene.add(lamp);pools.push({lamp,power,reach});
  }
  return {set(daylight,weather,afterDusk=1-daylight){
    const night=Math.pow(1-daylight,1.4);
    wind=weather==='rain'?1:weather==='snow'?.84:.74;
    uniforms.gain.value=.10+1.18*night;
    for(const {lamp,power,reach} of pools){
      lamp.intensity=.33+power*night;
      lamp.distance=reach+3.4*afterDusk;
    }
  },update(walking,height,camera,seconds,outdoors){
    glow.visible=walking;uniforms.height.value=height;
    if(!pins.length)return false;
    let sway=walking && outdoors && !!camera && !reducedMotion.matches && camera.position.distanceToSquared(yard.center)<32**2;
    if(sway){
      camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
      sway=frustum.intersectsSphere(yard);
    }
    const wave=seconds*.94+.24*Math.sin(seconds*.37);
    const gust=sway?wind*(.76+.24*Math.sin(seconds*.51)):0;
    const sine=gust*Math.sin(wave),cosine=gust*Math.cos(wave);
    for(const part of parts){
      part.morphTargetInfluences[0]=sine;part.morphTargetInfluences[1]=cosine;
    }
    return sway;
  }};
}
