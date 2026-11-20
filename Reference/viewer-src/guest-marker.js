import * as T from 'three';

// A small trail marker with a facing arrow identifies friends without obscuring
// architectural details. Depth testing lets the cabin walls hide other visitors.
export function guestMarker(name,id){
  const root=new T.Group();
  let hash=0;for(const letter of id)hash=(hash*31+letter.charCodeAt(0))>>>0;
  const color=new T.Color().setHSL((hash%360)/360,.51,.45);
  const marker=new T.Mesh(new T.ConeGeometry(.14,.33,6),new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.34}));
  marker.rotation.z=Math.PI;marker.position.y=1.39;root.add(marker);
  const nose=new T.Mesh(new T.ConeGeometry(.055,.18,6),marker.material);
  nose.rotation.x=-Math.PI/2;nose.position.set(0,1.45,-.15);root.add(nose);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=80;
  const ctx=canvas.getContext('2d');ctx.font='bold 35px system-ui';const width=Math.min(500,Math.ceil(ctx.measureText(name).width)+38);
  ctx.fillStyle='#182e27';ctx.beginPath();ctx.roundRect((512-width)/2,7,width,66,18);ctx.fill();
  ctx.fillStyle='white';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(name,256,40,465);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const tag=new T.Sprite(new T.SpriteMaterial({map:texture,depthWrite:false,transparent:true}));
  tag.scale.set(1.65,.258,1);tag.position.y=1.76;root.add(tag);root.visible=false;
  return {root,dispose(){marker.geometry.dispose();marker.material.dispose();nose.geometry.dispose();tag.material.dispose();texture.dispose();}};
}
