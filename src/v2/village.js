// SmallVillage 2.0 village: loads the Blender export (public/models/v2) and assembles it with instancing.
//  - every kit asset is drawn as InstancedMeshes grouped in TILE x TILE metre tiles
//  - each tile picks its level of detail from the camera distance
//  - seasons swap the palette texture, leafy/bare tree geometry, crop colours and seasonal props
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {makeToon, toonUniforms} from './toon.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = '/models/v2/';
const TILE = 300;
// distance from the camera to the nearest edge of a tile: inside/next to the tile LOD0, < 450 m LOD1, beyond LOD2
let LOD_DIST = [40, 450];
let SMALL_CULL = 320;         // assets with a single LOD (props) disappear beyond this
let VIEW_DIST = Infinity;
// small details culled at a fraction of SMALL_CULL (props default to 1)
const SMALL_FAMILIES = {'field stake': 0.4, 'wellhead': 0.5, 'solar lamp': 1.0, 'well hut': 1.4};
let SHADOW_LOD = 2;           // tiles below this LOD cast shadows (phone tier: only full-detail tiles)
//     // phone tier: drop tiles beyond this (fog hides them), except horizon and sky pieces

function srgbByte(v) {
  v = Math.max(0, Math.min(1, v));
  return Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
}

function paletteTexture(pal, season) {
  const g = pal.grid;
  const data = new Uint8Array(g * g * 4);
  pal.seasons[season].forEach((c, i) => {
    const col = i % g, rowBlender = Math.floor(i / g);
    const row = g - 1 - rowBlender;  // glTF flips V; DataTexture row 0 is v = 0
    const o = (row * g + col) * 4;
    data[o] = srgbByte(c[0]); data[o + 1] = srgbByte(c[1]); data[o + 2] = srgbByte(c[2]); data[o + 3] = 255;
  });
  const t = new THREE.DataTexture(data, g, g, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

function slotRect(pal, slot) {
  const g = pal.grid, i = pal.slots.indexOf(slot);
  const col = i % g, row = g - 1 - Math.floor(i / g);
  return new THREE.Vector4(col / g, row / g, (col + 1) / g, (row + 1) / g);
}

export async function loadVillage(scene, {onProgress = () => {}} = {}) {
  const draco = new DRACOLoader().setDecoderPath('/draco/');
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const [data, assetsGltf, staticGltf] = await Promise.all([
    fetch(BASE + 'village.json').then(r => r.json()).then(d => { onProgress('layout'); return d; }),
    loader.loadAsync(BASE + 'assets.glb').then(g => { onProgress('assets'); return g; }),
    loader.loadAsync(BASE + 'static.glb').then(g => { onProgress('static'); return g; }),
  ]);
  const pal = data.palette;
  const textures = Object.fromEntries(Object.keys(pal.seasons).map(s => [s, paletteTexture(pal, s)]));
  toonUniforms.uWaterRect.value.copy(slotRect(pal, 'water'));
  const kitMat = makeToon({kind: 'palette', map: textures.summer});
  const kitMatSway = makeToon({kind: 'palette', map: textures.summer, sway: true});  // trees and crops in the wind
  const kitMatDry = makeToon({kind: 'palette', map: textures.summer, weather: false});  // creatures and props they carry

  // ---- kit geometries by asset name
  const geom = {};
  // GLTFLoader sanitises node names (spaces -> '_') and keeps the original in userData.name
  assetsGltf.scene.traverse(o => { if (o.isMesh) geom[o.userData.name || o.name] = o.geometry; });
  for (const g of Object.values(geom)) g.computeBoundingSphere();

  // ---- static meshes: terrain, ponds, fields, home quarter
  const statics = new THREE.Group();
  statics.name = 'static';
  const plain = [];
  const fieldMats = {};
  staticGltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const name = o.material?.name || '';
    if (name.startsWith('SV field')) {
      const kind = name.replace('SV field ', '');
      fieldMats[kind] ??= makeToon({kind: 'field', local: {uFieldA: {value: new THREE.Color()}, uFieldB: {value: new THREE.Color()}}});
      o.material = fieldMats[kind];
      o.userData.fieldKind = kind;
    } else if (name.startsWith('SV pond water')) {
      const pond = name.replace('SV pond water ', 'pond ');
      o.material = makeToon({kind: 'water', algae: data.ponds[pond]?.algae ?? 0.3});
    } else if (name.startsWith('SV kit palette')) {
      o.material = kitMat;
    } else {
      plain.push(o);  // merged below
      return;
    }
    o.castShadow = !name.startsWith('SV field');
    o.receiveShadow = true;
  });
  statics.add(staticGltf.scene);
  scene.add(statics);
  // Phase 9: the plain-coloured meshes (mostly the home quarter, about 70 of them) become one merged mesh per
  // opacity, with the colours baked into the vertices: some 140 draw calls (with shadows) become a few
  statics.updateMatrixWorld(true);
  const byOpacity = new Map();
  for (const o of plain) {
    const op = Math.round((o.material.opacity ?? 1) * 100) / 100;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(o.matrixWorld);
    const c = o.material.color, n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!byOpacity.has(op)) byOpacity.set(op, []);
    byOpacity.get(op).push(g);
    o.parent.remove(o);
  }
  for (const [op, list] of byOpacity) {
    const merged = mergeGeometries(list);
    const mat = makeToon({kind: 'color', opacity: op});
    mat.vertexColors = true;
    const m = new THREE.Mesh(merged, mat);
    m.name = `home quarter merged ${op}`;
    m.castShadow = op >= 1;
    m.receiveShadow = true;
    statics.add(m);
  }

  // ---- instanced assets, grouped by key and tile
  const groups = [];  // {key, tile, records, mesh, lod, center}
  const seasonalIdx = new Map();  // `${key}#${i}` -> months
  for (const [key, i, months] of data.seasonal) seasonalIdx.set(`${key}#${i}`, months);
  const instRoot = new THREE.Group();
  instRoot.name = 'instances';
  scene.add(instRoot);
  for (const [key, recs] of Object.entries(data.instances)) {
    const byTile = new Map();
    recs.forEach((r, i) => {
      const t = `${Math.floor(r[0] / TILE)},${Math.floor(r[2] / TILE)}`;
      if (!byTile.has(t)) byTile.set(t, []);
      byTile.get(t).push([r, i]);
    });
    for (const [t, list] of byTile) {
      const [tx, tz] = t.split(',').map(Number);
      groups.push({key, list, center: new THREE.Vector3((tx + 0.5) * TILE, 0, (tz + 0.5) * TILE), mesh: null, lod: -1, state: null});
    }
  }

  const asset = (key) => data.assets[key];
  const isCloud = (key) => key.startsWith('cloud');
  const swayKind = (key) => ['tree', 'crop'].includes(asset(key)?.kind);
  let month = 8;

  function stateFor(key) {
    const a = asset(key);
    if (!a) return '';
    const states = Object.keys(a.lods);
    if (states.length === 1) return states[0];
    for (const s of states) if ((a.months[s] || []).includes(month)) return s;
    return states.includes('leafy') ? 'leafy' : states[0];
  }

  function geometryFor(key, state, lod) {
    const a = asset(key);
    const lods = a?.lods[state] || a?.lods[Object.keys(a?.lods || {})[0]] || [];
    for (let l = Math.min(lod, lods.length - 1); l >= 0; l--) if (lods[l] && geom[lods[l]]) return {g: geom[lods[l]], l};
    return null;
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  let NEAR = 70;          // instances closer than this (in tiles next to the camera) use full detail
  const REPARTITION = 10; // re-split near/far instances after the camera moves this far

  function hidden(gp, i) {
    const months = seasonalIdx.get(`${gp.key}#${i}`);
    return months && !months.includes(month);
  }

  function compose(r) {
    p.set(r[0], r[1], r[2]);
    q.setFromEuler(e.set(0, r[3], 0));
    s.set(r[4], r[6], r[5]);  // Blender (sx, sy, sz) -> three (sx, sz, sy)
    return m4.compose(p, q, s);
  }

  function makeMesh(gp, g, name) {
    const kind = data.assets[gp.key]?.kind;
    const m = new THREE.InstancedMesh(g, kind === 'tree' || kind === 'crop' ? kitMatSway : kitMat, gp.list.length);
    m.name = `${gp.key} @ ${gp.center.x},${gp.center.z}${name}`;
    m.receiveShadow = true;
    instRoot.add(m);
    return m;
  }

  // fill a mesh with the instances accepted by `pick`; returns how many were written
  function fill(mesh, gp, pick) {
    let k = 0;
    gp.list.forEach(([r, i]) => {
      if (hidden(gp, i) || !pick(r)) return;
      mesh.setMatrixAt(k++, compose(r));
    });
    mesh.count = k;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.visible = k > 0;
    return k;
  }

  function update(gp, lod, camera, force) {
    const state = stateFor(gp.key);
    const nearMode = lod === 0;
    const far = geometryFor(gp.key, state, nearMode ? 1 : lod);
    if (!far) return;
    gp.mesh ??= makeMesh(gp, far.g, '');
    const moved = !gp.at || Math.hypot(camera.position.x - gp.at.x, camera.position.z - gp.at.z) > REPARTITION;
    const changed = force || gp.lod !== lod || gp.state !== state || (nearMode && moved);
    if (!changed) return;
    gp.mesh.geometry = far.g;
    if (nearMode) {
      const near = geometryFor(gp.key, state, 0);
      gp.near ??= makeMesh(gp, near.g, ' near');
      gp.near.geometry = near.g;
      const cx = camera.position.x, cz = camera.position.z;
      const isNear = (r) => Math.hypot(r[0] - cx, r[2] - cz) < NEAR;
      fill(gp.near, gp, isNear);
      fill(gp.mesh, gp, (r) => !isNear(r));
      gp.at = {x: cx, z: cz};
    } else {
      if (gp.near) gp.near.visible = false;
      fill(gp.mesh, gp, () => true);
      gp.at = null;
    }
    gp.lod = lod;
    gp.state = state;
  }

  // ---- Phase 9: batches for the far tiles, by LOD (1 casts shadows on the high tier, 2 does not) and material
  const signature = (g) => Object.keys(g.attributes).sort().join() + (g.index ? '+i' : '');
  const batches = new Map();  // `${lod}|${sway}` -> {bm, ids: Map(geometry -> geometryId), sig}
  function planBatches() {
    const need = new Map();  // batch key -> Set(geometry)
    for (const key of new Set(groups.map((g) => g.key))) {
      if (isCloud(key)) continue;
      const a = asset(key);
      if (!a) continue;
      for (const st of Object.keys(a.lods)) for (const lod of [1, 2]) {
        const f = geometryFor(key, st, lod);
        if (!f) continue;
        const bk = `${lod}|${swayKind(key)}`;
        if (!need.has(bk)) need.set(bk, new Set());
        need.get(bk).add(f.g);
      }
    }
    for (const [bk, set] of need) {
      const list = [...set];
      // the most common attribute layout wins; odd geometries stay on the instanced path
      const counts = new Map();
      for (const g of list) counts.set(signature(g), (counts.get(signature(g)) || 0) + 1);
      const sig = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const ok = list.filter((g) => signature(g) === sig);
      const verts = ok.reduce((n, g) => n + g.attributes.position.count, 0);
      const idx = ok.reduce((n, g) => n + (g.index ? g.index.count : 0), 0);
      const [lod, sway] = bk.split('|');
      const bm = new THREE.BatchedMesh(data.instancesTotal ?? 8192, verts, Math.max(idx, 1), sway === 'true' ? kitMatSway : kitMat);
      bm.name = `far batch lod${lod}${sway === 'true' ? ' sway' : ''}`;
      bm.sortObjects = false;
      bm.receiveShadow = true;
      bm.castShadow = Number(lod) < SHADOW_LOD;
      bm.userData.lod = Number(lod);
      const ids = new Map();
      for (const g of ok) ids.set(g, bm.addGeometry(g));
      instRoot.add(bm);
      batches.set(bk, {bm, ids, sig});
    }
  }
  data.instancesTotal = Object.values(data.instances).reduce((n, r) => n + r.length, 0) + 16;
  planBatches();

  function unbatch(gp) {
    if (!gp.b) return;
    for (const id of gp.b.ids) gp.b.batch.bm.deleteInstance(id);
    gp.b = null;
  }
  /** put a far tile into its batch; false when its geometry cannot be batched (it then stays instanced) */
  function batchTile(gp, lod, force) {
    if (isCloud(gp.key)) return false;
    const state = stateFor(gp.key);
    const f = geometryFor(gp.key, state, lod);
    const batch = f && batches.get(`${lod}|${swayKind(gp.key)}`);
    const gid = batch?.ids.get(f.g);
    if (gid === undefined) { unbatch(gp); return false; }
    if (gp.b && gp.b.lod === lod && gp.b.state === state && !force) return true;
    unbatch(gp);
    const ids = [];
    gp.list.forEach(([r, i]) => {
      if (hidden(gp, i)) return;
      const id = batch.bm.addInstance(gid);
      batch.bm.setMatrixAt(id, compose(r));
      ids.push(id);
    });
    gp.b = {batch, ids, lod, state};
    if (gp.mesh) gp.mesh.visible = false;
    if (gp.near) gp.near.visible = false;
    gp.lod = lod;
    gp.state = state;
    return true;
  }

  let lastCamera = null;
  function updateLod(camera, force = false) {
    lastCamera = camera;
    for (const gp of groups) {
      const d = Math.hypot(camera.position.x - gp.center.x, camera.position.z - gp.center.z) - TILE * 0.5;
      const lod = d < LOD_DIST[0] ? 0 : d < LOD_DIST[1] ? 1 : 2;
      const a = asset(gp.key);
      const single = a && Object.values(a.lods).every(l => l.length === 1);
      const smallFactor = SMALL_FAMILIES[a?.family] ?? (single && !['sky', 'building', 'infra', 'tree'].includes(a?.kind) ? 1 : null);
      const cull = (smallFactor !== null && d > SMALL_CULL * smallFactor) ||
        (d > VIEW_DIST && a?.kind !== 'sky');
      if (cull) {
        if (gp.mesh) gp.mesh.visible = false;
        if (gp.near) gp.near.visible = false;
        unbatch(gp);
        gp.lod = -1;
        continue;
      }
      if (lod >= 1 && batchTile(gp, lod, force)) continue;
      unbatch(gp);
      if (gp.lod >= 1 && !gp.mesh?.visible) gp.lod = -1;  // coming back from a batch: refill the instanced mesh
      update(gp, lod, camera, force);
      const shadows = lod < SHADOW_LOD && !isCloud(gp.key);  // distant tiles skip the shadow pass
      if (gp.mesh) gp.mesh.castShadow = shadows;
      if (gp.near) gp.near.castShadow = shadows;
    }
  }

  function setMonth(m) {
    month = m;
    const season = data.seasonOfMonth[String(m)];
    kitMat.map = kitMatSway.map = kitMatDry.map = textures[season];
    for (const [kind, mat] of Object.entries(fieldMats)) {
      const [a, b] = data.crops[kind][String(m)];
      const ca = pal.seasons[season][pal.slots.indexOf(a)], cb = pal.seasons[season][pal.slots.indexOf(b)];
      mat.userData.svUniforms.uFieldA.value.setRGB(ca[0], ca[1], ca[2], THREE.LinearSRGBColorSpace);
      mat.userData.svUniforms.uFieldB.value.setRGB(cb[0], cb[1], cb[2], THREE.LinearSRGBColorSpace);
    }
    if (lastCamera) updateLod(lastCamera, true);
    return season;
  }

  // ---- power wires as line strips
  const wireGeo = [];
  for (const pts of data.wires) {
    for (let i = 0; i + 5 < pts.length; i += 3) wireGeo.push(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], pts[i + 4], pts[i + 5]);
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wireGeo, 3));
  const wires = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({color: 0x1a1a1a}));
  wires.name = 'power wires';
  scene.add(wires);

  function setQuality(qs) {
    NEAR = qs.near;
    LOD_DIST = [40, qs.lod1];
    SMALL_CULL = qs.smallCull;
    VIEW_DIST = qs.viewDist ?? Infinity;
    SHADOW_LOD = qs.shadowLod ?? 2;
    for (const {bm} of batches.values()) bm.castShadow = bm.userData.lod < SHADOW_LOD;
    if (lastCamera) updateLod(lastCamera, true);
  }

  return {data, groups, updateLod, setMonth, setQuality, kitMat, kitMatSway, kitMatDry, geometryByName: (n) => geom[n],
    stats: () => ({groups: groups.length, live: groups.filter(g => g.mesh?.visible).length})};
}

