import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const ft=.3048,angle=5.4*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
function plan(x,y,height){
  return new THREE.Vector3(4.65-ft*(c*x+s*y),2.88+height,-8.5+ft*(-s*x+c*y));
}

// L1040560 shows the twin heads and sensor beside the front bedroom window.
// Use the same compact fitting on the solid rear wall beside the patio slider.
function wallFixture(scene,name,position,rotation){
  const fixture=new THREE.Group(),casting=[],glass=[];
  fixture.name=name+' · twin motion floodlight';
  fixture.position.copy(position);
  fixture.rotation.y=rotation; // Local -Z faces away from the mounting wall.
  function part(geometry,x,y,z,rx=0,ry=0,bucket=casting){
    geometry.rotateX(rx).rotateY(ry).translate(x,y,z);
    bucket.push(geometry);
  }
  part(new THREE.BoxGeometry(.11,.14,.039),0,0,-.016);
  part(new THREE.BoxGeometry(.18,.033,.05),0,.014,-.055);
  const glassFace=new THREE.PlaneGeometry(.105,.075);
  for(const side of [-1,1]){
    const tilt=-.56,yaw=-.22+side*.43;
    const p=new THREE.Vector3(side*.087,.035,-.087);
    part(new THREE.BoxGeometry(.126,.097,.049),p.x,p.y,p.z,tilt,yaw);
    const lens=glassFace.clone().rotateY(Math.PI).translate(0,0,-.0253);
    part(lens,p.x,p.y,p.z,tilt,yaw,glass);
  }
  glassFace.dispose();
  part(new THREE.SphereGeometry(.031,10,6),0,-.062,-.048);
  const enamel=new THREE.MeshStandardMaterial({color:0x252725,roughness:.55,metalness:.35});
  const lens=new THREE.MeshStandardMaterial({color:0xd2cdb4,roughness:.39});
  for(const [parts,material] of [[casting,enamel],[glass,lens]]){
    const combined=mergeGeometries(parts);
    const mesh=new THREE.Mesh(combined,material);mesh.receiveShadow=true;
    fixture.add(mesh);parts.forEach(g=>g.dispose());
  }
  scene.add(fixture);
}

export function addFloodlightFixtures(scene){
  wallFixture(scene,'Front entry',plan(39.07,-.08,1.81),-angle);
  wallFixture(scene,'Rear deck',plan(37.9,26.08,2.13),Math.PI-angle);
  // The unlit garage fixture is part of the exported cabin.
}
