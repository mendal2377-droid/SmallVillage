// SmallVillage 2.0 preview page: the Blender-built village with orbit, collision-aware walking (the shared
// walk controller and the exported v2 navigation), crops around the player, month/sky/view controls and
// quality tiers for phones. The original app (index.html) is unchanged.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadVillage, createSky, placeClouds} from './village.js';
import {createCrops} from './crops.js';
import {toonUniforms} from './toon.js';
import {createWalkController} from '../walk.js';
import './v2.css';

// ---------------------------------------------------------------- quality tiers
export const QUALITY = {
  high: {pixelRatio: 1.5, shadowMap: 4096, shadowExtent: 220, near: 70, lod1: 450, smallCull: 320, crops: [25, 60], fog: 1.0, clouds: 1},
  low: {pixelRatio: 1.0, shadowMap: 1024, shadowExtent: 110, near: 35, lod1: 260, smallCull: 150, viewDist: 900, shadowLod: 1, crops: [12, 30], fog: 1.9, clouds: 0.5},
};
function autoQuality() {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 700;
  const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  return coarse || small || weak ? 'low' : 'high';
}

const host = document.getElementById('v2-canvas');
// the control panel folds to its title (folded by default on small screens so the view stays clear)
const panel = document.querySelector('.v2-panel'), toggle = document.getElementById('v2-toggle');
function fold(on) { panel.classList.toggle('collapsed', on); toggle.setAttribute('aria-expanded', String(!on)); }
toggle.addEventListener('click', () => fold(!panel.classList.contains('collapsed')));
fold(innerWidth < 640);
const status = document.getElementById('v2-status');
const params = new URLSearchParams(location.search);
const qualitySel = document.getElementById('v2-quality');
qualitySel.value = params.get('quality') || 'auto';
const tierName = () => (qualitySel.value === 'auto' ? autoQuality() : qualitySel.value);
let Q = QUALITY[tierName()];

const renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, Q.pixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;  // matches Blender's "Standard" view transform
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.2, 9000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;

function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- walking with collisions
const walkBtn = document.getElementById('v2-walk');
const pad = document.getElementById('v2-pad');
const walk = createWalkController(camera, renderer.domElement, (on) => {
  controls.enabled = !on;
  walkBtn.textContent = on ? 'Orbit' : 'Walk';
  host.dataset.navigationMode = on ? 'walk' : 'orbit';
  pad.hidden = !(on && matchMedia('(pointer: coarse)').matches);
  if (!on) {
    camera.fov = 42;
    camera.near = 0.2;
    camera.updateProjectionMatrix();
    const d = new THREE.Vector3();
    camera.getWorldDirection(d);
    controls.target.copy(camera.position).addScaledVector(d, 20);
  }
});
for (const b of pad.querySelectorAll('[data-dir]')) {
  const dir = b.dataset.dir;
  b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); walk.input(dir, true); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => walk.input(dir, false));
}

function freeSpotNear(x, z) {
  // spiral out until the walk controller finds standing room (not inside a building, tree or water)
  for (let r = 0; r < 40; r += 1.5) {
    for (let k = 0; k < Math.max(1, r * 4); k++) {
      const a = (k / Math.max(1, r * 4)) * Math.PI * 2;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const h = walk.standAt(px, pz, village.data.nav.ground);
      if (h !== undefined) return [px, h, pz];
    }
  }
  return [x, village.data.nav.ground, z];
}

function startWalking(x, z, yaw = 0) {
  if (!walk.nav) walk.enter({...village.data.nav});  // initialise boxes once, then place
  const [px, h, pz] = freeSpotNear(x, z);
  walk.enter({...village.data.nav, spawn: [px, h + walk.eyeHeight, pz], yaw});
}

// ---------------------------------------------------------------- load and UI
let village, sky, crops;
const t0 = performance.now();
status.textContent = 'Opening the village…';
try {
  village = await loadVillage(scene, {onProgress: (w) => { status.textContent = `Loaded ${w}…`; }});
} catch (err) {
  status.textContent = 'The village could not be loaded: ' + err.message;
  throw err;
}
sky = createSky(scene, village.data);
crops = createCrops(scene, village);

