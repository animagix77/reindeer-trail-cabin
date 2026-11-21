import * as T from 'three';

const tau=2*Math.PI;
const clamp=T.MathUtils.clamp;
const height=.29;

function section(ring){
  let twiceArea=0,x=0,z=0;
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],weight=a.x*b.z-b.x*a.z;
    twiceArea+=weight;x+=(a.x+b.x)*weight;z+=(a.z+b.z)*weight;
  }
  const center={x:x/(3*twiceArea),z:z/(3*twiceArea)};
  // An ear of bark may have twenty vertices while an exposed face has only
  // two. Use the area moments of the timber, independent of the vertex count.
  let xx=0,zz=0,xz=0;
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];
    const ax=a.x-center.x,az=a.z-center.z,bx=b.x-center.x,bz=b.z-center.z;
    const weight=ax*bz-bx*az;
    xx+=weight*(ax*ax+ax*bx+bx*bx)/12;
    zz+=weight*(az*az+az*bz+bz*bz)/12;
    xz+=weight*(2*ax*az+ax*bz+bx*az+2*bx*bz)/24;
  }
  const angle=.5*Math.atan2(2*xz,xx-zz),nx=Math.cos(angle),nz=Math.sin(angle);
  const projection=ring.map(p=>p.x*nx+p.z*nz);
  const length=Math.max(...projection)-Math.min(...projection),area=twiceArea/2;
  return {area,center,nx,nz,length,splittable:area>=.00076 && length>=.036 && area/length>=.009};
}

function clipRing(ring,cut,side){
  const clipped=[];
  const distance=p=>side*((p.x-cut.x)*cut.nx+(p.z-cut.z)*cut.nz);
  function add(p){
    const prev=clipped.at(-1);
    if(!prev || Math.hypot(prev.x-p.x,prev.z-p.z)>1e-10)clipped.push(p);
  }
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],da=distance(a),db=distance(b);
    if(da>=0)add(a);
    if((da>=0)!==(db>=0)){
      const t=da/(da-db);
      add({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
    }
  }
  if(clipped.length>1 && Math.hypot(clipped[0].x-clipped.at(-1).x,clipped[0].z-clipped.at(-1).z)<1e-10)clipped.pop();
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
  return billet({ring,radius,phase,resistance});
}

