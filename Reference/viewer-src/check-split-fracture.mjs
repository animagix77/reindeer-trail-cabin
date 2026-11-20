import test from 'node:test';
import assert from 'node:assert/strict';
import {createOakRound,oakGeometry} from './wood-fracture.js';
import {makeSplittingBlock} from './splitting-block.js';
import {Group} from 'three';

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

test('the splitting block replaces its damaged geometry and releases separate ownable meshes',t=>{
  globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}})})};
  t.after(()=>{delete globalThis.document;});
  const station=makeSplittingBlock(new Group());
  const first=station.impact(blow());
  assert(first.split);assert.equal(station.round.visible,false);
  for(const p of first.pieces){
    assert(p.mesh.isMesh && p.hull.length>=3 && p.density>600);
    assert.equal(p.mesh.position.y,station.top+p.height/2);
  }
  station.begin();assert(station.round.visible);assert.equal(station.progress,0);
  const pristine=station.round.geometry;
  const dent=station.impact(blow());assert(!dent.split);
  assert.notEqual(station.round.geometry,pristine);
  assert.equal(first.pieces[0].mesh.geometry.groups.length,3,'loading a round leaves older fragments intact');
});
