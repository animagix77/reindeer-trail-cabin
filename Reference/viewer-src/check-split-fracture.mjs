import test from 'node:test';
import assert from 'node:assert/strict';
import {createOakRound,oakGeometry} from './wood-fracture.js';

const blow=(x=0,z=0,nx=1,nz=0,energy=.85)=>({x,z,nx,nz,energy});
function area(ring){
  return ring.reduce((sum,a,i)=>{
    const b=ring[(i+1)%ring.length];return sum+(a.x*b.z-b.x*a.z)/2;
  },0);
}
function volume(g){
  const a=g.attributes.position;
  let signed=0;
  for(let i=0;i<a.count;i+=3){
    const ax=a.getX(i),ay=a.getY(i),az=a.getZ(i);
    const bx=a.getX(i+1),by=a.getY(i+1),bz=a.getZ(i+1);
    const cx=a.getX(i+2),cy=a.getY(i+2),cz=a.getZ(i+2);
    signed+=(ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx))/6;
  }
  return signed;
}
test('an oak round takes and keeps a blade-shaped notch, and advancing along it frees the fibres',()=>{
  const wood=createOakRound(3),fresh=oakGeometry(wood);
  assert(!wood.strike(blow(1)).progress);
  assert(!wood.strike(blow(0,0,0,0)).progress);
  const first=wood.strike(blow());
  assert(!first.split && first.progress>0 && first.progress<1);
  const carved=oakGeometry(wood);
  const pos=carved.attributes.position;
  assert(Array.from({length:pos.count},(_,i)=>i).some(i=>pos.getY(i)<wood.height-.001 &&
    pos.getY(i)>wood.height-.025 && Math.abs(pos.getX(i))<.005),'blade must physically indent the hit area');
  assert(volume(carved)<volume(fresh));
  const repeated=createOakRound(3);repeated.strike(blow());assert(!repeated.strike(blow()).split);
  assert(wood.strike(blow(0,.10)).split,'advancing along the check splits this tough round in two hits');
  const crossed=createOakRound(3);crossed.strike(blow());
  assert(crossed.strike(blow(.03,.06,0,1)).progress<repeated.progress);
  assert.equal(crossed.checks.length,2,'a crossing blow makes its own notch');
  assert(!wood.strike(blow()).split,'spent round cannot produce duplicate fragments');
});
test('fresh split oak pieces have complementary cut surfaces, centered collision hulls and preserved volume',()=>{
  for(let i=0;i<15;i++){
    const w=createOakRound(i),angle=i*.371,hit=blow(.042,-.031,Math.cos(angle),Math.sin(angle),1);
    let result;
    for(let j=0;j<6 && !result?.split;j++)result=w.strike(hit);
    assert.equal(result.pieces.length,2);
    const areaSum=result.pieces.reduce((sum,p)=>sum+area(p.hull),0);
    assert(Math.abs(area(w.ring)-areaSum)<1e-10);
    const surfaces=[];
    for(const p of result.pieces){
      assert(area(p.hull)>0);
      const g=oakGeometry(w,p.polygon,result.cut,p.center,p.height/2);
      assert.deepEqual(g.groups.map(s=>s.materialIndex),[0,1,2]);
      assert(volume(g)>area(p.hull)*p.height*.99,'closed outward-facing fragment with wood only lost at the incision');
      const face=g.groups[2],pos=g.attributes.position,points=new Set();
      for(let j=face.start;j<face.start+face.count;j++){
        points.add([pos.getX(j)+p.center.x,pos.getY(j),pos.getZ(j)+p.center.z].join(','));
      }
      surfaces.push([...points].map(key=>key.split(',').map(Number)));
    }
    assert.equal(surfaces[0].length,surfaces[1].length);
    for(const [x,y,z] of surfaces[0])assert(surfaces[1].some(p=>Math.hypot(x-p[0],y-p[1],z-p[2])<3e-8));
  }
});

test('repeated cuts preserve each piece of the original round down to kindling size',()=>{
  const whole=createOakRound(0);
  const pending=[{wood:whole,level:0}];
  const terminal=[];
  let deepest=0,splitQuarter=false,observedHeartwood=false;
  while(pending.length){
    const {wood,level}=pending.pop();
    const {nx,nz}=wood.grainDirection(1,0);
    const {x,z}=wood.center,hit=blow(x,z,nx,nz,1);
    let result;
    for(let i=0;i<5&&!result?.split;i++)result=wood.strike(hit);
    assert(result.split,'Fresh strength should split a centered billet in a few blows');
    assert(!wood.strike(hit).split,'A spent billet must not create duplicate fragments');
    if(level===2)splitQuarter=true;
    const total=result.pieces.reduce((sum,p)=>sum+area(p.hull),0);
    assert(Math.abs(total-area(wood.ring))<1e-9);
    for(const p of result.pieces){
      assert(p.hull.length>=3 && area(p.hull)>0);
      const geometry=oakGeometry(wood,p.polygon,result.cut,p.center,p.height/2);
      const groups=geometry.groups.map(g=>g.materialIndex);
      assert(groups.includes(1) && groups.includes(2),'All pieces have end grain and split grain');
      if(!groups.includes(0))observedHeartwood=true;
      const nominal=area(p.hull)*p.height,v=volume(geometry);
      // The facets follow wandering fibres and cuts remove a little end grain.
      assert(v>nominal*.89 && v<nominal*1.07,'A fragment must remain a solid billet');
      if(p.billet){
        assert(Math.abs(p.billet.area-area(p.hull))<1e-10);
        assert(p.billet.faces.some(f=>f===result.cut));
        for(const f of wood.faces){
          const on=p=>Math.abs((p.x-f.x)*f.nx+(p.z-f.z)*f.nz)<1e-9;
          const retained=p.polygon.some((a,i)=>on(a)&&on(p.polygon[(i+1)%p.polygon.length]));
          assert.equal(p.billet.faces.includes(f),retained,'Each edge keeps its original cleavage face');
        }
        pending.push({wood:p.billet,level:level+1});
      }else{
        terminal.push(p);deepest=Math.max(deepest,level+1);
      }
      geometry.dispose();
    }
  }
  assert(splitQuarter && deepest>=5 && deepest<13);
  assert(terminal.length>16);
  assert(observedHeartwood,'Pieces from the middle must not grow bark on inherited cut faces');
  assert(Math.abs(terminal.reduce((sum,p)=>sum+area(p.hull),0)-area(whole.ring))<1e-9);
});

test('guidance favors a billet’s broad dimension while still respecting the strike bearing',()=>{
  const first=createOakRound(0).strike(blow(0,0,1,0,1));
  const half=first.pieces[0].billet;
  const left=half.grainDirection(-1,.2),right=half.grainDirection(1,.2);
  assert(left.nz>.8 && right.nz>.8 && left.nx<right.nx);
  const center=half.center;
  const offset=blow(center.x*.6,center.z+.046,0,1,1);
  const quarter=half.strike(offset);
  assert(quarter.split);assert(quarter.pieces.every(p=>p.billet));
  assert(area(quarter.pieces[0].hull)<area(quarter.pieces[1].hull)*.7,'Off-center split leaves an unequal pair');
});
