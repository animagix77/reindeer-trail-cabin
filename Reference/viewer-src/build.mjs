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
const license=(await fs.readFile(path.join(base,'node_modules/three/LICENSE'),'utf8')).replaceAll('*/','* /');
let orthophoto='';
const refs=referencePath||path.join(base,'..');
try {orthophoto=(await fs.readFile(path.join(refs,'State aerial.jpg'))).toString('base64');}
catch(error){if(referencePath || error.code!=='ENOENT')throw error;}
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
const html=template.replace('%%ORTHO%%',()=>orthophoto).replace('%%GLB%%',()=>glb.toString('base64')).replace('%%JS%%',()=>('/* '+license+' */\n'+js).replace(/<\/script/gi,'<\\/script'));
await fs.writeFile(outPath,html);
console.log(path.resolve(outPath));