// ---------------------------------------------------------------- sky, light and fog from the shared presets

export function createSky(scene, data) {
  const domeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {uH: {value: new THREE.Color()}, uM: {value: new THREE.Color()}, uZ: {value: new THREE.Color()}},
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vDir; uniform vec3 uH, uM, uZ;
      void main(){ float y = max(vDir.y, 0.0);
        vec3 c = y < 0.12 ? mix(uH, uM, smoothstep(0.0, 0.12, y)) : mix(uM, uZ, smoothstep(0.12, 0.62, y));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), domeMat);
  dome.name = 'sky dome';
  dome.renderOrder = -1;
  scene.add(dome);
  const sun = new THREE.DirectionalLight(0xffffff, 4.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -220; sc.right = sc.top = 220; sc.near = 10; sc.far = 1600;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);
  const amb = new THREE.AmbientLight(0xffffff, 1.4);
  scene.add(amb);
  scene.fog = new THREE.FogExp2(0xffffff, 0.0005);
  let sunDir = new THREE.Vector3(0, 1, 0);

  /** a preset by name, or a parameter set of the same shape (the climate model blends them) */
  function apply(name) {
    const P = typeof name === 'string' ? data.sky[name] : name;
    const lin = (c) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.LinearSRGBColorSpace);
    domeMat.uniforms.uH.value.copy(lin(P.horizon));
    domeMat.uniforms.uM.value.copy(lin(P.mid));
    domeMat.uniforms.uZ.value.copy(lin(P.zenith));
    const el = THREE.MathUtils.degToRad(P.sun_el), az = THREE.MathUtils.degToRad(P.sun_az);
    sunDir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    sun.color.copy(lin(P.sun));
    sun.intensity = P.sun_strength;
    amb.color.copy(lin(P.ambient));
    amb.intensity = Math.PI * P.ambient_strength;
    toonUniforms.uLit.value.copy(lin(P.lit));
    toonUniforms.uShadow.value.copy(lin(P.shadow));
    toonUniforms.uSkyHorizon.value.copy(lin(P.horizon));
    scene.fog.color.copy(lin(P.fog));
    scene.fog.density = P.fog_density * 0.55;
    return P;
  }

  function follow(camera) {
    dome.position.copy(camera.position);
    const c = camera.position;
    sun.target.position.set(c.x, 0, c.z);
    sun.position.copy(sun.target.position).addScaledVector(sunDir, 700);
  }
  return {apply, follow, dome, sun, amb, domeMat};
}

