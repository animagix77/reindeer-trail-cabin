import {Euler,Quaternion,Vector3} from 'three';

const gravity=9.81,step=1/90;
// Restitution, grip on first impact, rolling resistance and effective rolling
// radius distinguish a round apple from a branch or a log with a flat face.
const materials={
  apple:      {bounce:.31,carry:.40,drag:2.1,radius:.044,spin:4.8},
  carrot:     {bounce:.23,carry:.25,drag:3.5,radius:.024,spin:3.2},
  vegetables: {bounce:.10,carry:.11,drag:6.8,radius:.056,spin:2.6},
  twigs:      {bounce:.19,carry:.20,drag:5.5,radius:.040,spin:3.0},
  sticks:     {bounce:.26,carry:.30,drag:3.8,radius:.025,spin:3.7},
  logs:       {bounce:.21,carry:.22,drag:4.6,radius:.076,spin:2.2}
};

export function tossArc(out,start,contact,duration,t){
  out.lerpVectors(start,contact,t);
  out.y+=.5*gravity*duration*duration*t*(1-t);
  return out;
}

// Plan the short landing at toss time, so the feeding AI can select a reachable
// spot and playback gives the same impacts at any display refresh rate.
export function createTossMotion({kind,start,contact,duration,orientation=new Quaternion(),groundAt}){
  const material=materials[kind],origin=start.clone(),touch=contact.clone();
  const heading=new Vector3(touch.x-origin.x,0,touch.z-origin.z);
  const incoming=heading.length()/duration;
  if(incoming>0)heading.normalize();else heading.set(0,0,1);
  const axle=new Vector3(heading.z,0,-heading.x);
  const flat=new Quaternion().setFromEuler(new Euler(0,Math.atan2(heading.x,heading.z)+.16,
    kind==='carrot'?Math.PI/2:0,'YXZ'));
  const rotation=new Quaternion(),initial=orientation.clone();
  const impact=new Quaternion().setFromAxisAngle(axle,-.34).multiply(flat);
  const unspun=new Quaternion().setFromAxisAngle(axle,-material.spin).multiply(impact);
  const frames=[{position:touch,quaternion:impact}];
  let speed=Math.min(1.35,incoming*material.carry);
  let vertical=Math.min(1.55,Math.max(0,(origin.y-touch.y)/duration+.5*gravity*duration)*material.bounce);
  let airborne=true,floor=touch.y;
  for(let i=0;i<270;i++){
    const last=frames.at(-1),position=last.position.clone(),quaternion=last.quaternion.clone();
    let distance=speed*step;
    let nextFloor=distance>0?groundAt(position.x+heading.x*distance,position.z+heading.z*distance):floor;
    if(!Number.isFinite(nextFloor)||nextFloor-floor>Math.max(.035,distance)){
      // An edge, a vertical obstacle, or the inside wall of the fire ring.
      distance=0;speed=0;nextFloor=floor;
    }
    position.addScaledVector(heading,distance);
    if(airborne){
      position.y+=vertical*step-.5*gravity*step*step;
      vertical-=gravity*step;
      if(position.y<=nextFloor){
        position.y=nextFloor;
        vertical=-vertical*material.bounce;
        speed*=.74;
        airborne=vertical>.16;
      }
    }else{
      position.y=nextFloor;
      const slope=distance>0?(nextFloor-floor)/distance:0;
      speed=Math.max(0,speed-step*Math.max(.65,material.drag+gravity*slope));
    }
    floor=nextFloor;
    rotation.setFromAxisAngle(axle,distance/material.radius);
    quaternion.premultiply(rotation);
    if(!airborne && kind!=='apple'){
      // Irregular pieces rock onto a flat side after their last hop.
      quaternion.slerp(flat,1-Math.exp(-step*14));
    }
    frames.push({position,quaternion});
    if(!airborne && speed===0 && (kind==='apple'||quaternion.angleTo(flat)<.012))break;
  }
  return {
    duration:duration+(frames.length-1)*step,rest:frames.at(-1).position.clone(),
    sample(age,mesh){
      if(age<duration){
        const t=Math.max(0,age/duration);
        tossArc(mesh.position,origin,touch,duration,t);
        mesh.quaternion.slerpQuaternions(initial,unspun,t*t*(3-2*t));
        mesh.quaternion.premultiply(rotation.setFromAxisAngle(axle,material.spin*t));
        return false;
      }
      const index=Math.max(0,(age-duration)/step),lo=Math.min(Math.floor(index),frames.length-1);
      const a=frames[lo],b=frames[Math.min(lo+1,frames.length-1)],mix=Math.min(1,index-lo);
      mesh.position.lerpVectors(a.position,b.position,mix);
      mesh.quaternion.slerpQuaternions(a.quaternion,b.quaternion,mix);
      return age>=duration+(frames.length-1)*step;
    }
  };
}
