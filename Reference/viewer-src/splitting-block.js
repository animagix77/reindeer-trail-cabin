import * as T from 'three';
import {createOakRound,oakGeometry} from './wood-fracture.js';
import {makeSplittingMaul} from './splitting-maul.js';

// Bark comes from the cabin's woodland photograph. The sawn cross-section
// keeps the same annual rings on both pieces as they separate.
const tau=2*Math.PI;
const clamp01=n=>Math.min(1,Math.max(0,n));
function timberTexture(w,h,paint){
  const bytes=new Uint8ClampedArray(w*h*4);
  let seed=371824;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const grain=paint((x+.5)/w,(y+.5)/h,seed/4294967296);
    const i=4*(y*w+x);
    bytes[i]=grain[0];bytes[i+1]=grain[1];bytes[i+2]=grain[2];bytes[i+3]=255;
  }
  const texture=new T.DataTexture(new Uint8Array(bytes.buffer),w,h);
  texture.colorSpace=T.SRGBColorSpace;texture.generateMipmaps=true;
  texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;
  texture.anisotropy=4;texture.needsUpdate=true;
  return texture;
}
function endGrain(){
  const checks=[.35,2.73,4.65];
  return timberTexture(384,384,(u,v,noise)=>{
    // Off-center pith and variable earlywood growth leave individual rings
    // different widths. Medullary rays and pores cross that larger pattern.
    const x=(u-.458)*2,z=(v-.541)*2.15;
    const a=Math.atan2(z,x),r=Math.hypot(x,z);
    const knot=Math.exp(-((x+.31)**2/.035+(z-.32)**2/.043));
    const growth=r*(1+.041*Math.sin(3*a+.8*r)+.024*Math.cos(5*a-2.1*r))+
      .012*Math.sin(12*x+3*z)*Math.sin(9*z)+.043*knot;
    const ring=22.8*growth+.81*Math.sin(12.1*growth)+.26*Math.sin(24*growth)+.17*Math.cos(36*growth);
    const band=.5+.5*Math.cos(tau*ring),latewood=band**3.8;
    const sap=clamp01((growth-.70+.033*Math.cos(a*3))/.14);
    const rays=Math.max(0,Math.sin(51*a+2.7*growth+.7*Math.sin(a*21)))**14;
    const saw=.5+.5*Math.sin(122*z+46*x+.65*Math.cos(x*17));
    const pore=latewood*Math.max(0,noise-.52)*52;
    const variation=7*Math.cos(13*growth)+5*Math.sin(13*x+8*z)+7*rays+3*saw+(noise-.5)*17-16*knot;
    let check=0;
    for(let i=0;i<checks.length;i++){
      const angle=checks[i]+.018*Math.sin(21*r+a)+.013*Math.cos(49*r+i);
      const width=.0045*clamp01((growth-.60-i*.035)/.2);
      const offset=Math.atan2(Math.sin(a-angle),Math.cos(a-angle));
      if(width)check=Math.max(check,clamp01(1-Math.abs(offset)*r/width)*clamp01((growth-.66)/.16));
    }
    const bandContrast=21+8*Math.sin(15*growth+2*Math.sin(a))+6*Math.cos(7*a);
    const shade=variation-bandContrast*latewood-pore-69*check;
    return [211+22*sap+shade,163+38*sap+shade,113+39*sap+shade];
  });
}

function splitGrain(){
  return timberTexture(256,192,(x,y,noise)=>{
    const knot=Math.exp(-((x-.68)**2/.009+(y-.38)**2/.046));
    const vessel=x+.020*Math.sin(12*x+2.1*y)+.008*Math.sin(21*x-3*y)+.006*y*Math.cos(45*x)+.031*knot;
    const earlywood=Math.sin(38*vessel+1.2*Math.sin(vessel*7));
    const ridges=Math.cos(214*vessel+y*1.1);
    const fibre=.5+.5*Math.cos(631*vessel+y*5+.7*Math.sin(y*12+x*4));
    const ray=Math.max(0,Math.sin(128*vessel-11*y+4*Math.sin(41*x+y*12)))**8;
    const sap=clamp01((Math.abs(x-.5)-.35)*7);
    const shade=9*earlywood+6*ridges-20*fibre**6+12*ray+(noise-.5)*20-15*knot;
    return [222+12*sap+shade*.78,187+17*sap+shade*1.14,137+24*sap+shade*1.42];
  });
}

