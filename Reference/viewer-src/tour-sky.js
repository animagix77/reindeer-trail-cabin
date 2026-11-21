import * as THREE from 'three';

const smooth=(low,high,value)=>THREE.MathUtils.smoothstep(value,low,high);
const skies={
  clear:{clouds:.13,light:1,fog:.0022},
  cloudy:{clouds:.79,light:.57,fog:.0075},
  rain:{clouds:.97,light:.31,fog:.024},
  snow:{clouds:.88,light:.64,fog:.021}
};
export function validWeather(weather){return Object.hasOwn(skies,weather);}
const color=hex=>new THREE.Color(hex);

// The manual clock uses a representative equinox. Local time supplies the
// actual seasonal solar direction in the same east, up, south coordinate frame.
export function atmosphere(hour,weather,sunDirection=null) {
  const weatherData=skies[weather],cover=weatherData.clouds;
  const angle=(hour-12)*Math.PI/12,latitude=41.67*Math.PI/180;
  const direction=sunDirection?new THREE.Vector3().fromArray(sunDirection).normalize():
    new THREE.Vector3(-Math.sin(angle),Math.cos(latitude)*Math.cos(angle),Math.sin(latitude)*Math.cos(angle)).normalize();
  const alt=direction.y,day=smooth(-.11,.19,alt);
  const twilight=1-smooth(.015,.30,Math.abs(alt+.015));
  const golden=smooth(-.095,.035,alt)*(1-smooth(.085,.38,alt));
  const blueHour=smooth(-.235,-.115,alt)*(1-smooth(-.065,.055,alt));
  const zenith=color('#10223a').lerp(color('#367e98'),day)
    .lerp(color('#6b7894'),golden*.85).lerp(color('#384d85'),blueHour*.90);
  const horizon=color('#2b3b53').lerp(color('#b3d0c6'),day)
    .lerp(color('#f7b17f'),golden*.94).lerp(color('#a68ca4'),blueHour*.85);
  const cloudTint=color('#26364c').lerp(color(weather==='rain'?'#8497a0':'#e2e5d7'),day)
    .lerp(color('#d99b83'),golden*.80).lerp(color('#777f9c'),blueHour*.78);
  zenith.lerp(cloudTint,cover*.61);
  horizon.lerp(cloudTint,cover*.65);
  const sunTint=color('#ff9e57').lerp(color('#ffedc7'),smooth(.025,.48,alt))
    .lerp(color('#ecf1fa'),cover*.45);
  const skyTint=color('#8ba4cc').lerp(color('#d9efee'),day)
    .lerp(color('#a9c7d4'),golden*.76).lerp(color('#a6b9ed'),blueHour*.85);
  const groundTint=color('#646b81').lerp(color('#b3a28f'),day)
    .lerp(color('#c49c84'),golden*.62).lerp(color('#696b88'),blueHour*.70);
  return {direction,day,twilight,golden,blueHour,zenith,horizon,cloudTint,sunTint,skyTint,groundTint,...weatherData};
}

// Project the view ray through curved cloud layers. The bottom layer has pooled
// cumulus and the upper layer has long, thinner filaments. Stars use this same field.
export const cloudField=`
  float skyHash(vec2 p){
    vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
    q+=dot(q,q.yzx+33.33);
    return fract((q.x+q.y)*q.z);
  }
  float skyNoise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(skyHash(i),skyHash(i+vec2(1,0)),f.x),
               mix(skyHash(i+vec2(0,1)),skyHash(i+1.),f.x),f.y);
  }
  float cloudShape(vec2 p){
    mat2 turn=mat2(.81,-.59,.59,.81);
    float a=.52*skyNoise(p);
    p=turn*p*2.03+17.5;a+=.26*skyNoise(p);
    p=turn*p*2.07+8.1;a+=.14*skyNoise(p);
    p=turn*p*2.11+25.7;return a+.08*skyNoise(p);
  }
  vec2 skyCloudLayers(vec3 d,float cover){
    float up=max(0.,d.y);
    vec2 p=d.xz*(3.6/(up+sqrt(up*up+.032)))+vec2(17.6,9.8);
    float shape=cloudShape(p);
    float bank=smoothstep(.735-.50*cover,.895-.47*cover,shape);
    vec2 wisps=mat2(.36,-.93,.93,.36)*p;
    wisps*=vec2(.69,2.3);
    float veil=.64*skyNoise(wisps)+.36*skyNoise(wisps*2.7+shape*1.8);
    float cirrus=smoothstep(.51-.12*cover,.83-.10*cover,veil);
    return vec2(bank,cirrus)*smoothstep(-.03,.065,d.y);
  }
  float cloudTransmission(vec3 d,float cover){
    vec2 layer=skyCloudLayers(d,cover);
    return (1.-layer.x*.96)*(1.-layer.y*.35);
  }
`;

