// Crops scattered around the player at run time, at the growth stage of the chosen month.
// Field parcels and road corridors come from village.json. Placement uses a world-aligned grid with
// hash jitter, so plants stay put as the player moves; full detail near, LOD1 further out.
import * as THREE from 'three';

const CELL = 50;  // spatial index cell (m)

function hash(i, j, k = 0) {
  let h = (i * 374761393 + j * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// month -> kit asset per crop kind (mirrors crop_src in build_layout.py)
const WHEAT_MAIZE = {10: 'wheat seedling', 11: 'wheat seedling', 12: 'wheat winter', 1: 'wheat winter', 2: 'wheat winter',
  3: 'wheat jointing', 4: 'wheat jointing', 5: 'wheat ripe', 6: 'maize seedling', 7: 'maize knee', 8: 'maize tall', 9: 'maize dry'};

function cropAsset(kind, month, lod, variant) {
  if (kind === 'soybean' && [6, 7, 8, 9].includes(month)) return {name: 'KIT soybean L0', spacing: [0.5, 0.75]};
  if (kind === 'vegetables') return {name: 'KIT garlic L0', spacing: [0.32, 0.55]};
  const st = WHEAT_MAIZE[month];
  if (st.startsWith('maize')) return {name: `KIT ${st} ${variant} L${lod}`, spacing: [0.62, 0.85]};
  return {name: `KIT ${st} L${lod}`, spacing: [0.5, 0.8]};
}

export function createCrops(scene, village) {
  const fields = village.data.fields;  // [x0, z0, x1, z1, kind]
  const index = new Map();
  fields.forEach((f, n) => {
    for (let i = Math.floor(f[0] / CELL); i <= Math.floor(f[2] / CELL); i++)
      for (let j = Math.floor(f[1] / CELL); j <= Math.floor(f[3] / CELL); j++) {
        const k = `${i},${j}`;
        if (!index.has(k)) index.set(k, []);
        index.get(k).push(n);
      }
  });
  // road corridors (road + shoulder + tree line) as segments, indexed the same way
  const segs = [];
  for (const R of Object.values(village.data.roads)) {
    for (let i = 0; i + 1 < R.pts.length; i++) segs.push([...R.pts[i], ...R.pts[i + 1], R.width / 2]);
  }
  const segIndex = new Map();
  segs.forEach((s, n) => {
    const [ax, az, bx, bz, w] = s;
    const L = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.ceil(L / 20));
    for (let t = 0; t <= steps; t++) {
      const x = ax + (bx - ax) * t / steps, z = az + (bz - az) * t / steps;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const k = `${Math.floor(x / CELL) + di},${Math.floor(z / CELL) + dj}`;
        if (!segIndex.has(k)) segIndex.set(k, new Set());
        segIndex.get(k).add(n);
      }
    }
  });

  function fieldAt(x, z) {
    for (const n of index.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) || []) {
      const f = fields[n];
      if (x > f[0] + 0.3 && x < f[2] - 0.3 && z > f[1] + 0.3 && z < f[3] - 0.3) return f[4];
    }
    return null;
  }
  /** on a road, or within `margin` metres of its edge (2.4 m covers the shoulder and the tree line) */
  function onRoad(x, z, margin = 2.4) {
    for (const n of segIndex.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) || []) {
      const [ax, az, bx, bz, w] = segs[n];
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
      const t = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)) : 0;
      if (Math.hypot(x - ax - t * dx, z - az - t * dz) < w + margin) return true;
    }
    return false;
  }

  const root = new THREE.Group();
  root.name = 'crops near the player';
  scene.add(root);
  const pools = new Map();  // asset name -> InstancedMesh
  let at = null, month = -1, radii = [25, 60], cut = null;  // cut(x, z): harvested ground shows stubble
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

  function pool(name, need) {
    let m = pools.get(name);
    if (m && m.instanceMatrix.count >= need) return m;
    const g = village.geometryByName(name);
    if (!g) return null;
    if (m) { root.remove(m); m.dispose(); }
    m = new THREE.InstancedMesh(g, village.kitMatSway, Math.ceil(need * 1.3) + 64);  // crops ripple in the wind
    m.name = name;
    m.castShadow = false;  // thousands of small casters: shading alone reads well and saves the shadow pass
    m.receiveShadow = true;
    m.frustumCulled = false;
    pools.set(name, m);
    root.add(m);
    return m;
  }

  function regenerate(cx, cz) {
    const buckets = new Map();
    for (const lod of [0, 1]) {
      const r0 = lod === 0 ? 0 : radii[0], r1 = lod === 0 ? radii[0] : radii[1];
      // spacing depends on the crop; use the finest for the grid and thin per kind
      const step = lod === 0 ? 0.5 : 0.8;
      const i0 = Math.floor((cx - r1) / step), i1 = Math.ceil((cx + r1) / step);
      const j0 = Math.floor((cz - r1) / step), j1 = Math.ceil((cz + r1) / step);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const x = (i + hash(i, j, 1)) * step, z = (j + hash(i, j, 2)) * step;
        const d = Math.hypot(x - cx, z - cz);
        if (d < r0 || d >= r1) continue;
        const kind = fieldAt(x, z);
        if (!kind || onRoad(x, z)) continue;
        const a = cut?.(x, z) ? {name: `KIT wheat stubble L${lod}`, spacing: [0.5, 0.8]} : cropAsset(kind, month, lod, hash(i, j, 3) < 0.5 ? 0 : 1);
        const keep = (step * step) / (a.spacing[lod] * a.spacing[lod]);  // thin to the crop's own spacing
        if (hash(i, j, 4) > keep) continue;
        if (!buckets.has(a.name)) buckets.set(a.name, []);
        buckets.get(a.name).push(x, z, hash(i, j, 5) * 6.283, 0.85 + hash(i, j, 6) * 0.3);
      }
    }
    for (const m of pools.values()) { m.count = 0; m.visible = false; }  // empty pools cost no draw call
    for (const [name, arr] of buckets) {
      const m = pool(name, arr.length / 4);
      if (!m) continue;
      let k = 0;
      for (let n = 0; n < arr.length; n += 4) {
        p.set(arr[n], 0.02, arr[n + 1]);
        q.setFromAxisAngle(up, arr[n + 2]);
        s.setScalar(arr[n + 3]);
        m.setMatrixAt(k++, m4.compose(p, q, s));
      }
      m.count = k;
      m.visible = k > 0;
      m.instanceMatrix.needsUpdate = true;
    }
    at = {x: cx, z: cz};
  }

  return {
    update(camera, m, force = false) {
      const moved = !at || Math.hypot(camera.position.x - at.x, camera.position.z - at.z) > 6;
      if (m !== month) { month = m; force = true; }
      if (force || moved) regenerate(camera.position.x, camera.position.z);
    },
    setRadii(r) { radii = r; at = null; },
    fieldAt, onRoad,
    /** mark harvested ground (a predicate on x, z), or null; the crops around the player are rebuilt */
    setCut(fn) { cut = fn; at = null; },
    count: () => [...pools.values()].reduce((a, m) => a + m.count, 0),
  };
}
