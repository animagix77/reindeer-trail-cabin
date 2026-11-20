import * as T from 'three';

const clamp = T.MathUtils.clamp;
const swatch = (color, roughness=.56) => new T.MeshStandardMaterial({color,roughness});
const round = (geometry, material, group, x,y,z) => {
  const part = new T.Mesh(geometry,material);
  part.position.set(x,y,z);
  part.castShadow=true;part.receiveShadow=true;
  group.add(part);return part;
};

// Latitude rings of a tapered breast or an irregular, flat cut of beef.
function cut(chicken){
  const vertices=[],indices=[],lat=20,lon=56;
  for(let i=0;i<=lat;i++){
    const t=i*Math.PI/lat, radius=Math.pow(Math.sin(t),.62);
    for(let j=0;j<lon;j++){
      const a=j*2*Math.PI/lon;
      const edge=1+.07*Math.sin(3*a+.7)+.038*Math.cos(5*a)+.018*Math.sin(9*a);
      const x=.127*radius*Math.cos(a)*edge;
      const taper=chicken?1-.33*Math.cos(a):1+.11*Math.cos(2*a-.3);
      vertices.push(x,.023*Math.sign(Math.cos(t))*Math.pow(Math.abs(Math.cos(t)),.53)*(chicken?1.08-.38*x/.127:1),
        (chicken?.072:.088)*radius*Math.sin(a)*edge*taper+.012*radius*Math.cos(a*2));
    }
  }
  for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){
    const a=i*lon+j,b=i*lon+(j+1)%lon;
    if(i>0)indices.push(a,b,a+lon);
    if(i<lat-1)indices.push(b,b+lon,a+lon);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}

function seared(material,kind,levels) {
  material.onBeforeCompile=shader=>{
    shader.uniforms.sear={value:levels};
    shader.vertexShader='varying vec3 cutPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\ncutPoint=position;');
    shader.fragmentShader='varying vec3 cutPoint; uniform vec2 sear;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec3 p=cutPoint;
      float doneness=mix(sear.x,sear.y,smoothstep(-.008,.008,p.y));
      float grain=sin(p.x*420.+sin(p.z*140.+p.x*18.)*2.3);
      float vein=sin(29.*p.x+60.*p.z+sin(p.x*61.-p.z*42.)*1.8+grain*.17);
      float fat=pow(max(vein,0.),25.)*(.48+.52*sin(p.x*85.)*sin(p.z*113.));
      diffuseColor.rgb*=.93+.066*grain;
      diffuseColor.rgb=mix(diffuseColor.rgb,${kind==='steak'?'vec3(.80,.61,.46)':'vec3(.86,.70,.54)'},fat*${kind==='steak'?'0.78':'0.08'}*(1.-doneness*.45));
      vec3 roasted=${kind==='chicken'?'vec3(.50,.243,.084)':kind==='steak'?'vec3(.181,.064,.028)':'diffuseColor.rgb*vec3(.69,.58,.42)'};
      diffuseColor.rgb=mix(diffuseColor.rgb,roasted,clamp(doneness,0.,1.));
      float stripe=1.-smoothstep(.16,.80,abs(sin(p.x*125.66+sin(p.z*41.)*.09)));
      diffuseColor.rgb*=1.-.78*stripe*smoothstep(.13,.88,doneness);
    `);
  };
  material.customProgramCacheKey=()=>kind;
  return material;
}
export function makeMeal(kind){
  const group=new T.Group(), levels=new T.Vector2();
  const skin=color=>seared(swatch(color),kind,levels);
  let halfHeight=.025;
  if(kind==='vegetables'){
    halfHeight=.024;
    const stick=round(new T.CylinderGeometry(.0027,.0027,.285,10),swatch('#b48c55'),group,0,0,0);
    stick.rotation.z=Math.PI/2;
    for(let i=0;i<7;i++){
      const x=(i-3)*.032;
      if(i%3===0){
        const piece=round(new T.CylinderGeometry(.024,.022,.021,20),[skin('#406626'),skin('#e3dc9b'),skin('#e3dc9b')],group,x,0,0);
        piece.rotation.z=Math.PI/2-.07;
      }else{
        const pepper=i%3===1;
        const piece=round(new T.SphereGeometry(1,pepper?8:18,12),skin(pepper?'#c03a1e':'#b22f20'),group,x,0,0);
        piece.scale.set(.018,pepper?.022:.021,.021);
      }
    }
  }else{
    const chicken=kind==='chicken';
    halfHeight=chicken?.031:.023;
    round(cut(chicken),skin(chicken?'#e6a69a':'#a54043'),group,0,0,0);
  }
  return {group,halfHeight,shade(bottom,top){levels.set(clamp(bottom,0,1),clamp(top,0,1));},
    dispose(){const mats=new Set();group.traverse(o=>{if(!o.isMesh)return;o.geometry.dispose();for(const m of [].concat(o.material))mats.add(m);});for(const m of mats)m.dispose();group.removeFromParent();}};
}
