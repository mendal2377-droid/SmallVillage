// SmallVillage 2.0 preview page: the Blender-built village with orbit and ground-level walking,
// month and sky preset controls and viewpoints. The original app (index.html) is unchanged.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadVillage, createSky, placeClouds} from './village.js';
import {toonUniforms} from './toon.js';
import './v2.css';

const host = document.getElementById('v2-canvas');
const status = document.getElementById('v2-status');
const renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;  // matches Blender's "Standard" view transform
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;  // PCFSoftShadowMap was removed in recent three.js
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

// ---------------------------------------------------------------- walking at eye height (no collisions yet)
const keys = new Set();
let walking = false, yaw = 0, pitch = 0;
addEventListener('keydown', (e) => keys.add(e.code));
addEventListener('keyup', (e) => keys.delete(e.code));
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!walking || !(e.buttons & 1)) return;
  yaw -= e.movementX * 0.003;
  pitch = Math.max(-1.2, Math.min(1.2, pitch - e.movementY * 0.003));
});

function setWalking(on, at) {
  walking = on;
  controls.enabled = !on;
  document.getElementById('v2-walk').textContent = on ? 'Orbit' : 'Walk';
  if (on) {
    const p = at || controls.target;
    camera.position.set(p.x, 1.65, p.z);
    const d = new THREE.Vector3();
    camera.getWorldDirection(d);
    yaw = Math.atan2(-d.x, -d.z);
    pitch = 0;
  } else {
    const d = new THREE.Vector3();
    camera.getWorldDirection(d);
    controls.target.copy(camera.position).addScaledVector(d, 20);
  }
}

function stepWalk(dt) {
  const speed = (keys.has('ShiftLeft') ? 6 : 2.2) * dt;
  const f = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), r = new THREE.Vector3(-f.z, 0, f.x);
  if (keys.has('KeyW') || keys.has('ArrowUp')) camera.position.addScaledVector(f, speed);
  if (keys.has('KeyS') || keys.has('ArrowDown')) camera.position.addScaledVector(f, -speed);
  if (keys.has('KeyD') || keys.has('ArrowRight')) camera.position.addScaledVector(r, speed);
  if (keys.has('KeyA') || keys.has('ArrowLeft')) camera.position.addScaledVector(r, -speed);
  camera.position.y = 1.65;
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
}

// ---------------------------------------------------------------- load and UI
let village, sky;
const t0 = performance.now();
status.textContent = 'Opening the village…';
try {
  village = await loadVillage(scene, {onProgress: (w) => { status.textContent = `Loaded ${w}…`; }});
} catch (err) {
  status.textContent = 'The village could not be loaded: ' + err.message;
  throw err;
}
sky = createSky(scene, village.data);

const monthSel = document.getElementById('v2-month');
const presetSel = document.getElementById('v2-preset');
const viewSel = document.getElementById('v2-view');
for (const name of Object.keys(village.data.sky)) presetSel.add(new Option(name, name));
for (const name of Object.keys(village.data.views)) viewSel.add(new Option(name, name));
const params = new URLSearchParams(location.search);
monthSel.value = params.get('month') || '8';
presetSel.value = params.get('sky') || 'summer afternoon';

function applyMonth() {
  const season = village.setMonth(Number(monthSel.value));
  host.dataset.season = season;
}
function applySky() {
  sky.apply(presetSel.value);
  placeClouds(scene, village, presetSel.value);
}
function goView(name) {
  const v = village.data.views[name];
  if (!v) return;
  const ground = v.position[1] < 3;
  camera.position.fromArray(v.position);
  camera.lookAt(new THREE.Vector3().fromArray(v.target));
  if (ground) {
    setWalking(true, camera.position.clone());
    const d = new THREE.Vector3().fromArray(v.target).sub(camera.position);
    yaw = Math.atan2(-d.x, -d.z);
    pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  } else {
    setWalking(false);
    controls.target.fromArray(v.target);
    if (v.ortho) controls.target.set(v.position[0], 0, v.position[2] - 0.01);
  }
}
monthSel.addEventListener('change', applyMonth);
presetSel.addEventListener('change', applySky);
viewSel.addEventListener('change', () => goView(viewSel.value));
document.getElementById('v2-walk').addEventListener('click', () => setWalking(!walking));

applySky();
applyMonth();
viewSel.value = params.get('view') || 'overview';
goView(viewSel.value);
village.updateLod(camera);
status.textContent = `Ready in ${((performance.now() - t0) / 1000).toFixed(1)} s`;
host.dataset.ready = 'true';

// ---------------------------------------------------------------- loop
const timer = new THREE.Timer();
let lodTimer = 0;
const info = document.getElementById('v2-info');
// test and debugging hook: render one frame on demand (the loop pauses while the page is hidden)
window.__sv2 = {
  renderer, scene, camera, village, goView, setMonth: (m) => { monthSel.value = String(m); applyMonth(); },
  setSky: (n) => { presetSel.value = n; applySky(); },
  frame() {
    renderer.info.reset();
    sky.follow(camera);
    village.updateLod(camera);
    renderer.render(scene, camera);
    const r = renderer.info.render;
    return {calls: r.calls, triangles: r.triangles};
  },
};

renderer.info.autoReset = false;  // count the whole frame, shadow pass included
renderer.setAnimationLoop(() => {
  renderer.info.reset();
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  toonUniforms.uTime.value += dt;
  if (walking) stepWalk(dt); else controls.update();
  sky.follow(camera);
  lodTimer -= dt;
  const sample = lodTimer <= 0;
  if (sample) {
    village.updateLod(camera);
    lodTimer = 0.4;
  }
  renderer.render(scene, camera);
  if (sample) {
    const r = renderer.info.render;
    info.textContent = `${r.calls} draw calls · ${(r.triangles / 1e6).toFixed(2)} M triangles (with shadows)`;
    host.dataset.calls = r.calls;
    host.dataset.triangles = r.triangles;
  }
});