function marker(mesh,name){mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;return mesh;}
export function makeSplittingBlock(model){
  const root=new T.Group();root.name='Driveway wood splitting';
  let tree;
  model.traverse(o=>{if(o.isMesh && !tree){for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.name==='Hardwood bark' && m.map)tree=m.map;}});
  const standard=(color,roughness,map)=>new T.MeshStandardMaterial({color,roughness,map,vertexColors:true});
  const bark=standard(tree?0xd6bfa1:0x655243,.98,tree||null);
  if(tree){bark.bumpMap=tree;bark.bumpScale=.002;}
  const end=standard(0xffffff,.94,endGrain()),split=standard(0xfff4de,.91,splitGrain());
  const materials=[bark,end,split];
  function blank(radius,height){
    const sample=createOakRound(0);
    return oakGeometry({...sample,height,radius,ring:sample.ring.map(({x,z})=>({x:x*radius/sample.radius,z:z*radius/sample.radius}))});
  }
  const top=.47;
  const base=marker(new T.Mesh(blank(.305,top),materials),'Scored chopping stump');root.add(base);
  let index=0,wood=createOakRound(index);
  const round=marker(new T.Mesh(oakGeometry(wood),materials),'Unsplit round');round.position.y=top;root.add(round);
  const rounds=[];
  for(let row=0;row<3;row++)for(let col=0;col<4-row;col++)rounds.push([-.60-col*.218-row*.105,.122+row*.187,-.35+.02*Math.sin(row+3*col)]);
  const cache=marker(new T.InstancedMesh(blank(.112,.36),materials,rounds.length),'Unsplit oak rounds');
  const obj=new T.Object3D();
  rounds.forEach(([x,y,z],i)=>{
    obj.position.set(x,y,z);obj.rotation.set(Math.PI/2,.035*Math.sin(i),0,'YXZ');obj.rotateY(i*.67);obj.scale.setScalar(.94+.06*Math.cos(i));obj.updateMatrix();cache.setMatrixAt(i,obj.matrix);
  });cache.computeBoundingSphere();root.add(cache);
  const tool=makeSplittingMaul(root);
  const flakes=new T.InstancedMesh(new T.OctahedronGeometry(1),new T.MeshStandardMaterial({color:0xbda078,roughness:.94}),8);
  flakes.name='Dislodged oak fibres';flakes.visible=false;flakes.frustumCulled=false;root.add(flakes);
  let chipHit=null;
  function clearChips(){chipHit=null;flakes.visible=false;}
  function flyChips(t,duration){
    const age=(t-tool.impactFraction)*duration;
    if(age<0 || t>=1){clearChips();return;}
    flakes.visible=true;
    for(let i=0;i<flakes.count;i++){
      const angle=i*2.4+chipHit.angle;
      const speed=.21+.04*i,up=.53+.13*((5*i+index)%7);
      const y=chipHit.y+.003+up*age-4.905*age*age;
      obj.position.set(chipHit.x+Math.cos(angle)*speed*age,y,chipHit.z+Math.sin(angle)*speed*age);
      obj.rotation.set(angle+age*(5+i),angle*.6,angle-age*(8-i));
      obj.scale.set(.0018,.0015,.005+i*.0008);
      obj.updateMatrix();flakes.setMatrixAt(i,obj.matrix);
    }
    flakes.instanceMatrix.needsUpdate=true;
  }

  // Fractures retain their original tree coordinates even when a billet tips
  // onto its side. Physics reports which of those meshes the stump supports.
  const supported=new Set([round]),timber=new WeakMap();
  const wholeCenter={x:0,z:0};
  timber.set(round,{wood,center:wholeCenter,centerY:0});
  const local=new T.Vector3(),inverse=new T.Quaternion(),normal=new T.Vector3();
  function sourcePoint(target,point){
    const item=timber.get(target);
    local.copy(point).sub(target.position).applyQuaternion(inverse.copy(target.quaternion).invert());
    return {x:local.x+item.center.x,y:local.y+item.centerY,z:local.z+item.center.z};
  }
  function sideEntry(point,wood){
    // The visible bark wanders a few millimetres along a billet. Match the
    // contact on it to the same lip of the undeformed grain cross-section.
    let closest=Infinity,x=point.x,z=point.z;
    for(let i=0;i<wood.ring.length;i++){
      const a=wood.ring[i],b=wood.ring[(i+1)%wood.ring.length],dx=b.x-a.x,dz=b.z-a.z;
      const u=clamp01(((point.x-a.x)*dx+(point.z-a.z)*dz)/(dx*dx+dz*dz));
      const px=a.x+u*dx,pz=a.z+u*dz,dist=(px-point.x)**2+(pz-point.z)**2;
      if(dist<closest){closest=dist;x=px;z=pz;}
    }
    point.x=x+.002*(wood.center.x-x);point.z=z+.002*(wood.center.z-z);
  }
  function onMesh(target,x,y,z){
    const item=timber.get(target);
    return new T.Vector3(x-item.center.x,y-item.centerY,z-item.center.z).applyQuaternion(target.quaternion).add(target.position);
  }
  return {...tool,root,round,top,
    get height(){return wood.height;},get radius(){return wood.radius;},get progress(){return wood.progress;},
    get targets(){return Array.from(supported);},
    setSupported(mesh,standing){
      if(!timber.has(mesh))return;
      if(standing)supported.add(mesh);else supported.delete(mesh);
    },
    grainCenter(target=supported.values().next().value){
      const item=timber.get(target);if(!item)return null;
      return onMesh(target,item.wood.center.x,item.wood.height*.5,item.wood.center.z);
    },
    aimDirection(target,nx,nz,face){
      const item=timber.get(target);
      normal.set(nx,0,nz).applyQuaternion(inverse.copy(target.quaternion).invert());
      // On a fallen billet the blade enters the side and opens a seam along
      // its length. The cross-sectional normal lies tangent to that side.
      const side=Math.abs(face.y)<.55;
      const cut=side
        ?{nx:face.z/Math.hypot(face.x,face.z),nz:-face.x/Math.hypot(face.x,face.z)}
        :item.wood.grainDirection(normal.x,normal.z);
      normal.set(cut.nx,0,cut.nz).applyQuaternion(target.quaternion);
      const horizontal=Math.hypot(normal.x,normal.z);
      return {nx:horizontal>.001?normal.x/horizontal:nx,nz:horizontal>.001?normal.z/horizontal:nz,grainNX:cut.nx,grainNZ:cut.nz,sideFace:side};
    },
    begin(){
      if(supported.size)return false;
      clearChips();wood=createOakRound(++index);
      round.geometry.dispose();round.geometry=oakGeometry(wood);round.visible=true;
      timber.set(round,{wood,center:wholeCenter,centerY:0});supported.add(round);return true;
    },
    rest(){clearChips();tool.rest();},
    stroke(t,good,reduced,camera,aim){
      tool.stroke(t,good,reduced,camera,aim);
      if(chipHit){if(reduced)clearChips();else flyChips(t,aim?.duration??tool.swingDuration);}
    },
    impact(hit){
      const target=hit.target??round,item=timber.get(target);
      if(!item || !supported.has(target))return {split:false,bite:false,pieces:[]};
      const billet=item.wood,before=billet.revision;
      const at=sourcePoint(target,hit);
      if(hit.sideFace)sideEntry(at,billet);
      const result=billet.strike({...at,nx:hit.grainNX??hit.nx,nz:hit.grainNZ??hit.nz,energy:hit.energy});
      result.bite=billet.revision!==before;result.area=billet.area;
      if(result.bite){
        chipHit={x:hit.x,y:hit.y,z:hit.z,angle:Math.atan2(hit.nz,hit.nx)};
        flakes.count=result.split?8:4;
      }
      const cut=result.cut;
      if(cut){
        const point=onMesh(target,cut.x,at.y,cut.z);
        normal.set(cut.nx,0,cut.nz).applyQuaternion(target.quaternion);
        result.cut={...cut,x:point.x,y:point.y,z:point.z,nx:normal.x,ny:normal.y,nz:normal.z};
      }
      if(!result.split){
        if(result.bite){
          target.geometry.dispose();
          target.geometry=oakGeometry(billet,billet.ring,null,item.center,item.centerY);
        }
        return result;
      }
      result.pieces=result.pieces.map(({polygon,center,billet:child,...body})=>{
        const geometry=oakGeometry(billet,polygon,cut,center,billet.height/2);
        const mesh=marker(new T.Mesh(geometry,materials),'Split oak firewood');
        mesh.position.copy(onMesh(target,center.x,billet.height/2,center.z));
        mesh.quaternion.copy(target.quaternion);
        if(child)timber.set(mesh,{wood:child,center,centerY:billet.height/2});
        return {mesh,...body,choppable:!!child};
      });
      supported.delete(target);
      if(target===round)round.visible=false;
      else {target.removeFromParent();target.geometry.dispose();}
      return result;
    }
  };
}
