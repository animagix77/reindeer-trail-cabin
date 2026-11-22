import * as T from 'three';

const width=960,height=540;
const tiles=[
  {id:'winter',name:'Winter garden',x:40,y:119,w:555,h:377},
  {id:'aerial',name:'From above',x:611,y:119,w:309,h:377}
];
const homeButton={x:24,y:20,w:152,h:60};
const contains=(r,x,y)=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;

function photograph(ctx,image,r){
  ctx.fillStyle='#334d47';ctx.fillRect(r.x,r.y,r.w,r.h);
  if(!image?.naturalWidth)return;
  const ratio=Math.max(r.w/image.naturalWidth,r.h/image.naturalHeight);
  const w=r.w/ratio,h=r.h/ratio;
  ctx.drawImage(image,(image.naturalWidth-w)/2,(image.naturalHeight-h)*.58,w,h,r.x,r.y,r.w,r.h);
}

export function installSmartTV(model,schedule){
  let glass;
  model.traverse(o=>{if(o.isMesh && o.material.name?.endsWith('Television glass'))glass=o;});
  if(!glass)return null;
  glass.geometry.computeBoundingBox();
  const bounds=glass.geometry.boundingBox,center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
  const material=new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,toneMapped:false});
  const panel=new T.Mesh(new T.PlaneGeometry(size.x,size.y),material);
  panel.name='Living room smart TV display';
  panel.position.set(center.x,center.y,bounds.max.z+.0008);
  panel.visible=false;glass.add(panel);panel.updateWorldMatrix(true,false);
  const toLocal=panel.matrixWorld.clone().invert(),local=new T.Vector3();
  let awake=false,level=0,previousTime=null,page='home',ctx;
  const images={};
  function draw(){
    if(!ctx)return;
    ctx.clearRect(0,0,width,height);
    if(page==='home'){
      const bg=ctx.createLinearGradient(0,0,width,height);
      bg.addColorStop(0,'#263c38');bg.addColorStop(1,'#0c181c');ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
      ctx.fillStyle='#fff5dd';ctx.font='600 56px Georgia';ctx.fillText('Cabin TV',40,83);
      ctx.textAlign='right';ctx.font='500 28px sans-serif';ctx.fillStyle='#cfddd3';ctx.fillText('Home',920,76);ctx.textAlign='left';
      for(const tile of tiles){
        ctx.save();ctx.beginPath();ctx.roundRect(tile.x,tile.y,tile.w,tile.h,18);ctx.clip();
        photograph(ctx,images[tile.id],tile);
        const shade=ctx.createLinearGradient(0,280,0,498);
        shade.addColorStop(0,'rgba(4,13,13,0)');shade.addColorStop(1,'rgba(4,13,13,.94)');
        ctx.fillStyle=shade;ctx.fillRect(tile.x,tile.y,tile.w,tile.h);
        ctx.font='600 38px sans-serif';ctx.fillStyle='#fff8e8';ctx.fillText(tile.name,tile.x+23,463);
        ctx.restore();
      }
    }else{
      photograph(ctx,images[page],{x:0,y:0,w:width,h:height});
      ctx.fillStyle='rgba(12,26,24,.82)';ctx.beginPath();ctx.roundRect(homeButton.x,homeButton.y,homeButton.w,homeButton.h,29);ctx.fill();
      ctx.fillStyle='#fff5e3';ctx.font='600 28px sans-serif';ctx.fillText('‹  Home',48,60);
      if(page==='aerial'){
        ctx.fillStyle='rgba(10,24,22,.86)';ctx.fillRect(0,height-34,width,34);
        ctx.font='19px sans-serif';ctx.fillStyle='#fff4dc';ctx.fillText('2025 · New York Statewide Digital Orthoimagery Program',24,height-11);
      }
    }
    material.map.needsUpdate=true;schedule();
  }
  function init(){
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    ctx=canvas.getContext('2d');
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    material.map=texture;material.needsUpdate=true;
    images.winter=document.querySelector('.welcome-image');
    if(!images.winter?.naturalWidth)images.winter?.addEventListener('load',draw,{once:true});
    images.aerial=new Image();images.aerial.onload=draw;
    images.aerial.src=JSON.parse(document.getElementById('map-assets').textContent).images.aerial;
    draw();
  }
  function control(uv){
    if(!awake || !uv)return null;
    const x=uv.x*width,y=(1-uv.y)*height;
    if(page==='home')return tiles.find(tile=>contains(tile,x,y))?.id;
    return contains(homeButton,x,y)?'home':null;
  }
  return {
    update(position,floor,time){
      local.copy(position).applyMatrix4(toLocal);
      // A visitor upstairs, behind the screen or at the other side of the house
      // should never wake it. A wider exit band prevents flicker at the boundary.
      awake=/^WalkSurface_MainFloor/.test(floor) && local.z>.05 && Math.abs(local.y)<1.05 &&
        local.lengthSq()<(awake?3.7:2.55)**2;
      if(awake && !ctx)init();
      const dt=Math.min(.12,Math.max(0,time-(previousTime??time)));previousTime=time;
      level=T.MathUtils.clamp(level+(awake?3:-2)*dt,0,1);
      material.opacity=level;panel.visible=level>0;
      if(!awake&&!level&&page!=='home'){page='home';draw();}
      return awake?level<1:level>0;
    },
    hit(raycaster){
      if(!awake)return null;
      const hit=raycaster.intersectObject(panel,false)[0];
      return control(hit?.uv)?hit:null;
    },
    select(uv){
      const next=control(uv);
      if(!next)return false;
      page=next;draw();return true;
    }
  };
}
