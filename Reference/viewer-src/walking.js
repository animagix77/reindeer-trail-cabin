import * as THREE from 'three';

// Collision geometry is exported with the house and uses glTF Y-up metres.
// A 2 m grid limits movement queries to faces and convex blockers near the visitor.
const CELL=2, RADIUS=.19, STEP=.32, DROP=.36;
const key=(x,z)=>Math.floor(x/CELL)+','+Math.floor(z/CELL);
function index(grid,item,bounds) {
  for(let x=Math.floor(bounds.min.x/CELL); x<=Math.floor(bounds.max.x/CELL);x++){
    for(let z=Math.floor(bounds.min.z/CELL); z<=Math.floor(bounds.max.z/CELL);z++){
      const k=x+','+z;
      if(!grid.has(k)) grid.set(k,[]);
      grid.get(k).push(item);
    }
  }
}
const cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
function hull(points) {
  const sorted=[...new Map(points.map(p=>[p.x+','+p.z,p])).values()].sort((a,b)=>a.x-b.x||a.z-b.z);
  if(sorted.length<3) return sorted;
  function half(order) {
    const result=[];
    for(const p of order) {
      while(result.length>=2 && cross(result.at(-2),result.at(-1),p)<=1e-8) result.pop();
      result.push(p);
    }
    result.pop();
    return result;
  }
  return half(sorted).concat(half(sorted.reverse()));
}
function nearPolygon(x,z,polygon) {
  let inside=true,minDistance=Infinity;
  for(let i=0;i<polygon.length;i++) {
    const a=polygon[i],b=polygon[(i+1)%polygon.length];
    const dx=b.x-a.x,dz=b.z-a.z;
    if(dx*(z-a.z)-dz*(x-a.x)<-1e-7) inside=false;
    const t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);
    minDistance=Math.min(minDistance,(a.x+t*dx-x)**2+(a.z+t*dz-z)**2);
  }
  return (polygon.length>=3 && inside)||minDistance<RADIUS*RADIUS;
}

export class WalkSpace {
  floors=new Map();
  blocks=new Map();
  start=null;
  add(mesh,helperName) {
    const attr=mesh.geometry.getAttribute('position');
    const points=Array.from({length:attr.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(attr,i).applyMatrix4(mesh.matrixWorld));
    if(/^WalkSurface_/i.test(helperName)) {
      const idx=mesh.geometry.index;
      const total=idx?idx.count:points.length;
      for(let i=0;i<total;i+=3) {
        const [a,b,c]=[i,i+1,i+2].map(n=>points[idx?idx.getX(n):n]);
        const determinant=cross(a,b,c);
        if(Math.abs(determinant)<1e-9) continue;
        const bounds=new THREE.Box3().setFromPoints([a,b,c]);
        index(this.floors,{a,b,c,determinant,label:helperName},bounds);
      }
    } else {
      const box=new THREE.Box3().setFromPoints(points);
      const item={minY:box.min.y,maxY:box.max.y,polygon:hull(points),label:helperName};
      index(this.blocks,item,box.expandByScalar(RADIUS));
    }
  }
  heights(x,z) {
    const found=[];
    for(const f of this.floors.get(key(x,z))||[]) {
      const p={x,z},u=cross(f.b,f.c,p)/f.determinant,v=cross(f.c,f.a,p)/f.determinant,w=1-u-v;
      if(Math.min(u,v,w)>=-1e-5) found.push({y:u*f.a.y+v*f.b.y+w*f.c.y,label:f.label});
    }
    return found;
  }
  // Lower the eye in low sleeping areas and under overhead walk surfaces.
  settle(x,z,floor,hits) {
    let clearance=4;
    for(const h of hits) if(h.y>floor.y+.4) clearance=Math.min(clearance,h.y-floor.y-.14);
    const nearby=this.blocks.get(key(x,z))||[];
    for(const b of nearby) {
      if(b.maxY<floor.y+.07 || !nearPolygon(x,z,b.polygon)) continue;
      if(b.minY<=floor.y+.68) return null;
      clearance=Math.min(clearance,b.minY-floor.y-.07);
    }
    if(clearance<.75) return null;
    const eye=/loft/i.test(floor.label)?1.00:1.59;
    return {x,z,y:floor.y,eye:Math.min(eye,clearance-.12),label:floor.label};
  }
  spawn(x,z,eyeY,expectedFloor=null) {
    const hits=this.heights(x,z);
    const target=expectedFloor??eyeY-1.59;
    for(const h of [...hits].sort((a,b)=>Math.abs(a.y-target)-Math.abs(b.y-target))) {
      const state=this.settle(x,z,h,hits);
      if(state) return state;
    }
    return null;
  }
  test(state,x,z) {
    const hits=this.heights(x,z);
    const possible=hits.filter(h=>h.y<=state.y+STEP && h.y>=state.y-DROP).sort((a,b)=>b.y-a.y);
    for(const h of possible) {
      const next=this.settle(x,z,h,hits);
      if(next) return next;
    }
    return null;
  }
  move(state,dx,dz) {
    const count=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.07));
    dx/=count;dz/=count;
    for(let i=0;i<count;i++) {
      const full=this.test(state,state.x+dx,state.z+dz);
      if(full) {state=full;continue;}
      const side=dx?this.test(state,state.x+dx,state.z):null;
      if(side) state=side;
      const forward=dz?this.test(state,state.x,state.z+dz):null;
      if(forward) state=forward;
    }
    return state;
  }
}
