import * as THREE from 'three';

const smooth=(low,high,value)=>THREE.MathUtils.smoothstep(value,low,high);
const skies={
  clear:{clouds:.13,light:1,fog:.0022},
  cloudy:{clouds:.79,light:.57,fog:.0075},
  rain:{clouds:.97,light:.31,fog:.024},
  snow:{clouds:.88,light:.64,fog:.021}
};
export function validWeather(weather){return Object.hasOwn(skies,weather);}

// A representative local solar path. East is +X and north is -Z in the tour.
export function atmosphere(hour,weather) {
  const weatherData=skies[weather];
  const angle=(hour-12)*Math.PI/12;
  const latitude=41.67*Math.PI/180;
  const direction=new THREE.Vector3(-Math.sin(angle),Math.cos(latitude)*Math.cos(angle),Math.sin(latitude)*Math.cos(angle)).normalize();
  const day=smooth(-.11,.19,direction.y);
  const twilight=1-smooth(.015,.30,Math.abs(direction.y+.015));
  const zenith=new THREE.Color('#17223f').lerp(new THREE.Color('#317ab9'),day);
  const horizon=new THREE.Color('#323e59').lerp(new THREE.Color('#d9e4e7'),day);
  horizon.lerp(new THREE.Color('#eeb29b'),twilight*.70);
  zenith.lerp(new THREE.Color('#545982'),twilight*.48);
  const cloudTint=new THREE.Color('#24334b').lerp(new THREE.Color(weather==='rain'?'#8f9caa':'#dbe1e8'),day);
  cloudTint.lerp(new THREE.Color('#bd9d97'),twilight*.43);
  zenith.lerp(cloudTint,weatherData.clouds*.64);
  horizon.lerp(cloudTint,weatherData.clouds*.71);
  const sunTint=new THREE.Color('#ffae74').lerp(new THREE.Color('#fff0d3'),smooth(.02,.46,direction.y));
  const skyTint=new THREE.Color('#778bad').lerp(new THREE.Color('#fff6e8'),day);
  skyTint.lerp(new THREE.Color('#c3cee1'),day*weatherData.clouds*.74);
  return {direction,day,twilight,zenith,horizon,cloudTint,sunTint,skyTint,...weatherData};
}

export function createSky(scene) {
  const uniforms={
    sunDirection:{value:new THREE.Vector3()},
    zenith:{value:new THREE.Color()},horizon:{value:new THREE.Color()},cloudTint:{value:new THREE.Color()},
    cloudCover:{value:0},day:{value:1},twilight:{value:0}
  };
  const sky=new THREE.Mesh(new THREE.SphereGeometry(400,32,16),new THREE.ShaderMaterial({
    uniforms,side:THREE.BackSide,depthWrite:false,fog:false,
    vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 direction;
      uniform vec3 sunDirection,zenith,horizon,cloudTint;
      uniform float cloudCover,day,twilight;
      float hash(vec2 p) {return fract(sin(dot(p,vec2(127.1,311.7)))*4375.611);}
      float noise(vec2 p) {
        vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
      }
      void main(){
        vec3 d=normalize(direction);
        float up=max(0.,d.y);
        vec3 color=mix(horizon,zenith,pow(up,.5));
        float sunDot=max(dot(d,sunDirection),0.);
        float moonDot=max(dot(d,-sunDirection),0.);
        color+=vec3(1.,.40,.14)*twilight*pow(sunDot,5.)*.67;
        color+=vec3(1.,.82,.59)*day*(pow(sunDot,28.)*.38+smoothstep(.99985,.99998,sunDot)*3.8);
        color+=vec3(.68,.75,.86)*(1.-day)*(pow(moonDot,110.)*.07+smoothstep(.99975,.99993,moonDot)*1.6);
        vec2 p=d.xz/(up+.23)*2.8;
        float n=.57*noise(p)+.29*noise(p*2.09+17.)+.14*noise(p*4.1+31.);
        float cloud=smoothstep(.77-.53*cloudCover,.97-.45*cloudCover,n);
        color=mix(color,cloudTint*(.73+.53*n),cloud*mix(.55,.96,cloudCover)*smoothstep(-.06,.13,d.y));
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
      for(const key of ['zenith','horizon','cloudTint'])uniforms[key].value.copy(a[key]);
      uniforms.cloudCover.value=a.clouds;
      uniforms.day.value=a.day;
      uniforms.twilight.value=a.twilight;
    }
  };
}
