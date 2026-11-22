import {Box3,Vector3} from 'three';
import {ConvexHull} from 'three/addons/math/ConvexHull.js';
import {Body,ConvexPolyhedron,Vec3,World,RaycastResult} from 'cannon-es';
import {WALK_CELL_SIZE,WalkSpace} from './walking.js';

const boundsOf=points=>new Box3().setFromPoints(points);
const cell=n=>Math.floor(n/WALK_CELL_SIZE);

// Cannon's convex bodies need a volume. A thin prism supports both faces of
// raised walkways and leaves the original sloping surface exactly in position.
function prism(top,depth){
  const count=top.length,vertices=top.map(p=>new Vector3(p.x,p.y-depth,p.z)).concat(top);
  const bottom=top.map((_,i)=>i),lid=bottom.map(i=>2*count-i-1);
  const faces=[bottom,lid];
  for(let i=0;i<count;i++){
    const j=(i+1)%count;
    faces.push([i,i+count,j+count,j]);
  }
  return {vertices,faces};
}

function addToGrid(grid,record){
  const {min,max}=record.bounds;
  for(let x=cell(min.x);x<=cell(max.x);x++){
    for(let z=cell(min.z);z<=cell(max.z);z++){
      const key=x+','+z;
      if(!grid.has(key))grid.set(key,[]);
      grid.get(key).push(record);
    }
  }
}

// Timber boards, individual stones and fire logs are separate connected
// solids inside material-batched meshes. Weld UV seams before separating them.
function components(mesh){
  const geometry=mesh.geometry,attr=geometry.attributes.position;
  const lookup=new Map(),ids=[],points=[],parents=[];
  function root(i){
    while(i!==parents[i]){parents[i]=parents[parents[i]];i=parents[i];}
    return i;
  }
  for(let i=0;i<attr.count;i++){
    const p=new Vector3().fromBufferAttribute(attr,i),key=p.toArray().map(v=>Math.round(v*1e5)).join(',');
    let id=lookup.get(key);
    if(id===undefined){
      id=points.length;lookup.set(key,id);parents.push(id);points.push(p.applyMatrix4(mesh.matrixWorld));
    }
    ids.push(id);
  }
  const index=geometry.index,count=index?index.count:attr.count;
  const idAt=i=>ids[index?index.getX(i):i];
  for(let i=0;i<count;i+=3){
    const a=root(idAt(i));
    parents[root(idAt(i+1))]=a;parents[root(idAt(i+2))]=a;
  }
  const result=new Map();
  for(let i=0;i<points.length;i++){
    const id=root(i);
    if(!result.has(id))result.set(id,[]);
    result.get(id).push(points[i]);
  }
  return result.values();
}

function hullData(points){
  // Keep the extreme points of bevels and rounded board ends. Submillimetre
  // bevel triangles make poor separating axes and add no useful contact area.
  if(points.length>32){
    const support=new Set();
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
      if(!(x||y||z))continue;
      let best=-Infinity,tip;
      for(const p of points){
        const distance=p.x*x+p.y*y+p.z*z;
        if(distance>best){best=distance;tip=p;}
      }
      support.add(tip);
    }
    points=[...support];
  }
  if(points.length<4)return null;
  // A standalone open triangle fan can be perfectly flat (a paint overlay).
  // QuickHull requires four noncoplanar samples.
  const a=points[0],b=points[1],edge=new Vector3().subVectors(b,a),normal=new Vector3();
  const delta=new Vector3();
  for(const p of points){
    normal.crossVectors(edge,delta.subVectors(p,a));
    if(normal.lengthSq()>1e-14)break;
  }
  normal.normalize();
  if(!points.some(p=>Math.abs(normal.dot(delta.subVectors(p,a)))>.00001))return null;
  const hull=new ConvexHull().setFromPoints(points),vertices=[],faces=[],index=new Map();
  for(const f of hull.faces){
    let e=f.edge;
    const face=[];
    do{
      const p=e.head().point;
      if(!index.has(p)){index.set(p,vertices.length);vertices.push(p);}
      face.push(index.get(p));e=e.next;
    }while(e!==f.edge);
    faces.push(face);
  }
  return {vertices,faces};
}

function createBody(data){
  const {vertices,faces}=data;
  const center=new Vec3();
  for(const p of vertices){center.x+=p.x;center.y+=p.y;center.z+=p.z;}
  center.scale(1/vertices.length,center);
  const shape=new ConvexPolyhedron({
    vertices:vertices.map(p=>new Vec3(p.x-center.x,p.y-center.y,p.z-center.z)),faces
  });
  return new Body({mass:0,shape,position:center});
}

