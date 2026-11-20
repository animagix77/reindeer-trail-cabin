const layers = {
  aerial: {
    extent: [516308, 4612407, 516373, 4612472], bar: 10,
    title: 'Property aerial', detail: '2025 · 6 inches per pixel',
    credit: 'New York Statewide Digital Orthoimagery Program, NYS ITS Geospatial Services.',
    alt: 'North-up aerial photograph of the cabin, its surrounding trees and East Reindeer Trail.'
  },
  satellite: {
    extent: [515880, 4611990, 516780, 4612890], bar: 200,
    title: 'Neighborhood satellite', detail: 'June 3, 2025 · 10 metres per pixel',
    credit: 'Contains modified Copernicus Sentinel data (2025). Sentinel-2C, Level-2A true color.',
    alt: 'North-up Sentinel-2 satellite image covering 900 metres of the wooded Smallwood neighborhood.'
  }
};

const vectors = {
  parcel: {color:'#ffcf65', width:2.3, dash:[], closed:true},
  footprint: {color:'#fff9e9', width:1.8, dash:[5,3], closed:true},
  road: {color:'#8de3f2', width:2.1, dash:[10,5], closed:false}
};

export function installPropertyMap({stopMovement, destinations, visit, resume}) {
  const get = id => document.getElementById(id);
  const dialog = get('property-map'), trigger = get('map-toggle');
  const photo = get('map-photo'), frame = get('map-frame'), canvas = get('map-vectors');
  const controls = [...dialog.querySelectorAll('[data-map-layer]')];
  const pins = [...dialog.querySelectorAll('[data-map-place]')];
  const cabin = get('map-cabin');
  let assets, mode = 'aerial', nextView = null;

  function project(point) {
    const [west,south,east,north] = layers[mode].extent;
    return [(point[0]-west)/(east-west), (north-point[1])/(north-south)];
  }

  function pinPosition(button, point) {
    const [x,y] = project(point);
    button.style.left = 100*x+'%';
    button.style.top = 100*y+'%';
    button.hidden = x<0 || x>1 || y<0 || y>1;
  }

  function draw() {
    if (!dialog.open || !assets) return;
    const {width,height} = frame.getBoundingClientRect();
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1,3);
    canvas.width = Math.round(width*ratio);
    canvas.height = Math.round(height*ratio);
    const ctx = canvas.getContext('2d');
    ctx.scale(canvas.width/width,canvas.height/height);
    ctx.lineJoin='round'; ctx.lineCap='round';
    for (const control of controls) {
      if (!control.checked) continue;
      const name = control.dataset.mapLayer, style = vectors[name];
      const path = new Path2D();
      assets.lines[name].forEach((p,i) => {
        const [x,y] = project(p);
        if (i===0) path.moveTo(x*width,y*height);
        else path.lineTo(x*width,y*height);
      });
      if (style.closed) path.closePath();
      if (name==='parcel') {
        ctx.fillStyle='rgba(252,204,99,.065)';
        ctx.fill(path);
      }
      ctx.setLineDash(style.dash);
      ctx.lineWidth = style.width+2;
      ctx.strokeStyle = 'rgba(11,25,23,.75)';
      ctx.stroke(path);
      ctx.lineWidth = style.width;
      ctx.strokeStyle = style.color;
      ctx.stroke(path);
    }
    const positions = destinations();
    for (const pin of pins) {
      const coords = positions[pin.dataset.mapPlace];
      if (mode==='aerial' && coords) pinPosition(pin,coords);
      else pin.hidden=true;
    }
    if (mode==='satellite') {
      const footprint=assets.lines.footprint;
      const centroid=footprint.slice(0,-1).reduce((sum,p)=>[sum[0]+p[0],sum[1]+p[1]],[0,0]);
      pinPosition(cabin,centroid.map(c=>c/(footprint.length-1)));
    } else cabin.hidden=true;
  }

  function selectMode(next) {
    mode = next;
    const info=layers[mode], [west,,east]=info.extent;
    photo.src=assets.images[mode];
    photo.alt=info.alt;
    frame.dataset.mode=mode;
    get('map-source-title').textContent=info.title;
    get('map-source-detail').textContent=info.detail;
    get('map-credit').textContent=info.credit;
    const scale=get('map-scale');
    scale.style.width=100*info.bar/(east-west)+'%';
    scale.firstElementChild.textContent=info.bar+' m';
    get('map-'+mode).checked=true;
    draw();
  }

  for (const radio of dialog.querySelectorAll('[name=map-imagery]')) {
    radio.addEventListener('change',()=>{if (radio.checked) selectMode(radio.value);});
  }
  for (const input of controls) input.addEventListener('change',draw);
  for (const pin of pins) pin.addEventListener('click',()=>{
    nextView=pin.dataset.mapPlace;
    dialog.close();
  });
  cabin.addEventListener('click',()=>{selectMode('aerial');get('map-aerial').focus();});
  get('map-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{
    if (event.target===dialog) {
      const box=dialog.getBoundingClientRect();
      if (event.clientX<box.left || event.clientX>box.right || event.clientY<box.top || event.clientY>box.bottom) dialog.close();
    }
  });
  // Keep arrow keys, Escape and shortcuts inside the native modal.
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  dialog.addEventListener('close',()=>{
    trigger.setAttribute('aria-expanded','false');
    const destination=nextView;
    nextView=null;
    if (destination) visit(destination);
    else trigger.focus({preventScroll:true});
    resume();
  });
  new ResizeObserver(draw).observe(frame);
  trigger.addEventListener('click',()=>{
    if (dialog.open) return;
    assets ??= JSON.parse(get('map-assets').textContent);
    stopMovement();
    if (document.pointerLockElement) document.exitPointerLock();
    dialog.showModal();
    trigger.setAttribute('aria-expanded','true');
    selectMode(mode);
    get('map-'+mode).focus({preventScroll:true});
  });
  return {get open(){return dialog.open;}};
}
