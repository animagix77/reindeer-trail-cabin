import fs from 'node:fs/promises';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
const args=process.argv.slice(2);
const web=args.at(-1)==='--web';
if(web) args.pop();
const [glbPath,outPath,referencePath]=args;
if(!glbPath || !outPath || args.length>3) {console.error('Usage: node build.mjs MODEL.glb OUTPUT.html [REFERENCE_DIRECTORY] [--web]');process.exit(1);}
const base=path.dirname(fileURLToPath(import.meta.url));
const glb=await fs.readFile(glbPath);
if(glb.length<20 || glb.readUInt32LE(0)!==0x46546c67 || glb.readUInt32LE(4)!==2 || glb.readUInt32LE(8)!==glb.length) throw Error('Expected a complete GLB v2 file');
const manifest=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
if([...(manifest.images||[]),...(manifest.buffers||[])].some(item=>item.uri && !item.uri.startsWith('data:'))) throw Error('The GLB has external dependencies. Please export a self-contained GLB.');
const js=(await build({entryPoints:[path.join(base,'viewer.js')],bundle:true,format:'iife',minify:true,legalComments:'inline',write:false,target:'es2022'})).outputFiles[0].text;
const licenseFiles=['three/LICENSE','peerjs/LICENSE','peerjs-js-binarypack/LICENSE','eventemitter3/LICENSE','sdp/LICENSE','webrtc-adapter/LICENSE.md','@msgpack/msgpack/LICENSE'];
const licenses=await Promise.all(licenseFiles.map(async file=>file.split('/LICENSE')[0]+'\n'+await fs.readFile(path.join(base,'node_modules',file),'utf8')));
const license=licenses.join('\n\n').replaceAll('*/','* /');
let orthophoto='';
const refs=referencePath||path.join(base,'..');
try {orthophoto=(await fs.readFile(path.join(refs,'State aerial.jpg'))).toString('base64');}
catch(error){if(referencePath || error.code!=='ENOENT')throw error;}
const [aerialPhoto,satellitePhoto,mapVectors]=await Promise.all([
  fs.readFile(path.join(refs,'Property aerial.jpg')),
  fs.readFile(path.join(refs,'Neighborhood satellite.jpg')),
  fs.readFile(path.join(refs,'Map layers.json'),'utf8')
]);
const lines=JSON.parse(mapVectors);
for(const [layer,minPoints] of Object.entries({parcel:4,footprint:4,road:2})){
  const points=lines[layer];
  if(!Array.isArray(points) || points.length<minPoints ||
     !points.every(p=>Array.isArray(p) && p.length===2 && p.every(Number.isFinite))){
    throw Error('Invalid map coordinates for '+layer);
  }
}
const mapJSON=JSON.stringify({images:{
  aerial:'data:image/jpeg;base64,'+aerialPhoto.toString('base64'),
  satellite:'data:image/jpeg;base64,'+satellitePhoto.toString('base64')
},lines}).replaceAll('<','\\u003c');
const welcomePhoto=(await fs.readFile(path.join(base,'welcome-yard.webp'))).toString('base64');
let template=await fs.readFile(path.join(base,'template.html'),'utf8');
if(web){
  const chunkSize=12*1024*1024;
  const parts=[];
  for(let start=0;start<glb.length;start+=chunkSize){
    const chunk=glb.subarray(start,start+chunkSize);
    const digest=createHash('sha256').update(chunk).digest('hex');
    const name='scene-'+digest+'.bin';
    await fs.writeFile(path.join(path.dirname(outPath),name),chunk);
    parts.push(name);
  }
  template=template.replace('id="model">%%GLB%%','id="model" data-parts="'+parts.join(' ')+'" data-bytes="'+glb.length+'">');
}
const html=template.replace('%%WELCOME_PHOTO%%',()=>welcomePhoto).replace('%%MAP%%',()=>mapJSON).replace('%%ORTHO%%',()=>orthophoto).replace('%%GLB%%',()=>glb.toString('base64')).replace('%%JS%%',()=>('/* '+license+' */\n'+js).replace(/<\/script/gi,'<\\/script'));
await fs.writeFile(outPath,html);
console.log(path.resolve(outPath));
