import * as T from 'three';
import {makeSplittingMaul} from './splitting-maul.js';

// Bark comes from the cabin's woodland photograph. The sawn cross-section
// keeps the same annual rings on both pieces as they separate.
function endGrain(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const c=canvas.getContext('2d');
  c.fillStyle='#c59b65';c.fillRect(0,0,256,256);
  for(let ring=1;ring<85;ring++){
    const radius=ring*2.08;
    c.strokeStyle=ring%4?'rgba(105,69,41,.31)':'rgba(92,60,38,.44)';
    c.lineWidth=ring%4?.7:1.2;c.beginPath();
    for(let j=0;j<=120;j++){
      const a=j*Math.PI/60,r=radius*(1+.034*Math.sin(3*a+ring*.016)+.012*Math.cos(8*a))+.32*Math.sin(a*18+ring);
      const x=119+Math.cos(a)*r,y=139+Math.sin(a)*r*.96;
      if(j)c.lineTo(x,y);else c.moveTo(x,y);
    }
    c.stroke();
  }
  for(const [a,length] of [[.32,65],[2.62,47],[4.70,39],[5.41,22]]){
    c.strokeStyle='#654b34';c.lineWidth=1.1;c.beginPath();
    for(let j=0;j<=6;j++){
      const r=122-length*j/6,angle=a+Math.sin(j*3+a)*.013;
      const x=128+r*Math.cos(angle),y=128+r*Math.sin(angle);
      if(j)c.lineTo(x,y);else c.moveTo(x,y);
    }c.stroke();
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  return texture;
}

function billet(radius,height,start=0,arc=Math.PI*2){
  const positions=[],uv=[],g=new T.BufferGeometry();
  const count=Math.round(24*arc/(2*Math.PI));
  function vertex(p,st){positions.push(...p);uv.push(...st);}
  function triangle(a,b,c,ta,tb,tc){vertex(a,ta);vertex(b,tb);vertex(c,tc);}
  function ring(a,top){
    const rr=radius*(1+.031*Math.sin(3*a+.7)+.022*Math.cos(7*a))*(top?.965:1);
    return [rr*Math.cos(a)+(top?radius*.025:0),top?height:0,rr*Math.sin(a)];
  }
  const endUV=p=>[.5+p[0]/radius*.46,.5+p[2]/radius*.46];
  let last=0;
  function group(index){const n=positions.length/3;g.addGroup(last,n-last,index);last=n;}
  for(let j=0;j<count;j++){
    const a=start+arc*j/count,b=start+arc*(j+1)/count;
    const a0=ring(a,false),a1=ring(a,true),b0=ring(b,false),b1=ring(b,true);
    const u0=a/(2*Math.PI)*1.35,u1=b/(2*Math.PI)*1.35;
    triangle(a0,a1,b0,[u0,0],[u0,1],[u1,0]);triangle(b0,a1,b1,[u1,0],[u0,1],[u1,1]);
  }group(0);
  for(const top of [false,true]){
    const center=[top?radius*.025:0,top?height:0,0];
    for(let j=0;j<count;j++){
      const a=ring(start+arc*j/count,top),b=ring(start+arc*(j+1)/count,top);
      if(top)triangle(center,b,a,endUV(center),endUV(b),endUV(a));
      else triangle(center,a,b,endUV(center),endUV(a),endUV(b));
    }
  }group(1);
  if(arc<2*Math.PI-.001){
    for(const [a,rev] of [[start,false],[start+arc,true]]){
      const p=[0,0,0],q=ring(a,false),s=[radius*.025,height,0],r=ring(a,true);
      if(!rev){triangle(p,s,q,[0,0],[0,1],[1,0]);triangle(q,s,r,[1,0],[0,1],[1,1]);}
      else{triangle(p,q,s,[0,0],[1,0],[0,1]);triangle(q,r,s,[1,0],[1,1],[0,1]);}
    }group(2);
  }
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();
  return g;
}

// Slice the actual loaded round through the blade. Its bark and both rings
// keep their original UVs, even when a cut near the rim takes off a thin piece.
function splitBillet(source,cut,side){
  const shape=source.attributes.position,texture=source.attributes.uv;
  const geometry=new T.BufferGeometry(),positions=[],uv=[],crossings=[];
  const distance=p=>side*((p[0]-cut.x)*cut.nx+(p[2]-cut.z)*cut.nz);
  function vertex(p){positions.push(p[0],p[1],p[2]);uv.push(p[3],p[4]);}
  for(const {start,count,materialIndex} of source.groups){
    const first=positions.length/3;
    for(let i=start;i<start+count;i+=3){
      const polygon=[],triangle=[];
      for(let j=i;j<i+3;j++)triangle.push([shape.getX(j),shape.getY(j),shape.getZ(j),texture.getX(j),texture.getY(j)]);
      for(let j=0;j<3;j++){
        const a=triangle[j],b=triangle[(j+1)%3],da=distance(a),db=distance(b);
        if(da>=0)polygon.push(a);
        if((da>=0)!==(db>=0)){
          const t=da/(da-db);
          polygon.push(a.map((value,k)=>T.MathUtils.lerp(value,b[k],t)));
        }
      }
      if(materialIndex===0)for(const p of polygon)if(Math.abs(distance(p))<1e-7)crossings.push(p);
      for(let j=1;j+1<polygon.length;j++){vertex(polygon[0]);vertex(polygon[j]);vertex(polygon[j+1]);}
    }
    geometry.addGroup(first,positions.length/3-first,materialIndex);
  }
  const along=p=>p[2]*cut.nx-p[0]*cut.nz;
  crossings.sort((a,b)=>along(a)-along(b));
  const height=Math.max(...crossings.map(p=>p[1])),bottom=crossings.filter(p=>p[1]<1e-7),top=crossings.filter(p=>p[1]>height-1e-7);
  const face=[bottom[0],bottom.at(-1),top.at(-1),top[0]];
  if(side<0)face.reverse();
  const first=positions.length/3;
  for(const i of [0,1,2,0,2,3]){
    const p=face[i];vertex([p[0],p[1],p[2],.5+along(p)/.27,p[1]/height]);
  }
  geometry.addGroup(first,6,2);
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();return geometry;
}

function marker(mesh,name){mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;return mesh;}
export function makeSplittingBlock(model){
  const root=new T.Group();root.name='Driveway wood splitting';
  let tree;
  model.traverse(o=>{if(o.isMesh && !tree){for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.name==='Hardwood bark' && m.map)tree=m.map;}});
  const standard=(color,roughness,metalness=0,map=null)=>new T.MeshStandardMaterial({color,roughness,metalness,map});
  const bark=standard(tree?0xaf9675:0x655243,.98,0,tree);
  const end=standard(0xffffff,.94,0,endGrain()),split=standard(0xb88a58,.93);
  const materials=[bark,end,split];
  const mesh=(g,m,name)=>marker(new T.Mesh(g,m),name);
  const base=mesh(billet(.305,.47),materials,'Scored chopping stump');root.add(base);
  const top=.47;
  const round=mesh(billet(.133,.29),materials,'Unsplit round');round.position.y=top;root.add(round);
  const halves=[0,1].map(i=>{
    const m=mesh(new T.BufferGeometry(),materials,'Matching split half '+i);root.add(m);return m;
  });
  // Stack short rounds and wedges on the shoulder, beyond the swing.
  const rounds=[];
  for(let row=0;row<3;row++)for(let col=0;col<4-row;col++)rounds.push([-.60-col*.218-row*.105,.122+row*.187,-.35+.02*Math.sin(row+3*col)]);
  const cache=marker(new T.InstancedMesh(billet(.112,.36),materials,rounds.length),'Unsplit oak rounds');
  const obj=new T.Object3D();
  rounds.forEach(([x,y,z],i)=>{
    obj.position.set(x,y,z);obj.rotation.set(Math.PI/2,.035*Math.sin(i),0,'YXZ');obj.rotateY(i*.67);obj.scale.setScalar(.94+.06*Math.cos(i));obj.updateMatrix();cache.setMatrixAt(i,obj.matrix);
  });cache.computeBoundingSphere();root.add(cache);
  const pieces=marker(new T.InstancedMesh(billet(.104,.36,0,Math.PI*.68),materials,14),'Split wood ready to carry');
  for(let i=0;i<pieces.instanceMatrix.count;i++){
    const row=i<5?0:i<9?1:i<12?2:3,first=[0,5,9,12][row];
    obj.position.set(.65+(i-first)*.134+row*.059,.155+.105*row,-.32+.012*Math.sin(i*3));
    obj.rotation.set(Math.PI/2,-.05+.012*(i%6),Math.PI*.07,'YXZ');obj.scale.setScalar(1);obj.updateMatrix();pieces.setMatrixAt(i,obj.matrix);
  }
  pieces.computeBoundingSphere();pieces.count=0;root.add(pieces);
  // Two sleepers and four short retaining stakes keep the earned pieces clear
  // of the damp gravel and establish the rack footprint before it fills.
  const rails=marker(new T.InstancedMesh(new T.BoxGeometry(1,1,1),split,6),'Split log cradle');
  const boards=[[.92,.032,-.26,.94,.064,.066],[.92,.032,-.025,.94,.064,.066]];
  for(const xx of [.48,1.36])for(const zz of [-.26,-.025])boards.push([xx,.15,zz,.042,.30,.048]);
  boards.forEach(([x,y,z,w,h,d],i)=>{obj.position.set(x,y,z);obj.rotation.set(0,0,0);obj.scale.set(w,h,d);obj.updateMatrix();rails.setMatrixAt(i,obj.matrix);});
  rails.computeBoundingSphere();root.add(rails);
  const tool=makeSplittingMaul(root);
  for(const half of halves)half.visible=false;
  const chips=marker(new T.InstancedMesh(new T.TetrahedronGeometry(.021),split,8),'Flying wood fibers');root.add(chips);chips.visible=false;
  let fractureCut=null;
  const rollAxis=new T.Vector3();
  function fracture(t){
    if(!fractureCut){
      fractureCut={...tool.cut};
      halves.forEach((part,i)=>{
        part.geometry.dispose();part.geometry=splitBillet(round.geometry,fractureCut,i?-1:1);
      });
    }
    const {nx,nz,x,z}=fractureCut,eased=1-(1-t)*(1-t);
    rollAxis.set(nz,0,-nx);
    halves.forEach((part,i)=>{
      const sign=i?-1:1,tilt=sign*.62*eased;part.visible=true;
      part.position.set(sign*nx*.112*eased,top+.133*Math.sin(Math.abs(tilt))+.018*Math.sin(Math.PI*t),sign*nz*.112*eased);
      part.quaternion.setFromAxisAngle(rollAxis,tilt);
    });
    round.visible=false;chips.visible=t<1;
    if(t<1){
      for(let i=0;i<8;i++){
        const a=i*2.4;obj.position.set(x+Math.cos(a)*.34*t,top+.29+.82*t-1.14*t*t,z+Math.sin(a)*.35*t);
        obj.rotation.set(i+3.6*t,a+t,i);obj.scale.set(.47,1.5,.83);obj.updateMatrix();chips.setMatrixAt(i,obj.matrix);
      }
      chips.instanceMatrix.needsUpdate=true;chips.frustumCulled=false;
    }
  }
  return {...tool,root,round,halves,
    begin(){fractureCut=null;round.visible=true;for(const h of halves)h.visible=false;chips.visible=false;},
    stroke(t,good,reduced,camera,aim){
      if(camera)tool.stroke(t,good,reduced,camera,aim);
      if(good && t>=tool.impactFraction)fracture(reduced?1:Math.min(1,(t-tool.impactFraction)/(1-tool.impactFraction)));
    },
    inventory(n){pieces.count=Math.min(pieces.instanceMatrix.count,n);}
  };
}
