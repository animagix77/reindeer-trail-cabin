import {
  ACESFilmicToneMapping, Box2, Box3, Color, DirectionalLight, HemisphereLight, MathUtils,
  Mesh, OrthographicCamera, PCFShadowMap, PlaneGeometry, Scene, ShadowMaterial,
  SRGBColorSpace, Vector2, Vector3, WebGLRenderer
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function releaseMeshes(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(node => {
    if (!node.isMesh) return;
    geometries.add(node.geometry);
    for (const material of [].concat(node.material)) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) {
    texture.dispose();
    texture.source?.data?.close?.();
  }
  for (const geometry of geometries) geometry.dispose();
}

// The deck and entry stairs occupy opposite corners of the footprint. Frame
// the visible silhouette rather than the empty corners of its bounding box.
function frameFloor(main, center, view) {
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), view).normalize();
  const up = new Vector3().crossVectors(view, right);
  const point = new Vector3(), projected = new Vector2(), outline = new Box2();
  main.traverse(node => {
    if (!node.isMesh) return;
    const positions = node.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld).sub(center);
      outline.expandByPoint(projected.set(point.dot(right), point.dot(up)));
    }
  });
  const midpoint = outline.getCenter(new Vector2());
  center.addScaledVector(right, midpoint.x).addScaledVector(up, midpoint.y);
  return outline.getSize(new Vector2());
}

