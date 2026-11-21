import {Source} from 'three';

// The distant hardwood atlas has three crowns. Fill in the limbs hidden by its
// summer foliage so the same trees have continuous silhouettes after leaf drop.
function dormantCrowns(width,height){
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');
  ctx.scale(width/1152,height/640);
  ctx.lineCap='round';
  let seed=4509;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  function limb(x,y,angle,length,radius,depth){
    const bend=(random()-.5)*.28;
    const endX=x+Math.cos(angle+bend)*length,endY=y+Math.sin(angle+bend)*length;
    ctx.beginPath();ctx.moveTo(x,y);
    ctx.quadraticCurveTo(x+Math.cos(angle)*length*.58,y+Math.sin(angle)*length*.58,endX,endY);
    ctx.lineWidth=radius;ctx.stroke();
    if(depth>0){
      limb(endX,endY,angle+bend-.22-random()*.32,length*(.56+random()*.18),radius*.63,depth-1);
      limb(endX,endY,angle+bend+.22+random()*.32,length*(.56+random()*.18),radius*.63,depth-1);
    }
  }
  for(const [index,base] of [178,197,209].entries()){
    ctx.save();
    ctx.translate(index*384,0);
    ctx.beginPath();ctx.rect(0,0,384,640);ctx.clip();
    ctx.strokeStyle='#524a40';
    let x=base,y=631;
    for(let k=0;k<20;k++){
      const nextX=x+(random()-.5)*7,nextY=y-29;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(nextX,nextY);
      ctx.lineWidth=9*(1-k/21);ctx.stroke();
      if(k>=5){
        const side=k%2?1:-1,angle=-Math.PI/2+side*(.67+random()*.40);
        const spread=Math.sin(Math.PI*(k-3)/19);
        limb(x,y,angle,19+48*spread,1.4+3.8*spread,4);
      }
      x=nextX;y=nextY;
    }
    ctx.restore();
  }
  return canvas;
}

// Bake seasonal coverage only when its level changes. The same alpha then
// reaches the color pass, directional shadow map, and outdoor reflection probe.
export function seasonalLeafCover(material,distant){
  const original=material.map;
  let lastLevel=0,canvas,ctx,pixels,summerAlpha,retention,branches;
  return season=>{
    const level=Math.round(32*Math.min(1,season.winter+.15*season.autumn+.09*season.spring));
    if(level===lastLevel)return;
    lastLevel=level;
    if(!canvas){
      const image=original.image;
      canvas=document.createElement('canvas');
      canvas.width=image.width;canvas.height=image.height;
      ctx=canvas.getContext('2d');
      ctx.drawImage(image,0,0);
      pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
      retention=new Uint8Array(canvas.width*canvas.height);
      summerAlpha=new Uint8Array(retention.length);
      const rgba=pixels.data;
      for(let k=0;k<retention.length;k++){
        const i=4*k,r=rgba[i],g=rgba[i+1],b=rgba[i+2];
        summerAlpha[k]=rgba[i+3];
        if(!summerAlpha[k]||g<r*.99||g-b<12){retention[k]=255;continue;}
        const x=k%canvas.width,y=Math.floor(k/canvas.width);
        // Shed clusters together and retain some of the shaded leaves longest.
        const clump=Math.sin(x*.057+2*Math.sin(y*.037))*.20+Math.cos(y*.094+x*.053)*.13;
        const shade=Math.max(-.22,Math.min(.22,(117-g)*.006));
        retention[k]=Math.round(235*Math.max(.01,Math.min(.99,.49+clump+shade)));
      }
      // Cloning preserves glTF orientation, wrapping, sampler and sRGB handling.
      const texture=original.clone();
      texture.source=new Source(canvas);
      material.map=texture;
    }
    const threshold=level/32*255;
    for(let k=0;k<retention.length;k++){
      const i=4*k+3;
      const keep=retention[k]===255?1:Math.max(0,Math.min(1,(retention[k]-threshold+6)/12));
      pixels.data[i]=summerAlpha[k]*keep;
    }
    ctx.putImageData(pixels,0,0);
    if(distant && level>8){
      branches??=dormantCrowns(canvas.width,canvas.height);
      ctx.globalCompositeOperation='destination-over';
      ctx.globalAlpha=Math.min(1,(level-8)/16);
      ctx.drawImage(branches,0,0);
      ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    }
    material.map.needsUpdate=true;
  };
}
