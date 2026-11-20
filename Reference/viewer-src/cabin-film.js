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
  // Store the local lighting multiplier and eye depth together. Four nearest
  // taps can then reconstruct the low-resolution lighting without bleeding
  // the black edge of a chair onto the distant wall behind it.
  const indirect=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false,
    minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  // A pair of single texels retains the eye's previous exposure on the GPU.
  const meterTargets=Array.from({length:2},()=>new THREE.WebGLRenderTarget(1,1,{
    type:THREE.HalfFloatType,depthBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter
  }));
  const u={
    meterMap:{value:meterTargets[0].texture},meterInterval:{value:0},
    daylightMeter:{value:0},
    indirectMap:{value:indirect.texture},indirectSize:{value:new THREE.Vector2(1,1)},
    depthMap:{value:image.depthTexture},imageMap:{value:image.texture},lightMap:{value:light.texture},
    pixel:{value:new THREE.Vector2(1,1)},lightPixel:{value:new THREE.Vector2(1,1)},
    lens:{value:new THREE.Vector2()},clipPlanes:{value:new THREE.Vector2()},
    cameraWorld:{value:new THREE.Matrix4()},sunMatrix:{value:new THREE.Matrix4()},
    sunDepth:{value:null},sunDir:{value:new THREE.Vector3()},sunColor:{value:new THREE.Color()},
    exposureGain:{value:1}
  };
  const meter=pass(u,`
    uniform sampler2D imageMap,meterMap;
    uniform float meterInterval,daylightMeter;
    void main(){
      if(meterInterval<0.){gl_FragColor=vec4(0.,1.,0.,1.);return;}
      float average=0.,sum=0.;
      // Meter a stable, center-weighted field of view in stops. Limiting each
      // contribution prevents an individual bulb or dark twig from dominating.
      for(int y=0;y<6;y++)for(int x=0;x<8;x++){
        vec2 uv=(vec2(float(x),float(y)) + vec2(.25+.5*mod(float(y),2.),.5))/vec2(8.,6.);
        float weight=1.-.72*smoothstep(.16,.65,length(uv-.5));
        float radiance=dot(texture2D(imageMap,uv).rgb,vec3(.2126,.7152,.0722));
        average+=weight*log2(clamp(radiance,.024,2.));
        sum+=weight;
      }
      float target=clamp(.46*(log2(.18)-average/sum),-.48,.52);
      float previous=texture2D(meterMap,vec2(.5)).r;
      float delta=target-previous;
      // React more quickly when stepping into sun. A deadband suppresses
      // exposure changes caused by a footstep or a branch passing the lens.
      float change=max(abs(delta)-.025,0.)*sign(delta);
      float blend=1.-exp(-max(0.,meterInterval)*(delta<0.?2.1:1.25));
      float stops=previous+change*blend;
      gl_FragColor=vec4(stops,exp2(stops*daylightMeter),0.,1.);
    }`);
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
  const localLight=pass(u,`
    varying vec2 coords;
    uniform sampler2D imageMap;
    uniform vec2 pixel;
    ${projection}
    vec3 positionAt(vec2 uv){return viewPoint(uv,viewDepth(uv));}
    void main(){
      float z=viewDepth(coords);
      if(z>25.0){gl_FragColor=vec4(1.,1.,1.,z);return;}
      vec3 p=viewPoint(coords,z);
      vec3 a=p-positionAt(coords-vec2(pixel.x,0.)),b=positionAt(coords+vec2(pixel.x,0.))-p;
      vec3 c=p-positionAt(coords-vec2(0.,pixel.y)),d=positionAt(coords+vec2(0.,pixel.y))-p;
      vec3 n=cross(dot(a,a)<dot(b,b)?a:b,dot(c,c)<dot(d,d)?c:d);
      n*=inversesqrt(max(dot(n,n),1.e-16));
      float blocked=0.;
      vec3 bounce=vec3(0.);
      for(int i=0;i<14;i++){
        float k=float(i)+.5,theta=k*2.399963,r=.025+.68*k/14.;
        vec2 uv=coords+vec2(cos(theta),sin(theta))*r/(2.*lens*z);
        if(any(lessThan(uv,pixel))||any(greaterThan(uv,1.-pixel)))continue;
        vec3 delta=positionAt(uv)-p;
        float dist=max(.0001,length(delta));
        float weight=max(0.,dot(n,delta)/dist-.09)*(1.-smoothstep(.26,.85,dist))*smoothstep(.004,.025,dist);
        if(weight<=0.)continue;
        blocked+=weight;
        // Use incident scene radiance before the film shoulder. The bound
        // keeps emissive bulbs from lighting surfaces across a depth break.
        bounce+=min(texture2D(imageMap,uv).rgb,vec3(2.))*weight;
      }
      gl_FragColor=vec4(1.-min(.48,blocked*.10)+min(vec3(.20),bounce*.062),z);
    }`);
  const finish=pass(u,`
    varying vec2 coords;
    uniform sampler2D imageMap,lightMap,indirectMap,meterMap;
    uniform vec2 pixel,lightPixel,indirectSize;
    uniform float exposureGain,daylightMeter;
    ${projection}
    void main(){
      float z=viewDepth(coords);
      vec2 pos=coords*indirectSize-.5,base=floor(pos),f=fract(pos);
      vec3 lightFactor=vec3(0.);
      float sum=0.;
      for(int j=0;j<2;j++)for(int i=0;i<2;i++){
        vec2 side=vec2(float(i),float(j));
        vec4 tap=texture2D(indirectMap,(base+side+.5)/indirectSize);
        vec2 w=mix(1.-f,f,side);
        float weight=w.x*w.y/(1.+abs(tap.a-z)*95./max(1.,z));
        sum+=weight;lightFactor+=tap.rgb*weight;
      }
      // A thin foreground rail may miss all four half-resolution pixels.
      // Fall back to unmodified lighting when none share its depth.
      lightFactor=(lightFactor+vec3(.045))/(sum+.045);
      vec3 source=texture2D(imageMap,coords).rgb;
      vec3 glow=texture2D(lightMap,coords).rgb*.20;
      for(int i=0;i<8;i++){
        float angle=float(i)*.785398;
        vec2 direction=vec2(cos(angle),sin(angle));
        glow+=texture2D(lightMap,coords+direction*lightPixel*1.7).rgb*.067;
        glow+=texture2D(lightMap,coords+direction*lightPixel*4.5).rgb*.033;
      }
      vec3 color=source*lightFactor+glow;
      // A soft film shoulder preserves the warm lamp cores and cool blue hour.
      float luminance=dot(color,vec3(.2126,.7152,.0722));
      color*=mix(vec3(.97,.995,1.035),vec3(1.025,1.,.97),smoothstep(.025,.85,luminance));
      color*=1.-.055*smoothstep(.21,.76,length(coords-.5));
      float eyeGain=daylightMeter>0.?texture2D(meterMap,vec2(.5)).g:1.;
      gl_FragColor=vec4(color*(exposureGain*eyeGain),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,true);
  const size=new THREE.Vector2();
  const lastEye=new THREE.Vector3(Infinity,0,0),lastHeading=new THREE.Quaternion(),lastSunDir=new THREE.Vector3();
  let gain=1,last=null,meterIndex=0,lastMeter=null,settleUntil=0,lastSun=-1;
  return {
    render(world,camera,lighting,outdoors,seconds){
      renderer.getDrawingBufferSize(size);
      const scale=Math.min(1,Math.sqrt(1750000/(size.x*size.y)));
      const w=Math.max(1,Math.round(size.x*scale)),h=Math.max(1,Math.round(size.y*scale));
      if(w!==image.width||h!==image.height){
        image.setSize(w,h);light.setSize(Math.max(1,Math.ceil(w/4)),Math.max(1,Math.ceil(h/4)));
        indirect.setSize(Math.max(1,Math.ceil(w/2)),Math.max(1,Math.ceil(h/2)));
        u.indirectSize.value.set(indirect.width,indirect.height);
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
      // No exposure compensation after dusk, including when using the torch.
      const dayWeight=THREE.MathUtils.smoothstep(lighting.daylight,.035,.48);
      u.daylightMeter.value=dayWeight;
      const changedLight=Math.abs(lastSun-lighting.daylight)>.002 || lastSunDir.distanceToSquared(u.sunDir.value)>.0001;
      if(changedLight){lastSun=lighting.daylight;lastSunDir.copy(u.sunDir.value);}
      if(dayWeight>0 && (changedLight || lastEye.distanceToSquared(camera.position)>.008 ||
          1-Math.abs(lastHeading.dot(camera.quaternion))>.0004)){
        lastEye.copy(camera.position);lastHeading.copy(camera.quaternion);
        settleUntil=seconds+3.2;
      }
      if(lastMeter===null || (dayWeight>0 && (changedLight || seconds-lastMeter>=.083))){
        u.meterInterval.value=lastMeter===null?-1:Math.min(.25,seconds-lastMeter);
        meterIndex=1-meterIndex;
        renderer.setRenderTarget(meterTargets[meterIndex]);meter.render(renderer);
        u.meterMap.value=meterTargets[meterIndex].texture;lastMeter=seconds;
      }
      renderer.setRenderTarget(indirect);localLight.render(renderer);
      renderer.setRenderTarget(light);scatter.render(renderer);
      renderer.setRenderTarget(null);finish.render(renderer);
      return Math.abs(desired-gain)>.003 || (dayWeight>0 && seconds<settleUntil);
    }
  };
}
