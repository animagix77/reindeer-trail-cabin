import * as THREE from 'three';
import {bulbCenters} from './tree-lights.js';

// Only outdoor finishes receive this diffuse light. The trees, sky and the
// rooms behind the garage doors keep their own lighting.
const receivers=/^(Garage ·|Midnight blue siding|Blue lap siding|Entry wing ·|Painted (?:block|fascia)|Rainwater goods|Front (?:motor court|sash|basement)|Rear basement window|Street gate|Uphill front court|Driveway (?:end|edging|markers)|Entry ·|Weathered (?:railing timber|timber ties|fieldstone|stone highlights)|Stair tread|Concrete stairs|Fine crushed gravel|Garden ·|Water well ·|Path lights ·|Glacial boulder|Fieldstone shadows|Leaf litter and low cover|Cool-season fescue|Roadside masonry|Timber$|Deck boards|Porch ·|Patio steps ·|Rear landing ·|Utility (?:apron|stair)|Fire circle ·|Adirondack slat|Fire pit ·|Firewood ·|Outdoor wicker|Room detail \| Front (?:entrance|screen|door))/;

// Store the steady lamps' strength and mean incident direction in a small
// world-space texture. All the lamps cost one filtered lookup on these
// surfaces, including on a phone. The camera never selects or moves a pool.
function bakeLight(sources){
  const cell=.4,box=new THREE.Box3();
  for(const {p,range} of sources){
    box.expandByPoint(p.clone().addScalar(-range));box.expandByPoint(p.clone().addScalar(range));
  }
  // The floors and wall fittings occupy a shallow band of the grounds.
  box.min.y=Math.min(...sources.map(s=>s.p.y))-3;
  box.max.y=Math.max(...sources.map(s=>s.p.y))+3;
  const span=box.getSize(new THREE.Vector3());
  const [w,h,d]=span.toArray().map(v=>Math.ceil(v/cell)+2);
  const data=new Uint8Array(4*w*h*d);
  for(let k=0;k<d;k++)for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const x=box.min.x+(i-.5)*cell,y=box.min.y+(j-.5)*cell,z=box.min.z+(k-.5)*cell;
    let energy=0,nx=0,ny=0,nz=0;
    for(const {p,power,range,softness} of sources){
      const dx=p.x-x,dy=p.y-y,dz=p.z-z;
      const r2=dx*dx+dy*dy+dz*dz,limit=range*range;
      if(r2>=limit)continue;
      // Shade the floor and wall below a shielded fixture. A small amount of
      // reflected light can still reveal the blue siding above the shade.
      const down=.14+.86*THREE.MathUtils.smoothstep(dy,-1.4,.35);
      const fade=1-(r2/limit)**2;
      const e=down*power*fade*fade/(r2+softness*softness);
      const scale=e/Math.sqrt(Math.max(.001,r2));
      energy+=e;nx+=dx*scale;ny+=dy*scale;nz+=dz*scale;
    }
    const index=4*((k*h+j)*w+i);
    const norm=127/Math.max(energy,.001);
    data[index]=Math.round(128+nx*norm);
    data[index+1]=Math.round(128+ny*norm);
    data[index+2]=Math.round(128+nz*norm);
    data[index+3]=Math.round(255*Math.min(1,Math.log2(1+energy)/5));
  }
  const texture=new THREE.Data3DTexture(data,w,h,d);
  texture.format=THREE.RGBAFormat;texture.minFilter=texture.magFilter=THREE.LinearFilter;
  texture.needsUpdate=true;
  return {practicalField:{value:texture},practicalOrigin:{value:box.min.clone().addScalar(-cell)},
    practicalScale:{value:new THREE.Vector3(1/(w*cell),1/(h*cell),1/(d*cell))},practicalNight:{value:0}};
}

function receiveLight(material,uniforms){
  const before=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{
    before.call(material,shader,renderer);Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
      '#include <common>\nvarying vec3 practicalUV; uniform vec3 practicalOrigin,practicalScale;')
      .replace('#include <worldpos_vertex>',
        '#include <worldpos_vertex>\npracticalUV=((modelMatrix*vec4(transformed,1.)).xyz-practicalOrigin)*practicalScale;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
      '#include <common>\nvarying vec3 practicalUV; uniform highp sampler3D practicalField; uniform float practicalNight;')
      .replace('#include <lights_fragment_maps>',`#include <lights_fragment_maps>
        if(practicalNight>0. && all(greaterThan(practicalUV,vec3(0.))) && all(lessThan(practicalUV,vec3(1.)))){
          vec4 field=texture(practicalField,practicalUV);
          vec3 incident=mat3(viewMatrix)*((field.rgb*255.-128.)/127.);
          float facing=max(0.,dot(geometryNormal,incident));
          irradiance+=vec3(1.,.74,.48)*(exp2(5.*field.a)-1.)*(.27+.73*facing)*practicalNight;
        }`);
  };
  material.customProgramCacheKey=()=>key+'|fixed-exterior-light';material.needsUpdate=true;
}