// Every billet retains the round's coordinates. The rings, bark, old
// incisions and exposed wood then still line up on the next cut.
const onCut=(p,f)=>Math.abs((p.x-f.x)*f.nx+(p.z-f.z)*f.nz)<1e-9;
function hasScar(ring,mark){
  let near=Infinity,far=-Infinity,lo=Infinity,hi=-Infinity;
  for(const p of ring){
    const x=p.x-mark.x,z=p.z-mark.z,across=x*mark.nx+z*mark.nz,along=z*mark.nx-x*mark.nz;
    near=Math.min(near,across);far=Math.max(far,across);lo=Math.min(lo,along);hi=Math.max(hi,along);
  }
  return near<.014 && far>-.014 && lo<mark.hi+.057 && hi>mark.lo-.057;
}
function billet({ring,radius,phase,resistance,faces=[],scars=[],sectionInfo=section(ring)}){
  const {center,area}=sectionInfo,grain=phase+.25;
  const stockRadius=faces.length?Math.sqrt(area/Math.PI):radius;
  const checks=[];
  let damage=0,progress=0,split=false;
  let revision=0;
  function grainDirection(nx,nz){
    if(!faces.length)return {nx,nz};
    const side=nx*sectionInfo.nx+nz*sectionInfo.nz<0?-1:1;
    // Run the blade across the long axis of the end grain. The visitor's
    // position still steers the cutting plane through the chosen point.
    const x=.74*side*sectionInfo.nx+.26*nx,z=.74*side*sectionInfo.nz+.26*nz;
    const length=Math.hypot(x,z);
    return {nx:x/length,nz:z/length};
  }

  function strike(hit){
    const cut=makeCut(hit);
    const energy=clamp(Number.isFinite(hit.energy)?hit.energy:1,0,1);
    const result=(pieces=[],plane=cut)=>({split:pieces.length>0,progress,cut:plane,pieces});
    if(!cut || split || energy<=0)return result();
    // A tangential strike on the outside of the bark cannot split off a zero-volume sliver.
    const offsets=ring.map(p=>(p.x-cut.x)*cut.nx+(p.z-cut.z)*cut.nz);
    const low=Math.min(...offsets),high=Math.max(...offsets);
    const purchase=Math.max(.005,(high-low)*.11);
    if(low>-purchase || high<purchase)return result();
    if(!ring.every((a,i)=>{
      const b=ring[(i+1)%ring.length];
      return (b.x-a.x)*(cut.z-a.z)-(b.z-a.z)*(cut.x-a.x)>=-1e-7;
    }))return result();

    let seam=null,best=0;
    for(const check of checks){
      const across=Math.abs((cut.x-check.x)*check.nx+(cut.z-check.z)*check.nz);
      const alignment=Math.abs(cut.nx*check.nx+cut.nz*check.nz);
      const match=alignment*clamp(1-across/(stockRadius*.30),0,1);
      if(alignment>.77 && match>.45 && match>best){seam=check;best=match;}
    }
    const edgeDistance=Math.abs((cut.x-center.x)*cut.nx+(cut.z-center.z)*cut.nz)/stockRadius;
    const grainFit=Math.abs(Math.cos(grain)*cut.nx+Math.sin(grain)*cut.nz);
    const bite=energy*(.84+.19*grainFit)*(1-.30*edgeDistance);
    if(!seam){seam={...cut,lo:-.016,hi:.016,stress:0};checks.push(seam);}
    const along=(cut.z-seam.z)*seam.nx-(cut.x-seam.x)*seam.nz;
    // Advancing along an opened check releases intact fibres at its ends.
    const extension=Math.max(0,along-seam.hi,seam.lo-along);
    seam.stress+=bite*(.78+.22*best+Math.min(.8,extension/stockRadius*2));
    const length=.011+.026*Math.min(2,seam.stress);
    seam.lo=Math.min(seam.lo,along-length);seam.hi=Math.max(seam.hi,along+length);
    damage+=bite;revision++;
    const load=seam.stress+.38*(damage-seam.stress);
    progress=Math.max(progress,Math.min(.99,load/resistance));
    if(load<resistance)return result();
    seam.open=true;
    const plane={x:seam.x,z:seam.z,nx:seam.nx,nz:seam.nz,energy};
    const pieces=[1,-1].map(side=>{
      const polygon=clipRing(ring,plane,side),info=section(polygon),center=info.center;
      const childFaces=faces.filter(f=>polygon.some((p,i)=>onCut(p,f) && onCut(polygon[(i+1)%polygon.length],f)));
      const child=info.splittable?billet({ring:polygon,radius,phase,sectionInfo:info,
        resistance:Math.max(.17,resistance*(.36+.50*Math.sqrt(info.area/area))),
        faces:[...childFaces,plane],scars:scars.concat(checks).filter(c=>hasScar(polygon,c))}):null;
      return {billet:child,polygon,center,hull:polygon.map(p=>({x:p.x-center.x,z:p.z-center.z})),height,side,density:710+Math.round(38*Math.sin(phase))};
    });
    split=true;progress=1;return result(pieces,plane);
  }
  return {ring,radius,height,phase,area,center,faces,scars,checks,strike,grainDirection,get marks(){return scars.length?scars.concat(checks):checks;},get progress(){return progress;},get revision(){return revision;}};
}

