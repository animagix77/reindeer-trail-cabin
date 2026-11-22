import * as T from 'three';

const material=(color,roughness=.58)=>new T.MeshStandardMaterial({color,roughness,side:T.DoubleSide});
function mesh(group,geometry,finish,x=0,y=0,z=0){
  const part=new T.Mesh(geometry,finish);
  part.position.set(x,y,z);part.castShadow=part.receiveShadow=true;group.add(part);return part;
}
function rod(group,from,to,radius,finish){
  const a=new T.Vector3(...from),b=new T.Vector3(...to),v=b.clone().sub(a);
  const part=mesh(group,new T.CylinderGeometry(radius,radius,v.length(),10),finish);
  part.position.copy(a).lerp(b,.5);part.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());
}
export function plasticSled(color){
  const group=new T.Group(),plastic=material(color,.33),rope=material(0xcbbfa5);
  // The nose curls upward, with a raised lip and parallel molded runners.
  const vertices=[],faces=[];
  const rows=16,cols=10;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const v=j/rows,u=i/cols*2-1,tip=Math.max(0,(v-.73)/.27);
    vertices.push(u*(.225-.065*tip*tip-.02*(1-v)**4),
      .044*Math.abs(u)**6+.105*tip**2+.024*(1-v)**10,
      .58-1.16*v);
    if(i&&j){const k=vertices.length/3-1;faces.push(k-cols-2,k-cols-1,k,k-cols-2,k,k-1);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geometry.setIndex(faces);geometry.computeVertexNormals();mesh(group,geometry,plastic);
  for(const x of [-.14,-.07,.07,.14])rod(group,[x,.007,-.32],[x,.007,.40],.011,plastic);
  for(const side of [-1,1])rod(group,[side*.14,.115,-.57],[side*.14,.07,-.68],.006,rope);
  rod(group,[-.14,.07,-.68],[.14,.07,-.68],.006,rope);
  return group;
}
function snowShovel(){
  const group=new T.Group(),blue=material(0x316489,.38),metal=material(0x929ba2),grip=material(0x30363a);
  const v=[],ix=[];
  for(let j=0;j<5;j++)for(let i=0;i<9;i++){
    const y=j*.082,u=(i-4)/4;
    v.push(u*(.235-y*.06),y,.07*u*u+.05*Math.sin(j*Math.PI/4));
    if(i&&j){const k=j*9+i;ix.push(k-10,k-9,k,k-10,k,k-1);}
  }
  const blade=new T.BufferGeometry();blade.setAttribute('position',new T.Float32BufferAttribute(v,3));blade.setIndex(ix);blade.computeVertexNormals();mesh(group,blade,blue);
  rod(group,[-.23,.004,.07],[.23,.004,.07],.009,metal);
  rod(group,[0,.21,-.008],[0,1.12,-.09],.017,metal);
  for(const side of [-1,1])rod(group,[0,1.10,-.09],[side*.065,1.22,-.09],.012,grip);
  rod(group,[-.07,1.22,-.09],[.07,1.22,-.09],.018,grip);
  return group;
}

export function garageGear(scene,space,camera,{pack,visit,schedule,reduced}){
  const fixtures=[],parked=snowShovel(),held=parked.clone();
  function park(object,y,name){
    const x=-1.28,px=4.65-.3048*(.995562*x+.094108*y),pz=-8.5+.3048*(-.094108*x+.995562*y);
    const floor=space.heights(px,pz).reduce((v,h)=>Math.max(v,h.y),-Infinity);
    object.position.set(px,floor,pz);object.name=name;scene.add(object);
  }
  park(parked,4.45,'Driveway snow shovel');
  parked.rotation.order='YXZ';parked.rotation.y=Math.PI/2-.094;parked.rotation.x=-.22;fixtures.push(parked);
  const sleds=[['Blue',0x205ba4,14.63],['Red',0xb62e35,16.86]];
  for(const [name,color,y] of sleds){
    const sled=plasticSled(color);park(sled,y,name+' plastic sled');
    sled.position.y+=.57;sled.rotation.order='YXZ';sled.rotation.y=Math.PI/2-.094;sled.rotation.x=1.36;
    sled.userData.color=color;fixtures.push(sled);
  }
  const button=document.getElementById('return-shovel');
  held.visible=false;held.name='Carried snow shovel';scene.add(held);
  let equipped=false,lastStroke=-Infinity;
  function putBack(){
    equipped=false;held.visible=false;parked.visible=true;button.hidden=true;
    document.documentElement.classList.remove('shoveling');schedule();
  }
  button.addEventListener('click',()=>{putBack();document.getElementById('view').focus({preventScroll:true});});
  return {
    get equipped(){return equipped;},putBack,
    aim(cast){
      if(equipped){
        const contact=pack()?.hit(cast.ray);
        return contact?{id:'scoop',contact,caption:'Shovel snow'}:null;
      }
      cast.far=Math.min(cast.far,2.85);
      const hit=cast.intersectObjects(fixtures,true)[0];
      if(!hit)return null;
      const item=fixtures.find(f=>f.children.includes(hit.object));
      if(!item)return null;
      return {id:item===parked?'shovel':'sled',item,contact:hit,caption:item===parked?'Pick up shovel':'Sled at Lake Superior'};
    },
    use(target,direction){
      if(target.id==='sled'){visit(target.item.userData.color);return true;}
      if(target.id==='shovel'){equipped=true;held.visible=true;parked.visible=false;button.hidden=false;document.documentElement.classList.add('shoveling');return true;}
      const now=performance.now()/1000;
      if(now-lastStroke<.48||!pack()?.scoop(target.contact.point,direction))return false;
      lastStroke=now;return true;
    },
    update(seconds,outdoors){
      if(!equipped)return false;
      if(!outdoors){putBack();return false;}
      const t=T.MathUtils.clamp((seconds-lastStroke)/.55,0,1),swing=reduced.matches?0:Math.sin(Math.PI*t);
      held.position.set(.29,-.27-.08*swing,-.78-.16*swing).applyQuaternion(camera.quaternion).add(camera.position);
      held.quaternion.copy(camera.quaternion);
      held.rotateZ(.15+.10*swing);held.rotateX(2.0+.25*swing);held.scale.setScalar(.78);
      return t<1;
    }
  };
}
