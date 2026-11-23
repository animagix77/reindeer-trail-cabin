import fs from 'node:fs/promises';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {modelPartBytes} from './model-loading.js';
import {tourAreas} from './tour-areas.js';
import path from 'node:path';
const args=process.argv.slice(2);
const website=args.at(-1)==='--website';
const web=website || args.at(-1)==='--web';
if(web) args.pop();
const [glbPath,requestedOut,referencePath]=args;
const outPath=website && requestedOut?path.join(path.dirname(requestedOut),'tour','index.html'):requestedOut;
if(!glbPath || !outPath || args.length>3) {console.error('Usage: node build.mjs MODEL.glb OUTPUT.html [REFERENCE_DIRECTORY] [--web | --website]');process.exit(1);}
const base=path.dirname(fileURLToPath(import.meta.url));
const glb=await fs.readFile(glbPath);
if(glb.length<20 || glb.readUInt32LE(0)!==0x46546c67 || glb.readUInt32LE(4)!==2 || glb.readUInt32LE(8)!==glb.length) throw Error('Expected a complete GLB v2 file');
const manifest=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
if([...(manifest.images||[]),...(manifest.buffers||[])].some(item=>item.uri && !item.uri.startsWith('data:'))) throw Error('The GLB has external dependencies. Please export a self-contained GLB.');
const js=(await build({entryPoints:[path.join(base,'viewer.js')],bundle:true,format:'iife',minify:true,legalComments:'inline',write:false,target:'es2022'})).outputFiles[0].text;
const licenseFiles=['three/LICENSE','cannon-es/LICENSE','peerjs/LICENSE','peerjs-js-binarypack/LICENSE','eventemitter3/LICENSE','sdp/LICENSE','webrtc-adapter/LICENSE.md','@msgpack/msgpack/LICENSE'];
const licenses=await Promise.all(licenseFiles.map(async file=>file.split('/LICENSE')[0]+'\n'+await fs.readFile(path.join(base,'node_modules',file),'utf8')));
const siteDir=path.resolve(base,'../../Website');
for(const family of ['Instrument-Sans','Instrument-Serif']){
  licenses.push(await fs.readFile(path.join(siteDir,'fonts',family+'-OFL.txt'),'utf8'));
}
const license=licenses.join('\n\n').replaceAll('*/','* /');
const refs=referencePath||path.join(base,'..');
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
let brandStyles='<link rel="stylesheet" href="../brand.css">';
if(!website){
  // Keep the single-file tour usable offline.
  let css=await fs.readFile(path.join(siteDir,'brand.css'),'utf8');
  for(const match of [...css.matchAll(/url\("\.\/(fonts\/[^"]+\.woff2)"\)/g)]){
    const font=await fs.readFile(path.join(siteDir,match[1]));
    css=css.replace(match[0],'url(data:font/woff2;base64,'+font.toString('base64')+')');
  }
  brandStyles='<style>'+css+'</style>';
}
const mobileStyles=await Promise.all(['mobile-walk.css','mobile-welcome.css','mobile-panels.css'].map(file=>fs.readFile(path.join(base,file),'utf8')));
let template=(await fs.readFile(path.join(base,'template.html'),'utf8'))
  .replace('%%BRAND_STYLES%%',()=>brandStyles)
  .replace('%%MOBILE_STYLES%%',()=>mobileStyles.join('\n'));
const homeAnchor=(label)=>'<a class="cabin-site-link" href="../">'+label+'</a>';
template=template.replaceAll('%%CABIN_URL%%',website?'../':'https://reindeertrail.com/')
  .replaceAll('%%CABIN_NAME%%',website?homeAnchor('The Reindeer Trail'):'The Reindeer Trail')
  .replace('%%CABIN_HOME%%',website?homeAnchor('Return to the cabin website'):'');
const modelDir=website?path.dirname(requestedOut):path.dirname(outPath);
if(website){
  await fs.access(path.join(siteDir,'index.html'));
  await fs.cp(siteDir,modelDir,{recursive:true,filter:file=>!path.basename(file).startsWith('.')});
  await fs.copyFile(path.resolve(base,'../../CNAME'),path.join(modelDir,'CNAME'));
  // The overview viewer loads only when a visitor opens the cabin cutaway.
  await build({entryPoints:[path.join(base,'cabin-cutaway.js')],bundle:true,format:'esm',minify:true,
    legalComments:'inline',target:'es2022',outfile:path.join(modelDir,'media/cabin-cutaway-viewer.js'),
    banner:{js:'/* '+licenses[0]+' */'}});
  const aliases=Object.entries(tourAreas).flatMap(([key,area])=>[key,area.slug,...area.aliases]);
  const router=`(() => {
    const [scene, query] = location.hash.slice(1).split('?');
    if (${JSON.stringify(aliases)}.includes(scene) || new URLSearchParams(query).has('room')) {
      location.replace('./tour/' + location.search + location.hash);
    }
  })();`;
  await fs.writeFile(path.join(modelDir,'tour-links.js'),router);
  await fs.mkdir(path.dirname(outPath),{recursive:true});
}
if(web){
  const parts=[];
  for(let start=0;start<glb.length;start+=modelPartBytes){
    const chunk=glb.subarray(start,start+modelPartBytes);
    const digest=createHash('sha256').update(chunk).digest('hex');
    const name='scene-'+digest+'.bin';
    await fs.writeFile(path.join(modelDir,name),chunk);
    parts.push(website?'../'+name:name);
  }
  template=template.replace('id="model">%%GLB%%','id="model" data-parts="'+parts.join(' ')+'" data-bytes="'+glb.length+'">');
}
const html=template.replace('%%WELCOME_PHOTO%%',()=>welcomePhoto).replace('%%MAP%%',()=>mapJSON).replace('%%GLB%%',()=>glb.toString('base64')).replace('%%JS%%',()=>('/* '+license+' */\n'+js).replace(/<\/script/gi,'<\\/script'));
await fs.writeFile(outPath,html);
console.log(path.resolve(outPath));
