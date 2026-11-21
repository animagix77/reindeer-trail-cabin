import * as T from 'three';

const maxLeaves=7, palette=[0xe6b84b,0xd99c43,0xeac773,0xc47c35,0xac622f];
const underCover=/^WalkSurface_(MainFloor|Loft|Bathroom|Basement|CoveredDeck|FrontLanding)/;

function exposedGround(space,x,z){
  let ground=-Infinity;
  for(const hit of space.heights(x,z)){
    if(underCover.test(hit.label))return -Infinity;
    ground=Math.max(ground,hit.y);
  }
  return ground;
}

// A shallow fold along the midrib catches the moving light on each side.
function leafBlade(){
  const g=new T.BufferGeometry();
  const outline=[[0,0,-.065],[-.016,0,-.043],[-.045,.003,-.024],[-.031,.003,-.012],
    [-.052,.004,.017],[-.024,.002,.013],[-.022,0,.036],[-.011,.001,.026],
    [.002,.003,.071],[.012,.001,.025],[.025,0,.035],[.023,.002,.012],
    [.049,.003,.018],[.031,.003,-.011],[.043,.002,-.025],[.016,0,-.044]];
  const rib=outline.length,indices=[];
  for(let i=0;i<rib;i++)indices.push(rib,(i+1)%rib,i);
  g.setAttribute('position',new T.Float32BufferAttribute([...outline,[0,.007,-.007]].flat(),3));
  g.setIndex(indices);g.computeVertexNormals();
  return g;
}

export function installFallingLeaves(world,model,space,motion,schedule){
  const sources=[],point=new T.Vector3(),forward=new T.Vector3(),pose=new T.Object3D(),tint=new T.Color();
  model.traverse(mesh=>{
    if(!mesh.isMesh||mesh.material?.name!=='Daylight broadleaf sprays')return;
    const positions=mesh.geometry.getAttribute('position');
    // Sample one tip per nineteen authored sprays, excluding low ferns and saplings.
    for(let i=2;i<positions.count;i+=4*19){
      point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
      const ground=exposedGround(space,point.x,point.z);
      if(Number.isFinite(ground)&&point.y-ground>2.4)sources.push(point.clone());
    }
  });
  const material=new T.MeshLambertMaterial({side:T.DoubleSide});
  const leaves=new T.InstancedMesh(leafBlade(),material,maxLeaves);
  leaves.name='Falling hardwood leaves';
  leaves.instanceMatrix.setUsage(T.DynamicDrawUsage);
  leaves.count=0;leaves.visible=false;leaves.frustumCulled=false;leaves.receiveShadow=true;
  world.add(leaves);
  const active=[];
  let next=0,wake=null,previous=null;

  function release(camera,seconds,weather,arriving){
    camera.getWorldDirection(forward);
    const horizon=Math.hypot(forward.x,forward.z);
    let source,total=0;
    for(const site of sources){
      const dx=site.x-camera.position.x,dz=site.z-camera.position.z,distance=Math.hypot(dx,dz);
      if(distance>19||distance<.75)continue;
      const facing=horizon>.1?(dx*forward.x+dz*forward.z)/(distance*horizon):1;
      if(facing<-.1)continue;
      // Favour the nearby woodline, with enough variation to avoid a single emitter.
      const weight=(.15+Math.max(0,facing)**2)/(3+distance);
      total+=weight;
      if(Math.random()*total<weight)source=site;
    }
    if(!source)return;
    const speed=(.72+Math.random()*.45)*(weather==='rain'?1.25:1);
    const wind=(.09+Math.random()*.15)*(weather==='rain'?1.6:weather==='cloudy'?1.2:1);
    const advance=arriving?Math.max(0,(source.y-camera.position.y-1-Math.random()*2)/speed):0;
    active.push({source,speed,wind,start:seconds-advance,phase:Math.random()*Math.PI*2,
      scale:.78+Math.random()*.43,color:palette[Math.floor(Math.random()*palette.length)],
      landed:null});
  }

  return function update(camera,seconds,outdoors,leafFall,weather){
    if(!outdoors||motion.matches||!(leafFall>0)||weather==='snow'||!sources.length){
      active.length=0;leaves.count=0;leaves.visible=false;next=0;previous=null;
      if(wake!==null){clearTimeout(wake);wake=null;}
      return false;
    }
    // A returning tab starts with the current breeze rather than catching up old flights.
    const arriving=previous===null||(active.length>0&&seconds-previous>3);
    if(arriving){active.length=0;next=seconds;}
    previous=seconds;
    if(seconds>=next){
      if(active.length<maxLeaves)release(camera,seconds,weather,arriving);
      next=seconds+(2.8+Math.random()*5.4)/Math.max(.12,leafFall);
    }

    let count=0;
    for(let i=active.length-1;i>=0;i--){
      const leaf=active[i],age=seconds-leaf.start,p=leaf.phase,s=leaf.source;
      if(leaf.landed===null){
        const wave=age*2.35+p;
        pose.position.set(s.x+leaf.wind*age+.22*(Math.sin(wave)-Math.sin(p)),
          s.y-age*leaf.speed+.075*(Math.cos(wave)-Math.cos(p)),
          s.z+leaf.wind*.35*age+.18*(Math.sin(age*1.62+p)-Math.sin(p)));
        leaf.ground=exposedGround(space,pose.position.x,pose.position.z);
        if(!Number.isFinite(leaf.ground)){active.splice(i,1);continue;}
        if(pose.position.y<=leaf.ground+.014){
          leaf.landed=seconds;leaf.x=pose.position.x;leaf.z=pose.position.z;
        }
      }
      if(leaf.landed!==null){
        const rest=seconds-leaf.landed;
        if(rest>=2.7){active.splice(i,1);continue;}
        pose.position.set(leaf.x,leaf.ground+.014,leaf.z);
        pose.rotation.set(.06,p+.34*(leaf.landed-leaf.start),.03);
        pose.scale.setScalar(leaf.scale*(1-T.MathUtils.smoothstep(rest,1.9,2.7)));
      }else{
        pose.rotation.set(.23+.8*Math.sin(age*2.35+p),p+age*.34,.95*Math.sin(age*1.62+p));
        pose.scale.setScalar(leaf.scale);
      }
      pose.updateMatrix();
      leaves.setMatrixAt(count,pose.matrix);
      leaves.setColorAt(count++,tint.setHex(leaf.color));
    }
    leaves.count=count;leaves.visible=count>0;
    if(count){
      leaves.instanceMatrix.needsUpdate=true;leaves.instanceColor.needsUpdate=true;
    }else if(wake===null&&schedule){
      wake=setTimeout(()=>{wake=null;schedule();},Math.max(1,(next-seconds)*1000));
    }
    return count>0;
  };
}
