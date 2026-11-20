import * as THREE from 'three';

// A tileable 3-D density field supplies the fine curls in the cooking plume.
// The lower-resolution field is immediately usable offline and without WebGPU.
function densityVolume(values, size) {
  const t = new THREE.Data3DTexture(values, size, size, size);
  t.format = THREE.RedFormat;
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}

function smallField() {
  const size = 24, bytes = new Uint8Array(size ** 3);
  let seed = 4503;
  for (let i = 0; i < bytes.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    bytes[i] = seed >>> 24;
  }
  return densityVolume(bytes, size);
}

const densityKernel = `
@group(0) @binding(0) var<storage, read_write> density: array<u32>;
fn hash(p: vec3u) -> f32 {
  var h = p.x * 1597334677u ^ p.y * 3812015801u ^ p.z * 2798796415u;
  h = (h ^ (h >> 16u)) * 2246822519u;
  return f32(h ^ (h >> 13u)) / 4294967295.0;
}
fn field(p: vec3f, repeat: u32) -> f32 {
  let cell = vec3u(floor(p));
  let f = smoothstep(vec3f(0), vec3f(1), fract(p));
  var sum = 0.;
  for (var i = 0u; i < 8u; i++) {
    let o = vec3u(i & 1u, (i >> 1u) & 1u, i >> 2u);
    let w = mix(vec3f(1)-f, f, vec3f(o));
    sum += hash((cell + o) % vec3u(repeat)) * w.x*w.y*w.z;
  }
  return sum;
}
@compute @workgroup_size(4,4,4)
fn bake(@builtin(global_invocation_id) id: vec3u) {
  let p = vec3f(id) / 64.;
  let densitySample = 0.57*field(p*8.,8u)+0.28*field(p*16.,16u)+0.15*field(p*32.,32u);
  density[id.x+64u*(id.y+64u*id.z)] = u32(round(255.*densitySample));
}`;

async function fineField() {
  if (!navigator.gpu) return null;
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return null;
  const device = await adapter.requestDevice();
  const size = 64, bytes = size ** 3 * 4;
  const field = device.createBuffer({size:bytes, usage:GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC});
  const read = device.createBuffer({size:bytes, usage:GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ});
  try {
    const pipeline = await device.createComputePipelineAsync({layout:'auto',
      compute:{module:device.createShaderModule({code:densityKernel}),entryPoint:'bake'}});
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, device.createBindGroup({layout:pipeline.getBindGroupLayout(0),
      entries:[{binding:0,resource:{buffer:field}}]}));
    pass.dispatchWorkgroups(size/4, size/4, size/4);
    pass.end();
    encoder.copyBufferToBuffer(field, 0, read, 0, bytes);
    device.queue.submit([encoder.finish()]);
    await read.mapAsync(GPUMapMode.READ);
    const result = Uint8Array.from(new Uint32Array(read.getMappedRange()));
    read.unmap();
    return densityVolume(result, size);
  } finally {
    field.destroy();
    read.destroy();
    device.destroy();
  }
}

export function cookingSmoke() {
  const uniforms = {flow:{value:smallField()}, clock:{value:0}, strength:{value:0}, localEye:{value:new THREE.Vector3()}};
  const material = new THREE.ShaderMaterial({
    uniforms, transparent:true, depthWrite:false, side:THREE.FrontSide,
    vertexShader:`varying vec3 entry;
      void main(){entry=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`precision highp sampler3D;
      uniform sampler3D flow; uniform vec3 localEye; uniform float clock, strength; varying vec3 entry;
      void main(){
        vec3 ray=normalize(entry-localEye), p=entry+ray*.003;
        float transmission=1.;
        for(int i=0;i<28;i++){
          if(any(greaterThan(abs(p),vec3(.501))))break;
          float h=p.y+.5;
          vec2 center=vec2(.14*h*h+.044*h*sin(8.*h-clock), .045*h*cos(10.*h-1.2*clock));
          float radius=.09+.20*h;
          vec3 wind=vec3(.017*clock,-.12*clock,.014*clock);
          float n=texture(flow, .73*p+wind).r;
          float detail=texture(flow,1.75*p+wind*1.32+vec3(n*.21)).r;
          float plume=exp(-dot(p.xz-center,p.xz-center)/(radius*radius));
          float d=plume*smoothstep(0.,.07,h)*(1.-smoothstep(.36,.99,h))*
            smoothstep(.28,.73,.63*n+.37*detail)*strength;
          transmission*=exp(-d*.074);
          p+=ray*.048;
        }
        float opacity=1.-transmission;
        if(opacity<.004)discard;
        gl_FragColor=vec4(.68,.66,.61,opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const volume = new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);
  volume.scale.set(.60,.66,.50);
  volume.position.y=.36;
  volume.visible=false;
  let started=false;
  return {volume,update(camera,seconds,amount){
    volume.visible=amount>.005;
    if(!volume.visible)return;
    if(!started){
      started=true;
      fineField().then(t=>{if(t){uniforms.flow.value.dispose();uniforms.flow.value=t;}}).catch(()=>{});
    }
    uniforms.clock.value=seconds%600;
    uniforms.strength.value=amount;
    volume.worldToLocal(uniforms.localEye.value.copy(camera.position));
  }};
}
