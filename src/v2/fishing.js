// Pond fishing for SmallVillage 2.0, the way village children fish: a bamboo hand pole (手竿) with a float,
// no reel. Watch the float, let the nibbles pass, strike on the real bite, then play the fish: pull while it
// rests, lower the rod when it runs, lean against its runs, and ease off when it jumps. Small fish come in
// quickly; a big grass carp takes patience. Every catch goes into the journal (鱼谱), kept in localStorage.
import * as THREE from 'three';
import {makeToon} from './toon.js';
import {sounds as sharedSounds, buzz} from './sounds.js';

const clamp = THREE.MathUtils.clamp, damp = THREE.MathUtils.damp, lerp = THREE.MathUtils.lerp;
const rnd = Math.random;

// ---------------------------------------------------------------- species and conditions

// bite: how the float shows a real take. lift = the float rises and lies flat (顶漂, crucian), sink = pulled
// under (黑漂), slide = drawn away while sinking, jitter = rapid shaking then down. window: seconds to strike.
// a: weight factor (kg = a · L³, L in cm).
export const SPECIES = {
  crucian: {zh: '鲫鱼', en: 'Crucian carp', L: [10, 26], a: 2.4e-5, strength: 0.7, window: 1.0, bite: 'lift', nibbles: [1, 3], jump: 0.12,
    back: 0x56583a, belly: 0xd2c890, fin: 0x6e6a44, shape: {h: 0.42, w: 0.17}},
  carp: {zh: '鲤鱼', en: 'Common carp', L: [24, 62], a: 1.5e-5, strength: 1.15, window: 1.5, bite: 'sink', nibbles: [1, 2], jump: 0.35,
    back: 0x6a5524, belly: 0xe0b85c, fin: 0xc0602a, shape: {h: 0.3, w: 0.18}},
  grass: {zh: '草鱼', en: 'Grass carp', L: [32, 75], a: 1.25e-5, strength: 1.35, window: 1.3, bite: 'slide', nibbles: [0, 2], jump: 0.6,
    back: 0x4a5636, belly: 0xdcd6aa, fin: 0x6b6a48, shape: {h: 0.22, w: 0.17}},
  loach: {zh: '泥鳅', en: 'Pond loach', L: [8, 19], a: 6e-6, strength: 0.4, window: 0.8, bite: 'jitter', nibbles: [2, 5], jump: 0,
    back: 0x5a4a30, belly: 0xb9a676, fin: 0x5a4a30, shape: {h: 0.12, w: 0.11, long: 1.4}},
  gudgeon: {zh: '麦穗鱼', en: 'Topmouth gudgeon', L: [5, 11], a: 1.2e-5, strength: 0.25, window: 0.55, bite: 'jitter', nibbles: [2, 4], jump: 0.1,
    back: 0x8a8460, belly: 0xe6e0c4, fin: 0x8a8460, shape: {h: 0.2, w: 0.12}},
};
const POND_FISH = {
  'north pond': {crucian: 4, carp: 3, grass: 2, gudgeon: 2, loach: 0.5},
  'south pond': {crucian: 4, loach: 3, gudgeon: 3, carp: 1},
  'west pond': {crucian: 3, carp: 3, grass: 1.5, gudgeon: 2, loach: 1},
};
const POND_NAME = {'north pond': ['北坑塘', 'North pond'], 'south pond': ['南坑塘', 'South pond'], 'west pond': ['西坑塘', 'West pond']};
export const BAITS = {
  worm: {zh: '蚯蚓', en: 'Worm', mult: {loach: 2, crucian: 1.3, gudgeon: 1.5, grass: 0.4}},
  dough: {zh: '面团', en: 'Dough', mult: {carp: 1.6, grass: 1.5, loach: 0.3}},
};
const SKY_WORDS = {
  'winter haze morning': ['冬日雾晨', 1.1], 'winter sunrise frost': ['霜晨', 1.2], 'spring clear': ['春日晴', 1.0],
  'summer afternoon': ['夏日午后', 0.7], overcast: ['阴天', 1.3], 'golden sunset': ['夕阳', 1.5], 'summer storm': ['雷雨前', 1.4],
  'snow day': ['雪天', 0.6], dusk: ['黄昏', 1.5], night: ['夜里', 0.9], dawn: ['清晨', 1.5], rain: ['雨里', 1.3],
};
const FROZEN = [12, 1, 2];

function pickSpecies(pond, bait, month) {
  const w = {...POND_FISH[pond]};
  for (const [k, m] of Object.entries(BAITS[bait].mult)) if (w[k]) w[k] *= m;
  if (w.grass && (month < 5 || month > 9)) w.grass *= 0.25;  // grass carp feed in the warm months
  if (w.loach && (month < 4 || month > 10)) w.loach *= 0.3;
  let r = rnd() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(w)) { r -= v; if (r <= 0) return k; }
  return 'crucian';
}

// ---------------------------------------------------------------- geometry helpers (outline points are three.js [x, z])

export function inside([x, z], poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
export function closestEdge(x, z, poly) {
  let best = null;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1);
    const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
    if (!best || d < best.d) {
      let nx = -dz, nz = dx;
      const L = Math.hypot(nx, nz);
      nx /= L; nz /= L;
      if (!inside([px + nx * 0.5, pz + nz * 0.5], poly)) { nx = -nx; nz = -nz; }  // normal pointing into the water
      best = {d, p: new THREE.Vector3(px, 0, pz), n: new THREE.Vector3(nx, 0, nz)};
    }
  }
  return best;
}


// ---------------------------------------------------------------- models: rod, line, float, fish, rings, spray

function makeRod() {
  // a tapered bamboo pole rebuilt along a bending curve every frame (N rings of R vertices)
  const N = 16, R = 6, pos = new Float32Array((N + 1) * R * 3), idx = [];
  for (let i = 0; i < N; i++) for (let k = 0; k < R; k++) {
    const a = i * R + k, b = i * R + (k + 1) % R, c = a + R, d = b + R;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  const col = new Float32Array((N + 1) * R * 3);
  for (let i = 0; i <= N; i++) for (let k = 0; k < R; k++) {
    const node = i % 4 === 0 ? 0.82 : 1;  // darker bamboo nodes
    col.set([0.78 * node, 0.66 * node, 0.36 * node], (i * R + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = makeToon({kind: 'color'});
  mat.vertexColors = true;
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  const P = new THREE.Vector3(), T = new THREE.Vector3(), U = new THREE.Vector3(), V = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());
  return {
    mesh,
    /** butt, control and tip in world space */
    set(butt, ctrl, tip) {
      curve.v0.copy(butt); curve.v1.copy(ctrl); curve.v2.copy(tip);
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        curve.getPoint(t, P); curve.getTangent(t, T);
        U.crossVectors(T, up); if (U.lengthSq() < 1e-6) U.set(1, 0, 0); U.normalize();
        V.crossVectors(U, T).normalize();
        const r = lerp(0.017, 0.0045, t);
        for (let k = 0; k < R; k++) {
          const a = (k / R) * Math.PI * 2, c = Math.cos(a) * r, s = Math.sin(a) * r;
          pos.set([P.x + U.x * c + V.x * s, P.y + U.y * c + V.y * s, P.z + U.z * c + V.z * s], (i * R + k) * 3);
        }
      }
      g.attributes.position.needsUpdate = true;
      g.computeVertexNormals();
    },
  };
}

function makeLine() {
  const n = 24, pos = new Float32Array(n * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const line = new THREE.Line(g, new THREE.LineBasicMaterial({color: 0x3c3c36, transparent: true, opacity: 0.8}));
  line.frustumCulled = false;
  const P = new THREE.Vector3();
  return {
    mesh: line,
    /** from the rod tip to the float or the fish, sagging by `sag` metres in the middle */
    set(a, b, sag) {
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        P.lerpVectors(a, b, t);
        P.y -= Math.sin(t * Math.PI) * sag * (1 - t * 0.35);
        pos.set([P.x, P.y, P.z], i * 3);
      }
      g.attributes.position.needsUpdate = true;
    },
  };
}

function makeFloat() {
  const grp = new THREE.Group();
  const white = makeToon({kind: 'color', color: new THREE.Color(0xf3efe2)});
  const red = makeToon({kind: 'color', color: new THREE.Color(0xd8442c)});
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), white);
  body.scale.set(1, 2.1, 1);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.11, 6), red);
  top.position.y = 0.1;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.08, 5), white);
  stem.position.y = -0.09;
  grp.add(body, top, stem);
  grp.scale.setScalar(1.6);  // painted world: a little larger than life so it reads on screen
  return grp;
}