export function placeClouds(scene, village, presetName, density = 1, cloudKinds = null) {
  const old = scene.getObjectByName('clouds');
  if (old) scene.remove(old);
  const P = cloudKinds ? {clouds: cloudKinds} : village.data.sky[presetName];
  const grp = new THREE.Group();
  grp.name = 'clouds';
  // deterministic placement: a small seeded generator per preset
  let seed = [...presetName].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const names = {'cumulus': ['cloud cumulus 0', 'cloud cumulus 1', 'cloud cumulus 2'], 'cumulus tower': ['cloud tower 0', 'cloud tower 1'],
    'cumulus small': ['cloud small 0', 'cloud small 1', 'cloud small 2'], 'thunderhead': ['cloud thunderhead'],
    'stratus': ['cloud stratus 0'], 'cirrus': ['cloud cirrus 0', 'cloud cirrus 1']};
  const center = village.data.anchors.home.position;
  const geomOf = (key) => {
    const a = village.data.assets[key];
    return a && a.lods[''] ? a.lods[''][0] : null;
  };
  for (const kind of P.clouds) {
    const n = ['thunderhead', 'stratus'].includes(kind) ? 1 : Math.max(2, Math.round(7 * density));
    for (let i = 0; i < n; i++) {
      const key = names[kind][Math.floor(rnd() * names[kind].length)];
      const g = village.geometryByName(geomOf(key));
      if (!g) continue;
      const mesh = new THREE.Mesh(g, village.kitMat);
      const a = rnd() * Math.PI * 2, r = 900 + rnd() * 1700;
      const h = {stratus: 520, cirrus: 950, thunderhead: 120}[kind] ?? (260 + rnd() * 260);
      mesh.position.set(center[0] + Math.cos(a) * r, h, center[2] + Math.sin(a) * r);
      mesh.rotation.y = rnd() * 6.28;
      grp.add(mesh);
    }
  }
  scene.add(grp);
  return grp;
}
