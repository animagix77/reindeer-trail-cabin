// A small E-minor arrangement for handbells and bowed bass. The three-beat
// Shchedryk figure leaves space for the longer God Rest You Merry phrase.
const rate=22050,beat=60/96,tau=2*Math.PI;
export async function cabinCarol(ctx){
  const buffer=ctx.createBuffer(1,Math.round(64*beat*rate),rate);
  const mix=buffer.getChannelData(0),notes=new Map();
  function note(instrument,midi,beats){
    const key=instrument+':'+midi+':'+beats;
    if(notes.has(key))return notes.get(key);
    const bell=instrument==='bell',held=beats*beat,length=bell?1.65:held+.30;
    const samples=new Float32Array(Math.ceil(length*rate)),hz=440*2**((midi-69)/12);
    for(let i=0;i<samples.length;i++){
      const t=i/rate,phase=tau*hz*t,tail=Math.min(1,(length-t)/.10);
      if(bell){
        const body=Math.sin(phase)+.28*Math.sin(2.003*phase)+.16*Math.sin(2.76*phase)*Math.exp(-3*t);
        samples[i]=body*Math.min(1,t/.009)*Math.exp(-3.7*t)*tail;
      }else{
        const bow=phase+.042*Math.sin(tau*4.4*t);
        const body=Math.sin(bow)+.34*Math.sin(2*bow)+.22*Math.sin(3*bow)+.13*Math.sin(4*bow);
        const envelope=(1-Math.exp(-11*t))*Math.exp(-6*Math.max(0,t-held));
        samples[i]=body*envelope*(.9+.1*Math.cos(tau*t/length))*tail;
      }
    }
    notes.set(key,samples);
    return samples;
  }
  function play(at,instrument,midi,beats,level){
    const offset=Math.round(at*beat*rate),samples=note(instrument,midi,beats);
    // Carry natural releases through the loop seam.
    for(let i=0;i<samples.length;i++)mix[(offset+i)%mix.length]+=samples[i]*level;
  }
  // Mix in short sections so entering the cabin does not interrupt a touch
  // gesture on slower phones. The resulting loop runs on the audio thread.
  let sliceStart=performance.now();
  async function yieldToWalk(){
    if(performance.now()-sliceStart<4)return;
    await new Promise(resolve=>setTimeout(resolve,0));
    sliceStart=performance.now();
  }
  const bass=[40,36,43,47,40,45,43,47];
  for(let bar=0;bar<8;bar++){
    const start=bar*3;
    play(start,'string',bass[bar],2.55,.13);
    for(const [offset,pitch,level] of [[0,79,.26],[1,78,.15],[1.5,79,.19],[2,76,.22]]){
      play(start+offset,'bell',pitch,1,level*(bar%2?.82:1));
    }
    if(bar>2)play(start+1.5,'string',bass[bar]+7,1.0,.059);
    await yieldToWalk();
  }
  // A pickup into a slower-sounding four-beat answering phrase.
  const verse=[64,64,71,71,69,67,66,64,62,64,66,67,69,71];
  for(let phrase=0;phrase<2;phrase++){
    const start=24+phrase*16;
    for(const [i,pitch] of verse.entries()){
      play(start+i,'bell',pitch,1,i%4===1?.29:.23);
      await yieldToWalk();
    }
    for(const [bar,pitch] of [40,43,38,47].entries()){
      play(start+bar*4,'string',pitch,3.68,.14);
      await yieldToWalk();
    }
  }
  for(const [at,pitch] of [[56,79],[57,78],[57.5,79],[58,76],[60,71],[61,76]])play(at,'bell',pitch,1,.25);
  play(56,'string',47,3.5,.14);
  play(60,'string',40,3.25,.17);
  return buffer;
}
