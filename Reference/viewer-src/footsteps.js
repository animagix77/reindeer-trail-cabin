// Cadence follows distance actually walked, including when sliding along a wall.
export function walkingGait() {
  let phase=.35, strength=0, left=false;
  return {
    reset(){phase=.35;strength=0;left=false;},
    update(distance,dt,shortStride,onStep,reducedMotion){
      const progress=phase+distance/(shortStride?.54:.74);
      if(progress>=1){left=!left;onStep(left);}
      phase=progress%1;
      const pace=dt>0?Math.min(1,distance/(dt*1.45)):0;
      strength+=(pace-strength)*(1-Math.exp(-12*dt));
      return reducedMotion?0:-.017*strength*Math.cos(phase*2*Math.PI);
    }
  };
}

// A softened heel impact followed by a short roll of the sole.
// Timbers ring briefly, loose stones rattle and leaves brush together.
const surfaces={
  wood:{pitch:113,ring:.26,grain:.16,tail:.115},
  pavement:{pitch:89,ring:.11,grain:.17,tail:.068},
  tile:{pitch:157,ring:.19,grain:.12,tail:.075},
  grass:{pitch:66,ring:.022,grain:.13,tail:.12},
  snow:{pitch:64,ring:.024,grain:.26,tail:.23},
  gravel:{pitch:83,ring:.065,grain:.31,tail:.15},
  leaves:{pitch:74,ring:.07,grain:.22,tail:.19}
};
export function soleSound(audio,surface,variant){
  const profile=surfaces[surface]??surfaces.leaves,rate=22050;
  const length=Math.ceil(rate*(profile.tail+.135)),buffer=audio.createBuffer(1,length,rate);
  const wave=buffer.getChannelData(0);
  let seed=11723+variant*42997+surface.length*717,previous=0,low=0,crunch=0;
  const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const pitch=profile.pitch*(.92+.16*noise());
  for(let i=0;i<length;i++){
    const t=i/rate,white=noise()*2-1,edge=white-previous;previous=white;
    low+=.15*(white-low);
    const heel=Math.min(t/.006,1)*Math.exp(-t/.043),toe=Math.max(0,t-.068);
    const roll=Math.min(toe/.017,1)*Math.exp(-toe/(profile.tail*.32));
    if(surface==='gravel'&&noise()<.0018)crunch=noise();else crunch*=.973;
    let grain=white*.55+low*.65;
    if(surface==='grass')grain=.88*low+.12*edge;
    if(surface==='leaves')grain=edge*.41+low*.85;
    if(surface==='snow'){
      // Powder compresses under the heel, then crystals squeak as the toe rolls.
      if(noise()<.009)crunch=.28+.72*noise();else crunch*=.97;
      grain=low*1.25+crunch*(.28*edge+.15*Math.sin(2*Math.PI*(710*t+590*t*t)));
    }
    const tone=Math.sin(2*Math.PI*(pitch*t+2*(1-Math.exp(-t*24))));
    wave[i]=(.36*low+profile.ring*tone)*heel+profile.grain*(grain+(crunch*edge))*(.62*heel+roll);
  }
  return buffer;
}

export function groundFinish(name){
  if(/fescue|grass turf/i.test(name))return 'grass';
  if(/leaf litter/i.test(name))return 'leaves';
  if(/porcelain|charcoal.gray tile|hex tile/i.test(name))return 'tile';
  if(/asphalt(?! shingle)|pavement|concrete|flagstone/i.test(name))return 'pavement';
  if(/gravel|crushed stone|photographed aggregate/i.test(name))return 'gravel';
  if(/timber ties|clear-finished knotty pine/i.test(name))return 'wood';
  return null;
}
