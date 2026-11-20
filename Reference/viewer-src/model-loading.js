// The web build and the reader use the same boundaries. Each parallel stream
// can write to its final GLB offset as soon as its first bytes arrive.
export const modelPartBytes=12*1024*1024;

export class ModelDownloadError extends Error {}

function checkModel(bytes){
  if(bytes.length<20)throw Error('Incomplete GLB header');
  const header=new DataView(bytes.buffer);
  if(header.getUint32(0,true)!==0x46546c67 || header.getUint32(4,true)!==2 ||
     header.getUint32(8,true)!==bytes.length)throw Error('Invalid or incomplete GLB');
  return bytes.buffer;
}

function transferMeter(total,onProgress){
  let loaded=0,lastLoaded=0,rate=0;
  const start=performance.now();
  let sampledAt=start,lastDataAt=start;
  function report(){
    const now=performance.now(),elapsed=(now-sampledAt)/1000;
    if(elapsed>=.4){
      // Weight by elapsed time so the estimate behaves the same at all packet sizes.
      const current=(loaded-lastLoaded)/elapsed;
      const weight=1-Math.exp(-elapsed/2.4);
      rate=rate ? rate+(current-rate)*weight : current;
      lastLoaded=loaded;sampledAt=now;
    }
    const stalled=loaded<total && now-lastDataAt>3500;
    const remainingSeconds=!stalled && rate>0 && now-start>=1400 && loaded<total
      ? Math.max(1,Math.ceil((total-loaded)/rate)) : null;
    onProgress({source:'download',loaded,total,remainingSeconds,stalled});
  }
  report();
  const timer=setInterval(report,300);
  return {
    add(count){loaded+=count;if(count>0)lastDataAt=performance.now();},
    finish(){report();},
    stop(){clearInterval(timer);}
  };
}

async function downloadModel(model,onProgress){
  const names=model.dataset.parts.trim().split(/\s+/);
  const total=Number(model.dataset.bytes);
  if(!Number.isSafeInteger(total) || total<20 || names.length!==Math.ceil(total/modelPartBytes)){
    throw Error('Invalid model download manifest');
  }
  const bytes=new Uint8Array(total),abort=new AbortController();
  const meter=transferMeter(total,onProgress);
  try{
    await Promise.all(names.map(async(name,i)=>{
      const first=i*modelPartBytes,end=Math.min(total,first+modelPartBytes);
      let position=first;
      const response=await fetch(name,{signal:abort.signal});
      if(!response.ok)throw Error('HTTP '+response.status+' reading '+name);
      function append(chunk){
        if(position+chunk.byteLength>end)throw Error('Oversized model part '+name);
        bytes.set(chunk,position);
        position+=chunk.byteLength;meter.add(chunk.byteLength);
      }
      if(response.body?.getReader){
        const reader=response.body.getReader();
        try{
          for(;;){
            const {done,value}=await reader.read();
            if(done)break;
            append(value);
          }
        }finally{reader.releaseLock();}
      }else{
        append(new Uint8Array(await response.arrayBuffer()));
      }
      if(position!==end)throw Error('Incomplete model part '+name);
    }));
    const buffer=checkModel(bytes);
    meter.finish();
    return buffer;
  }catch(error){
    abort.abort();
    throw error;
  }finally{meter.stop();}
}

async function readEmbedded(encoded,onProgress){
  const padding=encoded.endsWith('==')?2:encoded.endsWith('=')?1:0;
  if(!encoded.length || encoded.length%4)throw Error('Incomplete base64 data');
  const total=encoded.length/4*3-padding,bytes=new Uint8Array(total);
  let loaded=0,yieldedAt=performance.now();
  const progress=()=>onProgress({source:'embedded',loaded,total,remainingSeconds:null,stalled:false});
  progress();
  // Four-character boundaries preserve every base64 quartet. Browsers with
  // setFromBase64 decode directly into the final buffer.
  const group=1024*1024;
  for(let start=0;start<encoded.length;start+=group){
    const slice=encoded.slice(start,start+group);
    if(bytes.setFromBase64){
      const {read,written}=bytes.subarray(loaded).setFromBase64(slice);
      if(read!==slice.length)throw Error('Invalid embedded model length');
      loaded+=written;
    }else{
      const binary=atob(slice);
      for(let i=0;i<binary.length;i++)bytes[loaded++]=binary.charCodeAt(i);
    }
    if(loaded<total && performance.now()-yieldedAt>=12){
      progress();
      await new Promise(resolve=>setTimeout(resolve,0));
      yieldedAt=performance.now();
    }
  }
  if(loaded!==total)throw Error('Incomplete embedded model');
  const buffer=checkModel(bytes);
  progress();
  return buffer;
}

export async function readModel(model,onProgress=()=>{}){
  model.remove();
  if(model.dataset.parts){
    try{return await downloadModel(model,onProgress);}
    catch(cause){throw new ModelDownloadError('The cabin model could not download. Check your connection and try again.',{cause});}
  }
  const encoded=model.textContent.trim();
  model.textContent='';
  try{return await readEmbedded(encoded,onProgress);}
  catch(cause){throw new ModelDownloadError('This saved cabin file could not be read. Download a fresh copy and try again.',{cause});}
}
