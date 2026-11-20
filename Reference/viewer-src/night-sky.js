import * as THREE from 'three';
import catalog from './hipparcos-bright.json' with {type:'json'};

const rad=Math.PI/180,latitude=41.67*rad,longitude=-74.82;
const nyClock=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'numeric',day:'numeric',hour:'numeric',hourCycle:'h23'});

// Greenwich mean sidereal time, US Naval Observatory, aa.usno.navy.mil/faq/GAST.
// Apply Smallwood's civil clock to its local calendar date, including DST.
export function localSidereal(hour,now=new Date()){
  const parts=Object.fromEntries(nyClock.formatToParts(now).map(({type,value})=>[type,value]));
  const midnight=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day));
  const civil=midnight+hour*3600000;
  const approximate=new Date(civil+5*3600000);
  const actual=Object.fromEntries(nyClock.formatToParts(approximate).map(({type,value})=>[type,value]));
  const offset=(Date.UTC(+actual.year,+actual.month-1,+actual.day,+actual.hour)-
    Math.floor(approximate.getTime()/3600000)*3600000)/3600000;
  const days=(civil-offset*3600000-Date.UTC(2000,0,1,12))/86400000;
  return ((18.697375+24.065709824279*days+longitude/15)%24)*15*rad;
}
const cloudNoise=`
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*4375.611);}
  float noise(vec2 p){
    vec2 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(hash(cell),hash(cell+vec2(1,0)),f.x),
               mix(hash(cell+vec2(0,1)),hash(cell+vec2(1)),f.x),f.y);
  }
  float transmission(vec3 d,float clouds){
    vec2 p=d.xz/(max(0.,d.y)+.23)*2.8;
    float n=.57*noise(p)+.29*noise(p*2.09+17.)+.14*noise(p*4.1+31.);
    return 1.-smoothstep(.77-.53*clouds,.97-.45*clouds,n);
  }
`;
function starField(uniforms) {
  const positions=[],strength=[],color=[],cool=new THREE.Color('#d8e7ff'),warm=new THREE.Color('#ffc08a');
  const white=new THREE.Color('#fff7ec'),tint=new THREE.Color();
  for(const [ra100,dec100,mag100,bv100] of catalog.stars){
    const ra=ra100*.01*rad,dec=dec100*.01*rad,mag=mag100*.01,bv=bv100*.01;
    positions.push(Math.cos(dec)*Math.cos(ra),Math.sin(dec),Math.cos(dec)*Math.sin(ra));
    strength.push(Math.pow(10,-.19*(mag-1.8)));
    if(bv<.55)tint.copy(cool).lerp(white,THREE.MathUtils.smoothstep(bv,-.3,.55));
    else tint.copy(white).lerp(warm,THREE.MathUtils.smoothstep(bv,.55,1.85));
    tint.toArray(color,color.length);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('strength',new THREE.Float32BufferAttribute(strength,1));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(color,3));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms,
    vertexShader:`attribute float strength; attribute vec3 color;
      uniform vec2 sidereal; uniform float night,clouds,pixelRatio,time;
      varying vec3 starColor; varying float alpha;
      ${cloudNoise}
      void main(){
        float meridian=sidereal.x*position.x+sidereal.y*position.z;
        vec3 d=vec3(sidereal.x*position.z-sidereal.y*position.x,
          ${Math.sin(latitude)}*position.y+${Math.cos(latitude)}*meridian,
          ${Math.sin(latitude)}*meridian-${Math.cos(latitude)}*position.y);
        float air=smoothstep(.012,.30,d.y);
        alpha=night*air*transmission(d,clouds)*min(1.8,strength*1.26);
        alpha*=1.+.13*(1.-.75*air)*sin(time*1.9+position.x*325.);
        starColor=color;gl_PointSize=pixelRatio*clamp(1.6+1.8*sqrt(strength),2.,6.5);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(d*315.,1.);
      }`,
    fragmentShader:`varying vec3 starColor;varying float alpha;
      void main(){
        vec2 p=2.*gl_PointCoord-1.;float d=dot(p,p);
        if(d>=1.||alpha<=.003)discard;
        gl_FragColor=vec4(starColor,alpha*(exp(-5.5*d)-.0041));
        #include <colorspace_fragment>
      }`
  });
  const field=new THREE.Points(geometry,material);field.name='Hipparcos stars over Smallwood';
  field.frustumCulled=false;field.renderOrder=-98;return field;
}
export function installNightSky(scene){
  const group=new THREE.Group();group.name='Night sky';group.visible=false;scene.add(group);
  const uniforms={sidereal:{value:new THREE.Vector2()},clouds:{value:0},night:{value:0},
    pixelRatio:{value:1},time:{value:0}};
  group.add(starField(uniforms));
  const count=54,positions=new Float32Array(count*3),fades=new Float32Array(count);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  for(let i=0;i<count;i++)fades[i]=(1-i/(count-1))**1.5;
  geo.setAttribute('glow',new THREE.BufferAttribute(fades,1));
  const meteor=new THREE.Points(geo,new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    blending:THREE.AdditiveBlending,uniforms,vertexShader:`attribute float glow;varying float g;
      uniform float pixelRatio;void main(){g=glow;gl_PointSize=pixelRatio*(1.1+1.85*glow);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying float g;uniform float night;void main(){vec2 p=gl_PointCoord*2.-1.;
      float a=max(0.,1.-dot(p,p));gl_FragColor=vec4(mix(vec3(.62,.77,1.),vec3(1.,.93,.75),g),night*g*a*a);}`
  }));
  meteor.name='Shooting star';meteor.renderOrder=-97;meteor.frustumCulled=false;group.add(meteor);
  const gaze=new THREE.Vector3(),across=new THREE.Vector3(),start=new THREE.Vector3(),end=new THREE.Vector3();
  const sample=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  let previous=null,elapsed=0,begin=0,next=7,span=.82,watching=false;
  function startMeteor(){
    across.crossVectors(gaze,up);
    if(across.lengthSq()<.001)across.set(1,0,0);
    across.normalize().multiplyScalar(Math.random()<.5?1:-1);
    start.copy(gaze).addScaledVector(across,-.28-Math.random()*.12);
    start.y=Math.max(.42,start.y+.08+Math.random()*.18);start.normalize();
    end.copy(start).addScaledVector(across,.39+Math.random()*.19);end.y-=.13;end.normalize();
    begin=elapsed;span=.7+Math.random()*.52;next=elapsed+19+Math.random()*47;
  }
  return {
    set(hour,air){
      const hourAngle=localSidereal(hour);
      uniforms.sidereal.value.set(Math.cos(hourAngle),Math.sin(hourAngle));
      uniforms.clouds.value=air.clouds;
      uniforms.night.value=(1-air.day)*(1-air.twilight*.85)*(1-THREE.MathUtils.smoothstep(air.clouds,.28,.75));
    },
    update(camera,mode,seconds,pixelRatio,outdoors){
      group.visible=mode!=='property' && uniforms.night.value>.015;
      watching=false;
      if(!group.visible){previous=null;meteor.visible=false;return;}
      group.position.copy(camera.position);camera.getWorldDirection(gaze);
      watching=outdoors && gaze.y>.15;
      uniforms.pixelRatio.value=pixelRatio;uniforms.time.value=seconds%3600;
      if(!watching){previous=null;meteor.visible=false;return;}
      const dt=previous===null?0:THREE.MathUtils.clamp(seconds-previous,0,1);
      previous=seconds;elapsed+=dt;
      if(elapsed>=next)startMeteor();
      const t=(elapsed-begin)/span;
      meteor.visible=begin>0 && t>=0 && t<1.24;
      if(meteor.visible){
        for(let i=0;i<count;i++){
          const pos=t-.24*i/(count-1);
          sample.lerpVectors(start,end,THREE.MathUtils.clamp(pos,0,1)).normalize().multiplyScalar(309);
          sample.toArray(positions,i*3);
          fades[i]=Math.max(0,1-i/(count-1))**1.45*THREE.MathUtils.smoothstep(pos,0,.07)*(1-THREE.MathUtils.smoothstep(pos,.87,1));
        }
        geo.attributes.position.needsUpdate=geo.attributes.glow.needsUpdate=true;
      }
    },
    get animated(){return watching;}
  };
}
