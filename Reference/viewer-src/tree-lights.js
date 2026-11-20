import * as THREE from 'three';

export function bulbCenters(mesh,maxVertexDistance){
  const centers=[],point=new THREE.Vector3(),attr=mesh.geometry.getAttribute('position');
  for(let i=0;i<attr.count;i++){
    point.fromBufferAttribute(attr,i).applyMatrix4(mesh.matrixWorld);
    let bulb=centers.find(b=>b.first.distanceToSquared(point)<maxVertexDistance**2);
    if(!bulb){bulb={first:point.clone(),sum:new THREE.Vector3(),count:0};centers.push(bulb);}
    bulb.sum.add(point);bulb.count++;
  }
  return centers.map(b=>b.sum.divideScalar(b.count));
}

// Collect bulb centers from the actual modeled wire, including the drape
// between branches. This pass happens once, before static meshes are batched.
export function installTreeLights(scene,model,reducedMotion){
  const xyz=[],colors=[],phase=[];
  const palette={cherry:0xff473e,gold:0xffcd74,green:0x65f890,blue:0x698dff};
  model.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const match=mesh.material.name?.match(/(cherry|gold|green|blue) fairy light/i);
    if(!match)return;
    const color=new THREE.Color(palette[match[1].toLowerCase()]);
    for(const bulb of bulbCenters(mesh,.0292)){
      xyz.push(...bulb.toArray());colors.push(...color.toArray());
      phase.push(phase.length*2.39996);
    }
  });
  if(!xyz.length)return;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute('aPhase',new THREE.Float32BufferAttribute(phase,1));
  geometry.computeBoundingSphere();
  const uniforms={clock:{value:0},scalePx:{value:1},twinkle:{value:1}};
  const material=new THREE.ShaderMaterial({uniforms,vertexColors:true,depthTest:true,depthWrite:false,
    transparent:true,blending:THREE.AdditiveBlending,toneMapped:false,
    vertexShader:`
      uniform float clock,scalePx,twinkle;
      attribute float aPhase;
      varying vec3 tint; varying float shine;
      void main(){
        vec4 v=modelViewMatrix*vec4(position,1.0);
        gl_Position=projectionMatrix*v;
        float wave=sin(clock*(2.15+.3*sin(aPhase))+aPhase);
        shine=mix(1.0,.44+.56*smoothstep(-.85,.82,wave),twinkle);
        gl_PointSize=clamp(scalePx*.124*projectionMatrix[1][1]/max(.05,-v.z),3.0,64.0);
        tint=color;
      }`,
    fragmentShader:`
      varying vec3 tint; varying float shine;
      void main(){
        float r=length(gl_PointCoord*2.0-1.0);
        if(r>=1.0) discard;
        float halo=exp(-4.3*r)*(1.0-smoothstep(.5,1.0,r));
        float core=1.0-smoothstep(.015,.155,r);
        gl_FragColor=vec4(mix(tint,vec3(1.0),core*.72),shine*(core+.95*halo));
        #include <colorspace_fragment>
      }`});
  const stars=new THREE.Points(geometry,material);stars.name='Christmas tree · glowing fairy lights';scene.add(stars);
  const center=geometry.boundingSphere.center,frustum=new THREE.Frustum(),matrix=new THREE.Matrix4();
  return {update(camera,mode,seconds,height){
    stars.visible=mode!=='property' && camera.position.distanceToSquared(center)<144;
    if(!stars.visible)return false;
    camera.updateMatrixWorld();frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    stars.visible=frustum.intersectsSphere(geometry.boundingSphere);
    uniforms.clock.value=seconds;uniforms.scalePx.value=height*.5;uniforms.twinkle.value=reducedMotion.matches?0:1;
    return stars.visible&&!reducedMotion.matches;
  }};
}
