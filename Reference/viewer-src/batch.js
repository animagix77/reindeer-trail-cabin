import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Blender keeps each rail, floorboard and cabinet editable. Batch only fixed, opaque
// pieces in the viewer, preserving the original transforms and textured materials.
export function batchStatic(model) {
  const buckets=new Map();
  const conditional=/^(roof|terrain|wooded[ _]terrain|canopy|backdrop|walk(?:surface|block|spawn)|tax[ _]parcel|site[ _]section|vault[ _])|ceiling/i;
  model.traverseVisible(mesh=>{
    if(!mesh.isMesh || mesh.children.length || Array.isArray(mesh.material) || mesh.material.transparent || mesh.isSkinnedMesh || mesh.isInstancedMesh || mesh.morphTargetInfluences?.length) return;
    for(let ancestor=mesh;ancestor;ancestor=ancestor.parent) if(conditional.test(ancestor.name)) return;
    const attrs=Object.entries(mesh.geometry.attributes).map(([k,a])=>[k,a.itemSize,a.normalized,a.array?.constructor?.name].join(':')).sort().join('|');
    const key=[mesh.material.uuid,attrs,!!mesh.geometry.index,mesh.castShadow,mesh.receiveShadow].join('/');
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(mesh);
  });
  model.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(model.matrixWorld).invert();
  for(const meshes of buckets.values()){
    if(meshes.length<4) continue;
    const prepared=meshes.map(mesh=>{
      const geometry=mesh.geometry.clone();
      const relative=new THREE.Matrix4().multiplyMatrices(inv,mesh.matrixWorld);
      // Blender exports mirrored geometry with reversed winding on the node; reflect its triangles when baking the transform.
      if(relative.determinant()<0) {
        if(!geometry.index) geometry.setIndex(Array.from({length:geometry.attributes.position.count},(_,i)=>i));
        const index=geometry.index;
        for(let i=0;i<index.count;i+=3){const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b);}
      }
      geometry.applyMatrix4(relative);
      return geometry;
    });
    if(prepared.some(g=>!!g.index!==!!prepared[0].index)) {
      for(const g of prepared) if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
    }
    const geometry=mergeGeometries(prepared,false);
    prepared.forEach(g=>g.dispose());
    if(!geometry) continue;
    geometry.computeBoundingSphere();
    const batch=new THREE.Mesh(geometry,meshes[0].material);
    batch.name='Fixed material '+meshes[0].material.name;
    batch.castShadow=meshes[0].castShadow;batch.receiveShadow=meshes[0].receiveShadow;
    model.add(batch);
    meshes.forEach(mesh=>{mesh.visible=false;});
  }
}
