import * as T from 'three';

const tau=2*Math.PI;
const clamp=T.MathUtils.clamp;
const height=.29;

function areaCenter(ring){
  let twiceArea=0,x=0,z=0;
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],weight=a.x*b.z-b.x*a.z;
    twiceArea+=weight;x+=(a.x+b.x)*weight;z+=(a.z+b.z)*weight;
  }
  return {x:x/(3*twiceArea),z:z/(3*twiceArea)};
}

function clipRing(ring,cut,side){
  const clipped=[];
  const distance=p=>side*((p.x-cut.x)*cut.nx+(p.z-cut.z)*cut.nz);
  function add(p){
    const prev=clipped.at(-1);
    if(!prev || Math.hypot(prev.x-p.x,prev.z-p.z)>1e-7)clipped.push(p);
  }
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],da=distance(a),db=distance(b);
    if(da>=0)add(a);
    if((da>=0)!==(db>=0)){
      const t=da/(da-db);
      add({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
    }
  }
  if(clipped.length>1 && Math.hypot(clipped[0].x-clipped.at(-1).x,clipped[0].z-clipped.at(-1).z)<1e-7)clipped.pop();
  return clipped;
}

function makeCut(hit){
  const norm=Math.hypot(hit.nx,hit.nz);
  if(!Number.isFinite(norm) || norm<1e-6 || !Number.isFinite(hit.x) || !Number.isFinite(hit.z))return null;
  return {x:hit.x,z:hit.z,nx:hit.nx/norm,nz:hit.nz/norm};
}

export function createOakRound(index=0){
  // Vary actual end outlines, split resistance and available checks with each round.
  const phase=index*2.39996,radius=[.133,.146,.126,.152,.137,.143][index%6];
  const resistance=[.63,1.52,.91,1.81,1.13,1.46][index%6];
  const ring=Array.from({length:36},(_,i)=>{
    const a=i*tau/36;
    const r=radius*(1+.029*Math.sin(3*a+.7+phase)+.009*Math.cos(5*a-phase));
    return {x:r*Math.cos(a),z:r*(.97+.016*Math.sin(phase))*Math.sin(a)};
  });
  const grain=phase+.25;
  const checks=[];
  let damage=0,progress=0,split=false;
  let revision=0;

  function strike(hit){
    const cut=makeCut(hit);
    const energy=clamp(Number.isFinite(hit.energy)?hit.energy:1,0,1);
    const result=(pieces=[],plane=cut)=>({split:pieces.length>0,progress,cut:plane,pieces});
    if(!cut || split || energy<=0)return result();
    // A tangential strike on the outside of the bark cannot split off a zero-volume sliver.
    const offsets=ring.map(p=>(p.x-cut.x)*cut.nx+(p.z-cut.z)*cut.nz);
    if(Math.min(...offsets)>-.005 || Math.max(...offsets)<.005)return result();
    if(!ring.every((a,i)=>{
      const b=ring[(i+1)%ring.length];
      return (b.x-a.x)*(cut.z-a.z)-(b.z-a.z)*(cut.x-a.x)>=-1e-7;
    }))return result();

    let seam=null,best=0;
    for(const check of checks){
      const across=Math.abs((cut.x-check.x)*check.nx+(cut.z-check.z)*check.nz);
      const alignment=Math.abs(cut.nx*check.nx+cut.nz*check.nz);
      const match=alignment*clamp(1-across/(radius*.30),0,1);
      if(alignment>.77 && match>.45 && match>best){seam=check;best=match;}
    }
    const edgeDistance=Math.abs(cut.x*cut.nx+cut.z*cut.nz)/radius;
    const grainFit=Math.abs(Math.cos(grain)*cut.nx+Math.sin(grain)*cut.nz);
    const bite=energy*(.84+.19*grainFit)*(1-.30*edgeDistance);
    if(!seam){seam={...cut,lo:-.016,hi:.016,stress:0};checks.push(seam);}
    const along=(cut.z-seam.z)*seam.nx-(cut.x-seam.x)*seam.nz;
    // Advancing along an opened check releases intact fibres at its ends.
    const extension=Math.max(0,along-seam.hi,seam.lo-along);
    seam.stress+=bite*(.78+.22*best+Math.min(.8,extension/radius*2));
    const length=.011+.026*Math.min(2,seam.stress);
    seam.lo=Math.min(seam.lo,along-length);seam.hi=Math.max(seam.hi,along+length);
    damage+=bite;revision++;
    const load=seam.stress+.38*(damage-seam.stress);
    progress=Math.max(progress,Math.min(.99,load/resistance));
    if(load<resistance)return result();
    const plane={x:seam.x,z:seam.z,nx:seam.nx,nz:seam.nz,energy};
    const pieces=[1,-1].map(side=>{
      const polygon=clipRing(ring,plane,side),center=areaCenter(polygon);
      return {polygon,center,hull:polygon.map(p=>({x:p.x-center.x,z:p.z-center.z})),height,side,density:710+Math.round(38*Math.sin(phase))};
    });
    split=true;progress=1;return result(pieces,plane);
  }
  return {ring,radius,height,phase,checks,strike,get progress(){return progress;},get revision(){return revision;}};
}