export async function createCutaway({canvas, modelUrl, reducedMotion, onError}) {
  const renderer = new WebGLRenderer({canvas, antialias: true, powerPreference: 'low-power'});
  const scene = new Scene();
  let model;
  try {
    ({scene: model} = await new GLTFLoader().loadAsync(modelUrl));
    scene.add(model);
    if (renderer.getContext().isContextLost()) throw new Error('The 3D graphics context was lost.');
    if (!model.getObjectByName('Main')) throw new Error('The cutaway floor is missing.');
  } catch (error) {
    releaseMeshes(scene);
    renderer.dispose();
    throw error;
  }
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  scene.background = new Color(0xf7f5ed);

  const main = model.getObjectByName('Main');
  const bounds = new Box3().setFromObject(main);
  const center = bounds.getCenter(new Vector3()), size = bounds.getSize(new Vector3());
  const span = Math.hypot(size.x, size.z);
  const direction = new Vector3(11, 22, -16).normalize();
  const silhouette = frameFloor(main, center, direction);
  const loft = model.getObjectByName('Loft'), roof = model.getObjectByName('Roof');
  if (loft) loft.visible = false;
  model.traverse(node => {
    if (node.isMesh) {
      node.castShadow = [].concat(node.material).some(material => !material.transparent || material.opacity > .95);
      node.receiveShadow = true;
    }
  });

  const daylight = new DirectionalLight(0xffedcf, 2.55);
  daylight.position.copy(center).add(new Vector3(.45, 1.65, -.7).multiplyScalar(span));
  daylight.target.position.copy(center);
  daylight.castShadow = true;
  const reach = span * .7;
  Object.assign(daylight.shadow.camera, {left: -reach, right: reach, top: reach, bottom: -reach, near: .2, far: span * 3});
  daylight.shadow.camera.updateProjectionMatrix();
  daylight.shadow.mapSize.set(2048, 2048);
  daylight.shadow.normalBias = .017;
  daylight.shadow.bias = -.00015;
  const sky = new HemisphereLight(0xfff8e8, 0xc2c6b8, 1.8);
  const bounce = new DirectionalLight(0xdfe9f2, .82);
  bounce.position.copy(center).add(new Vector3(-span, span * .7, span));
  bounce.target = daylight.target;
  scene.add(sky, daylight, daylight.target, bounce);

  const ground = new Mesh(new PlaneGeometry(span * 4, span * 4), new ShadowMaterial({color: 0x4a5047, opacity: .14}));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(center.x, bounds.min.y - .025, center.z);
  ground.receiveShadow = true;
  scene.add(ground);
  renderer.shadowMap.needsUpdate = true;

  const camera = new OrthographicCamera(-1, 1, 1, -1, .05, span * 8);
  camera.position.copy(center).addScaledVector(direction, span * 2.6);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(center);
  controls.enablePan = false;
  controls.rotateSpeed = .72;
  controls.zoomSpeed = .92;
  controls.minZoom = .7;
  controls.maxZoom = 3.75;
  controls.minPolarAngle = MathUtils.degToRad(12);
  controls.maxPolarAngle = MathUtils.degToRad(55);
  const preference = reducedMotion?.addEventListener ? reducedMotion : matchMedia('(prefers-reduced-motion: reduce)');
  const reduce = () => reducedMotion === true || preference.matches;
  controls.enableDamping = !reduce();
  controls.dampingFactor = .13;
  controls.update();
  controls.saveState();

  // Only the roof needs translucent materials during its first lift. Keep the
  // shared siding and timber opaque on the main floor and in the loft.
  const roofCoats = new Map();
  const roofBase = roof?.position.y || 0;
  let opened = !roof || reduce(), liftElapsed = 0, liftTime = null;
  if (roof) {
    roof.visible = !opened;
    roof.traverse(node => {
      if (!node.isMesh) return;
      node.castShadow = false;
      if (opened) return;
      const faded = [].concat(node.material).map(source => {
        if (!roofCoats.has(source)) {
          const copy = source.clone();
          copy.transparent = true;
          roofCoats.set(source, copy);
        }
        return roofCoats.get(source);
      });
      node.material = Array.isArray(node.material) ? faded : faded[0];
    });
  }

  const dialog = canvas.closest('dialog');
  let active = !dialog || dialog.open, lost = false, disposed = false, frame = 0;
  controls.enabled = active;
  let width = 0, height = 0, ratio = 0;
  function schedule() {
    if (!frame && active && !lost && !disposed && !document.hidden) frame = requestAnimationFrame(draw);
  }
  function draw(time) {
    frame = 0;
    if (!active || lost || disposed || document.hidden) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w !== width || h !== height || dpr !== ratio) {
      width = w; height = h; ratio = dpr;
      renderer.setDrawingBufferSize(w, h, dpr);
      // The fixed frustum leaves clearance for the corners as the model turns.
      const aspect = w / h;
      const halfHeight = Math.max(silhouette.x * .61 / aspect, silhouette.y * .595);
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.updateProjectionMatrix();
    }
    if (!opened) {
      if (liftTime !== null) liftElapsed += Math.min(time - liftTime, 90);
      liftTime = time;
      const p = reduce() ? 1 : Math.min(liftElapsed / 830, 1);
      const eased = p * p * (3 - 2 * p);
      roof.position.y = roofBase + span * .12 * eased;
      for (const [original, coat] of roofCoats) coat.opacity = original.opacity * (1 - eased);
      opened = p === 1;
      roof.visible = !opened;
    }
    controls.update();
    renderer.render(scene, camera);
    if (!opened) schedule();
  }
  function reset() {
    controls.enableDamping = false;
    controls.update();
    controls.reset();
    controls.enableDamping = !reduce();
    schedule();
  }
  function turn(direction) {
    controls.rotateLeft(-Math.sign(direction) * Math.PI / 8);
    schedule();
  }
  function keydown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || !active) return;
    switch (event.key) {
      case 'ArrowLeft': turn(-1); break;
      case 'ArrowRight': turn(1); break;
      case 'ArrowUp': controls.rotateUp(Math.PI / 28); break;
      case 'ArrowDown': controls.rotateUp(-Math.PI / 28); break;
      case '+': case '=': controls.dollyIn(1 / 1.18); break;
      case '-': controls.dollyOut(1 / 1.18); break;
      case 'Home': reset(); break;
      default: return;
    }
    event.preventDefault();
  }
  function setLoft(visible) {
    if (!loft || loft.visible === visible) return;
    loft.visible = visible;
    renderer.shadowMap.needsUpdate = true;
    schedule();
  }
  function setActive(next) {
    active = next;
    controls.enabled = next;
    liftTime = null;
    if (next) schedule();
    else { cancelAnimationFrame(frame); frame = 0; }
  }
  function preferenceChanged() {
    controls.enableDamping = !reduce();
    schedule();
  }
  function contextLost(event) {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frame);
    frame = 0;
    onError?.(new Error('The 3D graphics context was lost.'));
  }

  const observer = new ResizeObserver(schedule);
  observer.observe(canvas);
  controls.addEventListener('change', schedule);
  canvas.addEventListener('keydown', keydown);
  canvas.addEventListener('webglcontextlost', contextLost);
  window.addEventListener('resize', schedule);
  document.addEventListener('visibilitychange', schedule);
  preference.addEventListener('change', preferenceChanged);
  schedule();

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    controls.removeEventListener('change', schedule);
    controls.dispose();
    observer.disconnect();
    canvas.removeEventListener('keydown', keydown);
    canvas.removeEventListener('webglcontextlost', contextLost);
    window.removeEventListener('resize', schedule);
    document.removeEventListener('visibilitychange', schedule);
    preference.removeEventListener('change', preferenceChanged);
    // Roof clones may be the final users of their original material.
    for (const original of roofCoats.keys()) original.dispose();
    releaseMeshes(scene);
    daylight.shadow.dispose();
    renderer.dispose();
  }
  return {reset, turn, setActive, setLoft, hasLoft: Boolean(loft), dispose};
}
