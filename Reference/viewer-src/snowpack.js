import * as T from 'three';

// A sampled surface in metres follows the walkable grade, including the driveway
// and yard. A cell keeps its own depth after a shovel stroke or a weather change.
const spacing=.22, limit=.18;
const sheltered=/^WalkSurface_(MainFloor|Bathroom|Basement|Loft|CoveredDeck|FrontLanding)/;
export function installSnowpack(scene,model,space,roof){
  const bounds=new T.Box3().setFromObject(model.getObjectByName('WalkSurface_ParcelGround'));
  const x0=bounds.min.x-spacing,z0=bounds.min.z-spacing;
  const width=Math.ceil((bounds.max.x-x0)/spacing)+2,height=Math.ceil((bounds.max.z-z0)/spacing)+2;
  const depths=new Float32Array(width*height),base=new Float32Array(depths.length).fill(NaN);
  const mask=new Uint8Array(depths.length),texture=new T.DataTexture(mask,width,height,T.RedFormat);
  texture.needsUpdate=true;
  const uv=new T.Vector4(x0-spacing/2,z0-spacing/2,1/(width*spacing),1/(height*spacing));
  const material=new T.MeshStandardMaterial({vertexColors:true,transparent:true,alphaTest:.015,depthWrite:false,roughness:.92});
  let mesh,level=0,last=null,elapsed=0,maximum=0;
  function covered(x,y,z){
    const map=roof.coverMap.value.image,transform=roof.coverUV.value;
    const u=Math.floor((x-transform.x)*transform.z*map.width),v=Math.floor((z-transform.y)*transform.w*map.height);
    if(u<0||v<0||u>=map.width||v>=map.height)return false;
    const value=map.data[v*map.width+u],range=roof.coverY.value;
    return value>0 && y<range.x+(value-1)*range.y/254;
  }
  function build(){
    const points=[],colors=[],indices=[];
    for(let row=0;row<height;row++)for(let col=0;col<width;col++){
      const i=row*width+col,x=x0+col*spacing,z=z0+row*spacing;
      const floors=space.heights(x,z);
      const y=floors.reduce((top,f)=>Math.max(f.y,top),-Infinity);
      if(Number.isFinite(y)&&!floors.some(f=>sheltered.test(f.label))&&!covered(x,y,z)){
        base[i]=y+.006;mask[i]=255;
      }
      points.push(x,mask[i]?base[i]:0,z);
      const shade=.93+.035*Math.sin(x*1.2+Math.cos(z*2))+.025*Math.cos(z*3.8+x);
      colors.push(shade*.92,shade*.97,shade,0);
    }
    function triangle(a,b,c){
      if(mask[a]&&mask[b]&&mask[c]&&Math.max(base[a],base[b],base[c])-Math.min(base[a],base[b],base[c])<.29)indices.push(a,b,c);
    }
    for(let z=0;z<height-1;z++)for(let x=0;x<width-1;x++){
      const i=z*width+x;triangle(i,i+width,i+1);triangle(i+1,i+width,i+width+1);
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(points,3).setUsage(T.DynamicDrawUsage));
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,4).setUsage(T.DynamicDrawUsage));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    mesh=new T.Mesh(geometry,material);
    mesh.name='Settled snow';mesh.receiveShadow=true;mesh.frustumCulled=false;scene.add(mesh);texture.needsUpdate=true;
  }
  function refresh(){
    maximum=0;
    const {position,color}=mesh.geometry.attributes;
    for(let i=0;i<depths.length;i++)if(mask[i]){
      const depth=depths[i];maximum=Math.max(maximum,depth);
      position.setY(i,base[i]+depth);color.setW(i,Math.min(1,depth/.014));
    }
    mesh.visible=maximum>.0005;
    position.needsUpdate=color.needsUpdate=true;
    mesh.geometry.computeVertexNormals();
  }
  function index(x,z){
    const c=Math.round((x-x0)/spacing),r=Math.round((z-z0)/spacing);
    return c>=0&&c<width&&r>=0&&r<height?r*width+c:-1;
  }
  return {
    material,mask:texture,uv,
    get coverage(){return Math.min(1,level/.085);},
    get melting(){return maximum>.0005;},
    update(weather,seconds){
      const dt=last===null?0:Math.min(1,Math.max(0,seconds-last));last=seconds;
      if(weather!=='snow'&&!maximum&&!level)return;
      if(!mesh)build();
      elapsed+=dt;
      if(elapsed<.25)return;
      const delta=elapsed*(weather==='snow'?.0024:weather==='rain'?-.003:-.0009);elapsed=0;
      level=T.MathUtils.clamp(level+delta,0,limit);
      let changed=false;
      for(let i=0;i<depths.length;i++)if(mask[i]){
        const d=depths[i];
        depths[i]=delta>0?Math.max(d,Math.min(limit,d+delta)):Math.max(0,d+delta);
        if(depths[i]!==d)changed=true;
      }
      if(changed)refresh();
    },
    at(x,z,ground){
      const i=index(x,z);
      return i>=0&&Math.abs(base[i]-ground)<.28?depths[i]:0;
    },
    hit(ray){
      if(!mesh?.visible||ray.direction.y>-.10)return null;
      const p=new T.Vector3();
      for(let d=.25;d<=2.85;d+=.055){
        ray.at(d,p);const i=index(p.x,p.z);
        if(i>=0&&mask[i]&&p.y<=base[i]+depths[i]){
          return depths[i]>=.006?{object:mesh,point:p.clone(),distance:d}:null;
        }
      }
      return null;
    },
    scoop(point,direction){
      if(!mesh)return false;
      const center=index(point.x,point.z);
      if(center<0||depths[center]<.006)return false;
      let removed=0;
      function patch(x,z,radius,fn){
        const col=Math.round((x-x0)/spacing),row=Math.round((z-z0)/spacing),reach=Math.ceil(radius/spacing);
        for(let r=Math.max(0,row-reach);r<=Math.min(height-1,row+reach);r++)for(let c=Math.max(0,col-reach);c<=Math.min(width-1,col+reach);c++){
          const i=r*width+c,dist=Math.hypot(x0+c*spacing-x,z0+r*spacing-z);
          if(mask[i]&&dist<radius&&Math.abs(base[i]-base[center])<.38)fn(i,1-T.MathUtils.smoothstep(dist,radius*.67,radius));
        }
      }
      patch(point.x,point.z,.49,(i,w)=>{const take=depths[i]*w;depths[i]-=take;removed+=take;});
      const horizontal=Math.hypot(direction.x,direction.z)||1;
      const x=point.x-direction.z*.86/horizontal,z=point.z+direction.x*.86/horizontal;
      const bank=[];let total=0;
      patch(x,z,.55,(i,w)=>{bank.push([i,w]);total+=w;});
      for(const [i,w] of bank)depths[i]=Math.min(.34,depths[i]+removed*w/total);
      refresh();return removed>0;
    }
  };
}