// In millimetres at the lip and deepest beneath the center of the maul.
// The same field displaces and darkens the end grain on both resulting pieces.
function indent(p,round,marks){
  let depth=0,shade=1;
  for(const c of marks){
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
    // After the check opens, daylight reaches the faces. Only the short
    // wedge imprint near the strike keeps a deep lip in the sawn end.
    const entry=c.open?Math.exp(-((along/.037)**2)):1;
    const relief=c.open?.17+.45*entry:1;
    depth=Math.max(depth,Math.min(.023,.008+.010*c.stress)*mouth*taper*relief);
    const packed=Math.min(1,mouth*2.0)*taper**.38;
    const rawLip=(across>0?.53:.24)*Math.max(0,1-Math.abs(d-1.04)/.34)*taper;
    shade*=1-(c.open?.29+.20*entry:.963)*packed+rawLip*relief;
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
  const faces=cut?[...round.faces,cut]:round.faces,marks=round.marks;
  const exposed=[];
  const rows=8;
  function sideVertex(p,v,u,shade){
    // Oak grain wanders along the length of the wood. Follow the same field
    // on the bark and on every newly exposed face, including their corners.
    const wave=Math.sin(Math.PI*v),angle=.035*wave*Math.sin(2.7*v+round.phase);
    const x=p.x-angle*p.z+.0035*wave*Math.sin(round.phase+2.8*v+6*p.z);
    const z=p.z+angle*p.x+.0028*wave*Math.cos(round.phase+2.1*v-8*p.x);
    vertex({x,z},v*(h-indent(p,round,marks).depth),u,v,shade);
  }
  for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length];
    const face=faces.find(f=>onCut(a,f) && onCut(b,f));
    if(face){exposed.push({a,b,face});continue;}
    const ua=(Math.atan2(a.z,a.x)+Math.PI)/tau,ub=(Math.atan2(b.z,b.x)+Math.PI)/tau;
    const u0=ua+round.phase*.12,u1=(ub<ua-.5?ub+1:ub)+round.phase*.12;
    for(let row=0;row<rows;row++){
      const v=row/rows,w=(row+1)/rows;
      sideVertex(a,v,u0);sideVertex(a,w,u0);sideVertex(b,v,u1);
      sideVertex(b,v,u1);sideVertex(a,w,u0);sideVertex(b,w,u1);
    }
  }
  group(0);
  const centerPoint=section(polygon).center;
  const endVertex=(p,top)=>{
    const dent=top?indent(p,round,marks):{depth:0,shade:1};
    vertex(p,top?h-dent.depth:0,.5+(p.x*rotationCos-p.z*rotationSin)*.46/ri,
      .5+(p.x*rotationSin+p.z*rotationCos)*.46/ri,dent.shade);
  };
  function cutEnd(a,b,c,level){
    const p={x:(a.x+b.x+c.x)/3,z:(a.z+b.z+c.z)/3};
    const bound=Math.sqrt(Math.max(...[a,b,c].map(q=>(p.x-q.x)**2+(p.z-q.z)**2)));
    // Refine only close to a groove. Leaves the unmarked end-grain mesh light.
    if(level<(cut?4:6) && bound>.0025 && marks.some(check=>{
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
  for(const edge of exposed){
    const face=edge.face,tangent=p=>p.z*face.nx-p.x*face.nz;
    const reverse=tangent(edge.a)>tangent(edge.b);
    const [a,b]=reverse?[edge.b,edge.a]:[edge.a,edge.b];
    const width=Math.hypot(b.x-a.x,b.z-a.z);
    const columns=Math.max(3,Math.ceil(width/.006));
    function fibre(u,v){
      const p=point(a,b,u);
      const d=tangent(p);
      const edgeFade=Math.min(1,u*width/.009,(1-u)*width/.009)*Math.sin(Math.PI*v);
      const drift=round.phase+2.6*v+.8*Math.sin(13*d-3*v);
      const grainWave=Math.sin(181*d+drift);
      // Raised latewood and torn fibre bundles run lengthwise. Broken ends
      // leave a few darker short shelves near the exit of the split.
      const torn=Math.max(0,Math.cos(294*d+.8*drift))**3;
      const tear=Math.max(0,1-Math.abs(v-(.25+.13*Math.cos(60*d+round.phase)))*6);
      const ridge=edgeFade*(.0019*grainWave+.0015*torn+.0024*tear*torn);
      const shade=1+edgeFade*(.07*grainWave-.13*tear*torn);
      const displaced={x:p.x+face.nx*ridge,z:p.z+face.nz*ridge};
      sideVertex(displaced,v,.5+d/(2*ri),shade);
    }
    for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
      const u=i/columns,v=j/rows,uu=(i+1)/columns,vv=(j+1)/rows;
      if(reverse){
        fibre(u,v);fibre(uu,v);fibre(u,vv);fibre(uu,v);fibre(uu,vv);fibre(u,vv);
      }else{
        fibre(u,v);fibre(u,vv);fibre(uu,v);fibre(uu,v);fibre(u,vv);fibre(uu,vv);
      }
    }
  }
  group(2);
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  g.computeVertexNormals();g.computeBoundingSphere();return g;
}