// In millimetres at the lip and deepest beneath the center of the maul.
// The same field displaces and darkens the end grain on both resulting pieces.
function indent(p,round){
  let depth=0,shade=1;
  for(const c of round.checks){
    const x=p.x-c.x,z=p.z-c.z,along=z*c.nx-x*c.nz;
    // The steel bit starts the mouth. Fine checks run ahead of it where the
    // fibres part, far enough to see and follow from a standing position.
    const run=.027+.019*Math.min(c.stress,1.5),lo=c.lo-run,hi=c.hi+run*.82;
    if(along<lo || along>hi)continue;
    const taper=Math.sin(Math.PI*(along-lo)/(hi-lo))**.63;
    const twist=(.0018*Math.sin(along*107+round.phase)+.0007*Math.cos(along*271))*taper;
    const across=x*c.nx+z*c.nz+twist;
    const width=(.0058+.0027*Math.min(c.stress,1.5))*taper;
    const d=Math.abs(across)/Math.max(width,1e-6);
    const mouth=clamp(1-d,0,1);
    depth=Math.max(depth,Math.min(.023,.008+.010*c.stress)*mouth*taper);
    const packed=Math.min(1,mouth*2.0)*taper**.38;
    const rawLip=(across>0?.53:.24)*Math.max(0,1-Math.abs(d-1.04)/.34)*taper;
    shade*=1-.963*packed+rawLip;
  }
  return {depth,shade};
}

// Preserve rings and bark in source coordinates when the split is offset.
// Each fresh face shares one ridged surface with the opposing piece.
export function oakGeometry(round,polygon=round.ring,cut=null,center={x:0,z:0},centerY=0){
  const g=new T.BufferGeometry(),positions=[],uv=[],colors=[];
  let first=0;
  function vertex(p,y,u,v,shade=1){
    positions.push(p.x-center.x,y-centerY,p.z-center.z);uv.push(u,v);colors.push(shade,shade,shade);
  }
  function group(material){const end=positions.length/3;if(end>first)g.addGroup(first,end-first,material);first=end;}
  const ri=round.radius,h=round.height;
  const rotationCos=Math.cos(round.phase),rotationSin=Math.sin(round.phase);
  const point=(a,b,t)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
  const onCut=p=>Math.abs((p.x-cut.x)*cut.nx+(p.z-cut.z)*cut.nz)<1e-7;
  let exposed;
  function barkVertex(p,y,u){
    vertex(p,y,u,y/h);
  }
  for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length];
    if(cut && onCut(a) && onCut(b)){exposed=[a,b];continue;}
    const ua=(Math.atan2(a.z,a.x)+Math.PI)/tau,ub=(Math.atan2(b.z,b.x)+Math.PI)/tau;
    const u0=ua+round.phase*.12,u1=(ub<ua-.5?ub+1:ub)+round.phase*.12;
    const ay=h-indent(a,round).depth,by=h-indent(b,round).depth;
    barkVertex(a,0,u0);barkVertex(a,ay,u0);barkVertex(b,0,u1);
    barkVertex(b,0,u1);barkVertex(a,ay,u0);barkVertex(b,by,u1);
  }
  group(0);
  const centerPoint=areaCenter(polygon);
  const endVertex=(p,top)=>{
    const dent=top?indent(p,round):{depth:0,shade:1};
    vertex(p,top?h-dent.depth:0,.5+(p.x*rotationCos-p.z*rotationSin)*.46/ri,
      .5+(p.x*rotationSin+p.z*rotationCos)*.46/ri,dent.shade);
  };
  function cutEnd(a,b,c,level){
    const p={x:(a.x+b.x+c.x)/3,z:(a.z+b.z+c.z)/3};
    const bound=Math.sqrt(Math.max(...[a,b,c].map(q=>(p.x-q.x)**2+(p.z-q.z)**2)));
    // Refine only close to a groove. Leaves the unmarked end-grain mesh light.
    if(level<(cut?4:6) && bound>.0025 && round.checks.some(check=>{
      const x=p.x-check.x,z=p.z-check.z,t=z*check.nx-x*check.nz;
      return Math.abs(x*check.nx+z*check.nz)<=bound+.014 && t>=check.lo-bound-.057 && t<=check.hi+bound+.057;
    })){
      const ab=point(a,b,.5),ac=point(a,c,.5),bc=point(b,c,.5);
      cutEnd(a,ab,ac,level+1);cutEnd(ab,b,bc,level+1);cutEnd(ac,bc,c,level+1);cutEnd(ab,bc,ac,level+1);
    }else{endVertex(a,true);endVertex(b,true);endVertex(c,true);}
  }
  for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length];
    endVertex(centerPoint,false);endVertex(a,false);endVertex(b,false);
    cutEnd(centerPoint,b,a,0);
  }
  group(1);
  if(exposed){
    const tangent=p=>p.z*cut.nx-p.x*cut.nz;
    const reverse=tangent(exposed[0])>tangent(exposed[1]);
    const [a,b]=reverse?[exposed[1],exposed[0]]:exposed;
    const width=Math.hypot(b.x-a.x,b.z-a.z);
    const columns=Math.max(6,Math.round(width/.010)),rows=6;
    function fibre(u,v){
      const p=point(a,b,u);
      const d=p.z*cut.nx-p.x*cut.nz;
      const edgeFade=Math.sin(Math.PI*u)*Math.sin(Math.PI*v);
      const ridge=.0017*(Math.sin(183*d+v*1.8)+.48*Math.sin(371*d+v*.9))*edgeFade;
      const y=v*(h-indent(p,round).depth);
      vertex({x:p.x+cut.nx*ridge,z:p.z+cut.nz*ridge},y,.5+d/(2*ri),v);
    }
    for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
      const u=i/columns,v=j/rows,uu=(i+1)/columns,vv=(j+1)/rows;
      if(reverse){
        fibre(u,v);fibre(uu,v);fibre(u,vv);fibre(uu,v);fibre(uu,vv);fibre(u,vv);
      }else{
        fibre(u,v);fibre(u,vv);fibre(uu,v);fibre(uu,v);fibre(u,vv);fibre(uu,vv);
      }
    }
    group(2);
  }
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  g.computeVertexNormals();g.computeBoundingSphere();return g;
}
