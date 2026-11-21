import * as T from 'three';

// Planting beds in the cabin's survey coordinates (feet). Their soft edges
// leave the paths and gathering areas open. The last two sit in front-yard soil.
const beds=[
  [-35,7,4,19],[-33,39,6,13],[-18,50,10,7],[-1,65,12,7],
  [13,74,12,5],[34,74,11,5],[53,60,6,11],[55,21,4,12],
  [48,-2,4,9],[7.8,-1.6,2.3,1.8],[40.4,-11,2.9,2.3]
];

function makeTuft(random){
  const positions=[],colors=[],bends=[],indices=[];
  const olive=new T.Color(0x5f6d46),sage=new T.Color(0xa4ae78);
  const straw=new T.Color(0xd5b77c),oat=new T.Color(0xe1c48a);
  function vertex(x,y,z,color,bend){
    positions.push(x,y,z);colors.push(color.r,color.g,color.b);bends.push(bend);
    return bends.length-1;
  }
  for(let blade=0;blade<9;blade++){
    const angle=blade*2.39996+random()*.48,dx=Math.cos(angle),dz=Math.sin(angle);
    const radial=.012+.065*random(),height=.32+random()*.30,reach=.085+random()*.19;
    const width=.011+random()*.010,tip=blade%4===0?straw:sage;
    const color=olive.clone(),start=bends.length;
    // The centre rib stands proud of the edges. Its two planes catch the sun
    // separately, like a folded leaf, even at the thinnest part of the blade.
    for(const [t,w] of [[0,.65],[.46,1],[.82,.50]]){
      const r=radial+reach*t*t,y=height*(t-.16*t*t*t);
      color.copy(olive).lerp(tip,t);
      vertex(dx*r-dz*width*w,y,dz*r+dx*width*w,color,t*t);
      vertex(dx*(r+.005*w),y,dz*(r+.005*w),color,t*t);
      vertex(dx*r+dz*width*w,y,dz*r-dx*width*w,color,t*t);
    }
    const end=vertex(dx*(radial+reach),height*.84,dz*(radial+reach),tip,1);
    for(const a of [start,start+3]){
      indices.push(a,a+1,a+3,a+1,a+4,a+3,a+1,a+2,a+4,a+2,a+5,a+4);
    }
    indices.push(start+6,start+7,end,start+7,start+8,end);
  }
  // One open seed head breaks up the silhouette of the leafy clump.
  const seedAngle=random()*Math.PI*2,dx=Math.cos(seedAngle),dz=Math.sin(seedAngle);
  const stem=(t,w,side,color)=>vertex(dx*.12*t*t-dz*w*side,.67*t,dz*.12*t*t+dx*w*side,color,t*t);
  const s=bends.length;
  for(const t of [0,.65,1]){stem(t,.0034,-1,straw);stem(t,.0034,1,straw);}
  indices.push(s,s+1,s+2,s+1,s+3,s+2,s+2,s+3,s+4,s+3,s+5,s+4);
  for(let k=0;k<7;k++){
    const t=.78+k*.031,side=k%2?1:-1,spread=.015+.018*(1-k/7);
    const root=stem(t,0,0,straw),mid=stem(t+.023,spread*.42,side,straw);
    const tip=stem(t+.047,spread,side,oat),edge=stem(t+.032,spread*.76,side,oat);
    indices.push(root,mid,edge,mid,tip,edge);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.setAttribute('grassBend',new T.Float32BufferAttribute(bends,1));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}

export function installWoodlandGrass(scene,model,space,motion){
  let seed=74913;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const soil=/^(Leaf litter and low cover|Cool-season fescue)$/;
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3(),edge=new T.Vector3();
  const rotation=Math.PI*5.4/180,co=Math.cos(rotation),si=Math.sin(rotation);
  const instances=[],patchBounds=beds.map(()=>new T.Box3());
  model.traverse(mesh=>{
    if(!mesh.isMesh || !soil.test(mesh.material.name))return;
    const geometry=mesh.geometry,position=geometry.getAttribute('position'),index=geometry.index;
    const point=(out,i)=>out.fromBufferAttribute(position,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);
    const total=index?index.count:position.count;
    for(let i=0;i<total;i+=3){
      point(a,i);point(b,i+1).sub(a);point(c,i+2).sub(a);
      normal.crossVectors(b,c);
      if(normal.y<.76*normal.length())continue;
      const candidates=Math.floor(normal.y*.5*8+random()); // eight per square metre before thinning
      for(let j=0;j<candidates;j++){
        let u=random(),v=random();if(u+v>1){u=1-u;v=1-v;}
        edge.copy(a).addScaledVector(b,u).addScaledVector(c,v);
        const ex=(edge.x-4.65)/.3048,nz=(edge.z+8.5)/.3048;
        const x=-co*ex-si*nz,y=-si*ex+co*nz;
        let density=0,patch=0;
        for(let k=0;k<beds.length;k++){
          const [cx,cy,rx,ry]=beds[k];
          const distance=((x-cx)/rx)**2+((y-cy)/ry)**2;
          if(1-distance>density){density=1-distance;patch=k;}
        }
        if(random()>=density)continue;
        const floors=space.heights(edge.x,edge.z);
        const ground=floors.find(f=>f.label==='WalkSurface_ParcelGround');
        if(!ground || Math.abs(ground.y-edge.y)>.16 || floors.some(f=>f.label!==ground.label) ||
           !space.settle(edge.x,edge.z,ground,floors))continue;
        const height=(.67+random()*.53)*(y<0?.67:1);
        instances.push({x:edge.x,y:edge.y-.016,z:edge.z,angle:random()*Math.PI*2,height,tint:random()});
        patchBounds[patch].expandByPoint(edge);
      }
    }
  });
  const material=new T.MeshLambertMaterial({side:T.DoubleSide,vertexColors:true});
  material.name='Woodland grasses · sage leaves and oat seed';
  const time={value:0},wind={value:0};
  material.onBeforeCompile=shader=>{
    shader.uniforms.grassTime=time;shader.uniforms.grassWind=wind;
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute float grassBend; uniform float grassTime, grassWind;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        vec2 root=instanceMatrix[3].xz;
        float sweep=sin(dot(root,vec2(.43,.27))+grassTime*.94);
        float ripple=sin(dot(root,vec2(.9,.56))-grassTime*1.83+position.y);
        vec2 breeze=vec2(.058,.031)*sweep+vec2(.014,-.007)*ripple;
        // Convert the same wind field into each rotated tuft's local frame.
        transformed.xz+=grassBend*grassWind*vec2(dot(normalize(instanceMatrix[0].xz),breeze),
                                                 dot(normalize(instanceMatrix[2].xz),breeze));`);
  };
  const mesh=new T.InstancedMesh(makeTuft(random),material,instances.length);
  mesh.name='Tall grass along the woodland edge';mesh.receiveShadow=true;
  const dummy=new T.Object3D(),tint=new T.Color();
  for(const [i,plant] of instances.entries()){
    dummy.position.set(plant.x,plant.y,plant.z);dummy.rotation.y=plant.angle;
    dummy.scale.setScalar(plant.height);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    tint.setRGB(.75+.25*plant.tint,.82+.16*plant.tint,.76+.15*plant.tint);mesh.setColorAt(i,tint);
  }
  mesh.computeBoundingSphere();
  mesh.boundingSphere.radius+=.12;
  scene.add(mesh);
  const patches=patchBounds.filter(box=>!box.isEmpty()).map(box=>box.expandByScalar(.9).getBoundingSphere(new T.Sphere()));
  const frustum=new T.Frustum(),view=new T.Matrix4();
  return function updateGrass(camera,seconds,outdoors){
    wind.value=motion.matches?0:1;time.value=seconds%4096;
    if(!outdoors || motion.matches)return false;
    frustum.setFromProjectionMatrix(view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    return patches.some(patch=>frustum.intersectsSphere(patch));
  };
}
