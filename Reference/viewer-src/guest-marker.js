import * as T from 'three';
import {makeHiker} from './hiker.js';

function labelSprite(){
  const canvas=document.createElement('canvas');
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
  const material=new T.SpriteMaterial({map,depthTest:true,depthWrite:false,transparent:true,fog:false,toneMapped:false});
  const sprite=new T.Sprite(material);sprite.center.set(.5,0);sprite.frustumCulled=false;
  return {canvas,map,sprite,width:0,height:0,dispose(){map.dispose();material.dispose();}};
}
function draw(label,lines,chat){
  const font=chat?'500 34px system-ui, sans-serif':'650 33px system-ui, sans-serif';
  const ctx=label.canvas.getContext('2d');ctx.font=font;
  let width=0;for(const line of lines)width=Math.max(width,ctx.measureText(line).width);
  const padding=chat?23:19,lineHeight=chat?42:40,tail=chat?13:0;
  const w=Math.ceil(width)+2*padding+4,h=lines.length*lineHeight+18;
  if(label.width && (label.width!==w || label.height!==h+tail))label.map.dispose();
  label.canvas.width=w;label.canvas.height=h+tail;ctx.font=font;ctx.textBaseline='middle';
  ctx.fillStyle=chat?'#fffaea':'#1e382f';
  ctx.beginPath();ctx.roundRect(1,1,w-2,h-2,chat?20:Math.min(22,h/2));ctx.fill();
  if(chat){
    ctx.beginPath();ctx.moveTo(w/2-12,h-4);ctx.lineTo(w/2,h+tail-1);ctx.lineTo(w/2+12,h-4);ctx.closePath();ctx.fill();
  }
  ctx.textAlign=chat?'left':'center';ctx.fillStyle=chat?'#242e28':'#f6f6e9';
  for(let i=0;i<lines.length;i++)ctx.fillText(lines[i],chat?padding:w/2,9+lineHeight*(i+.5));
  label.width=w;label.height=h+tail;label.map.needsUpdate=true;
}
// Chat may contain one long word or an emoji sequence. Use measured line
// lengths and page long messages so every word fits on a portrait screen.
function wrap(measure,text){
  const ctx=measure.canvas.getContext('2d');ctx.font='500 34px system-ui, sans-serif';
  const lines=[];let line='';
  for(const word of text.trim().split(/\s+/u)){
    const trial=line?line+' '+word:word;
    if(ctx.measureText(trial).width<=455){line=trial;continue;}
    if(line){lines.push(line);line='';}
    if(ctx.measureText(word).width<=455){line=word;continue;}
    const chars=typeof Intl.Segmenter==='function'
      ?Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(word),v=>v.segment):Array.from(word);
    for(const ch of chars){
      if(line && ctx.measureText(line+ch).width>455){lines.push(line);line='';}
      line+=ch;
    }
  }
  if(line)lines.push(line);
  const pages=[];
  for(let i=0;i<lines.length;i+=4)pages.push(lines.slice(i,i+4));
  return pages;
}

export function guestMarker(name,id,avatar='man'){
  const root=new T.Group();root.name='Visitor · '+name;root.visible=false;
  const hiker=makeHiker(id,avatar);root.add(hiker.root);
  const tag=labelSprite(),bubble=labelSprite();
  tag.sprite.name='Visitor name';bubble.sprite.name='Visitor chat';
  root.add(tag.sprite,bubble.sprite);
  const letters=Array.from(name);const nameContext=tag.canvas.getContext('2d');nameContext.font='650 33px system-ui, sans-serif';
  while(letters.length>1 && nameContext.measureText(letters.join('')+'…').width>434)letters.pop();
  draw(tag,[letters.length===Array.from(name).length?name:letters.join('')+'…'],false);bubble.sprite.visible=false;
  const eye=new T.Vector3();
  // Give text a minimum projected size within conversational range; distant
  // labels shrink naturally. Both sprites still depth-test against the model.
  function sizeLabel(label,chat){
    label.sprite.onBeforeRender=(renderer,scene,camera)=>{
      eye.setFromMatrixPosition(root.matrixWorld);eye.y+=hiker.height;
      eye.applyMatrix4(camera.matrixWorldInverse);
      const lens=2/Math.abs(camera.projectionMatrix.elements[5]);
      const metresPerPixel=lens*(camera.isPerspectiveCamera?Math.max(0,-eye.z):1)/Math.max(1,renderer.domElement.clientHeight||renderer.domElement.height);
      const viewportWidth=renderer.domElement.clientWidth||renderer.domElement.width;
      const factor=Math.min(T.MathUtils.clamp(.42*metresPerPixel,.0036,.0095),metresPerPixel*.86*viewportWidth/label.width);
      const nameSize=Math.min(T.MathUtils.clamp(.40*metresPerPixel,.0036,.0095),metresPerPixel*.80*viewportWidth/tag.width);
      const anchor=hiker.height+.07+(chat?tag.height*nameSize+.035:0);
      label.sprite.position.y=anchor;
      label.sprite.scale.set(label.width*(chat?factor:nameSize),label.height*(chat?factor:nameSize),1);
      label.sprite.updateWorldMatrix(false,false);
    };
  }
  sizeLabel(tag,false);sizeLabel(bubble,true);
  let stride=0,motion=0,pages=[],page=-1,until=0;
  function showPage(index,now){
    page=index;
    const lines=pages[index];draw(bubble,lines,true);
    until=now+Math.max(3700,1700+51*lines.join(' ').length);
    bubble.sprite.visible=true;bubble.sprite.material.opacity=1;
  }
  return {
    root,
    say(value){
      const message=String(value??'').slice(0,360).trim();if(!message)return;
      pages=wrap(bubble,message);showPage(0,performance.now());
    },
    update(dt,walking,seated=false){
      const step=Math.min(.20,Math.max(0,Number.isFinite(dt)?dt:0));
      const goal=walking?1:0;
      if(seated!==hiker.seated || goal || motion>.001){
        motion=T.MathUtils.damp(motion,goal,walking?12:15,step);stride+=step*7.6*motion;
        if(!walking && motion<.002){motion=0;stride=0;}
        hiker.pose(stride,motion,seated);
      }
      if(page!==-1){
        const now=performance.now();
        while(now>=until && page+1<pages.length)showPage(page+1,until);
        if(now>=until){page=-1;pages=[];bubble.sprite.visible=false;}else{
          bubble.sprite.material.opacity=Math.min(1,(until-now)/280);
        }
      }
      return Boolean(goal || motion>.001 || page!==-1);
    },
    dispose(){hiker.dispose();tag.dispose();bubble.dispose();}
  };
}
