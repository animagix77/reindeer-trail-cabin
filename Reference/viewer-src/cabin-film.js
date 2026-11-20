import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

const vertex=`varying vec2 coords;
void main(){coords=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const projection=`
  uniform sampler2D depthMap;
  uniform vec2 clipPlanes, lens;
  float viewDepth(vec2 uv){
    float n=clipPlanes.x,f=clipPlanes.y,d=texture2D(depthMap,uv).r;
    return n*f/max(.000001,f-d*(f-n));
  }
  vec3 viewPoint(vec2 uv,float depth){return vec3((uv*2.-1.)*lens*depth,-depth);}
`;
function pass(uniforms,code,toneMapped=false){
  return new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms,vertexShader:vertex,fragmentShader:code,depthTest:false,depthWrite:false,toneMapped
  }));
}

export function cabinFilm(renderer){
  // Use one geometry pass. The depth buffer supplies room-scale contact shadows
  // and bounds every sample of illuminated air by the first visible surface.
  if(!renderer.extensions.has('EXT_color_buffer_float'))return null;
  const image=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,
    depthTexture:new THREE.DepthTexture(1,1,THREE.UnsignedIntType),
    samples:Math.min(2,renderer.capabilities.maxSamples)});
  const light=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
  const u={
    depthMap:{value:image.depthTexture},imageMap:{value:image.texture},lightMap:{value:light.texture},
    pixel:{value:new THREE.Vector2(1,1)},lightPixel:{value:new THREE.Vector2(1,1)},
    lens:{value:new THREE.Vector2()},clipPlanes:{value:new THREE.Vector2()},
    cameraWorld:{value:new THREE.Matrix4()},sunMatrix:{value:new THREE.Matrix4()},
    sunDepth:{value:null},sunDir:{value:new THREE.Vector3()},sunColor:{value:new THREE.Color()},
    exposureGain:{value:1}
  };
  const scatter=pass(u,`
    precision highp sampler2DShadow;
    uniform sampler2DShadow sunDepth;
    uniform sampler2D imageMap;
    uniform mat4 cameraWorld,sunMatrix;
    uniform vec3 sunDir,sunColor;
    uniform vec2 pixel;
    varying vec2 coords;
    ${projection}
    float visibility(vec3 p){
      vec4 shadow=sunMatrix*vec4(p,1.);
      vec3 q=shadow.xyz/shadow.w;
      if(any(lessThan(q,vec3(0.))) || any(greaterThan(q,vec3(1.))))return 1.;
      return texture(sunDepth,vec3(q.xy,q.z-.00022));
    }
    vec3 bright(vec2 uv){
      vec3 c=texture2D(imageMap,uv).rgb;
      float peak=max(max(c.r,c.g),c.b);
      return min(c,vec3(12.))*smoothstep(.75,2.4,peak);
    }
    void main(){
      vec2 d=2.*pixel;
      vec3 glow=(bright(coords+d)+bright(coords-d)+bright(coords+vec2(d.x,-d.y))+bright(coords+vec2(-d.x,d.y)))*.25;
      vec3 through=viewPoint(coords,viewDepth(coords));
      float reach=min(length(through),31.);
      vec3 ray=mat3(cameraWorld)*normalize(through);
      vec3 origin=cameraWorld[3].xyz;
      float sum=0.;
      if(dot(sunColor,vec3(1.))>.001){
        for(int i=0;i<12;i++)sum+=visibility(origin+ray*(float(i)+.5)*(reach/12.));
      }
      float forward=.23+1.65*pow(max(0.,dot(ray,sunDir)),5.);
      vec3 air=sunColor*(sum/12.)*reach*.00115*forward;
      gl_FragColor=vec4(glow*.16+air,1.);
    }`);
  const finish=pass(u,`
    varying vec2 coords;
    uniform sampler2D imageMap,lightMap;
    uniform vec2 pixel,lightPixel;
    uniform float exposureGain;
    ${projection}
    void main(){
      float z=viewDepth(coords);
      vec3 center=viewPoint(coords,z);
      vec3 norm=cross(dFdx(center),dFdy(center));
      norm*=inversesqrt(max(dot(norm,norm),1.e-16));
      float shade=0.;
      if(z<32.){
        // Project a fixed physical radius into screen space and sample the
        // hemisphere facing the surface. Flat boards cannot occlude themselves.
        for(int i=0;i<10;i++){
          float k=float(i)+.5,angle=k*2.39996;
          vec2 offset=vec2(cos(angle),sin(angle))*(.32*sqrt(k/10.))/(2.*lens*z);
          vec2 uv=clamp(coords+offset,pixel,1.-pixel);
          vec3 delta=viewPoint(uv,viewDepth(uv))-center;
          float radius=max(length(delta),.0001);
          shade+=max(0.,dot(norm,delta)/radius-.10)*smoothstep(0.,.04,radius)*(1.-smoothstep(.15,.5,radius));
        }
      }
      vec3 source=texture2D(imageMap,coords).rgb;
      vec3 glow=texture2D(lightMap,coords).rgb*.20;
      for(int i=0;i<8;i++){
        float angle=float(i)*.785398;
        vec2 direction=vec2(cos(angle),sin(angle));
        glow+=texture2D(lightMap,coords+direction*lightPixel*1.7).rgb*.067;
        glow+=texture2D(lightMap,coords+direction*lightPixel*4.5).rgb*.033;
      }
      vec3 color=source*(1.-min(.43,shade*.095))+glow;
      // A soft film shoulder preserves the warm lamp cores and cool blue hour.
      float luminance=dot(color,vec3(.2126,.7152,.0722));
      color*=mix(vec3(.97,.995,1.035),vec3(1.025,1.,.97),smoothstep(.025,.85,luminance));
      color*=1.-.055*smoothstep(.21,.76,length(coords-.5));
      gl_FragColor=vec4(color*exposureGain,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,true);
  const size=new THREE.Vector2();
  let gain=1,last=null;
  return {
    render(world,camera,lighting,outdoors,seconds){
      renderer.getDrawingBufferSize(size);
      const scale=Math.min(1,Math.sqrt(1750000/(size.x*size.y)));
      const w=Math.max(1,Math.round(size.x*scale)),h=Math.max(1,Math.round(size.y*scale));
      if(w!==image.width||h!==image.height){
        image.setSize(w,h);light.setSize(Math.max(1,Math.ceil(w/4)),Math.max(1,Math.ceil(h/4)));
        u.pixel.value.set(1/w,1/h);u.lightPixel.value.set(1/light.width,1/light.height);
      }
      const desired=outdoors?1:1.12;
      const dt=last===null?1:Math.min(.25,seconds-last);last=seconds;
      gain=THREE.MathUtils.lerp(gain,desired,1-Math.exp(-dt*2.4));u.exposureGain.value=gain;
      renderer.setRenderTarget(image);renderer.render(world,camera);
      const sun=lighting.sun;
      if(!sun.shadow.map){renderer.setRenderTarget(null);renderer.render(world,camera);return false;}
      u.clipPlanes.value.set(camera.near,camera.far);
      u.lens.value.set(1/camera.projectionMatrix.elements[0],1/camera.projectionMatrix.elements[5]);
      u.cameraWorld.value.copy(camera.matrixWorld);u.sunMatrix.value.copy(sun.shadow.matrix);
      u.sunDepth.value=sun.shadow.map.depthTexture;
      u.sunDir.value.subVectors(sun.position,sun.target.position).normalize();
      // The low sun travels through more haze. The shadow samples keep the light
      // in gaps between branches and stop the shafts at the cabin walls.
      u.sunColor.value.copy(sun.color).multiplyScalar(sun.intensity*lighting.daylight*(1+1.6*lighting.goldenHour));
      renderer.setRenderTarget(light);scatter.render(renderer);
      renderer.setRenderTarget(null);finish.render(renderer);
      return Math.abs(desired-gain)>.003;
    }
  };
}