export function createThrowColliders(space,model){
  const extra=new Map(),shell=new WalkSpace(),skip=new Set(),bounds=new WeakMap();
  const worlds=new WeakMap();
  let ringInnerRadius;
  function addSolid(points){
    if(points.length>=4)addToGrid(extra,{bounds:boundsOf(points),build:()=>hullData(points)});
  }
  model.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const material=mesh.material.name;
    if(/^Backdrop_Woodland floor|^Asphalt shingle$|^Interior · soft ivory vault$|^Loft · stained roof boards/.test(material)){
      shell.add(mesh,'WalkSurface_ThrowShell');
      return;
    }
    if(material==='Fire ring · galvanized steel'){
      // A walker cannot step inside the ring. A billet can clear (or clip)
      // its lip; leave the centre hollow all the way down to the ash.
      skip.add('WalkBlock_FireRing');
      const box=new Box3().setFromObject(mesh,true),center=box.getCenter(new Vector3());
      const segments=32,radius=.5*Math.min(box.max.x-box.min.x,box.max.z-box.min.z)/.52;
      ringInnerRadius=.473*radius;
      const point=(i,r)=>new Vector3(center.x+r*radius*Math.cos(i*2*Math.PI/segments),box.max.y,
        center.z+r*radius*Math.sin(i*2*Math.PI/segments));
      for(let i=0;i<segments;i++){
        const top=[point(i,.473),point(i,.507),point(i+1,.507),point(i+1,.473)];
        const data=prism(top,box.max.y-box.min.y);
        addToGrid(extra,{bounds:boundsOf(data.vertices),build:()=>data});
      }
      return;
    }
    if(material==='Fire pit · bed of cold ash'){
      const box=new Box3().setFromObject(mesh,true),center=box.getCenter(new Vector3());
      const r=(box.max.x-box.min.x)/2,top=[];
      for(let i=0;i<32;i++)top.push(new Vector3(center.x+r*Math.cos(i*Math.PI/16),center.y,center.z+r*Math.sin(i*Math.PI/16)));
      const data=prism(top,.045);
      addToGrid(extra,{bounds:boundsOf(data.vertices),build:()=>data});return;
    }
    const chair=/^Adirondack[ _](\d+).*?(?:cedar|burgundy)/i.exec(mesh.name);
    const table=/A.frame[ _]picnic[ _]table/i.test(mesh.name);
    const edging=material==='Driveway edging · split fieldstone';
    if(chair)skip.add('WalkBlock_YardChair'+chair[1]);
    if(table)skip.add('WalkBlock_GardenPicnicTable');
    if(edging)skip.add('WalkSurface_DrivewayFieldstone');
    if(chair||table||edging||/^Charred wood$|^Fire pit · (tumbled stone|exposed split wood)/.test(material)){
      for(const points of components(mesh))addSolid(points);
    }
  });

  function describe(item){
    if(item.build)return item;
    if(bounds.has(item))return bounds.get(item);
    let record;
    if(item.a){
      const top=item.determinant>0?[item.a,item.b,item.c]:[item.a,item.c,item.b];
      const depth=.085,box=boundsOf(top);
      box.min.y-=depth;
      record={bounds:box,build:()=>prism(top,depth)};
    }else{
      if(item.polygon.length<3||item.maxY-item.minY<1e-6)return null;
      const top=item.polygon.map(p=>new Vector3(p.x,item.maxY,p.z)),box=boundsOf(top);
      box.min.y=item.minY;
      record={bounds:box,build:()=>prism(top,item.maxY-item.minY)};
    }
    bounds.set(item,record);
    return record;
  }

  // A half-metre bin and generous halo cover the longest held piece between
  // updates. Existing floor/block grids include later additions (e.g. stump).
  function sync(world,position){
    let state=worlds.get(world);
    if(!state){state={key:null,active:new Map()};worlds.set(world,state);}
    const x=Math.floor(position.x*2)*.5,y=Math.floor(position.y*2)*.5,z=Math.floor(position.z*2)*.5;
    const key=x+','+y+','+z;
    if(state.key===key)return;
    state.key=key;
    const area=new Box3(new Vector3(x-.8,y-.8,z-.8),new Vector3(x+1.3,y+1.3,z+1.3));
    const nearby=new Set();
    for(let i=cell(area.min.x);i<=cell(area.max.x);i++){
      for(let j=cell(area.min.z);j<=cell(area.max.z);j++){
        const k=i+','+j;
        for(const grid of [space.floors,space.blocks,shell.floors,extra]){
          for(const item of grid.get(k)||[]){
            if(skip.has(item.label))continue;
            const record=describe(item);
            if(record && area.intersectsBox(record.bounds))nearby.add(record);
          }
        }
      }
    }
    for(const [record,body] of state.active){
      if(!nearby.has(record)){world.removeBody(body);state.active.delete(record);}
    }
    for(const record of nearby){
      if(state.active.has(record))continue;
      if(record.data===undefined)record.data=record.build();
      if(record.data){
        const body=createBody(record.data);
        state.active.set(record,body);world.addBody(body);
      }
    }
  }
  const probeWorld=new World(),from=new Vec3(),to=new Vec3(),hit=new RaycastResult();
  function blockedSegment(start,end){
    from.copy(start);
    const dx=end.x-start.x,dy=end.y-start.y,dz=end.z-start.z;
    const steps=Math.ceil(Math.hypot(dx,dy,dz)/.7);
    for(let step=1;step<=steps;step++){
      to.set(start.x+dx*step/steps,start.y+dy*step/steps,start.z+dz*step/steps);
      sync(probeWorld,from);
      if(probeWorld.raycastAny(from,to,{},hit))return true;
      from.copy(to);
    }
    return false;
  }
  return {sync,blockedSegment,ringInnerRadius};
}
