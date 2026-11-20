import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Geometry is authored in metres, looking down -Z. Bake each articulated
// part into one vertex-coloured mesh so a full party is inexpensive to draw.
export function makeHiker(id,avatar){
  const woman=String(avatar).toLowerCase()==='woman';
  let seed=0;for(const c of String(id))seed=(seed*31+c.charCodeAt(0))>>>0;
  const skin=['#c58a62','#a66c4c','#dcab83','#8c5d45','#bc856a','#e4b894'][seed%6];
  const hair=woman?'#493025':'#382d25';
  const jacket=woman?'#46736e':'#a25133',seams=woman?'#315952':'#7b3c2b';
  const panel=woman?'#5a8a80':'#ba6c44',trousers=woman?'#4d5642':'#485053';
  const pack=woman?'#aa7443':'#52624b',web='#403e34',boot='#80593f',sole='#403d38',brass='#bf9770';
  const root=new T.Group(),body=new T.Group(),head=new T.Group(),joints=[];
  root.name=woman?'Woman trail hiker':'Man trail hiker';root.scale.setScalar(woman?.945:1);
  root.add(body);body.add(head);head.position.set(0,1.475,-.012);
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.87,metalness:0});
  const batches=new Map(),geometries=[],dummy=new T.Object3D();
  function part(parent,g,ink,x=0,y=0,z=0,rx=1,ry=1,rz=1,ax=0,ay=0,az=0){
    dummy.position.set(x,y,z);dummy.scale.set(rx,ry,rz);dummy.rotation.set(ax,ay,az);dummy.updateMatrix();
    const b=g.index?g.toNonIndexed():g;
    if(b!==g)g.dispose();
    b.deleteAttribute('uv');b.applyMatrix4(dummy.matrix);
    const color=new T.Color(ink),rgb=new Float32Array(b.attributes.position.count*3);
    for(let i=0;i<rgb.length;i+=3){rgb[i]=color.r;rgb[i+1]=color.g;rgb[i+2]=color.b;}
    b.setAttribute('color',new T.BufferAttribute(rgb,3));
    if(!batches.has(parent))batches.set(parent,[]);
    batches.get(parent).push(b);
  }
  const box=(p,c,x,y,z,w,h,d,ax=0,ay=0,az=0)=>part(p,new T.BoxGeometry(1,1,1),c,x,y,z,w,h,d,ax,ay,az);
  const oval=(p,c,x,y,z,w,h,d,ax=0,ay=0,az=0)=>part(p,new T.SphereGeometry(1,12,9),c,x,y,z,w,h,d,ax,ay,az);
  // Profiles keep a recognisable chin, shoulders, jacket hem and boot toe
  // even in silhouette. Each row is height, half width, half depth, Z offset.
  function profile(p,ink,rows,sides=12,x=0,z=0){
    const vertices=[],indices=[];
    for(const [y,rx,rz,cz=0] of rows)for(let k=0;k<sides;k++){
      const a=(k+.5)*Math.PI*2/sides;vertices.push(Math.sin(a)*rx,y,cz-Math.cos(a)*rz);
    }
    for(let j=0;j<rows.length-1;j++)for(let i=0;i<sides;i++){
      const a=j*sides+i,b=j*sides+(i+1)%sides;indices.push(a,a+sides,b,b,a+sides,b+sides);
    }
    const last=(rows.length-1)*sides;
    for(let i=1;i<sides-1;i++)indices.push(0,i,i+1,last,last+i+1,last+i);
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
    part(p,g,ink,x,0,z);
  }
  // A webbing strip follows the jacket over each shoulder without a gap.
  function ribbon(p,ink,points,halfWidth){
    const pos=[],idx=[];
    for(const [x,y,z] of points)pos.push(x-halfWidth,y,z,x+halfWidth,y,z);
    for(let i=0;i<points.length-1;i++){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
    part(p,g,ink);
  }
  const shoulder=woman?.209:.229;
  profile(body,trousers,[[.745,.117,.096],[.79,.164,.116],[.882,.171,.112],[.932,.15,.092]]);
  profile(body,jacket,[[.84,.165,.112],[.855,.186,.122],[.96,.181,.114],[1.10,.17,.112],[1.26,.210,.125],[1.38,shoulder,.119],[1.435,.124,.090],[1.44,.075,.070]]);
  profile(body,seams,[[.848,.184,.122],[.874,.187,.124],[.884,.183,.121]]);
  ribbon(body,'#403c34',[[0,.86,-.122],[0,.96,-.112],[0,1.10,-.111],[0,1.26,-.124],[0,1.38,-.118],[0,1.428,-.094]],.005);
  box(body,brass,-.004,1.325,-.131,.014,.038,.009,0,0,.1);
  for(const side of [-1,1]){
    box(body,seams,side*.12,.993,-.094,.015,.114,.015,0,side*-.35,side*-.41);
    box(body,panel,side*.144,1.239,-.088,.084,.034,.014,0,side*-.48,0);
  }
  oval(body,pack,0,1.175,.151,.158,.244,.107);
  oval(body,web,0,1.015,.204,.132,.090,.060);
  oval(body,pack,0,1.294,.209,.15,.104,.066);
  for(const side of [-1,1]){
    ribbon(body,web,[[side*.147,1.155,-.087],[side*.16,1.27,-.091],[side*.16,1.369,-.092],
      [side*.145,1.410,-.065],[side*.138,1.431,-.026],[side*.138,1.436,.013],
      [side*.149,1.422,.057],[side*.153,1.378,.108],[side*.15,1.289,.18]],.020);
    box(body,brass,side*.15,1.177,-.108,.034,.019,.015,0,side*-.38,0);
  }
  profile(body,skin,[[1.39,.074,.059],[1.50,.064,.065]]);
  profile(body,woman?'#c8954f':'#4a5645',[[1.389,.107,.096],[1.419,.113,.098],[1.465,.078,.074]],12,0,-.002);
  profile(head,skin,[[0,.047,.047,-.022],[.025,.073,.073,-.024],[.075,.100,.093,-.010],
    [.128,.113,.103],[.20,.114,.107,.004],[.251,.098,.090,.004],[.27,.055,.062]],16);
  for(const side of [-1,1]){
    oval(head,skin,side*.111,.125,.004,.022,.035,.019,0,0,side*-.1);
    oval(head,'#e6d8c4',side*.046,.138,-.095,.023,.007,.005,0,side*-.30,0);
    oval(head,'#40342a',side*.045,.137,-.100,.008,.007,.004,0,side*-.30,0);
    oval(head,hair,side*.046,.155,-.095,.024,.004,.004,0,side*-.29,side*.06);
  }
  profile(head,skin,[[.089,.013,.013,-.104],[.096,.022,.021,-.105],[.108,.017,.016,-.104],[.147,.007,.007,-.101]],9);
  for(const side of [-1,1])oval(head,'#925f4f',side*.014,.065,-.095,.018,.0035,.006,0,side*-.12,side*.11);
  if(woman){
    // The hairline rises at the forehead and dips behind each ear.
    const n=24,cap=[],tri=[];
    for(let ring=0;ring<5;ring++)for(let i=0;i<n;i++){
      const a=2*Math.PI*i/n,front=Math.max(0,Math.cos(a));
      const y=[.105+.096*front+.011*Math.sin(2*a),.218,.253,.279,.287][ring];
      const rx=[.12,.121,.105,.065,.015][ring],rz=[.112,.114,.105,.068,.019][ring];
      cap.push(rx*Math.sin(a),y,.001-rz*Math.cos(a));
    }
    for(let i=0;i<4*n;i++){
      const next=Math.floor(i/n)*n+(i+1)%n;
      tri.push(i,i+n,next,next,i+n,next+n);
    }
    const capGeo=new T.BufferGeometry();capGeo.setAttribute('position',new T.Float32BufferAttribute(cap,3));
    capGeo.setIndex(tri);capGeo.computeVertexNormals();part(head,capGeo,hair);
    for(const side of [-1,1])oval(head,hair,side*.104,.155,.016,.020,.047,.069,-.2,0,side*-.18);
    oval(head,'#c29b5d',0,.135,.113,.043,.039,.034);
    oval(head,hair,0,.061,.14,.055,.100,.046,-.35);
    oval(head,hair,0,-.014,.169,.036,.047,.031,-.34);
  }else{
    for(const side of [-1,1])oval(head,hair,side*.101,.17,.021,.021,.049,.065);
    profile(head,'#314a41',[[.172,.116,.108],[.187,.124,.118],[.255,.124,.118],[.301,.083,.083],[.314,.035,.035]],16);
    profile(head,'#41594e',[[.174,.123,.117],[.179,.128,.121],[.212,.127,.122],[.218,.122,.119]],16);
    box(head,'#bb936c',-.062,.197,-.106,.031,.025,.006,0,.54,0);
  }
  for(const side of [-1,1]){
    const arm=new T.Group(),forearm=new T.Group(),thigh=new T.Group(),shin=new T.Group(),foot=new T.Group();
    body.add(arm);arm.position.set(side*(shoulder-.012),1.36,0);arm.rotation.z=side*.105;
    profile(arm,jacket,[[-.269,.055,.057],[-.194,.065,.066],[-.108,.071,.077],[-.044,.079,.082],[.005,.070,.075],[.035,.045,.046]],12,side*.008);
    profile(arm,panel,[[-.050,.079,.083],[-.044,.080,.083],[-.041,.079,.082]],12,side*.008);
    arm.add(forearm);forearm.position.y=-.255;
    profile(forearm,jacket,[[-.224,.044,.047],[-.202,.053,.053],[-.076,.055,.060],[.013,.053,.058]]);
    profile(forearm,seams,[[-.231,.044,.047],[-.207,.051,.052]]);
    oval(forearm,skin,0,-.272,-.006,.042,.061,.033);
    oval(forearm,skin,-side*.026,-.261,-.026,.018,.038,.018);
    body.add(thigh);thigh.position.set(side*.094,.842,0);
    profile(thigh,trousers,[[-.385,.066,.068],[-.255,.073,.081],[-.10,.086,.101],[.034,.089,.096]]);
    thigh.add(shin);shin.position.y=-.369;
    profile(shin,trousers,[[-.325,.058,.064],[-.265,.066,.071],[-.135,.070,.075],[.01,.066,.070]]);
    shin.add(foot);foot.position.set(0,-.327,0);
    profile(foot,boot,[[-.131,.064,.133,-.038],[-.101,.075,.139,-.041],[-.062,.073,.123,-.034],[-.025,.068,.095,-.013],[.025,.066,.069]],12);
    profile(foot,sole,[[-.145,.071,.138,-.042],[-.122,.076,.142,-.042],[-.110,.073,.135,-.039]],12);
    for(let n=0;n<3;n++)box(foot,brass,0,-.024-n*.015,-.082-n*.024,.070,.006,.009,-.48,0,.04*(n%2?1:-1));
    joints.push({arm,forearm,thigh,shin,foot,side});
  }
  for(const [bone,parts] of batches){
    const g=mergeGeometries(parts,false);for(const p of parts)p.dispose();geometries.push(g);
    const mesh=new T.Mesh(g,material);mesh.receiveShadow=true;bone.add(mesh);
  }
  let seated=false;
  function pose(phase,motion,sit=false){
    seated=sit;
    const wave=Math.sin(phase);
    body.position.y=sit?-.43:.014*motion*(1-Math.cos(2*phase));
    body.rotation.z=.023*wave*motion;head.rotation.y=-.032*wave*motion;
    for(let i=0;i<joints.length;i++){
      const j=joints[i],stride=wave*j.side*motion;
      if(sit){
        j.thigh.rotation.x=1.65;j.shin.rotation.x=-1.23;j.foot.rotation.x=-.42;
        j.arm.rotation.x=.31;j.forearm.rotation.x=.91;
        continue;
      }
      j.thigh.rotation.x=.47*stride;
      j.shin.rotation.x=-.025-.46*Math.max(0,Math.cos(phase)*j.side)*motion;
      j.foot.rotation.x=-.20*stride-j.shin.rotation.x*.27;
      j.arm.rotation.x=-.36*stride+.04;
      j.forearm.rotation.x=.16+.17*Math.max(0,-stride);
    }
  }
  pose(0,0);
  return {root,get height(){return root.scale.y*(seated?1.36:1.79);},get seated(){return seated;},pose,dispose(){for(const g of geometries)g.dispose();material.dispose();}};
}
