// Village flowers and small plants, scattered around the player at run time (like the crops) and following the
// calendar: each kind has the months it is there (green) and the months it blooms. Hollyhocks, four o'clocks,
// balsams, roses and morning glories by the walls and gates; dandelions, 二月兰, cosmos, wild chrysanthemums
// and foxtail grass along the road shoulders and under the poplar rows; pots in the home courtyard; and a few
// flowering trees among the houses (peach, pear and the purple paulownia that marks a Henan spring).
// Plants are small procedural meshes with vertex colours, painted by the toon shader and moved by the wind.
import * as THREE from 'three';
import {makeToon} from './toon.js';
import {inside} from './fishing.js';

const CELL = 25;

function hash(i, j, k = 0) {
  let h = (i * 374761393 + j * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const inMonths = (m, [a, b]) => (a <= b ? m >= a && m <= b : m >= a || m <= b);

// ---------------------------------------------------------------- a tiny geometry builder (non-indexed, vertex colours)

class Builder {
  constructor(seed) { this.pos = []; this.nor = []; this.col = []; this.seed = seed; }
  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  add(geo, matrix, color) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(matrix);
    g.computeVertexNormals();
    const c = new THREE.Color(color);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      this.pos.push(p.getX(i), p.getY(i), p.getZ(i));
      this.nor.push(n.getX(i), n.getY(i), n.getZ(i));
      this.col.push(c.r, c.g, c.b);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
const mat4 = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => M.compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S1.set(sx, sy, sz)).clone();
const GREEN = 0x4f7a2c, DARK = 0x355a22, PALE = 0x7a9a3c;

function stem(b, x, z, h, color = GREEN, lean = 0, dir = 0, r = 0.009) {
  b.add(new THREE.CylinderGeometry(r * 0.7, r, h, 4).translate(0, h / 2, 0), mat4(x, 0, z, lean * Math.cos(dir), 0, lean * Math.sin(dir)), color);
}
function blob(b, x, y, z, r, color, sx = 1, sy = 1, sz = 1) { b.add(new THREE.IcosahedronGeometry(r, 0), mat4(x, y, z, 0, b.rnd() * 6, 0, sx, sy, sz), color); }
function disc(b, x, y, z, r, color, tilt = 0.3, dir = 0) { b.add(new THREE.CylinderGeometry(r, r * 0.85, r * 0.22, 7), mat4(x, y, z, tilt * Math.cos(dir), 0, tilt * Math.sin(dir)), color); }
function leaf(b, x, y, z, len, w, color, yaw, pitch) {
  b.add(new THREE.PlaneGeometry(w, len).translate(0, len / 2, 0), mat4(x, y, z, pitch, yaw, 0), color);
}

// ---------------------------------------------------------------- the kinds of plants (built bloom: true / false)

const build = {
  hollyhock: (petal) => (b, bloom) => {
    const n = 2 + Math.floor(b.rnd() * 2);
    for (let k = 0; k < n; k++) {
      const x = (b.rnd() - 0.5) * 0.3, z = (b.rnd() - 0.5) * 0.15, h = 1.3 + b.rnd() * 0.6;
      stem(b, x, z, h, GREEN, 0.06, b.rnd() * 6, 0.014);
      for (let i = 0; i < 4; i++) leaf(b, x, 0.15 + i * 0.25, z, 0.22, 0.2, DARK, b.rnd() * 6, 1.0);
      // big open cups all the way up the top half, buds at the tip
      if (bloom) for (let i = 0; i < 10; i++) disc(b, x + Math.sin(i * 2.4) * 0.07, h * (0.45 + i * 0.05), z + Math.cos(i * 2.4) * 0.07, 0.085 - i * 0.005, petal, 1.35, i * 2.4);
      else blob(b, x, h, z, 0.03, PALE);
    }
  },
  bush: (petal, size = 0.55, dots = 22, dot = 0.03) => (b, bloom) => {
    blob(b, 0, size * 0.55, 0, size * 0.6, DARK, 1, 0.85, 1);
    blob(b, size * 0.25, size * 0.45, 0.1, size * 0.4, GREEN);
    if (bloom) for (let i = 0; i < dots; i++) {
      const a = b.rnd() * 6.28, e = b.rnd() * 1.2, r = size * 0.62;
      blob(b, Math.cos(a) * Math.cos(e) * r, size * 0.55 + Math.sin(e) * r * 0.85, Math.sin(a) * Math.cos(e) * r, dot, petal);
    }
  },
  balsam: (petal) => (b, bloom) => {
    for (let k = 0; k < 4; k++) {
      const x = (b.rnd() - 0.5) * 0.25, z = (b.rnd() - 0.5) * 0.25, h = 0.35 + b.rnd() * 0.15;
      stem(b, x, z, h, 0x6a8a3a, 0.15, b.rnd() * 6, 0.012);
      for (let i = 0; i < 3; i++) leaf(b, x, h * (0.4 + i * 0.2), z, 0.12, 0.05, GREEN, b.rnd() * 6, 0.9);
      if (bloom) for (let i = 0; i < 3; i++) blob(b, x + (b.rnd() - 0.5) * 0.06, h * (0.5 + i * 0.18), z + (b.rnd() - 0.5) * 0.06, 0.028, petal);
    }
  },
  rose: (petal) => (b, bloom) => {
    blob(b, 0, 0.35, 0, 0.36, DARK, 1, 0.9, 1);
    for (let i = 0; i < 5; i++) stem(b, (b.rnd() - 0.5) * 0.3, (b.rnd() - 0.5) * 0.3, 0.7 + b.rnd() * 0.2, DARK, 0.25, b.rnd() * 6, 0.01);
    if (bloom) for (let i = 0; i < 9; i++) {
      const a = b.rnd() * 6.28;
      blob(b, Math.cos(a) * 0.3, 0.45 + b.rnd() * 0.3, Math.sin(a) * 0.3, 0.045, petal, 1, 0.8, 1);
    }
  },
  vine: (petal) => (b, bloom) => {
    // a morning glory climbing the wall (the plant's +Z faces away from the wall)
    for (let k = 0; k < 3; k++) {
      const x = (k - 1) * 0.35 + (b.rnd() - 0.5) * 0.1, top = 1.2 + b.rnd() * 0.7;
      b.add(new THREE.CylinderGeometry(0.006, 0.008, top, 3).translate(0, top / 2, 0), mat4(x, 0, 0.03, 0, 0, (b.rnd() - 0.5) * 0.3), DARK);
      for (let y = 0.2; y < top; y += 0.12) {
        const lx = x + Math.sin(y * 9 + k) * 0.12;
        leaf(b, lx, y, 0.05, 0.1, 0.1, b.rnd() < 0.5 ? GREEN : DARK, (b.rnd() - 0.5) * 0.8, -0.2);
        if (bloom && b.rnd() < 0.35) {
          b.add(new THREE.ConeGeometry(0.045, 0.07, 6).rotateX(-Math.PI / 2), mat4(lx + 0.04, y + 0.03, 0.09), petal);
          blob(b, lx + 0.04, y + 0.03, 0.06, 0.012, 0xf4f0e8);
        }
      }
    }
  },
  iris: (b, bloom) => {
    for (let i = 0; i < 9; i++) leaf(b, (b.rnd() - 0.5) * 0.2, 0, (b.rnd() - 0.5) * 0.2, 0.45 + b.rnd() * 0.15, 0.035, GREEN, b.rnd() * 6, 0.15 + b.rnd() * 0.2);
    if (bloom) for (let k = 0; k < 4; k++) {
      const x = (b.rnd() - 0.5) * 0.25, z = (b.rnd() - 0.5) * 0.25, h = 0.5 + b.rnd() * 0.15;
      stem(b, x, z, h, GREEN, 0.05, b.rnd() * 6, 0.006);
      blob(b, x, h + 0.03, z, 0.045, 0x6a48c8, 1, 1.3, 1);
      blob(b, x, h, z, 0.03, 0xe8d050, 1.2, 0.5, 1.2);
    }
  },
  peony: (b, bloom) => {
    blob(b, 0, 0.35, 0, 0.38, GREEN, 1.1, 0.75, 1.1);
    blob(b, 0.15, 0.3, -0.1, 0.3, DARK);
    if (bloom) for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + b.rnd() * 0.4;
      blob(b, Math.cos(a) * 0.3, 0.55 + b.rnd() * 0.12, Math.sin(a) * 0.3, 0.085, i % 3 ? 0xf2a0c0 : 0xe05888, 1, 0.8, 1);
    }
  },
  cockscomb: (b, bloom) => {
    for (let k = 0; k < 3; k++) {
      const x = (b.rnd() - 0.5) * 0.25, z = (b.rnd() - 0.5) * 0.25, h = 0.4 + b.rnd() * 0.2;
      stem(b, x, z, h, 0x6a7a2a, 0.08, b.rnd() * 6, 0.014);
      leaf(b, x, h * 0.3, z, 0.15, 0.06, GREEN, b.rnd() * 6, 0.9);
      if (bloom) blob(b, x, h + 0.04, z, 0.07, 0xb8142c, 1.4, 0.8, 0.5);
    }
  },
  sunflower: (b, bloom) => {
    const h = 1.6 + b.rnd() * 0.4;
    stem(b, 0, 0, h, 0x5a7a2a, 0.04, 0, 0.022);
    for (let i = 0; i < 5; i++) leaf(b, 0, 0.3 + i * 0.25, 0, 0.26, 0.24, GREEN, i * 2.2, 1.1);
    if (bloom) {
      disc(b, 0, h, 0.06, 0.2, 0xf0b81c, 1.2, Math.PI / 2);
      disc(b, 0, h, 0.09, 0.11, 0x5a3a18, 1.2, Math.PI / 2);
    } else blob(b, 0, h, 0.04, 0.08, PALE);
  },
  tuft: (petal, h = 0.3, n = 10, dot = 0.02, leafC = GREEN) => (b, bloom) => {
    for (let i = 0; i < 6; i++) leaf(b, 0, 0, 0, 0.14 + b.rnd() * 0.08, 0.04, leafC, b.rnd() * 6, 1.15);
    for (let k = 0; k < n; k++) {
      const x = (b.rnd() - 0.5) * 0.3, z = (b.rnd() - 0.5) * 0.3, hh = h * (0.6 + b.rnd() * 0.6);
      stem(b, x, z, hh, leafC, 0.15, b.rnd() * 6, 0.005);
      if (bloom) disc(b, x, hh, z, dot, petal, 0.2, b.rnd() * 6);
    }
  },
  cosmos: (petal) => (b, bloom) => {
    for (let k = 0; k < 5; k++) {
      const x = (b.rnd() - 0.5) * 0.4, z = (b.rnd() - 0.5) * 0.4, h = 0.7 + b.rnd() * 0.5;
      stem(b, x, z, h, 0x6a9a3a, 0.12, b.rnd() * 6, 0.006);
      for (let i = 0; i < 3; i++) leaf(b, x, h * (0.3 + i * 0.2), z, 0.1, 0.02, GREEN, b.rnd() * 6, 0.9);
      if (bloom) { disc(b, x, h, z, 0.05, petal, 0.35, b.rnd() * 6); blob(b, x, h + 0.01, z, 0.013, 0xe8b020); }
    }
  },
  foxtail: (b, bloom) => {
    for (let k = 0; k < 9; k++) {
      const x = (b.rnd() - 0.5) * 0.35, z = (b.rnd() - 0.5) * 0.35, h = 0.35 + b.rnd() * 0.3, d = b.rnd() * 6;
      stem(b, x, z, h, 0x7a9a40, 0.3, d, 0.004);
      leaf(b, x, 0, z, 0.2, 0.025, GREEN, b.rnd() * 6, 0.7);
      if (bloom) b.add(new THREE.CapsuleGeometry(0.014, 0.07, 2, 4).translate(0, h + 0.03, 0), mat4(x, 0, z, 0.3 * Math.cos(d), 0, 0.3 * Math.sin(d)), 0xb8b878);
    }
  },
  pot: (petal) => (b, bloom) => {
    b.add(new THREE.CylinderGeometry(0.16, 0.11, 0.24, 9).translate(0, 0.12, 0), mat4(0, 0, 0), 0xa0502c);
    blob(b, 0, 0.36, 0, 0.17, DARK, 1, 0.8, 1);
    if (bloom) for (let i = 0; i < 10; i++) { const a = i * 0.63; blob(b, Math.cos(a) * 0.14, 0.4 + (i % 3) * 0.05, Math.sin(a) * 0.14, 0.04, petal); }
  },
  wintersweet: (b, bloom) => {
    for (let k = 0; k < 6; k++) stem(b, (b.rnd() - 0.5) * 0.3, (b.rnd() - 0.5) * 0.3, 1.1 + b.rnd() * 0.5, 0x5a4630, 0.35, b.rnd() * 6, 0.014);
    if (bloom) for (let i = 0; i < 26; i++) { const a = b.rnd() * 6.28, r = 0.15 + b.rnd() * 0.35; blob(b, Math.cos(a) * r, 0.5 + b.rnd() * 1.0, Math.sin(a) * r, 0.025, 0xf0d040); }
  },
  tree: (bloomC, leafC, bareOK = true) => (b, state) => {
    // a small village tree: a crooked trunk, a few limbs and a rounded crown; state 'bloom' | 'leaf' | 'bare'
    const h = 2.4 + b.rnd() * 0.8;
    b.add(new THREE.CylinderGeometry(0.08, 0.13, h, 6).translate(0, h / 2, 0), mat4(0, 0, 0, 0.05, 0, 0.04), 0x5a4632);
    for (let i = 0; i < 4; i++) {
      const a = i * 1.6 + b.rnd();
      b.add(new THREE.CylinderGeometry(0.03, 0.06, 1.2, 5).translate(0, 0.6, 0), mat4(0, h * 0.75, 0, 0.7 * Math.cos(a), 0, 0.7 * Math.sin(a)), 0x5a4632);
    }
    if (state === 'bare' && bareOK) return;
    const c = state === 'bloom' ? bloomC : leafC;
    for (let i = 0; i < 7; i++) {
      const a = b.rnd() * 6.28, r = 0.6 + b.rnd() * 0.6;
      blob(b, Math.cos(a) * r, h + 0.3 + b.rnd() * 0.9, Math.sin(a) * r, 0.55 + b.rnd() * 0.3, c, 1, 0.8, 1);
    }
    if (state === 'bloom' && leafC) for (let i = 0; i < 3; i++) blob(b, (b.rnd() - 0.5) * 1.2, h + 0.5 + b.rnd() * 0.6, (b.rnd() - 0.5) * 1.2, 0.35, leafC);
  },
};

// sites: wall (by walls and gates), yard (the home courtyard), shoulder (road edges), under (under the poplar rows), tree
const SPECIES = [
  {id: 'hollyhock pink', zh: '蜀葵', at: {wall: 2}, present: [4, 10], bloom: [5, 7], make: build.hollyhock(0xe9779e)},
  {id: 'hollyhock red', zh: '蜀葵', at: {wall: 1}, present: [4, 10], bloom: [5, 7], make: build.hollyhock(0xc8283a)},
  {id: 'hollyhock white', zh: '蜀葵', at: {wall: 1}, present: [4, 10], bloom: [5, 7], make: build.hollyhock(0xf2ece0)},
  {id: 'four o\'clock', zh: '紫茉莉', at: {wall: 3, yard: 1}, present: [5, 10], bloom: [6, 10], make: build.bush(0xd02080)},
  {id: 'balsam', zh: '凤仙花', at: {wall: 2, yard: 2}, present: [5, 9], bloom: [6, 9], make: build.balsam(0xef5f8c)},
  {id: 'rose', zh: '月季', at: {wall: 2, yard: 2}, present: [3, 11], bloom: [4, 10], make: build.rose(0xc81e3c)},
  {id: 'rose pink', zh: '月季', at: {wall: 1, yard: 1}, present: [3, 11], bloom: [4, 10], make: build.rose(0xf08aa8)},
  {id: 'morning glory', zh: '牵牛花', at: {wall: 2}, present: [5, 10], bloom: [6, 10], make: build.vine(0x6a5ae0), facing: true},
  {id: 'morning glory pink', zh: '牵牛花', at: {wall: 1}, present: [5, 10], bloom: [6, 10], make: build.vine(0xe060b0), facing: true},
  {id: 'iris', zh: '鸢尾', at: {wall: 2, yard: 1}, present: [3, 8], bloom: [4, 5], make: build.iris},
  {id: 'peony', zh: '芍药', at: {yard: 2, wall: 1}, present: [3, 9], bloom: [4, 5], make: build.peony},
  {id: 'cockscomb', zh: '鸡冠花', at: {yard: 1, wall: 1}, present: [6, 10], bloom: [7, 10], make: build.cockscomb},
  {id: 'sunflower', zh: '向日葵', at: {wall: 1}, present: [5, 9], bloom: [7, 9], make: build.sunflower},
  {id: 'dandelion', zh: '蒲公英', at: {shoulder: 3, under: 2}, present: [3, 10], bloom: [3, 5], make: build.tuft(0xf2c41c, 0.12, 5, 0.022)},
  {id: 'february orchid', zh: '二月兰', at: {under: 6, shoulder: 1}, present: [2, 5], bloom: [3, 4], make: build.tuft(0x9a78d8, 0.32, 12, 0.02)},
  {id: 'wild chrysanthemum', zh: '野菊', at: {shoulder: 3, under: 1}, present: [5, 11], bloom: [9, 11], make: build.tuft(0xf0c020, 0.4, 14, 0.018)},
  {id: 'cosmos pink', zh: '格桑花', at: {shoulder: 2}, present: [5, 10], bloom: [6, 10], make: build.cosmos(0xf08ab8)},
  {id: 'cosmos magenta', zh: '格桑花', at: {shoulder: 1}, present: [5, 10], bloom: [6, 10], make: build.cosmos(0xc8207a)},
  {id: 'cosmos white', zh: '格桑花', at: {shoulder: 1}, present: [5, 10], bloom: [6, 10], make: build.cosmos(0xf6f0ec)},
  {id: 'bindweed', zh: '打碗花', at: {shoulder: 3, under: 1}, present: [4, 9], bloom: [5, 8], make: build.tuft(0xf4c0d8, 0.18, 7, 0.032, 0x5f8a34)},
  {id: 'vetch', zh: '野豌豆', at: {shoulder: 2, under: 2}, present: [3, 7], bloom: [4, 6], make: build.tuft(0x8a3ab8, 0.28, 12, 0.016, 0x5a8a30)},
  {id: 'foxtail', zh: '狗尾草', at: {shoulder: 4, under: 2}, present: [6, 10], bloom: [7, 10], make: build.foxtail},
  {id: 'chrysanthemum pot', zh: '菊花', at: {yard: 2}, present: [9, 12], bloom: [10, 11], make: build.pot(0xf0c030)},
  {id: 'chrysanthemum pot white', zh: '菊花', at: {yard: 1}, present: [9, 12], bloom: [10, 11], make: build.pot(0xf4efe4)},
  {id: 'wintersweet', zh: '腊梅', at: {yard: 1}, present: [1, 12], bloom: [12, 2], make: build.wintersweet},
  {id: 'paulownia', zh: '泡桐', tree: true, scale: 2.6, at: {tree: 3}, present: [1, 12], bloom: [4, 4], leaf: [5, 10], make: build.tree(0xa98ad8, null)},
  {id: 'peach', zh: '桃花', tree: true, scale: 1.2, at: {tree: 2}, present: [1, 12], bloom: [3, 4], leaf: [5, 10], make: build.tree(0xf2a2c0, 0x6a9a3a)},
  {id: 'pear', zh: '梨花', tree: true, scale: 1.4, at: {tree: 2}, present: [1, 12], bloom: [3, 4], leaf: [5, 10], make: build.tree(0xf8f6ee, 0x5f8a34)},
];
// how often a site carries a plant at all
const DENSITY = {wall: 0.42, yard: 0.75, shoulder: 0.3, under: 0.4, tree: 1};

export function createFlora(scene, village, crops) {
  const data = village.data, ground = data.nav.ground;
  const HOME = [-37.2, 101.8, -24.8, 117.3];
  const ponds = Object.values(data.pondShapes || {}).map((p) => p.outline);

  // ---- box grid for "is this point inside something"
  const bgrid = new Map();
  for (const b of data.nav.boxes) {
    const R = Math.hypot(b[2], b[3]);
    for (let gx = Math.floor((b[0] - R) / 10); gx <= Math.floor((b[0] + R) / 10); gx++)
      for (let gz = Math.floor((b[1] - R) / 10); gz <= Math.floor((b[1] + R) / 10); gz++) {
        const k = gx * 100003 + gz;
        if (!bgrid.has(k)) bgrid.set(k, []);
        bgrid.get(k).push(b);
      }
  }
  const solid = (x, z, pad) => (bgrid.get(Math.floor(x / 10) * 100003 + Math.floor(z / 10)) || []).some((b) => {
    if ((b[6] ?? 100) < ground + 0.3) return false;  // kerbs and steps do not count
    const c = Math.cos(b[4]), s = Math.sin(b[4]);
    const lx = c * (x - b[0]) - s * (z - b[1]), lz = s * (x - b[0]) + c * (z - b[1]);
    return Math.abs(lx) < b[2] + pad && Math.abs(lz) < b[3] + pad;
  });
  const wet = (x, z) => ponds.some((o) => inside([x, z], o));

  // ---- sites: [x, z, yaw, type] in a grid
  const TYPES = ['wall', 'yard', 'shoulder', 'under', 'tree'];
  const sites = new Map();
  let nSites = 0;
  function addSite(x, z, yaw, type) {
    const k = Math.floor(x / CELL) * 100003 + Math.floor(z / CELL);
    if (!sites.has(k)) sites.set(k, []);
    sites.get(k).push(x, z, yaw, TYPES.indexOf(type));
    nSites++;
  }
  // by the walls: every face of the boxes that stand on the ground (courtyard walls, house walls, gatehouses)
  for (const b of data.nav.boxes) {
    const [cx, cz, hx, hz, a, low = -100, high = 100] = b;
    if (low > ground + 0.6 || high < ground + 1.4 || Math.max(hx, hz) < 0.6 || Math.max(hx, hz) > 25) continue;
    const c = Math.cos(a), s = Math.sin(a);
    const X = [c, -s], Z = [s, c];  // the box's local axes in world space (inverse of the walk controller's transform)
    // four faces: along local x at z = ±hz, along local z at x = ±hx
    for (const [along, normal, half, depth] of [[X, Z, hx, hz], [Z, X, hz, hx]]) {
      if (half < 0.6) continue;
      for (let t = -half + 0.4; t < half - 0.3; t += 0.9) for (const side of [-1, 1]) {
        const off = depth + 0.28;
        const x = cx + along[0] * t + normal[0] * off * side, z = cz + along[1] * t + normal[1] * off * side;
        if (solid(x, z, 0.12) || crops.onRoad(x, z, 0.3) || wet(x, z)) continue;
        const yaw = Math.atan2(normal[0] * side, normal[1] * side);  // plant +Z away from the wall
        const inHome = x > HOME[0] && x < HOME[2] && z > HOME[1] && z < HOME[3];
        addSite(x, z, yaw, inHome ? 'yard' : 'wall');
        // now and then a flowering tree a little way out from a wall among the houses
        if (!inHome && hash(Math.round(x * 3), Math.round(z * 3), 9) < 0.01) {
          const tx = x + normal[0] * side * 1.8, tz = z + normal[1] * side * 1.8;
          if (!solid(tx, tz, 1.0) && !crops.onRoad(tx, tz, 1.0) && !wet(tx, tz)) addSite(tx, tz, 0, 'tree');
        }
      }
    }
  }
  // road shoulders and the strip under the poplar rows
  for (const R of Object.values(data.roads)) {
    for (let i = 0; i + 1 < R.pts.length; i++) {
      const [ax, az] = R.pts[i], [bx, bz] = R.pts[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 0.1) continue;
      const dx = (bx - ax) / L, dz = (bz - az) / L;
      for (let t = 0; t < L; t += 0.8) for (const side of [-1, 1]) {
        const h = hash(Math.round(ax + t * 7), Math.round(az + side * 13), i);
        const under = R.width >= 5 && h < 0.45;
        const off = R.width / 2 + (under ? 1.8 + h * 2.6 : 0.35 + h * 1.6);
        const x = ax + dx * t - dz * off * side, z = az + dz * t + dx * off * side;
        if (solid(x, z, 0.1) || wet(x, z) || crops.onRoad(x, z, 0.2)) continue;
        addSite(x, z, 0, under ? 'under' : 'shoulder');
      }
    }
  }

  // ---- geometry per species and state, one InstancedMesh each
  const mat = makeToon({kind: 'color', sway: true});
  mat.vertexColors = true;
  const root = new THREE.Group();
  root.name = 'flowers near the player';
  scene.add(root);
  const geoms = new Map(), pools = new Map();
  function geomFor(sp, state) {
    const key = `${sp.id}|${state}`;
    if (!geoms.has(key)) {
      const b = new Builder(1 + [...sp.id].reduce((a, c) => a + c.charCodeAt(0), 0) * 97);
      sp.make(b, sp.tree ? state : state === 'bloom');
      geoms.set(key, b.pos.length ? b.geometry() : null);
    }
    return geoms.get(key);
  }
  function pool(key, g, need) {
    let m = pools.get(key);
    if (m && m.instanceMatrix.count >= need) return m;
    if (m) { root.remove(m); m.dispose(); }
    m = new THREE.InstancedMesh(g, mat, Math.ceil(need * 1.4) + 32);
    m.name = key;
    m.frustumCulled = false;
    m.receiveShadow = true;
    m.castShadow = key.startsWith('paulownia') || key.startsWith('peach') || key.startsWith('pear') || key.startsWith('sunflower') || key.startsWith('hollyhock');
    pools.set(key, m);
    root.add(m);
    return m;
  }
  function stateOf(sp, month) {
    if (!inMonths(month, sp.present)) return null;
    if (inMonths(month, sp.bloom)) return 'bloom';
    if (sp.tree) return inMonths(month, sp.leaf) ? 'leaf' : 'bare';
    return 'leaf';
  }

  let at = null, month = -1, radius = 55;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function regenerate(cx, cz) {
    const buckets = new Map();
    // which species can grow at each kind of site this month, with their weights
    const choice = TYPES.map((t) => SPECIES.map((sp) => [sp, stateOf(sp, month), sp.at[t] || 0]).filter(([, st, w]) => st && w > 0));
    const totals = choice.map((list) => list.reduce((a, [, , w]) => a + w, 0));
    const r = radius;
    for (let gx = Math.floor((cx - r) / CELL); gx <= Math.floor((cx + r) / CELL); gx++)
      for (let gz = Math.floor((cz - r) / CELL); gz <= Math.floor((cz + r) / CELL); gz++) {
        const list = sites.get(gx * 100003 + gz);
        if (!list) continue;
        for (let i = 0; i < list.length; i += 4) {
          const x = list[i], z = list[i + 1], ti = list[i + 3];
          if (Math.hypot(x - cx, z - cz) > (TYPES[ti] === 'tree' ? r * 2 : r)) continue;
          // plants grow in patches: some stretches of wall are lush, others bare
          const patch = hash(Math.floor(x / 5), Math.floor(z / 5), 11);
          const h = hash(Math.round(x * 10), Math.round(z * 10), 3);
          if (h > DENSITY[TYPES[ti]] * (TYPES[ti] === 'tree' ? 1 : 0.25 + 1.3 * patch) || !totals[ti]) continue;
          // pick the species from the site's own hash, so it stays the same plant all year
          let w = hash(Math.round(x * 10), Math.round(z * 10), 7) * totals[ti];
          let pick = null;
          for (const c of choice[ti]) { w -= c[2]; if (w <= 0) { pick = c; break; } }
          if (!pick) continue;
          const [sp, st] = pick;
          const key = `${sp.id}|${st}`;
          if (!buckets.has(key)) buckets.set(key, [sp, st, []]);
          const yaw = sp.facing ? list[i + 2] : hash(Math.round(x * 10), Math.round(z * 10), 5) * 6.283;
          buckets.get(key)[2].push(x, z, yaw, (sp.scale ?? 1) * (0.8 + hash(Math.round(x * 10), Math.round(z * 10), 6) * 0.45));
        }
      }
    for (const m of pools.values()) { m.count = 0; m.visible = false; }
    for (const [key, [sp, st, arr]] of buckets) {
      const g = geomFor(sp, st);
      if (!g) continue;
      const m = pool(key, g, arr.length / 4);
      let k = 0;
      for (let n = 0; n < arr.length; n += 4) {
        p.set(arr[n], ground + 0.01, arr[n + 1]);
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
    root, sites: () => nSites, SPECIES,
    setRadius(r) { radius = r; at = null; },
    count: () => [...pools.values()].reduce((a, m) => a + (m.visible ? m.count : 0), 0),
    update(camera, m) {
      const moved = !at || Math.hypot(camera.position.x - at.x, camera.position.z - at.z) > 8;
      if (m !== month) { month = m; at = null; }
      if (!at || moved) regenerate(camera.position.x, camera.position.z);
    },
  };
}
