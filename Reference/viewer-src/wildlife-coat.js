// Surface nets join the rib cage, neck and leg muscles into one continuous
// pelt. Bone weights and coat pigment blend across the same anatomical seams.
import * as T from 'three';
const pitch=.019,pad=.061,smooth=.032;
const edgePairs=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
const clamp=T.MathUtils.clamp;
const fade=T.MathUtils.smoothstep;
const bell=(x,center,width)=>Math.exp(-Math.pow((x-center)/width,2));

function outline(part){
  const rows=part.rows,edges=[],bounds=new T.Box3();
  for(let i=0;i<rows.length-1;i++){
    const a=rows[i],b=rows[i+1],d=new T.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]),len=d.length();
    if(len<.0002)continue;
    d.multiplyScalar(1/len);
    const across=Math.abs(d.x)<.9?new T.Vector3(1,0,0):new T.Vector3(0,1,0);
    across.addScaledVector(d,-d.dot(across)).normalize();
    const up=d.clone().cross(across);
    edges.push({a,b,d,len,across,up});
  }
  for(const [x,y,z,w,h] of rows){
    const r=Math.max(w,h)+pad;
    bounds.expandByPoint(new T.Vector3(x-r,y-r,z-r));bounds.expandByPoint(new T.Vector3(x+r,y+r,z+r));
  }
  return {...part,bounds,edges};
}
function section(x,y,z,part,out){
  let closest=Infinity,cos=0;
  for(const e of part.edges){
    const u=x-e.a[0],v=y-e.a[1],w=z-e.a[2];
    const t=u*e.d.x+v*e.d.y+w*e.d.z,j=clamp(t/e.len,0,1);
    const rw=e.a[3]+(e.b[3]-e.a[3])*j,rh=e.a[4]+(e.b[4]-e.a[4])*j;
    const a=(u*e.across.x+v*e.across.y+w*e.across.z)/rw;
    const b=(u*e.up.x+v*e.up.y+w*e.up.z)/rh;
    const r=Math.min(rw,rh),axis=(t-j*e.len)/r;
    const mag=Math.sqrt(a*a+b*b+axis*axis);
    const d=(mag-1)*r;
    if(d<closest){closest=d;cos=b/(mag||1);}
  }
  if(out)out[0]=cos;
  return closest;
}
let cached;
export function skinGeometry(fields,palette){
  // The base silhouette is common to all three animals. Cache topology, UVs
  // and influence indices, then adjust each animal's coat without resampling.
  if(!cached){
    const parts=fields.map(outline);
    const total=new T.Box3();for(const p of parts)total.union(p.bounds);
    const ox=total.min.x,oy=total.min.y,oz=total.min.z;
    const nx=Math.ceil((total.max.x-ox)/pitch)+2,ny=Math.ceil((total.max.y-oy)/pitch)+2,nz=Math.ceil((total.max.z-oz)/pitch)+2;
    const count=nx*ny*nz,values=new Float32Array(count).fill(.14),cellIds=new Int32Array(count).fill(-1);
    const plane=nx*ny;
    for(const part of parts){
      const b=part.bounds;
      for(let k=Math.max(0,Math.floor((b.min.z-oz)/pitch));k<=Math.ceil((b.max.z-oz)/pitch);k++){
        const z=oz+k*pitch;
        for(let j=Math.max(0,Math.floor((b.min.y-oy)/pitch));j<=Math.ceil((b.max.y-oy)/pitch);j++){
          const y=oy+j*pitch;
          for(let i=Math.max(0,Math.floor((b.min.x-ox)/pitch));i<=Math.ceil((b.max.x-ox)/pitch);i++){
            const x=ox+i*pitch,n=i+j*nx+k*plane,a=values[n],v=section(x,y,z,part);
            const h=Math.max(0,smooth-Math.abs(a-v))/smooth;values[n]=Math.min(a,v)-h*h*smooth*.25;
          }
        }
      }
    }
    const offsets=[0,1,nx,nx+1,plane,plane+1,plane+nx,plane+nx+1],position=[],uv=[],indices=[];
    const ids=[],weights=[],paint=[],p=new T.Vector3(),normal=new T.Vector3(),side=[0];
    const quad=(a,b,c,d,forward)=>{
      if(Math.min(a,b,c,d)<0)return;
      if(forward)indices.push(a,b,c,a,c,d);else indices.push(a,d,c,a,c,b);
    };
    for(let k=1;k<nz-1;k++)for(let j=1;j<ny-1;j++)for(let i=1;i<nx-1;i++){
      const n=i+j*nx+k*plane,base=values[n]<0;let hits=0,px=0,py=0,pz=0;
      if(offsets.every(o=>(values[n+o]<0)===base))continue;
      for(const [a,b] of edgePairs){
        const va=values[n+offsets[a]],vb=values[n+offsets[b]];if((va<0)===(vb<0))continue;
        const f=va/(va-vb),g=1-f;
        px+=(a&1)*g+(b&1)*f;py+=((a>>1)&1)*g+((b>>1)&1)*f;pz+=(a>>2)*g+(b>>2)*f;hits++;
      }
      const id=cellIds[n]=position.length/3;const x=ox+(i+px/hits)*pitch,y=oy+(j+py/hits)*pitch,z=oz+(k+pz/hits)*pitch;
      position.push(x,y,z);p.set(x,y,z);
      normal.set(values[n+1]-values[n-1],values[n+nx]-values[n-nx],values[n+plane]-values[n-plane]).normalize();
      // Longitudinal hair lays back over the flanks. On a leg it lies down
      // the cannon rather than wrapping around the ankle.
      uv.push(z*3.2+y*.72+x*.68,y*2.6+Math.abs(x)*.57+z*.24);
      const contributors=[];
      for(const part of parts)if(part.bounds.containsPoint(p)){
        const distance=section(x,y,z,part,side);
        if(distance<.10)contributors.push({part,distance,cos:side[0]});
      }
      contributors.sort((a,b)=>a.distance-b.distance);const closest=contributors[0],leg=closest?.part.type==='leg';
      const vals=new Map();let pigment=0;
      const dt=leg?.017:.026;
      for(const c of contributors.slice(0,4)){
        const w=Math.exp(-(c.distance-closest.distance)/dt);
        vals.set(c.part.joint,(vals.get(c.part.joint)||0)+w);pigment+=w;
      }
      const sorted=[...vals.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4);
      const totalW=sorted.reduce((s,q)=>s+q[1],0)||1;
      for(let s=0;s<4;s++){ids.push(sorted[s]?.[0]||0);weights.push((sorted[s]?.[1]||0)/totalW);}
      // Colour is tied to the body at rest so fine features follow the skin.
      paint.push({x,y,z,normalY:normal.y,normalZ:normal.z,parts:contributors.slice(0,4).map(c=>({type:c.part.type,cos:c.cos,w:Math.exp(-(c.distance-closest.distance)/dt)/pigment}))});
      if((values[n+1]<0)!==base)quad(id,cellIds[n-nx],cellIds[n-nx-plane],cellIds[n-plane],base);
      if((values[n+nx]<0)!==base)quad(id,cellIds[n-plane],cellIds[n-plane-1],cellIds[n-1],base);
      if((values[n+plane]<0)!==base)quad(id,cellIds[n-1],cellIds[n-1-nx],cellIds[n-nx],base);
    }
    const g=new T.BufferGeometry();g.setIndex(indices);g.setAttribute('position',new T.Float32BufferAttribute(position,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(ids,4));
    g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));g.computeVertexNormals();
    cached={g,paint};
  }
  const g=cached.g.clone(),col=new Float32Array(cached.paint.length*3),{buff,deep,cream}=palette;
  const hair=new T.Color(),sum=new T.Color(),gray=new T.Color(0x726e62),brow=new T.Color(0x473d33);
  for(const [i,s] of cached.paint.entries()){
    const {x,y,z}=s;sum.setRGB(0,0,0);
    for(const {type,cos,w} of s.parts){
      hair.copy(buff);
      if(type==='body'){
        hair.lerp(deep,.24+.66*fade(cos,-.32,.92));
        hair.lerp(cream,.84*fade(-cos,.51,.87));
        // Light buff band beneath the tail and mottled gray shoulders.
        hair.lerp(cream,.55*fade(-z,.40,.61)*fade(-cos,.05,.46));
        hair.lerp(gray,.25*bell(z,.22,.33)*fade(cos,-.45,.63));
      }else if(type==='head'){
        hair.lerp(deep,.16+.55*fade(cos,-.48,.88));
        hair.lerp(cream,.91*fade(-cos,.31,.78));
        hair.lerp(cream,.78*bell(z,.867,.034)*fade(-cos,-.49,.01));
        hair.lerp(brow,.68*fade(cos,.32,.88)*bell(z,.743,.092));
      }else if(type==='neck'){
        hair.lerp(gray,.32);hair.lerp(deep,.59*fade(cos,-.22,.91));
        hair.lerp(cream,.86*fade(-cos,.50,.94)*fade(y,1.05,1.22));
      }else{
        hair.lerp(deep,.37*fade(y,.20,.83));hair.lerp(gray,.22);
        hair.lerp(cream,.23*fade(-s.normalZ,.28,.83));hair.lerp(brow,.54*fade(-y,-.25,-.06));
      }
      sum.add(hair.multiplyScalar(w));
    }
    const mottling=.96+.038*Math.sin(43*y+12*x+9*z)*Math.sin(16*z-13*y)+.028*Math.cos(64*z+81*y+23*x)*Math.sin(22*x-19*y);
    sum.multiplyScalar(mottling).toArray(col,i*3);
  }
  g.setAttribute('color',new T.BufferAttribute(col,3));return g;
}