const fishCache = {};
function makeFish(sp) {
  const S = SPECIES[sp], {h, w, long = 1} = S.shape;
  if (!fishCache[sp]) {
    // unit fish 1 m long facing -Z, origin at its middle; vertex colours from back to belly
    const body = new THREE.SphereGeometry(0.5, 16, 12);
    const p = body.attributes.position, col = new Float32Array(p.count * 3);
    const back = new THREE.Color(S.back), belly = new THREE.Color(S.belly), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const taper = 1 - Math.max(0, z) * 0.9;  // narrower towards the tail
      x *= w * 2 * taper; y *= h * 2 * taper * (1 + Math.max(0, -z) * 0.1);
      z *= long > 1 ? 1 : 1;
      p.setXYZ(i, x, y, z);
      c.copy(belly).lerp(back, clamp((y / (h * taper || 1)) + 0.45, 0, 1));
      col.set([c.r, c.g, c.b], i * 3);
    }
    body.setAttribute('color', new THREE.BufferAttribute(col, 3));
    body.computeVertexNormals();
    const tail = new THREE.BufferGeometry();
    tail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, h * 1.3, 0.32, 0, -h * 1.3, 0.32, 0, 0, 0.2], 3));
    tail.setIndex([0, 1, 3, 0, 3, 2]);
    tail.computeVertexNormals();
    const fin = new THREE.BufferGeometry();
    fin.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.12, 0, h * 0.75, 0.02, 0, 0, 0.16], 3));
    fin.setIndex([0, 1, 2]);
    fin.computeVertexNormals();
    const bodyMat = makeToon({kind: 'color'});
    bodyMat.vertexColors = true;
    fishCache[sp] = {body, tail, fin, bodyMat, finMat: makeToon({kind: 'color', color: new THREE.Color(S.fin)}),
      eyeMat: makeToon({kind: 'color', color: new THREE.Color(0x1d1d18)})};
  }
  const F = fishCache[sp];
  const root = new THREE.Group();
  const bend = new THREE.Group();  // the rear half swings for the tail beat
  const body = new THREE.Mesh(F.body, F.bodyMat);
  body.scale.z = long;
  const tail = new THREE.Mesh(F.tail, F.finMat);
  tail.position.z = 0.42 * long;
  const fin = new THREE.Mesh(F.fin, F.finMat);
  fin.position.set(0, h * 0.85, -0.02);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), F.eyeMat);
    eye.position.set(s * w * 0.75, h * 0.25, -0.36 * long);
    root.add(eye);
  }
  bend.add(tail);
  root.add(body, fin, bend);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return {root, tail: bend, flap(t, amp) { bend.rotation.y = Math.sin(t) * amp; body.rotation.y = -Math.sin(t) * amp * 0.12; }};
}

export function makeRings(scene, n = 12) {
  const geo = new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2);
  const rings = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color: 0xf6f8f0, transparent: true, opacity: 0, depthWrite: false}));
    m.visible = false;
    m.renderOrder = 2;
    scene.add(m);
    rings.push({m, t: 0, life: 1, size: 1});
  }
  let next = 0;
  return {
    add(x, y, z, size = 0.5, life = 1.2) {
      const r = rings[next++ % n];
      r.m.position.set(x, y + 0.012, z); r.t = 0; r.life = life; r.size = size; r.m.visible = true;
    },
    update(dt) {
      for (const r of rings) {
        if (!r.m.visible) continue;
        r.t += dt;
        const k = r.t / r.life;
        if (k >= 1) { r.m.visible = false; continue; }
        r.m.scale.setScalar(r.size * (0.12 + k));
        r.m.material.opacity = 0.6 * (1 - k) * (1 - k);
      }
    },
    hide() { for (const r of rings) r.m.visible = false; },
  };
}

export function makeSpray(scene, n = 60) {
  const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), life = new Float32Array(n);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({color: 0xf4f8f4, size: 0.07, transparent: true, opacity: 0.9, depthWrite: false}));
  pts.frustumCulled = false;
  pts.visible = false;
  scene.add(pts);
  let water = 0;
  return {
    burst(x, y, z, count = 20, power = 1) {
      water = y;
      let k = 0;
      for (let i = 0; i < n && k < count; i++) {
        if (life[i] > 0) continue;
        const a = rnd() * 6.283, s = (0.4 + rnd()) * power;
        pos.set([x + Math.cos(a) * 0.08, y + 0.02, z + Math.sin(a) * 0.08], i * 3);
        vel.set([Math.cos(a) * s, (1.6 + rnd() * 1.8) * power, Math.sin(a) * s], i * 3);
        life[i] = 1;
        k++;
      }
      pts.visible = true;
    },
    update(dt) {
      if (!pts.visible) return;  // nothing in the air: no draw call
      let alive = 0;
      for (let i = 0; i < n; i++) {
        if (life[i] <= 0) { pos[i * 3 + 1] = -999; continue; }
        alive++;
        vel[i * 3 + 1] -= 9.8 * dt;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] < water) life[i] = 0;
      }
      g.attributes.position.needsUpdate = true;
      if (!alive) pts.visible = false;
    },
  };
}

// ---------------------------------------------------------------- the journal

const JOURNAL_KEY = 'sv2-fish-journal';
function loadJournal() {
  try { const j = JSON.parse(localStorage.getItem(JOURNAL_KEY)); if (j && Array.isArray(j.entries)) return j; } catch { /* private window */ }
  return {entries: []};
}
function saveJournal(j) { try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(j)); } catch { /* storage blocked: the journal lasts for this visit */ } }

function fishSvg(sp, size = 64) {
  const S = SPECIES[sp], h = S.shape.h * 60, L = 70 * (S.shape.long || 1);
  const hex = (c) => '#' + c.toString(16).padStart(6, '0');
  return `<svg viewBox="-50 -30 100 60" width="${size}" height="${size * 0.6}" aria-hidden="true">
    <path d="M${-L / 2} 0 Q${-L / 4} ${-h} ${L / 4} ${-h * 0.45} L${L / 2} 0 L${L / 4} ${h * 0.45} Q${-L / 4} ${h} ${-L / 2} 0Z" fill="${hex(S.back)}"/>
    <path d="M${-L / 2 + 4} 2 Q${-L / 5} ${h * 0.8} ${L / 4} ${h * 0.4}" fill="none" stroke="${hex(S.belly)}" stroke-width="4" stroke-linecap="round"/>
    <path d="M${L / 2 - 2} 0 L${L / 2 + 14} ${-h * 0.8} L${L / 2 + 10} 0 L${L / 2 + 14} ${h * 0.8}Z" fill="${hex(S.fin)}"/>
    <circle cx="${-L / 2 + 8}" cy="${-h * 0.18}" r="2.6" fill="#1d1d18"/></svg>`;
}

// ---------------------------------------------------------------- the activity