export function createSky(scene) {
  const uniforms={
    sunDirection:{value:new THREE.Vector3()},zenith:{value:new THREE.Color()},horizon:{value:new THREE.Color()},
    cloudTint:{value:new THREE.Color()},sunTint:{value:new THREE.Color()},
    cloudCover:{value:0},day:{value:1},golden:{value:0},blueHour:{value:0}
  };
  const sky=new THREE.Mesh(new THREE.SphereGeometry(400,32,16),new THREE.ShaderMaterial({
    uniforms,side:THREE.BackSide,depthWrite:false,fog:false,
    vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 direction;
      uniform vec3 sunDirection,zenith,horizon,cloudTint,sunTint;
      uniform float cloudCover,day,golden,blueHour;
      ${cloudField}
      void main(){
        vec3 d=normalize(direction);
        float up=max(0.,d.y),sunDot=max(dot(d,sunDirection),0.);
        float moonDot=max(dot(d,-sunDirection),0.);
        float clearFraction=1.-.83*cloudCover;
        float lowAir=exp(-5.1*up);
        vec3 color=mix(horizon,zenith,1.-exp(-2.75*up));
        float towardsSun=smoothstep(-.28,.97,dot(d,sunDirection));
        // Long overlapping bands follow the real solar bearing. The warmest
        // band stays low in the west; the opposite sky carries violet shade.
        vec3 dusk=mix(horizon*vec3(1.02,.89,.94),vec3(1.18,.62,.24),towardsSun);
        vec3 belt=mix(vec3(.35,.255,.36),vec3(.81,.324,.175),towardsSun);
        dusk=mix(dusk,belt,smoothstep(.014,.22,up));
        dusk=mix(dusk,zenith,smoothstep(.19,.65,up));
        color=mix(color,dusk,golden*clearFraction*.89);
        color+=clearFraction*lowAir*(golden*towardsSun*vec3(.48,.17,.044)
                                  +blueHour*towardsSun*vec3(.31,.094,.043));
        color+=clearFraction*(day+blueHour*.24)*sunTint*
               (pow(sunDot,11.)*.17+pow(sunDot,85.)*.24+pow(sunDot,650.)*.31);
        vec2 layers=skyCloudLayers(d,cloudCover);
        float silver=pow(sunDot,9.)*(1.-layers.x)*(.6+.4*up);
        vec3 silverColor=mix(vec3(.92,1.,1.03),vec3(1.67,.75,.36),golden);
        vec3 cloudLight=cloudTint*(.71+.25*(1.-layers.x)+.10*up)
                     +silverColor*silver*day*clearFraction*.68;
        color=mix(color,cloudTint*(.98+.26*towardsSun),layers.y*(.20+.21*cloudCover));
        color=mix(color,cloudLight,layers.x*(.88+.09*cloudCover));
        float transmission=(1.-layers.x*.985)*(1.-layers.y*.45);
        float disc=smoothstep(.99991,.999956,sunDot);
        color+=transmission*clearFraction*smoothstep(-.025,.035,sunDirection.y)*sunTint*disc*5.5;
        color+=transmission*(1.-day)*vec3(.65,.75,.94)*
               (pow(moonDot,115.)*.064+smoothstep(.99990,.99997,moonDot)*1.45);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  sky.frustumCulled=false;sky.renderOrder=-100;scene.add(sky);
  return {
    place(eye,visible){sky.visible=visible;if(visible)sky.position.copy(eye);},
    set(a){
      uniforms.sunDirection.value.copy(a.direction);
      for(const key of ['zenith','horizon','cloudTint','sunTint'])uniforms[key].value.copy(a[key]);
      uniforms.cloudCover.value=a.clouds;
      for(const key of ['day','golden','blueHour'])uniforms[key].value=a[key];
    },
    dispose(){sky.removeFromParent();sky.geometry.dispose();sky.material.dispose();}
  };
}
