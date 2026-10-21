// Lights at night: the village lanes get small solar street lamps and the power poles inside the village get a
// lamp arm (both are kit assets); after dusk their heads glow (the toon shader lights the palette's lamp cell),
// with a soft halo and a warm pool of light on the ground beneath.
import * as THREE from 'three';
import {toonUniforms} from './toon.js';

const LANE_STEP = 30;  // metres between lamps along a lane

function inBox(b, x, z, pad) {
  const [cx, cz, hx, hz, a] = b, c = Math.cos(a), s = Math.sin(a);
  const lx = c * (x - cx) - s * (z - cz), lz = s * (x - cx) + c * (z - cz);
  return Math.abs(lx) < hx + pad && Math.abs(lz) < hz + pad;
}

/** add lamps to the instance lists (called before the village groups its instances) */
export function prepareLamps(data) {
  const boxes = data.nav.boxes;
  const free = (x, z) => !boxes.some((b) => Math.abs(b[0] - x) < 30 && Math.abs(b[1] - z) < 30 && inBox(b, x, z, 0.5));
  const solar = (data.instances['solar lamp'] ||= []);
  const y = solar[0]?.[1] ?? 0;
  let added = 0;
  // solar lamps along the village lanes, alternating sides
  for (const [name, R] of Object.entries(data.roads)) {
    if (!name.startsWith('lane')) continue;
    let carry = LANE_STEP / 2, side = 1;
    for (let i = 0; i + 1 < R.pts.length; i++) {
      const [ax, az] = R.pts[i], [bx, bz] = R.pts[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 1e-3) continue;
      const dx = (bx - ax) / L, dz = (bz - az) / L;
      for (let t = carry; t < L; t += LANE_STEP) {
        const off = R.width / 2 + 0.7;
        const x = ax + dx * t - dz * off * side, z = az + dz * t + dx * off * side;
        if (free(x, z)) { solar.push([x, y, z, Math.atan2(dx, dz) + (side > 0 ? 0 : Math.PI), 1, 1, 1]); added++; }
        side = -side;
        carry = t + LANE_STEP - L;
      }
      if (carry < 0) carry = 0;
    }
  }
  // every second power pole near the houses carries a lamp
  const plots = [];
  for (const [key, recs] of Object.entries(data.instances)) if (key.startsWith('plot ')) for (const r of recs) plots.push([r[0], r[2]]);
  const poles = data.instances['utility pole'] || [];
  const keep = [], lamps = (data.instances['utility pole lamp'] ||= []);
  let k = 0;
  for (const r of poles) {
    const nearHouses = plots.some(([px, pz]) => Math.hypot(px - r[0], pz - r[2]) < 45);
    if (nearHouses && k++ % 2 === 0) lamps.push(r); else keep.push(r);
  }
  data.instances['utility pole'] = keep;
  data.lampsAdded = {lane: added, poles: lamps.length};
}

function radialTexture(inner = 'rgba(255,220,150,1)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, inner);
  r.addColorStop(0.35, 'rgba(255,200,120,0.45)');
  r.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createNightLights(scene, village) {
  const data = village.data;
  const rect = toonUniforms.uLampRect.value;
  // where the glowing head of each lamp asset is: the centre of its lamp-coloured faces
  function headOf(name) {
    const g = village.geometryByName(name);
    if (!g) return new THREE.Vector3(0, 4, 0);
    const p = g.attributes.position, uv = g.attributes.uv;
    const sum = new THREE.Vector3();
    let n = 0;
    for (let i = 0; i < p.count; i++) {
      const u = uv?.getX(i), v = uv?.getY(i);
      if (uv && u > rect.x && u < rect.z && v > rect.y && v < rect.w) { sum.x += p.getX(i); sum.y += p.getY(i); sum.z += p.getZ(i); n++; }
    }
    if (n) return sum.divideScalar(n);
    g.computeBoundingBox();
    return new THREE.Vector3(0, g.boundingBox.max.y - 0.2, 0);
  }
  const heads = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const [key, geo] of [['solar lamp', 'KIT solar lamp L0'], ['utility pole lamp', 'KIT utility pole lamp L0']]) {
    const local = headOf(geo);
    for (const r of data.instances[key] || []) {
      m4.compose(new THREE.Vector3(r[0], r[1], r[2]), q.setFromEuler(e.set(0, r[3], 0)), new THREE.Vector3(r[4], r[6], r[5]));
      heads.push(local.clone().applyMatrix4(m4));
    }
  }
  // halos
  const pos = new Float32Array(heads.length * 3);
  heads.forEach((h, i) => pos.set([h.x, h.y, h.z], i * 3));
  const hg = new THREE.BufferGeometry();
  hg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const halo = new THREE.Points(hg, new THREE.PointsMaterial({size: 2.2, map: radialTexture(), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, color: 0xffd9a0}));
  halo.frustumCulled = false;
  // pools of light on the ground
  const pool = new THREE.InstancedMesh(new THREE.CircleGeometry(4.2, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({map: radialTexture('rgba(255,214,150,0.9)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd090}),
    heads.length);
  const ground = data.nav.ground;
  heads.forEach((h, i) => { m4.makeTranslation(h.x, ground + 0.04, h.z); pool.setMatrixAt(i, m4); });
  pool.renderOrder = 1;
  pool.frustumCulled = false;
  halo.visible = pool.visible = false;
  scene.add(halo, pool);
  return {
    count: heads.length,
    heads,
    update(glow) {
      const on = glow > 0.02;
      halo.visible = pool.visible = on;
      if (!on) return;
      halo.material.opacity = 0.85 * glow;
      pool.material.opacity = 0.45 * glow;
    },
  };
}