export function createFishing({scene, camera, walk, player, life, village, getMonth, getSky, busy = () => false}) {
  const data = village.data;
  const ponds = Object.entries(data.pondShapes || {});
  const sounds = sharedSounds;
  let journal = loadJournal();

  // world props
  const rod = makeRod(), line = makeLine(), float = makeFloat();
  const rings = makeRings(scene), spray = makeSpray(scene);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({color: 0x15241f, transparent: true, opacity: 0.35, depthWrite: false}));
  shadow.renderOrder = 1;
  const kit = (name) => {
    const a = data.assets[name];
    const g = a && village.geometryByName(Object.values(a.lods)[0][0]);
    if (!g) return new THREE.Group();
    const m = new THREE.Mesh(g, village.kitMat);
    m.castShadow = m.receiveShadow = true;
    return m;
  };
  const bucket = kit('bucket red');
  const props = [rod.mesh, line.mesh, float, shadow, bucket];
  for (const o of props) { o.visible = false; scene.add(o); }

  // state
  const S = {
    phase: 'off', t: 0, pond: null, edge: null, n: new THREE.Vector3(), side: new THREE.Vector3(), stand: new THREE.Vector3(),
    bait: 'worm', power: 0, cast: 6, target: new THREE.Vector3(),
    floatPos: new THREE.Vector3(), floatDip: 0, floatTilt: 0, nibblesLeft: 0, nextEvent: 0, biteRate: 1,
    fish: null, sp: null, L: 0, W: 0, d: 0, lat: 0, stamina: 1, tension: 0.2, surge: 0, runSide: 1, clock: 0, jumps: 0,
    pull: false, lean: 0, leanKeys: new Set(), msg: ['', ''], tip: new THREE.Vector3(), elev: 0.55, yawOff: 0,
    jump: null, land: null, slow: 1, lostBig: false, kept: 0, catchCard: null,
  };
  const fishPos = new THREE.Vector3();
  let fishModel = null;

  // ---------------------------------------------------------------- UI
  const ui = document.createElement('div');
  ui.innerHTML = `
    <button id="v2-fish-go" class="v2-fish-go" type="button" hidden>🎣 钓鱼 Fish · F</button>
    <button id="v2-journal-btn" class="v2-journal-btn" type="button" hidden title="Fishing journal (J)">📖 鱼谱</button>
    <section id="v2-fish" class="v2-fish" hidden aria-label="Fishing">
      <p class="v2-fish-msg"><b></b><span></span></p>
      <div class="v2-fish-meter" hidden><div class="v2-fish-bar"><i></i></div><small></small></div>
      <div class="v2-fish-row">
        <button type="button" data-lean="-1" aria-label="Lean the rod left (A)">◀</button>
        <button type="button" class="v2-fish-act">Cast</button>
        <button type="button" data-lean="1" aria-label="Lean the rod right (D)">▶</button>
      </div>
      <div class="v2-fish-row v2-fish-small">
        <button type="button" class="v2-fish-bait"></button>
        <button type="button" class="v2-fish-stop">✕ 收竿 Stop · Esc</button>
      </div>
    </section>
    <section id="v2-catch" class="v2-catch" hidden aria-live="polite"></section>
    <section id="v2-journal" class="v2-journal" hidden aria-label="Fishing journal"></section>`;
  document.body.append(...ui.children);
  const $ = (id) => document.getElementById(id);
  const goBtn = $('v2-fish-go'), hud = $('v2-fish'), card = $('v2-catch'), jBtn = $('v2-journal-btn'), jPanel = $('v2-journal');
  const msgB = hud.querySelector('.v2-fish-msg b'), msgS = hud.querySelector('.v2-fish-msg span');
  const meter = hud.querySelector('.v2-fish-meter'), bar = hud.querySelector('.v2-fish-bar i'), meterTxt = hud.querySelector('.v2-fish-meter small');
  const actBtn = hud.querySelector('.v2-fish-act'), baitBtn = hud.querySelector('.v2-fish-bait');

  function say(zh, en) { if (S.msg[0] === zh && S.msg[1] === en) return; S.msg = [zh, en]; msgB.textContent = zh; msgS.textContent = en; }
  function setPhase(p) { S.phase = p; S.t = 0; hud.dataset.phase = p; }

  // ---------------------------------------------------------------- finding a spot
  function nearestPond() {
    const x = player.position.x, z = player.position.z;
    let best = null;
    for (const [name, P] of ponds) {
      const e = closestEdge(x, z, P.outline);
      if (!best || e.d < best.e.d) best = {name, P, e};
    }
    return best;
  }
  let nearCache = null, nearT = 0, padWasHidden = true, journalExtra = null;
  const walkPad = document.getElementById('v2-pad');
  function canFishHere() {
    // in winter the ponds are frozen: the ice activities take over the banks
    if (!walk.enabled || !ponds.length || busy() || FROZEN.includes(getMonth())) return null;
    const b = nearestPond();
    return b && b.e.d < 4.5 && !inside([player.position.x, player.position.z], b.P.outline) ? b : null;
  }

  function start() {
    const b = canFishHere();
    if (!b || S.phase !== 'off') return false;
    sounds.unlock();
    const month = getMonth();
    S.pond = b.name; S.P = b.P; S.water = b.P.water;
    S.edge = b.e.p.clone(); S.n.copy(b.e.n);
    S.side.set(-S.n.z, 0, S.n.x);  // the child's right hand side when facing the water
    // step up to the nearest standing room by the water (the bank collider keeps walkers a little way back)
    let px = player.position.x, pz = player.position.z, feet = walk.feet ?? data.nav.ground;
    for (let back = 0.8; back < b.e.d; back += 0.25) {
      const sx = S.edge.x - S.n.x * back, sz = S.edge.z - S.n.z * back;
      const h = walk.standAt(sx, sz, feet);
      if (h !== undefined) { px = sx; pz = sz; feet = h; break; }
    }
    S.stand.set(px, feet, pz);
    walk.place(px, feet + walk.eyeHeight, pz, Math.atan2(-S.n.x, -S.n.z), -0.15);
    walk.pause(true);
    life.setPosture(posture);
    rod.mesh.visible = true;
    bucket.position.copy(S.stand).addScaledVector(S.side, -0.75).addScaledVector(S.n, -0.35);
    bucket.rotation.y = rnd() * 6;
    bucket.visible = true;
    hud.hidden = false;
    goBtn.hidden = true;
    padWasHidden = walkPad?.hidden ?? true;
    if (walkPad) walkPad.hidden = true;  // the fishing panel replaces the walking arrows
    S.lean = 0; S.pull = false; S.kept = 0;
    camSnap = true;
    setPhase('ready');
    if (FROZEN.includes(month)) {
      setPhase('frozen');
      say('塘面结冰了', 'The pond is frozen. Come back when the ice melts, or slide on it with the other children.');
    } else readyText();
    updateBait();
    return true;
  }
  function stop() {
    if (S.phase === 'off') return;
    setPhase('off');
    for (const o of props) o.visible = false;
    if (fishModel) { scene.remove(fishModel.root); fishModel = null; }
    rings.hide();
    card.hidden = true;
    hud.hidden = true;
    if (walkPad) walkPad.hidden = padWasHidden;
    S.slow = 1; S.slowTarget = 1; S.leanKeys.clear(); S.lean = 0; S.pull = false;
    life.setPosture(null);
    walk.pause(false);
  }
  function readyText() {
    const [word, rate] = SKY_WORDS[getSky()] || ['', 1];
    const hint = rate >= 1.3 ? '鱼口正好 the fish are feeding' : rate <= 0.75 ? '鱼口慢 slow bites at this hour' : '';
    say(`${POND_NAME[S.pond][0]} · ${word}`, `Hold to swing the float out, release to cast. ${hint ? '· ' + hint : ''}`);
  }
  function updateBait() {
    const b = BAITS[S.bait];
    baitBtn.textContent = `🪱 ${b.zh} ${b.en} · B`;
    baitBtn.disabled = S.phase !== 'ready';
  }

  // ---------------------------------------------------------------- input
  function press() {
    sounds.unlock();
    switch (S.phase) {
      case 'ready': S.power = 0; setPhase('charge'); say('甩竿…', 'Release to cast'); break;
      case 'wait': case 'nibble': strikeEarly(); break;
      case 'bite': hook(); break;
      case 'fight': case 'jump': S.pull = true; break;
      case 'missed': case 'lost': case 'gone': setPhase('ready'); readyText(); updateBait(); break;
    }
  }
  function release() {
    if (S.phase === 'charge') cast();
    S.pull = false;
  }
  function setLean(dir, on) {
    if (on) S.leanKeys.add(dir); else S.leanKeys.delete(dir);
    S.lean = (S.leanKeys.has(1) ? 1 : 0) - (S.leanKeys.has(-1) ? 1 : 0);
  }

  // ---------------------------------------------------------------- the cast and the wait
  function cast() {
    const want = 3.5 + S.power * 4.5;  // a hand pole reaches about 3.5 to 8 m out
    let d = want;
    while (d > 2 && !inside([S.edge.x + S.n.x * d, S.edge.z + S.n.z * d], S.P.outline)) d -= 0.4;
    S.cast = d;
    S.target.copy(S.edge).addScaledVector(S.n, d).addScaledVector(S.side, (rnd() - 0.5) * 0.8);
    S.target.y = S.water;
    S.floatPos.copy(float.position);
    S.castFrom = float.position.clone();
    sounds.whoosh();
    setPhase('cast');
    say('', '');
  }
  function beginWait() {
    const [, rate] = SKY_WORDS[getSky()] || ['', 1];
    S.biteRate = rate;
    S.sp = pickSpecies(S.pond, S.bait, getMonth());
    const sp = SPECIES[S.sp];
    S.nibblesLeft = sp.nibbles[0] + Math.floor(rnd() * (sp.nibbles[1] - sp.nibbles[0] + 1));
    S.nextEvent = (3 + rnd() * 6) / rate;
    S.falseNibble = rnd() < 0.35;  // a small fish teasing before the real one comes
    setPhase('wait');
    say('看漂…', 'Watch the float. Little taps are only nibbles; wait for the real take.');
  }
  function nibble() {
    S.floatDip = -0.02 - rnd() * 0.02;
    rings.add(S.floatPos.x, S.water, S.floatPos.z, 0.25, 0.9);
    sounds.tick();
    if (rnd() < 0.5) buzz(15);
    setPhase('nibble');
    say('有鱼在啃…', 'A nibble… not yet.');
  }
  function bite() {
    const sp = SPECIES[S.sp];
    S.biteKind = sp.bite;
    S.window = sp.window * (0.9 + rnd() * 0.3);
    rings.add(S.floatPos.x, S.water, S.floatPos.z, 0.45, 1.1);
    buzz([40, 30, 40]);
    sounds.tick();
    setPhase('bite');
    say('咬钩了！', sp.bite === 'lift' ? 'The float lifts and lies flat: strike!' : 'The float goes down: strike!');
  }
  function strikeEarly() {
    // too early: the float flies out of the water and over the child's head, the fish swims off
    S.missFrom = S.floatPos.clone();
    sounds.whoosh();
    sounds.boing();
    setPhase('missed');
    say('太早了！', 'Too early: it was only nibbling. Tap to cast again.');
  }
  function hook() {
    const sp = SPECIES[S.sp];
    const r = rnd() ** 1.8;
    S.L = Math.round(sp.L[0] + (sp.L[1] - sp.L[0]) * r);
    S.W = sp.a * S.L ** 3;
    S.d = S.floatPos.distanceTo(new THREE.Vector3(S.edge.x, S.water, S.edge.z));
    S.lat = (S.floatPos.clone().sub(S.edge)).dot(S.side);
    S.stamina = 1; S.tension = 0.35; S.surge = 0; S.clock = 0.6 + rnd(); S.runSide = rnd() < 0.5 ? -1 : 1; S.jumps = 0;
    S.size = clamp((S.L - 10) / 60, 0, 1);  // 0 tiny .. 1 huge
    S.strength = sp.strength * (0.55 + 0.9 * S.size);
    fishModel = makeFish(S.sp);
    fishModel.root.scale.setScalar(S.L / 100);
    fishModel.root.visible = false;
    scene.add(fishModel.root);
    fishPos.copy(S.floatPos);
    shadow.scale.set(S.L / 100 * 0.45, 1, S.L / 100);
    shadow.visible = true;
    float.visible = true;
    rings.add(S.floatPos.x, S.water, S.floatPos.z, 0.6, 1.0);
    spray.burst(S.floatPos.x, S.water, S.floatPos.z, 8 + S.size * 14, 0.5 + S.size * 0.6);
    sounds.splash(0.4 + S.size);
    buzz(S.size > 0.4 ? [80, 40, 120] : 60);
    setPhase('fight');
  }

  // ---------------------------------------------------------------- the fight
  function fightText() {
    if (S.size < 0.12) return say('小鱼！', 'A little one: lift it out (hold).');
    if (S.surge) {
      const dir = S.runSide > 0 ? '右' : '左';
      return say(`往${dir}冲！`, `It runs ${S.runSide > 0 ? 'right' : 'left'}: let go to give it rod, lean ${S.runSide > 0 ? 'left ◀ A' : 'right ▶ D'}.`);
    }
    say(S.tension > 0.75 ? '线紧了！' : '它歇了，拉！', S.tension > 0.75 ? 'Too tight: ease off a little.' : 'It is resting: hold to pull it closer.');
  }
  function lose(zh, en, big = false) {
    S.lostBig = big;
    sounds.snap();
    buzz([30, 30, 30]);
    if (fishModel) { scene.remove(fishModel.root); fishModel = null; }
    shadow.visible = false;
    float.visible = true;
    rings.add(fishPos.x, S.water, fishPos.z, 0.8, 1.4);
    setPhase('lost');
    say(zh, en);
  }
  function fight(dt) {
    const sp = SPECIES[S.sp];
    S.clock -= dt;
    if (S.clock <= 0) {
      S.surge = S.surge ? 0 : (rnd() < 0.15 + S.size * 0.8 ? 1 : 0);
      S.clock = S.surge ? 1.6 + rnd() * 1.6 * S.size : 1.8 + rnd() * 2.2;
      S.runSide = rnd() < 0.5 ? -1 : 1;
      if (S.surge) {
        buzz(50);
        if (S.jumps < 2 && S.stamina < 0.85 && rnd() < sp.jump) return startJump();
      }
    }
    const surge = S.surge && S.size >= 0.12;
    const brace = S.lean === -S.runSide;
    const str = S.strength * (0.4 + 0.6 * S.stamina);
    S.stamina = clamp(S.stamina - dt * (surge ? 0.03 : 0.05) * (S.pull ? 1.4 : 1) / Math.max(0.5, S.strength), 0, 1);
    // tension: rises when pulling against a running fish, eases when the rod is lowered
    let dT;
    if (surge) dT = S.pull ? 0.38 * str : 0.05 * str - 0.2;
    else dT = S.pull ? 0.06 + 0.04 * str : -0.25;
    if (brace && surge) dT -= 0.22;
    if (surge && !brace && S.lean === S.runSide) dT += 0.15;  // leaning the wrong way helps the fish
    S.tension = clamp(S.tension + dT * dt, 0.05, 1);
    // distance: the fish takes ground while running, the child gains it while it rests
    const maxD = S.cast + 1.8;
    if (surge) {
      S.d += dt * (S.pull ? 0.1 : brace ? 0.35 : 0.8) * str;
      S.lat += dt * S.runSide * (brace ? 0.5 : 1.3) * str;
    } else if (S.pull) S.d -= dt * (0.45 + (1 - S.size) * 1.6) * (0.5 + 0.8 * (1 - S.stamina));  // a fresh big fish gives ground slowly
    else S.d += dt * 0.12 * str;
    S.lat *= 1 - dt * 0.15;
    if (S.d > maxD) { S.d = maxD; if (surge) S.tension = clamp(S.tension + dt * 0.5); }
    S.d = Math.max(0.6, S.d);
    S.lat = clamp(S.lat, -6, 6);
    placeFish();
    if (surge && rnd() < dt * 6) rings.add(fishPos.x, S.water, fishPos.z, 0.25 + S.size * 0.4, 0.9);
    if (S.pull && rnd() < dt * 5) sounds.creak();
    if (S.tension >= 0.999) return lose('线断了！', S.size > 0.5 ? 'The line snapped. It was a big one! Let it run next time.' : 'The line snapped. Lower the rod when it runs.', S.size > 0.5);
    if (S.t > 90) return lose('鱼脱钩了', 'It slipped the hook after a long fight.');
    // a big fish that is not yet tired bolts when it sees the bank
    if (!S.surge && S.d < 2.4 && S.size >= 0.3 && S.stamina > 0.35 && S.clock > 0.3) {
      S.surge = 1; S.clock = 1.4 + rnd(); S.runSide = rnd() < 0.5 ? -1 : 1;
      spray.burst(fishPos.x, S.water, fishPos.z, 10, 0.6);
      sounds.splash(0.5);
      buzz(60);
    }
    if (S.d <= 1.3) return startLanding();
    fightText();
  }
  function placeFish() {
    for (let k = 0; k < 6; k++) {
      fishPos.copy(S.edge).addScaledVector(S.n, S.d).addScaledVector(S.side, S.lat);
      if (inside([fishPos.x, fishPos.z], S.P.outline)) break;
      S.lat *= 0.7; S.d = Math.max(0.8, S.d * 0.9);
    }
    fishPos.y = S.water;
  }

  function startJump() {
    const back = new THREE.Vector3().copy(S.side).multiplyScalar(S.runSide * 1.3);
    S.jump = {t: 0, T: 1.0, from: fishPos.clone(), to: fishPos.clone().add(back), h: 0.55 + S.size * 0.8, splashed: false};
    S.jumps++;
    spray.burst(fishPos.x, S.water, fishPos.z, 18, 0.8 + S.size * 0.5);
    rings.add(fishPos.x, S.water, fishPos.z, 0.7, 1.2);
    sounds.splash(0.8);
    buzz([60, 40, 60]);
    fishModel.root.visible = true;
    shadow.visible = false;
    setPhase('jump');
    say('跳起来了！', 'It jumps! Let go: ease off or it will throw the hook.');
  }
  function jump(dt) {
    const J = S.jump;
    J.t += dt;
    const k = clamp(J.t / J.T, 0, 1);
    fishPos.lerpVectors(J.from, J.to, k);
    fishPos.y = S.water + Math.sin(k * Math.PI) * J.h - 0.05;
    // slow motion around the top of the leap
    S.slowTarget = k > 0.12 && k < 0.85 ? 0.3 : 1;
    if (S.pull) S.tension = clamp(S.tension + dt * 2.4);
    else S.tension = clamp(S.tension - dt * 0.8, 0.1, 1);
    if (S.tension >= 0.999) {
      S.slowTarget = 1;
      return lose('甩钩了！', 'It shook the hook in mid-air. Ease off when a fish jumps.', S.size > 0.4);
    }
    if (k >= 1) {
      spray.burst(fishPos.x, S.water, fishPos.z, 22, 0.9 + S.size * 0.5);
      rings.add(fishPos.x, S.water, fishPos.z, 0.9, 1.4);
      sounds.splash(1);
      S.stamina = Math.max(0, S.stamina - 0.15);
      S.slowTarget = 1;
      S.d = S.edge.distanceTo(new THREE.Vector3(fishPos.x, 0, fishPos.z)) * 0.98;
      S.lat = new THREE.Vector3(fishPos.x - S.edge.x, 0, fishPos.z - S.edge.z).dot(S.side);
      S.surge = 0; S.clock = 1.5;
      fishModel.root.visible = false;
      shadow.visible = true;
      setPhase('fight');
    }
  }

  // ---------------------------------------------------------------- landing, the catch card and the journal
  function startLanding() {
    S.land = {from: fishPos.clone()};
    fishModel.root.visible = true;
    shadow.visible = false;
    float.visible = false;
    spray.burst(fishPos.x, S.water, fishPos.z, 16, 0.7);
    sounds.splash(0.6);
    buzz(80);
    setPhase('landing');
    say('起鱼！', 'Up it comes!');
  }
  function handsPoint() {
    const fw = S.n;
    return new THREE.Vector3(S.stand.x, S.stand.y + (S.phase === 'show' ? 0.8 : 0.9), S.stand.z).addScaledVector(fw, 0.4);
  }
  function landing(dt) {
    const k = clamp(S.t / 1.1, 0, 1), e = 1 - (1 - k) ** 3;
    const to = handsPoint();
    fishPos.lerpVectors(S.land.from, to, e);
    fishPos.y += Math.sin(k * Math.PI) * 1.4;
    if (k >= 1) showCatch();
  }
  function showCatch() {
    const sp = SPECIES[S.sp];
    const prev = journal.entries.filter((e) => e.sp === S.sp);
    const isNew = prev.length === 0, best = !isNew && S.L > Math.max(...prev.map((e) => e.L));
    const [skyWord] = SKY_WORDS[getSky()] || [getSky()];
    S.catchCard = {sp: S.sp, L: S.L, W: +S.W.toFixed(S.W < 0.1 ? 3 : 2), pond: S.pond, month: getMonth(), sky: getSky(), skyWord,
      bait: S.bait, date: new Date().toISOString(), kept: true, jumps: S.jumps};
    const wTxt = S.W < 1 ? `${Math.round(S.W * 1000)} g` : `${S.W.toFixed(2)} kg`;
    card.innerHTML = `
      <div class="v2-catch-fish">${fishSvg(S.sp, 120)}</div>
      <h3>${sp.zh} <small>${sp.en}</small></h3>
      ${isNew ? '<p class="v2-catch-flag">新鱼！ New for the journal</p>' : best ? '<p class="v2-catch-flag">最大的一条！ Your biggest yet</p>' : ''}
      <p class="v2-catch-size"><b>${S.L} cm</b> · ${wTxt}${S.jumps ? ` · 跳了 ${S.jumps} 次` : ''}</p>
      <p class="v2-catch-where">${POND_NAME[S.pond][0]} ${POND_NAME[S.pond][1]} · ${getMonth()}月 · ${skyWord} · ${BAITS[S.bait].zh}</p>
      <div class="v2-fish-row"><button type="button" data-keep="1">🪣 放桶里 Keep</button><button type="button" data-keep="0">🌊 放生 Release</button></div>`;
    card.hidden = false;
    for (const b of card.querySelectorAll('[data-keep]')) b.addEventListener('click', () => finishCatch(b.dataset.keep === '1'));
    sounds.chime();
    buzz([30, 60, 30]);
    // the dog comes over to see
    if (life.dog) { life.dog.idle = 5; life.dog.goal = S.stand.clone().addScaledVector(S.side, 0.9).addScaledVector(S.n, -0.4); }
    setPhase('show');
    say('钓到了！', `${sp.zh} ${sp.en}`);
  }
  function finishCatch(keep) {
    if (S.phase !== 'show') return;
    card.hidden = true;
    S.catchCard.kept = keep;
    journal.entries.push(S.catchCard);
    saveJournal(journal);
    S.away = {from: fishPos.clone(), keep, to: keep ? bucket.position.clone().add(new THREE.Vector3(0, 0.3, 0))
      : new THREE.Vector3(S.edge.x, S.water, S.edge.z).addScaledVector(S.n, 1.6)};
    if (keep) S.kept++;
    setPhase('away');
    say(keep ? '放进桶里' : '放生', keep ? 'Into the bucket.' : 'Back into the pond. Swim well!');
  }
  function away() {
    const k = clamp(S.t / 0.7, 0, 1);
    fishPos.lerpVectors(S.away.from, S.away.to, k);
    fishPos.y += Math.sin(k * Math.PI) * 0.6;
    if (k >= 1) {
      if (!S.away.keep) { spray.burst(fishPos.x, S.water, fishPos.z, 14, 0.6); rings.add(fishPos.x, S.water, fishPos.z, 0.6, 1.2); sounds.splash(0.5); }
      else sounds.plop();
      scene.remove(fishModel.root);
      fishModel = null;
      setPhase('ready');
      readyText();
      updateBait();
    }
  }

  function renderJournal() {
    const by = {};
    for (const e of journal.entries) (by[e.sp] ||= []).push(e);
    const total = journal.entries.length;
    const cards = Object.entries(SPECIES).map(([k, s]) => {
      const list = by[k] || [];
      const best = list.length ? Math.max(...list.map((e) => e.L)) : 0;
      return `<li class="${list.length ? '' : 'v2-journal-unknown'}">${fishSvg(k, 72)}<b>${list.length ? s.zh : '？？'}</b>
        <small>${list.length ? s.en : 'not caught yet'}</small>${list.length ? `<span>${list.length} 条 · 最大 ${best} cm</span>` : ''}</li>`;
    }).join('');
    const recent = journal.entries.slice(-8).reverse().map((e) => {
      const s = SPECIES[e.sp];
      return `<tr><td>${s.zh}</td><td>${e.L} cm</td><td>${POND_NAME[e.pond]?.[0] ?? e.pond}</td><td>${e.month}月 ${e.skyWord ?? ''}</td><td>${e.kept ? '🪣' : '🌊'}</td></tr>`;
    }).join('');
    jPanel.innerHTML = `<header><h3>鱼谱 · Fishing journal</h3><button type="button" class="v2-journal-close" aria-label="Close">✕</button></header>
      <p>${total ? `${total} 条鱼 · ${Object.keys(by).length} / ${Object.keys(SPECIES).length} 种` : '还没有钓到鱼。Walk to a pond edge and press F.'}</p>
      <ul class="v2-journal-grid">${cards}</ul>
      ${recent ? `<table><caption>最近 Recent catches</caption>${recent}</table>` : ''}
      ${journalExtra?.() ?? ''}`;
    jPanel.querySelector('.v2-journal-close').addEventListener('click', () => { jPanel.hidden = true; });
  }
  function toggleJournal(on = jPanel.hidden) {
    if (on) renderJournal();
    jPanel.hidden = !on;
  }

  // ---------------------------------------------------------------- per frame
  const tmp = new THREE.Vector3(), butt = new THREE.Vector3(), ctrl = new THREE.Vector3(), handR = new THREE.Vector3();
  let clock = 0;
  function update(rawDt) {
    S.slow = damp(S.slow, S.slowTarget ?? 1, 8, rawDt);
    const dt = rawDt * S.slow;
    clock += dt;
    rings.update(dt);
    spray.update(dt);
    nearT -= rawDt;
    if (nearT <= 0) {
      nearT = 0.3;
      nearCache = S.phase === 'off' ? canFishHere() : null;
      goBtn.hidden = !nearCache;
      jBtn.hidden = !walk.enabled;
    }
    if (S.phase === 'off') return;
    S.t += dt;

    switch (S.phase) {
      case 'charge': S.power = clamp(S.power + dt * 0.7, 0, 1); break;
      case 'cast': {
        const k = clamp(S.t / 0.9, 0, 1);
        S.floatPos.lerpVectors(S.castFrom, S.target, k);
        S.floatPos.y = lerp(S.castFrom.y, S.water, k) + Math.sin(k * Math.PI) * 2.2;
        if (k >= 1) {
          S.floatPos.copy(S.target);
          spray.burst(S.target.x, S.water, S.target.z, 6, 0.35);
          rings.add(S.target.x, S.water, S.target.z, 0.35, 1.2);
          sounds.plop();
          beginWait();
        }
        break;
      }
      case 'wait':
        S.nextEvent -= dt;
        if (S.nextEvent <= 0) {
          if (S.falseNibble) { S.falseNibble = false; nibble(); S.nextEvent = 2 + rnd() * 3; }
          else if (S.nibblesLeft > 0) { S.nibblesLeft--; nibble(); S.nextEvent = 0.8 + rnd() * 2.5; }
          else bite();
        }
        break;
      case 'nibble':
        if (S.t > 0.5) { setPhase('wait'); say('看漂…', 'Watch the float. Wait for the real take.'); }
        break;
      case 'bite':
        S.window -= dt;
        if (S.window <= 0) {
          setPhase('gone');
          rings.add(S.floatPos.x, S.water, S.floatPos.z, 0.3, 1);
          say('饵被偷吃了', 'Too late: the fish stole the bait. Tap to bait up and cast again.');
        }
        break;
      case 'fight': fight(dt); break;
      case 'jump': jump(dt); break;
      case 'landing': landing(dt); break;
      case 'away': away(); break;
    }
    // the float hangs from the rod tip whenever it is not in the water; it is off the line once the fish is out
    float.visible = !['show', 'away', 'frozen', 'landing'].includes(S.phase);
    line.mesh.visible = !['show', 'away', 'frozen'].includes(S.phase);
    animateFloat(dt);
    animateRod(dt);
    animateFish(dt);
    updateHud();
  }

  function animateFloat(dt) {
    if (!float.visible) return;
    if (['wait', 'nibble', 'bite', 'gone'].includes(S.phase)) {
      let dip = 0, tilt = 0, slide = 0;
      const t = clock;
      if (S.phase === 'nibble') dip = S.floatDip * Math.sin(Math.min(1, S.t / 0.5) * Math.PI);
      if (S.phase === 'bite') {
        const k = clamp(S.t / 0.35, 0, 1);
        if (S.biteKind === 'lift') { dip = 0.06 * k; tilt = 1.3 * clamp((S.t - 0.25) / 0.3, 0, 1); }
        else if (S.biteKind === 'sink') dip = -0.2 * k;
        else if (S.biteKind === 'slide') { dip = -0.12 * k; slide = S.t * 0.5; }
        else dip = -0.04 * Math.abs(Math.sin(S.t * 30)) - 0.14 * clamp((S.t - 0.25) / 0.2, 0, 1);
      }
      if (S.phase === 'gone') dip = 0.02;
      S.floatTilt = damp(S.floatTilt, tilt, 10, dt);
      float.position.set(S.floatPos.x + S.side.x * slide, S.water + 0.03 + Math.sin(t * 2.1) * 0.006 + dip, S.floatPos.z + S.side.z * slide);
      float.rotation.set(0, 0, 0);
      float.rotateOnWorldAxis(S.side, S.floatTilt);
    } else if (S.phase === 'cast' || S.phase === 'charge' || S.phase === 'ready') {
      float.position.copy(S.phase === 'cast' ? S.floatPos : S.tip).y -= S.phase === 'cast' ? 0 : 0.8;
      float.rotation.set(0, 0, 0);
    } else if (S.phase === 'fight' || S.phase === 'jump') {
      // the float is dragged along the line, half under
      tmp.copy(S.tip).lerp(fishPos, 0.85);
      float.position.set(tmp.x, S.water - 0.03, tmp.z);
      float.rotation.set(0, 0, 0);
      float.rotateOnWorldAxis(S.side, 1.1);
    } else if (S.phase === 'missed') {
      // the float sails back over the child's head and dangles
      const k = clamp(S.t / 0.8, 0, 1);
      const to = tmp.copy(S.tip); to.y -= 0.9;
      float.position.lerpVectors(S.missFrom, to, k);
      float.position.y += Math.sin(k * Math.PI) * 3;
      float.rotation.z += dt * 14 * (1 - k);
    } else if (S.phase === 'lost') {
      const k = clamp(S.t / 0.6, 0, 1);
      float.position.lerp(tmp.copy(S.tip).setY(S.tip.y - 0.9), k * 0.3);
    }
  }

  function animateRod(dt) {
    const c = life.child;
    // rod elevation (radians above level) and sideways lean by phase
    let elev = 0.55, side = 0;
    switch (S.phase) {
      case 'frozen': elev = 0.25; break;
      case 'ready': elev = 0.6 + Math.sin(clock * 1.3) * 0.02; break;
      case 'charge': elev = 0.6 + S.power * 1.35; break;
      case 'cast': elev = S.t < 0.22 ? lerp(1.95, 0.35, S.t / 0.22) : 0.45; break;
      case 'wait': case 'gone': elev = 0.45 + Math.sin(clock * 0.9) * 0.015; break;
      case 'nibble': elev = 0.47; break;
      case 'bite': elev = 0.45; break;
      case 'missed': elev = S.t < 0.2 ? lerp(0.45, 1.6, S.t / 0.2) : lerp(1.6, 0.6, clamp((S.t - 0.2) / 0.8, 0, 1)); break;
      case 'fight': elev = (S.pull ? 1.15 : 0.7) + (S.surge ? -0.15 : 0); side = S.lean * 0.45; break;
      case 'jump': elev = S.pull ? 1.2 : 0.55; side = S.lean * 0.45; break;
      case 'landing': elev = 1.45; break;
      case 'show': case 'away': elev = -0.1; side = -1.2; break;
      case 'lost': elev = S.t < 0.15 ? 0.3 : lerp(1.3, 0.6, clamp(S.t / 1.2, 0, 1)); break;
    }
    const k = S.phase === 'cast' || S.phase === 'missed' ? 1 : 1 - Math.exp(-10 * dt);
    S.elev = lerp(S.elev, elev, k);
    S.yawOff = lerp(S.yawOff, side, 1 - Math.exp(-6 * dt));
    c.root.updateMatrixWorld(true);
    c.parts['arm R'].localToWorld(handR.set(0, -0.4, -0.01));
    const dir = tmp.copy(S.n).applyAxisAngle(new THREE.Vector3(0, 1, 0), -S.yawOff);
    const flat = dir.clone();
    dir.multiplyScalar(Math.cos(S.elev)).setY(Math.sin(S.elev)).normalize();
    const L = 3.6;
    butt.copy(handR).addScaledVector(dir, -0.35);
    // the tip bends towards whatever pulls the line
    const tip0 = butt.clone().addScaledVector(dir, L);
    let bend = 0;
    const end = lineEnd();
    if (S.phase === 'fight' || S.phase === 'jump') bend = 0.15 + S.tension * 0.75;
    else if (S.phase === 'landing') bend = 0.25 + S.size * 0.5;
    else if (S.phase === 'bite') bend = 0.08;
    else if (S.phase === 'charge') bend = -0.05 * S.power;
    if (S.phase === 'show' || S.phase === 'away') {
      // laid down on the bank beside the child
      butt.copy(S.stand).addScaledVector(S.side, 0.5).setY(S.stand.y + 0.03);
      tip0.copy(butt).addScaledVector(flat, L).setY(S.stand.y + 0.25);
    }
    ctrl.copy(butt).addScaledVector(dir, L * 0.55);
    const tip = S.tip.copy(tip0);
    if (bend && end) {
      const pullDir = end.clone().sub(tip0).normalize();
      tip.addScaledVector(pullDir, bend * L * 0.32);
      tip.y -= bend * L * 0.12;
      // keep the rod length roughly constant
      tip.sub(butt).setLength(L * (1 - bend * 0.08)).add(butt);
    }
    rod.set(butt, ctrl, tip);
    if (end && line.mesh.visible) {
      const len = tip.distanceTo(end);
      const sag = ['fight', 'jump', 'landing'].includes(S.phase) ? (1 - S.tension) * 0.05 * len : S.phase === 'cast' ? 0.02 * len : 0.07 * len;
      line.set(tip, end, sag);
    }
  }
  function lineEnd() {
    if (['fight', 'jump', 'landing', 'show'].includes(S.phase)) {
      if (S.phase === 'show') return null;
      return fishPos.clone().setY(S.phase === 'fight' ? fishPos.y : fishPos.y + 0.05);
    }
    if (float.visible) return float.position.clone().setY(float.position.y + 0.12 * float.scale.y);
    return null;
  }

  function animateFish(dt) {
    if (!fishModel) return;
    const R = fishModel.root;
    const toShore = Math.atan2(S.n.x, S.n.z);  // fish facing the bank (fish face -Z)
    if (S.phase === 'fight') {
      const surge = S.surge && S.size >= 0.12;
      const swim = toShore + (surge ? S.runSide * 1.6 : 0) + Math.sin(clock * 2) * 0.2;
      shadow.position.set(fishPos.x, S.water + 0.01, fishPos.z);
      shadow.rotation.y = swim;
      shadow.material.opacity = 0.25 + 0.2 * clamp(1 - S.d / 8, 0, 1);
      // close to the bank the fish shows at the surface, thrashing
      const near = S.d < 2.6;
      R.visible = near;
      R.position.set(fishPos.x, S.water - 0.04 * S.L / 100, fishPos.z);
      R.rotation.set(0, swim, 0);
      fishModel.flap(clock * (surge ? 22 : 12), surge ? 0.7 : 0.4);
      if (near && rnd() < dt * 4) spray.burst(fishPos.x, S.water, fishPos.z, 4, 0.4);
    } else if (S.phase === 'jump') {
      const J = S.jump, k = clamp(J.t / J.T, 0, 1);
      R.position.copy(fishPos);
      const heading = Math.atan2(-(J.to.x - J.from.x), -(J.to.z - J.from.z));
      R.rotation.set(0, 0, 0);
      R.rotation.order = 'YXZ';
      R.rotation.y = heading;
      R.rotation.x = lerp(1.0, -1.0, k);  // nose up out of the water, nose down going back in
      R.rotation.z = Math.sin(k * Math.PI) * 0.5 * S.runSide;
      fishModel.flap(clock * 26, 0.9);
    } else if (S.phase === 'landing' || S.phase === 'away') {
      R.position.copy(fishPos);
      R.rotation.set(0, toShore + Math.PI / 2, Math.sin(clock * 9) * 0.3);
      fishModel.flap(clock * 24, 0.8);
    } else if (S.phase === 'show') {
      // held across both hands in front of the child, wriggling now and then
      const hp = handsPoint();
      fishPos.copy(hp);
      R.position.copy(hp);
      R.rotation.set(0, toShore + Math.PI / 2, 0);
      const wr = Math.max(0, Math.sin(clock * 1.7)) ** 6;
      fishModel.flap(clock * 20, 0.15 + wr * 0.6);
    }
  }

  // the child's posture while fishing, applied after the walking pose
  function posture(rig, t) {
    const P = rig.parts;
    const ph = S.phase;
    const arm = clamp(0.35 + S.elev * 0.55, 0.2, 1.6);
    P['arm R'].rotation.x = arm;
    P['arm R'].rotation.z = -0.28 - S.yawOff * 0.2;
    P['arm L'].rotation.x = arm * 0.85;
    P['arm L'].rotation.z = 0.42 - S.yawOff * 0.2;
    if (ph === 'fight' || ph === 'jump' || ph === 'landing') {
      P.torso.rotation.x = S.pull ? 0.16 : 0.04;  // lean back while pulling
      P.torso.rotation.z = -S.yawOff * 0.25;
      P['leg L'].rotation.x = 0.28;
      P['leg R'].rotation.x = -0.22;
      P['knee L'].rotation.x = -0.25;
      P.hips.position.y -= 0.03;
      if (S.tension > 0.8) P.torso.rotation.y = Math.sin(t * 30) * 0.02;
    }
    if (ph === 'bite' || ph === 'nibble') P.head.rotation.x = -0.15;
    if (ph === 'missed' && S.t > 0.8) {
      // scratch the head
      P['arm L'].rotation.x = 2.7;
      P['arm L'].rotation.z = 0.6 + Math.sin(t * 14) * 0.08;
      P['arm R'].rotation.x = 0.5;
      P.head.rotation.z = 0.15;
    }
    if (ph === 'show') {
      const hop = Math.max(0, Math.sin(Math.min(S.t, 0.9) * Math.PI * 2.2)) * (S.t < 0.9 ? 0.06 : 0);
      P.hips.position.y += hop;
      P['arm R'].rotation.x = P['arm L'].rotation.x = 1.0;
      P['arm R'].rotation.z = -0.32;
      P['arm L'].rotation.z = 0.32;
      P.head.rotation.x = 0.12;
    }
    if (ph === 'lost' && S.t < 1.5) { P.head.rotation.x = -0.3; P.torso.rotation.x = -0.1; }
  }

  function updateHud() {
    const ph = S.phase;
    const labels = {ready: '甩竿 Cast · hold', charge: '松手 Release', cast: '…', wait: '提竿 Strike', nibble: '提竿 Strike', bite: '提竿！ Strike!',
      fight: S.pull ? '拉 Pulling…' : '拉 Pull · hold', jump: '松！ Ease off', landing: '…', show: '…', away: '…',
      missed: '再来 Cast again', lost: '再来 Cast again', gone: '再来 Cast again', frozen: '❄'};
    actBtn.textContent = labels[ph] ?? '';
    actBtn.disabled = ['cast', 'landing', 'show', 'away', 'frozen'].includes(ph);
    actBtn.classList.toggle('v2-fish-urgent', ph === 'bite' || ph === 'jump');
    hud.classList.toggle('v2-fish-fighting', ph === 'fight' || ph === 'jump');
    if (ph === 'charge') {
      meter.hidden = false;
      bar.style.width = `${S.power * 100}%`;
      bar.style.background = '#7aa84a';
      meterTxt.textContent = `${(3.5 + S.power * 4.5).toFixed(1)} m`;
    } else if (ph === 'fight' || ph === 'jump') {
      meter.hidden = false;
      bar.style.width = `${S.tension * 100}%`;
      bar.style.background = S.tension > 0.8 ? '#d0402a' : S.tension > 0.55 ? '#e0a020' : '#5f9a48';
      meterTxt.textContent = `线 tension · ${S.d.toFixed(1)} m${S.size > 0.5 ? ' · 好沉！ Heavy!' : ''}`;  // what it is stays a surprise
    } else meter.hidden = true;
    if (ph === 'fight' && S.size >= 0.12 && !S.surge && S.tension < 0.75) {/* text set in fightText */}
  }

  // ---------------------------------------------------------------- camera while fishing
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let camSnap = true;
  function updateCamera(cam, rawDt) {
    const head = new THREE.Vector3(S.stand.x, S.stand.y + 1.3, S.stand.z);
    const wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
    const watch = S.phase === 'wait' || S.phase === 'nibble' || S.phase === 'bite' || S.phase === 'gone';
    if (S.phase === 'show' || S.phase === 'away') {
      // the photo: in front of the child and off to one side, so the face shows beside the fish
      wantPos.copy(head).addScaledVector(S.n, cam.aspect < 1 ? 2.8 : 2.0).addScaledVector(S.side, cam.aspect < 1 ? -0.9 : -1.5).setY(S.stand.y + 1.15);
      wantLook.copy(head).addScaledVector(S.side, -0.15).setY(S.stand.y + 0.95);
    } else if (S.phase === 'jump') {
      wantPos.copy(head).addScaledVector(S.n, -1.4).addScaledVector(S.side, 0.8).setY(S.stand.y + 1.7);
      wantLook.copy(fishPos);
    } else {
      // over the shoulder, closer to the water while watching the float
      const focus = float.visible && S.phase !== 'missed' ? float.position : fishModel ? fishPos : head.clone().addScaledVector(S.n, 5);
      // the camera stands back and to the right, so the child sits left of the panel and the float stays in view
      // on a portrait phone the view is narrow: stand further back and nearly straight behind
      const narrow = cam.aspect < 1;
      wantPos.copy(head).addScaledVector(S.n, (watch ? -2.0 : -3.0) - (narrow ? 1.0 : 0))
        .addScaledVector(S.side, narrow ? 0.45 : watch ? 1.3 : 1.7).setY(S.stand.y + (watch ? 2.3 : 2.7) + (narrow ? 0.5 : 0));
      wantLook.lerpVectors(head, focus, watch ? 0.8 : 0.6);
      wantLook.y -= 0.6;
    }
    if (camSnap) { camPos.copy(wantPos); camLook.copy(wantLook); camSnap = false; }
    const r = 1 - Math.exp(-(S.phase === 'jump' ? 3 : 4) * rawDt);
    camPos.lerp(wantPos, r);
    camLook.lerp(wantLook, 1 - Math.exp(-6 * rawDt));
    cam.position.copy(camPos);
    cam.lookAt(camLook);
  }

  // ---------------------------------------------------------------- wiring
  goBtn.addEventListener('click', start);
  jBtn.addEventListener('click', () => toggleJournal());
  hud.querySelector('.v2-fish-stop').addEventListener('click', stop);
  baitBtn.addEventListener('click', () => { if (S.phase === 'ready') { S.bait = S.bait === 'worm' ? 'dough' : 'worm'; updateBait(); } });
  actBtn.addEventListener('pointerdown', (e) => { actBtn.setPointerCapture(e.pointerId); press(); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) actBtn.addEventListener(ev, release);
  for (const b of hud.querySelectorAll('[data-lean]')) {
    const d = Number(b.dataset.lean);
    b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); setLean(d, true); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => setLean(d, false));
  }
  // holding the mouse on the view works like the action button
  const canvas = document.querySelector('#v2-canvas canvas');
  canvas?.addEventListener('pointerdown', (e) => { if (S.phase !== 'off' && e.button === 0) press(); });
  addEventListener('pointerup', () => { if (S.phase !== 'off') release(); });
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input,select,textarea')) return;
    if (e.code === 'KeyJ' && walk.enabled) toggleJournal();
    if (S.phase === 'off') { if (e.code === 'KeyF') start(); return; }
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'KeyF') { e.preventDefault(); if (S.phase === 'show') finishCatch(true); else press(); }
    else if (e.code === 'KeyA' || e.code === 'ArrowLeft') setLean(-1, true);
    else if (e.code === 'KeyD' || e.code === 'ArrowRight') setLean(1, true);
    else if (e.code === 'KeyB') baitBtn.click();
    else if (e.code === 'KeyR' && S.phase === 'show') finishCatch(false);
    else if (e.code === 'Escape') stop();
  });
  addEventListener('keyup', (e) => {
    if (S.phase === 'off') return;
    if (e.code === 'Space' || e.code === 'KeyF') release();
    else if (e.code === 'KeyA' || e.code === 'ArrowLeft') setLean(-1, false);
    else if (e.code === 'KeyD' || e.code === 'ArrowRight') setLean(1, false);
  });

  return {
    get active() { return S.phase !== 'off'; },
    /** slow motion during a jump, for the rest of the scene */
    get timeScale() { return S.slow; },
    state: S, start, stop, press, release, setLean, update, updateCamera, toggleJournal, canFishHere,
    finishCatch, get journal() { return journal; },
    /** more pages for the journal (the diary of the other activities) */
    setJournalExtra(fn) { journalExtra = fn; }, clearJournal() { journal = {entries: []}; saveJournal(journal); },
    /** test hooks: make the hooked fish jump now; skip the waiting */
    forceJump() { if (S.phase === 'fight' && fishModel) startJump(); },
    forceBite() { if (S.phase === 'wait' || S.phase === 'nibble') { S.nibblesLeft = 0; S.falseNibble = false; S.nextEvent = 0; setPhase('wait'); } },
    get fishPos() { return fishPos; },
  };
}