export function installExteriorPracticals(model,fromPlan,snowMaterial){
  const sources=[],finishes=new Set();
  const metal=new THREE.MeshStandardMaterial({color:0x39352e,metalness:.38,roughness:.65});
  const glass=new THREE.MeshStandardMaterial({color:0xffeac4,emissive:0xffdb9e,emissiveIntensity:0,roughness:.48});
  const panel=new THREE.BoxGeometry(.15,.20,.10),hood=new THREE.BoxGeometry(.18,.065,.14);
  // Mount small steady, hooded sconces beside the doors. The separate
  // photographed twin-head motion floods retain their non-emissive lenses.
  function wallLamp(name,p,out,power,range){
    const lamp=new THREE.Group();lamp.name=name+' · steady sconce';
    lamp.position.copy(p);lamp.lookAt(p.clone().add(out));
    for(const [geometry,material,y,z] of [[panel,glass,0,.060],[hood,metal,.107,.065],[hood,metal,-.107,.065]]){
      const piece=new THREE.Mesh(geometry,material);piece.position.set(0,y,z);lamp.add(piece);
    }
    model.add(lamp);
    sources.push({p:p.clone().addScaledVector(out,.29),power,range,softness:1.2});
  }
  const garageOut=fromPlan(-1,0,0).sub(fromPlan(0,0,0)).normalize();
  const porchOut=fromPlan(0,-1,0).sub(fromPlan(0,0,0)).normalize();
  wallLamp('Near garage bay',fromPlan(-.16,4.75,-.79),garageOut,57,13);
  wallLamp('Far garage bay',fromPlan(-.16,26.78,-.79),garageOut,57,13);
  wallLamp('Front porch',fromPlan(33.53,-.14,1.78),porchOut,42,9.5);
  model.traverse(mesh=>{
    if(!mesh.isMesh)return;
    for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
      if(!mat.isMeshStandardMaterial)continue;
      if(receivers.test(mat.name))finishes.add(mat);
      if(mat.name==='Path lights · frosted lens'){
        for(const p of bulbCenters(mesh,.10))sources.push({p,power:5.2,range:4.2,softness:.78});
      }
    }
  });
  // A lower tread lies below the row of path lights. Its illuminated retaining
  // wall also returns light onto the stair nose and the edge of the drive.
  const tread=model.getObjectByName('WalkSurface_RetainerTread04');
  const nearSteps=new THREE.Box3().setFromObject(tread).getCenter(new THREE.Vector3());
  sources.push({p:nearSteps.add(new THREE.Vector3(1.1,1.25,.65)),power:23,range:7.4,softness:1.35});
  // The last stretch of cord rises above the switchback between deck and
  // gravel. Its spread reaches the turned landing and the chairs at the rim.
  const deck=model.getObjectByName('FestoonPool_Deck').getWorldPosition(new THREE.Vector3());
  const pergola=model.getObjectByName('FestoonPool_Pergola').getWorldPosition(new THREE.Vector3());
  const corner=fromPlan(40.70,35.84,0);corner.y=deck.y;
  sources.push({p:corner.clone().lerp(pergola,.15),power:21,range:9.6,softness:2.1});
  const flue=fromPlan(23.30,35.84,0);flue.y=deck.y;
  const pole=new THREE.Box3().setFromObject(model.getObjectByName('WalkBlock_LightPole1'));
  const top=pole.getCenter(new THREE.Vector3());top.y=pole.max.y;
  sources.push({p:flue.lerp(top,.65),power:18,range:9.4,softness:2.2});
  const uniforms=bakeLight(sources);
  finishes.add(snowMaterial);
  for(const mat of finishes)receiveLight(mat,uniforms);
  return night=>{uniforms.practicalNight.value=night;glass.emissiveIntensity=2.5*night;};
}