const monthSel = document.getElementById('v2-month');
const presetSel = document.getElementById('v2-preset');
const viewSel = document.getElementById('v2-view');
for (const name of Object.keys(village.data.sky)) presetSel.add(new Option(name, name));
for (const name of Object.keys(village.data.views)) viewSel.add(new Option(name, name));
monthSel.value = params.get('month') || '8';
presetSel.value = params.get('sky') || 'summer afternoon';

function applyQuality() {
  Q = QUALITY[tierName()];
  host.dataset.quality = tierName();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, Q.pixelRatio));
  resize();
  sky.sun.shadow.mapSize.set(Q.shadowMap, Q.shadowMap);
  sky.sun.shadow.map?.dispose();
  sky.sun.shadow.map = null;
  const c = sky.sun.shadow.camera;
  c.left = c.bottom = -Q.shadowExtent; c.right = c.top = Q.shadowExtent;
  c.updateProjectionMatrix();
  village.setQuality(Q);
  crops.setRadii(Q.crops);
  applySky();
}
function applyMonth() {
  host.dataset.season = village.setMonth(Number(monthSel.value));
}
function applySky() {
  sky.apply(presetSel.value);
  scene.fog.density *= Q.fog;
  placeClouds(scene, village, presetSel.value, Q.clouds);
}
function goView(name) {
  const v = village.data.views[name];
  if (!v) return;
  const target = new THREE.Vector3().fromArray(v.target);
  if (v.position[1] < 3) {
    const d = target.clone().sub(new THREE.Vector3().fromArray(v.position));
    startWalking(v.position[0], v.position[2], Math.atan2(-d.x, -d.z));
  } else {
    if (walk.enabled) walk.exit();
    camera.position.fromArray(v.position);
    controls.target.copy(target);
    if (v.ortho) controls.target.set(v.position[0], 0, v.position[2] - 0.01);
    camera.lookAt(controls.target);
  }
}
monthSel.addEventListener('change', applyMonth);
presetSel.addEventListener('change', applySky);
qualitySel.addEventListener('change', applyQuality);
viewSel.addEventListener('change', () => goView(viewSel.value));
walkBtn.addEventListener('click', () => {
  if (walk.enabled) walk.exit();
  else startWalking(controls.target.x, controls.target.z, Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z));
});

applyQuality();
applyMonth();
viewSel.value = params.get('view') || 'overview';
goView(viewSel.value);
village.updateLod(camera);
status.textContent = `Ready in ${((performance.now() - t0) / 1000).toFixed(1)} s · quality ${tierName()}`;
host.dataset.ready = 'true';

// crops only matter near the ground
function updateCrops() {
  const low = camera.position.y < 40;
  scene.getObjectByName('crops near the player').visible = low;
  if (low) crops.update(camera, Number(monthSel.value));
}

// test and debugging hook: render one frame on demand (the loop pauses while the page is hidden)
window.__sv2 = {
  renderer, scene, camera, village, walk, crops, goView, startWalking, QUALITY,
  setMonth: (m) => { monthSel.value = String(m); applyMonth(); },
  setSky: (n) => { presetSel.value = n; applySky(); },
  setQuality: (q) => { qualitySel.value = q; applyQuality(); },
  step(dt = 1 / 60) { walk.update(dt); },
  frame() {
    renderer.info.reset();
    sky.follow(camera);
    village.updateLod(camera);
    updateCrops();
    renderer.render(scene, camera);
    const r = renderer.info.render;
    return {calls: r.calls, triangles: r.triangles, crops: crops.count()};
  },
};

// ---------------------------------------------------------------- loop
renderer.info.autoReset = false;  // count the whole frame, shadow pass included
const timer = new THREE.Timer();
let lodTimer = 0;
const info = document.getElementById('v2-info');
renderer.setAnimationLoop(() => {
  renderer.info.reset();
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  toonUniforms.uTime.value += dt;
  if (walk.enabled) walk.update(dt); else controls.update();
  sky.follow(camera);
  lodTimer -= dt;
  const sample = lodTimer <= 0;
  if (sample) {
    village.updateLod(camera);
    updateCrops();
    lodTimer = 0.4;
  }
  renderer.render(scene, camera);
  if (sample) {
    const r = renderer.info.render;
    info.textContent = `${r.calls} draw calls · ${(r.triangles / 1e6).toFixed(2)} M triangles · ${crops.count()} plants`;
    host.dataset.calls = r.calls;
    host.dataset.triangles = r.triangles;
  }
});
