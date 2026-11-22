// Metres, seconds, and a horizontal coordinate system with +d pointing downhill.
const gravity=9.81,step=1/120;
const clamp=(value,lo,hi)=>Math.min(hi,Math.max(lo,value));
function ease(from,to,value){
  const t=clamp((value-from)/(to-from),0,1);
  return t*t*(3-2*t);
}
export class SledMotion{
  constructor(surface){
    this.surface=surface;
    this.reset();
  }
  reset(){
    this.x=0;this.d=0;
    this.vx=0;this.vd=0;
    this.heading=0;this.bank=0;
    this.finished=false;
    this.remainder=0;
  }
  pushOff(){
    this.reset();
    this.vd=2.2;
  }
  advance(seconds,input){
    if(this.finished)return;
    this.remainder+=clamp(seconds,0,.25);
    while(this.remainder+1e-12>=step && !this.finished){
      this.remainder-=step;
      this.integrate(clamp(input,-1,1));
    }
  }
  integrate(input){
    const {x,d,vx,vd,surface}=this;
    const speed=Math.hypot(vx,vd);
    // The length of a plastic sled smooths small changes between DEM triangles.
    const slopeX=(surface(x+.5,d)-surface(x-.5,d));
    const slopeD=(surface(x,d+.5)-surface(x,d-.5));
    const projectedGravity=gravity/(1+slopeX*slopeX+slopeD*slopeD);
    // Ease the nose back towards the clearing before the trees and beach shelter.
    const shoulder=ease(4.6,7.4,Math.abs(x));
    const edge=Math.sign(x)*shoulder;
    const target=input*.42*(1-(input*x>0?shoulder:0))-.30*edge;
    this.heading+=(target-this.heading)*(1-Math.exp(-step*4.3));
    const cos=Math.cos(this.heading),sin=Math.sin(this.heading);
    const slip=vx*cos-vd*sin;
    // Runners grip across the hull, but packed snow can only supply so much
    // side force. The nose leads the velocity through a turn and on reversal.
    const sideForce=clamp(-slip*2.4,-2.6,2.6);
    const runout=ease(41,61,d);
    const resistance=.40+.0058*speed*speed+1.65*runout+.12*Math.abs(slip)+shoulder*.34;
    const drag=speed>0?Math.min(resistance/speed,1/step):0;
    const ax=-projectedGravity*slopeX+sideForce*cos-drag*vx;
    const ad=-projectedGravity*slopeD-sideForce*sin-drag*vd;
    this.vx+=ax*step;
    this.vd=Math.max(0,vd+ad*step);
    this.x+=step*this.vx;this.d+=step*this.vd;
    this.bank+=((-.022*sideForce)-this.bank)*(1-Math.exp(-step*3));
    if(Math.hypot(this.vx,this.vd)<.13){
      this.vx=0;this.vd=0;this.bank=0;this.finished=true;
    }
  }
}
