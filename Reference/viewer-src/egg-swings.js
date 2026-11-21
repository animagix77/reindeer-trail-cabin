import * as THREE from 'three';

// The exporter combines both baskets by material. Give each swing its own
// triangle list while retaining the authored vertices, normals and UVs.
function separateChairs(mesh,centers){
  const source=mesh.geometry,positions=source.getAttribute('position'),index=source.index;
  const sides=[[],[]],bounds=[new THREE.Box3(),new THREE.Box3()];
  const vertex=new THREE.Vector3();
  const count=index?.count??positions.count;
  for(let i=0;i<count;i+=3){
    const a=index?index.getX(i):i;
    vertex.fromBufferAttribute(positions,a).applyMatrix4(mesh.matrixWorld);
    const dx=vertex.x-centers[0].x,dz=vertex.z-centers[0].z;
    const ex=vertex.x-centers[1].x,ez=vertex.z-centers[1].z;
    const side=dx*dx+dz*dz<ex*ex+ez*ez?0:1;
    for(let k=0;k<3;k++){
      const j=index?index.getX(i+k):i+k;
      sides[side].push(j);
      bounds[side].expandByPoint(vertex.fromBufferAttribute(positions,j));
    }
  }
  return sides.map((indices,i)=>{
    const g=new THREE.BufferGeometry();
    for(const [key,attr] of Object.entries(source.attributes))g.setAttribute(key,attr);
    g.setIndex(indices);
    g.boundingBox=bounds[i];g.boundingSphere=bounds[i].getBoundingSphere(new THREE.Sphere());
    const part=mesh.clone(false);part.geometry=g;
    return part;
  });
}

export function installEggSwings(model,reducedMotion){
  const cushions=[];
  let baskets,chains;
  model.traverse(o=>{
    if(!o.isMesh)return;
    if(/tufted[ _]canvas[ _]basket[ _]cushion/.test(o.name))cushions.push(o);
    if(o.material.name==='Suspended baskets · dark woven cane')baskets=o;
    if(o.material.name==='Suspension chains · galvanized links')chains=o;
  });
  if(cushions.length!==2||!baskets||!chains)return;
  const centers=cushions.map(p=>new THREE.Box3().setFromObject(p).getCenter(new THREE.Vector3()));
  const shells=separateChairs(baskets,centers),links=separateChairs(chains,centers);
  const pivots=cushions.map((cushion,i)=>{
    baskets.parent.add(shells[i]);chains.parent.add(links[i]);
    const chainBounds=new THREE.Box3().setFromObject(links[i]);
    const pivot=new THREE.Group();
    pivot.name='EggSwingPivot'+(i+1);
    chainBounds.getCenter(pivot.position);pivot.position.y=chainBounds.max.y;
    model.worldToLocal(pivot.position);model.add(pivot);
    for(const piece of [links[i],shells[i],cushion])pivot.attach(piece);
    return pivot;
  });
  baskets.removeFromParent();chains.removeFromParent();
  const axis=pivots[1].position.clone().sub(pivots[0].position);axis.y=0;axis.normalize();
  const visibleArea=new THREE.Sphere(centers[0].clone().lerp(centers[1],.5),2.1);
  const frustum=new THREE.Frustum(),matrix=new THREE.Matrix4();
  function reset(){for(const pivot of pivots)pivot.quaternion.identity();}
  return (camera,seconds,walking)=>{
    if(!walking||reducedMotion.matches){reset();return false;}
    if(camera.position.distanceToSquared(visibleArea.center)>30**2)return false;
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    if(!frustum.intersectsSphere(visibleArea))return false;
    // The cushions travel only a few centimetres. Each pendulum has its own
    // phase and a slowly changing amplitude, like a light, uneven breeze.
    for(const [i,pivot] of pivots.entries()){
      const envelope=.75+.25*Math.sin(seconds*.36+i*1.4);
      const angle=.017*envelope*Math.sin(seconds*(2.46-i*.13)+i*2.2);
      pivot.quaternion.setFromAxisAngle(axis,angle);
    }
    return true;
  };
}
