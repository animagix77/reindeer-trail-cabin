import {Vector3} from 'three';
import {roomAt,roomAnchors} from './room-zones.js';
import {roomDetails} from './room-details.js';

export function installRoomHotspots({canvas,camera,getBody,visibleFromCamera,schedule}){
  const byId=id=>document.getElementById(id);
  const ui=byId('room-ui'),marker=byId('room-marker'),card=byId('room-card');
  const label=byId('room-label'),title=byId('room-title'),description=byId('room-description'),close=byId('room-close');
  const anchor=new Vector3(),projected=new Vector3();
  let current=null,blocked=false,layoutDirty=true,safe,view,halfWidth=0,halfHeight=0;
  let lastX,lastY,anchored=false;
  const eye=new Vector3(Infinity,0,0);
  const rotation=camera.quaternion.clone();
  let fov=0;

  function dismiss(){
    const ownedFocus=card.contains(document.activeElement)||document.activeElement===marker;
    current=null;marker.hidden=card.hidden=true;
    marker.setAttribute('aria-expanded','false');
    if(ownedFocus && !blocked)canvas.focus({preventScroll:true});
  }
  function closeCard(){
    if(card.hidden)return;
    card.hidden=true;marker.hidden=false;
    marker.setAttribute('aria-expanded','false');
    marker.focus({preventScroll:true});
    layoutDirty=true;schedule();
  }
  function openCard(){
    if(blocked || !current || current!==roomAt(getBody()))return;
    if(document.pointerLockElement===canvas)document.exitPointerLock();
    marker.setAttribute('aria-expanded','true');
    card.hidden=false;marker.hidden=true;
    close.focus({preventScroll:true});
  }
  marker.addEventListener('click',openCard);
  close.addEventListener('click',closeCard);
  document.addEventListener('keydown',e=>{
    if(!current || blocked || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.repeat)return;
    if(e.key==='Escape' && !card.hidden){closeCard();e.preventDefault();return;}
    if(e.code!=='KeyI'||![canvas,document.body,marker,close].includes(e.target))return;
    if(card.hidden)openCard();else closeCard();
    e.preventDefault();
  });
  // Mouse-look routes clicks to the canvas. The centre aim can still hit the marker.
  canvas.addEventListener('pointerup',e=>{
    if(e.button!==0 || document.pointerLockElement!==canvas || !anchored || marker.hidden)return;
    const r=marker.getBoundingClientRect(),x=view.left+view.width/2,y=view.top+view.height/2;
    if(x<r.left || x>r.right || y<r.top || y>r.bottom)return;
    e.stopImmediatePropagation();e.preventDefault();openCard();
  },true);

  function layoutChanged(){layoutDirty=true;schedule();}
  document.addEventListener('pointerlockchange',()=>{
    marker.toggleAttribute('data-locked',document.pointerLockElement===canvas);
    layoutChanged();
  });
  const resize=new ResizeObserver(layoutChanged);
  resize.observe(ui);resize.observe(canvas);resize.observe(marker);
  document.fonts?.ready.then(layoutChanged);
  const activity=byId('activity');
  function otherPanel(){
    blocked=!!document.querySelector('dialog[open]') || !activity.hidden;
    if(blocked)dismiss();else layoutChanged();
  }
  const panels=new MutationObserver(otherPanel);
  for(const dialog of document.querySelectorAll('dialog'))panels.observe(dialog,{attributes:true,attributeFilter:['open']});
  panels.observe(activity,{attributes:true,attributeFilter:['hidden']});
  otherPanel();

  function update(){
    if(blocked)return;
    const id=roomAt(getBody());
    if(id!==current){
      dismiss();
      if(!id)return;
      current=id;
      const details=roomDetails[id];
      label.textContent=details.marker;title.textContent=details.title;description.textContent=details.description;
      marker.setAttribute('aria-label',details.marker+' — '+details.title);
      anchor.fromArray(roomAnchors[id]);marker.hidden=false;layoutDirty=true;
    }
    if(!current || !card.hidden)return;
    if(!layoutDirty && eye.equals(camera.position) && rotation.equals(camera.quaternion) && fov===camera.fov)return;
    if(layoutDirty){
      safe=ui.getBoundingClientRect();view=canvas.getBoundingClientRect();
      halfWidth=marker.offsetWidth/2;halfHeight=marker.offsetHeight/2;
      layoutDirty=false;
    }
    eye.copy(camera.position);rotation.copy(camera.quaternion);fov=camera.fov;
    camera.updateWorldMatrix(true,false);
    projected.copy(anchor).project(camera);
    let x=view.left+(projected.x+1)*view.width/2-safe.left;
    let y=view.top+(1-projected.y)*view.height/2-safe.top-halfHeight-7;
    anchored=projected.z>=-1 && projected.z<=1 &&
      x>=halfWidth && x<=safe.width-halfWidth && y>=halfHeight && y<=safe.height-halfHeight &&
      visibleFromCamera(anchor);
    if(!anchored){x=halfWidth;y=halfHeight;}
    marker.toggleAttribute('data-anchored',anchored);
    x=Math.round(x);y=Math.round(y);
    if(x!==lastX || y!==lastY){
      marker.style.left=x+'px';marker.style.top=y+'px';lastX=x;lastY=y;
    }
  }
  return {update,reset:dismiss};
}
