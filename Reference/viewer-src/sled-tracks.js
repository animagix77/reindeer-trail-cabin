import * as T from 'three';

// Five centimetres per texel. A fixed patch around the ride keeps the full
// visit's tracks and uploads only the rows touched since the previous frame.
const cell=.045, width=512, rows=1792;
const left=-width*cell/2, top=-1;
const halfLength=.36, halfWidth=.25;

export function createSledTracks(){
  const pixels=new Uint8Array(width*rows*4);
  const texture=new T.DataTexture(pixels,width,rows,T.RGBAFormat);
  texture.name='Lake Superior · runner impressions';
  texture.magFilter=texture.minFilter=T.LinearFilter;
  texture.needsUpdate=true;
  const uv=new T.Vector4(left,top,1/(width*cell),1/(rows*cell));
  const rowStart=new Int16Array(rows).fill(width),rowEnd=new Int16Array(rows).fill(-1);
  let firstRow=rows,lastRow=-1,previous=null;

  function stamp(x,d,heading){
    const right=Math.cos(heading),forward=Math.sin(heading);
    const extentX=Math.abs(right)*halfWidth+Math.abs(forward)*halfLength;
    const extentD=Math.abs(forward)*halfWidth+Math.abs(right)*halfLength;
    const minCol=Math.max(0,Math.floor((x-extentX-left)/cell));
    const maxCol=Math.min(width-1,Math.floor((x+extentX-left)/cell));
    const minRow=Math.max(0,Math.floor((d-extentD-top)/cell));
    const maxRow=Math.min(rows-1,Math.floor((d+extentD-top)/cell));

    for(let row=minRow;row<=maxRow;row++){
      const dz=top+(row+.5)*cell-d;
      for(let col=minCol;col<=maxCol;col++){
        const dx=left+(col+.5)*cell-x;
        const across=Math.abs(dx*right-dz*forward),along=Math.abs(dz*right+dx*forward);
        if(across>=halfWidth || along>=halfLength)continue;
        const ends=1-T.MathUtils.smoothstep(along,.24,halfLength);
        // The two outer runners sit 28 cm apart. Powder is pushed up along
        // the outside lips, while the shallower ribs compress the snow between.
        const rut=1-T.MathUtils.smoothstep(Math.abs(across-.14),.012,.059);
        const rim=1-T.MathUtils.smoothstep(Math.abs(across-.202),.008,.043);
        const base=1-T.MathUtils.smoothstep(across,.14,.192);
        const r=Math.round(255*rut*ends),g=Math.round(255*rim*ends),b=Math.round(255*base*ends);
        const idx=4*(row*width+col);
        if(r<=pixels[idx] && g<=pixels[idx+1] && b<=pixels[idx+2])continue;
        pixels[idx]=Math.max(r,pixels[idx]);
        pixels[idx+1]=Math.max(g,pixels[idx+1]);
        pixels[idx+2]=Math.max(b,pixels[idx+2]);
        rowStart[row]=Math.min(rowStart[row],col);rowEnd[row]=Math.max(rowEnd[row],col);
        firstRow=Math.min(firstRow,row);lastRow=Math.max(lastRow,row);
      }
    }
  }
  return {
    texture,uv,
    beginRun(x,d,heading=0){previous={x,d,heading};},
    record(x,d,heading){
      if(!previous){previous={x,d,heading};return;}
      const dx=x-previous.x,dd=d-previous.d;
      const turn=Math.atan2(Math.sin(heading-previous.heading),Math.cos(heading-previous.heading));
      const travel=Math.hypot(dx,dd)+halfLength*Math.abs(turn);
      if(travel<cell*.65)return;
      // Following the swept footprint lets a sideways skid leave a wider
      // swath. Interpolation keeps the grooves continuous at low frame rates.
      const count=Math.max(1,Math.ceil(travel/.08));
      for(let k=1;k<=count;k++){
        const t=k/count;
        stamp(previous.x+t*dx,previous.d+t*dd,previous.heading+t*turn);
      }
      previous.x=x;previous.d=d;previous.heading=heading;
    },
    flush(){
      if(firstRow>lastRow)return;
      for(let row=firstRow;row<=lastRow;row++){
        if(rowEnd[row]<rowStart[row])continue;
        texture.addUpdateRange(4*(row*width+rowStart[row]),4*(rowEnd[row]-rowStart[row]+1));
        rowStart[row]=width;rowEnd[row]=-1;
      }
      texture.needsUpdate=true;firstRow=rows;lastRow=-1;
    }
  };
}
