// SmallVillage 2.0 page: choose a place on the painted map or the 3D map, glide down by paraglider and walk
// (shared walk controller + exported v2 navigation), with crops around the player, month/sky controls and
// quality tiers for phones. This is the front page (index.html); the original app lives on as classic.html.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadVillage, createSky} from './village.js';
import {createCrops} from './crops.js';
import {toonUniforms} from './toon.js';
import {createWalkController} from '../walk.js';
import {createGlider} from './glide.js';
import {createLanding} from './landing.js';
import {loadCreatures, createLife, createFollowCamera} from './creatures.js';
import {createFishing} from './fishing.js';
import {createActivities} from './activities.js';
import {createClimate} from './climate.js';
import {createAmbience} from './ambience.js';
import {sounds} from './sounds.js';
import {nearestPond} from './acts/common.js';
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
fold(true);  // developer controls start folded; the main page belongs to the maps
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
const player = new THREE.PerspectiveCamera(64, 1, 0.04, 9000);  // the child's eyes, driven by the walk controller
const walk = createWalkController(player, renderer.domElement, (on) => {
  controls.enabled = !on;
  if (on) life?.start(); else { fishing?.stop(); acts?.stop(); life?.stop(); }
  personBtn.hidden = !on;
  walkBtn.textContent = on ? 'Orbit' : 'Walk';
  host.dataset.navigationMode = on ? 'walk' : 'orbit';
  pad.hidden = !(on && matchMedia('(pointer: coarse)').matches);
  if (!on) {
    camera.position.copy(player.position);
    camera.quaternion.copy(player.quaternion);
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
  setFirstPerson(life?.firstPerson ?? false);  // restores the walking field of view after a glide and snaps the camera
}

// third person by default (the child and the dog in view); V or the button switches to the child's eyes
const personBtn = document.getElementById('v2-person');
let follow = null;
function setFirstPerson(on) {
  life?.setFirstPerson(on);
  personBtn.textContent = on ? '👁 1st' : '🧒 3rd';
  camera.fov = on ? 64 : 52;
  camera.near = on ? 0.04 : 0.1;
  camera.updateProjectionMatrix();
  if (walk.enabled) viewCamera(1 / 60, true);
}
function viewCamera(dt, snap = false) {
  if (!walk.enabled || !life) return;
  if (fishing?.active || acts?.ownsCamera) {  // the activity frames its own shots; the child is always in view
    life.child.root.visible = true;
    if (fishing.active) fishing.updateCamera(camera, dt); else acts.updateCamera(camera, dt);
    return;
  }
  if (life.firstPerson) {
    camera.position.copy(player.position);
    camera.quaternion.copy(player.quaternion);
  } else {
    follow.update(player, dt, snap);
    life.child.root.visible = !follow.tight;  // too boxed in for a camera behind: see through the child's eyes
  }
}
personBtn.addEventListener('click', () => setFirstPerson(!life.firstPerson));
addEventListener('keydown', (e) => { if (e.code === 'KeyV' && walk.enabled && !fishing?.active && !acts?.ownsCamera) setFirstPerson(!life.firstPerson); });

// ---------------------------------------------------------------- load and UI
let village, sky, crops, life, fishing, acts, climate, ambience;
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
const templates = await loadCreatures(village.kitMatDry);
follow = createFollowCamera(camera, walk);
life = createLife({scene, templates, walk, player, data: village.data, getMonth: () => Number(monthSel.value)});
setFirstPerson(false);
fishing = createFishing({scene, camera, walk, player, life, village,
  getMonth: () => Number(monthSel.value), getSky: () => climate.skyName(), busy: () => Boolean(acts?.active)});
acts = createActivities({scene, camera, walk, player, life, village, crops, fishing,
  getMonth: () => Number(monthSel.value), getSky: () => climate.skyName(),
  onStop: () => { if (walk.enabled) setFirstPerson(life.firstPerson); }});
const endFishing = fishing.stop;
fishing.stop = () => { endFishing(); if (walk.enabled) setFirstPerson(life.firstPerson); };

const monthSel = document.getElementById('v2-month');
const presetSel = document.getElementById('v2-preset');
const viewSel = document.getElementById('v2-view');
for (const name of Object.keys(village.data.sky)) presetSel.add(new Option(name, name));
for (const name of Object.keys(village.data.views)) viewSel.add(new Option(name, name));
presetSel.add(new Option('（日历 calendar）', ''), 0);
// the calendar: month, hour and weather (the developer sky presets override it when chosen)
climate = createClimate({scene, camera, village, sky, quality: () => Q, sounds,
  onMonth: (m) => { monthSel.value = String(m); applyMonth(); landing?.setSeason(village.data.seasonOfMonth[String(m)]); }});
monthSel.value = String(climate.month);
presetSel.value = params.get('sky') || '';
let pondNear = 999, pondT = 0;
ambience = createAmbience({button: climate.soundBtn, getState: () => {
  const st = climate.state;
  return {month: st.month, hour: st.hour, el: st.sun.el, weather: st.override ? 'clear' : st.weather, wind: st.wind, rain: st.rain,
    nearWater: pondNear, outdoors: camera.position.y < 60};
}});

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
  climate.applySky();  // the calendar's sky (or the chosen preset), fog for the quality tier, clouds
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
// ---------------------------------------------------------------- main page: maps and the paraglider landing
const glider = createGlider(scene, camera);
const backBtn = document.getElementById('v2-back');
const where = document.getElementById('v2-where');
let lastMode = 'map';
const landing = createLanding({
  data: village.data, camera, renderer,
  getSeason: () => village.data.seasonOfMonth[monthSel.value],
  onLand: (x, z, place) => land(x, z, place),
});
function land(x, z, place) {
  lastMode = landing.mode === 'flying' ? lastMode : landing.mode;
  landing.hideAll();
  if (walk.enabled) walk.exit();
  controls.enabled = false;
  backBtn.hidden = false;
  where.textContent = `${place.zh} · ${place.en}`;
  where.hidden = false;
  host.dataset.navigationMode = 'glide';
  const facing = place.look ? new THREE.Vector3(place.look[0] - x, 0, place.look[1] - z) : null;
  glider.fly(new THREE.Vector3(x, 0, z), {
    groundY: village.data.nav.ground, facing,
    onLand: (lx, lz, yaw) => {
      startWalking(lx, lz, yaw);
      setTimeout(() => { where.hidden = true; }, 2500);
    },
  });
}
function backToMap() {
  if (glider.active) glider.skip();
  if (walk.enabled) walk.exit();
  backBtn.hidden = true;
  where.hidden = true;
  goView('overview');
  landing.setMode(lastMode);
}
backBtn.addEventListener('click', backToMap);
for (const ev of ['keydown', 'pointerdown']) addEventListener(ev, (e) => {
  if (glider.active && !e.target.closest?.('#v2-back')) glider.skip();
});

monthSel.addEventListener('change', () => climate.setMonth(Number(monthSel.value)));
presetSel.addEventListener('change', () => climate.setOverride(presetSel.value || null));
qualitySel.addEventListener('change', applyQuality);
viewSel.addEventListener('change', () => { landing.hideAll(); backBtn.hidden = false; goView(viewSel.value); });
walkBtn.addEventListener('click', () => {
  if (walk.enabled) walk.exit();
  else startWalking(controls.target.x, controls.target.z, Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z));
});

applyQuality();
applyMonth();
viewSel.value = params.get('view') || 'overview';
goView(viewSel.value);
if (params.get('view')) { landing.hideAll(); backBtn.hidden = false; } else landing.setMode(params.get('mode') === '3d' ? '3d' : 'map');
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
  renderer, scene, camera, player, village, walk, crops, goView, startWalking, QUALITY, glider, landing, land, backToMap,
  life: () => life, setFirstPerson, fishing: () => fishing, acts: () => acts,
  setMonth: (m) => climate.setMonth(m),
  setSky: (n) => { presetSel.value = n; climate.setOverride(n || null); },
  setHour: (h) => climate.setHour(h),
  setWeather: (w) => climate.setWeather(w),
  climate: () => climate, ambience: () => ambience,
  setQuality: (q) => { qualitySel.value = q; applyQuality(); },
  step(dt = 1 / 60) {
    fishing.update(dt);
    acts.update(dt);
    climate.update(dt, camera);
    const sdt = dt * fishing.timeScale * acts.timeScale;
    if (glider.active) glider.update(dt); else { walk.update(dt); viewCamera(dt); }
    life.update(sdt, performance.now() / 1000);
  },
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
  fishing.update(dt);
  acts.update(dt);
  climate.update(dt, camera);
  ambience.update(dt);
  if ((pondT -= dt) <= 0) {
    pondT = 1;
    const p = nearestPond(village.data, camera.position.x, camera.position.z);
    pondNear = p ? p.e.d : 999;
    presetSel.value = climate.state.override ?? '';
  }
  const sdt = dt * fishing.timeScale * acts.timeScale;  // slow motion while a fish leaps
  toonUniforms.uTime.value += sdt;
  if (glider.active) glider.update(dt);
  else if (walk.enabled) { walk.update(dt); viewCamera(dt); }
  else controls.update();
  life.update(sdt, timer.getElapsed());
  landing.updatePins3d();
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
