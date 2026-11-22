import {Color,PlaneGeometry,Quaternion,Vector3} from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';

const waterShader={
  name:'Lake Superior open water',
  uniforms:{...Reflector.ReflectorShader.uniforms,waveTime:{value:0}},
  vertexShader:`
    uniform mat4 textureMatrix;
    varying vec4 reflectionPoint;
    varying vec3 lakePoint;
    void main(){
      lakePoint=(modelMatrix*vec4(position,1.)).xyz;
      reflectionPoint=textureMatrix*vec4(position,1.);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
    }`,
  fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform vec3 color;
    uniform float waveTime;
    varying vec4 reflectionPoint;
    varying vec3 lakePoint;

    // Filter short ripples as the projected footprint approaches a wavelength.
    float ripple(vec2 direction,float frequency,float speed){
      float phase=dot(lakePoint.xz,direction)*frequency;
      return sin(phase+waveTime*speed)*(1.-smoothstep(.6,3.,fwidth(phase)));
    }
    void main(){
      float swell=ripple(vec2(.33,1.),.77,.72);
      float crossWave=ripple(vec2(-.63,.84),1.48,-1.15);
      float small=ripple(vec2(.86,.48),4.05,1.72);
      vec3 normal=normalize(vec3(.036*swell+.022*small,1.,.069*crossWave+.018*swell));
      vec3 eye=normalize(cameraPosition-lakePoint);
      float fresnel=pow(1.-clamp(dot(normal,eye),0.,1.),5.);
      vec2 uv=reflectionPoint.xy/reflectionPoint.w;
      uv+=vec2(normal.x*.045,normal.z*.092);
      vec3 reflection=texture2D(tDiffuse,clamp(uv,.002,.998)).rgb;
      vec3 water=mix(color,reflection*vec3(.73,.86,.96),.20+.29*fresnel);
      vec3 sun=normalize(vec3(-.47,.20,-1.));
      float glint=pow(max(dot(reflect(-sun,normal),eye),0.),170.);
      water+=vec3(.32,.26,.16)*glint;
      gl_FragColor=vec4(water,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
};

export function addLakeWater(scene,xs,distances){
  const xmin=xs[0],xmax=xs.at(-1),near=distances[0],far=distances.at(-1);
  const compact=matchMedia('(pointer: coarse)').matches;
  const lake=new Reflector(new PlaneGeometry(xmax-xmin,far-near),{
    color:new Color(0x245462),shader:waterShader,textureWidth:compact?256:512,
    textureHeight:compact?256:320,multisample:0
  });
  // Only the connected, flat lakebed lies below this plane in the elevation grid.
  lake.name='Lake Superior water';lake.rotation.x=-Math.PI/2;
  lake.position.set((xmin+xmax)/2,.03,-(near+far)/2);
  lake.renderOrder=1;
  const capture=lake.onBeforeRender;
  const lastEye=new Vector3(),lastAngle=new Quaternion();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let lastCapture=-Infinity,aspect=0,fov=0;
  lake.onBeforeRender=(renderer,world,camera)=>{
    const time=performance.now()/1000;
    lake.material.uniforms.waveTime.value=reduced.matches?0:time;
    const moved=lastEye.distanceToSquared(camera.position)>.6 || lastAngle.angleTo(camera.quaternion)>.035;
    // The trees and sky are still. Reproject the last reflection between captures.
    if(camera.aspect===aspect && camera.fov===fov && (!moved || time-lastCapture<.10))return;
    capture.call(lake,renderer,world,camera);
    lastCapture=time;lastEye.copy(camera.position);lastAngle.copy(camera.quaternion);
    aspect=camera.aspect;fov=camera.fov;
  };
  scene.add(lake);
}
