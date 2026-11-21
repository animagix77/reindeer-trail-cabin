import * as THREE from 'three';
import {bulbCenters} from './tree-lights.js';

// The glass and filament remain in the model. A small halo preserves their
// brightness as a distant bulb shrinks below the size of a single pixel.
export function installCafeLights(scene,model){
  const locations=[];
  model.traverse(mesh=>{
    if(mesh.isMesh && mesh.material.name==='String bulbs · amber filament'){
      for(const p of bulbCenters(mesh,.042))locations.push(...p.toArray());
    }
  });
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(locations,3));
  const uniforms={height:{value:720},gain:{value:.1}};
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms,
    vertexShader:`
      uniform float height;
      void main(){
        vec4 p=modelViewMatrix*vec4(position,1.);
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
  const pools=[];
  // Each emitter stands in for a run of several bulbs. Enough reach for the
  // warm pools to overlap on the route from the porch to the swing seats.
  for(const [name,power,reach] of [['Deck',38,8.9],['Pergola',30,8.4],['Picnic',28,9.1]]){
    const marker=model.getObjectByName('FestoonPool_'+name);
    if(!marker)continue;
    const lamp=new THREE.PointLight(0xffce91,0,reach,2);
    lamp.name='Light beneath the '+name.toLowerCase();marker.getWorldPosition(lamp.position);
    lamp.position.y-=.27;scene.add(lamp);pools.push({lamp,power});
  }
  return {set(daylight){
    const night=Math.pow(1-daylight,1.4);
    uniforms.gain.value=.10+1.18*night;
    for(const {lamp,power} of pools)lamp.intensity=.33+power*night;
  },update(walking,height){
    glow.visible=walking;uniforms.height.value=height;
  }};
}
