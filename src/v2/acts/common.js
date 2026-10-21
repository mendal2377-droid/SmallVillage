// Small helpers shared by the village activities: toon materials, particles, a smoothed camera, kit props,
// the child's hands and the nearest pond edge.
import * as THREE from 'three';
import {makeToon} from '../toon.js';
import {closestEdge, inside} from '../fishing.js';

export const rnd = Math.random;
export const {clamp, damp, lerp} = THREE.MathUtils;

const colorMats = new Map();
/** a painted (toon) material of one colour, shared */
export function toon(hex) {
  if (!colorMats.has(hex)) colorMats.set(hex, makeToon({kind: 'color', color: new THREE.Color(hex)}));
  return colorMats.get(hex);
}
/** an unlit glowing material (flames, sparks, flashes) */
export function glow(hex, opacity = 0.9) {
  return new THREE.MeshBasicMaterial({color: hex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending});
}

let dotTexture = null;
/** a soft round dot, so particles are puffs and sparks rather than squares */
function softDot() {
  if (dotTexture) return dotTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  dotTexture = new THREE.CanvasTexture(c);
  return dotTexture;
}

/**
 * A pool of point particles. Additive pools fade by dimming their colour; plain ones (smoke, paper, chaff)
 * shrink out of existence when their life ends.
 */
export function particles(scene, {n = 120, color = 0xffffff, size = 0.08, additive = false, opacity = 0.9, gravity = -9.8, drag = 0, floor = -Infinity, stay = 0} = {}) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), vel = new Float32Array(n * 3), life = new Float32Array(n), max = new Float32Array(n);
  const base = new THREE.Color(color);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({size, map: softDot(), vertexColors: true, transparent: true, opacity, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: !additive}));  // glows shine through the haze
  pts.frustumCulled = false;
  scene.add(pts);
  for (let i = 0; i < n; i++) pos[i * 3 + 1] = -999;
  pts.visible = false;
  let next = 0;
  return {
    points: pts,
    emit(x, y, z, vx, vy, vz, secs = 1, tint = null) {
      const i = next++ % n;
      pos.set([x, y, z], i * 3); vel.set([vx, vy, vz], i * 3);
      life[i] = max[i] = secs;
      (tint ? new THREE.Color(tint) : base).toArray(col, i * 3);
      pts.visible = true;
    },
    update(dt) {
      if (!pts.visible) return;  // an empty pool costs no draw call
      let alive = 0;
      for (let i = 0; i < n; i++) {
        if (life[i] <= 0) continue;
        alive++;
        life[i] -= dt;
        if (life[i] <= 0 && !(stay && pos[i * 3 + 1] <= floor + 0.02)) { pos[i * 3 + 1] = -999; continue; }
        if (life[i] <= 0) { life[i] = stay; continue; }  // settled pieces (paper on the ground) linger
        vel[i * 3 + 1] += gravity * dt;
        const k = 1 - drag * dt;
        vel[i * 3] *= k; vel[i * 3 + 1] *= k; vel[i * 3 + 2] *= k;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] < floor) { pos[i * 3 + 1] = floor; vel.set([0, 0, 0], i * 3); }
        if (additive) {
          const f = clamp(life[i] / max[i], 0, 1);
          base.toArray(col, i * 3);
          col[i * 3] *= f; col[i * 3 + 1] *= f; col[i * 3 + 2] *= f;
        }
      }
      g.attributes.position.needsUpdate = true;
      g.attributes.color.needsUpdate = true;
      if (!alive) pts.visible = false;
    },
    clear() { life.fill(0); for (let i = 0; i < n; i++) pos[i * 3 + 1] = -999; g.attributes.position.needsUpdate = true; pts.visible = false; },
  };
}

/** a camera that eases towards a wanted position and look point */
export function smoothCamera() {
  const at = new THREE.Vector3(), look = new THREE.Vector3();
  let snap = true;
  return {
    reset() { snap = true; },
    update(cam, wantPos, wantLook, dt, rate = 4) {
      if (snap) { at.copy(wantPos); look.copy(wantLook); snap = false; }
      at.lerp(wantPos, 1 - Math.exp(-rate * dt));
      look.lerp(wantLook, 1 - Math.exp(-rate * 1.5 * dt));
      cam.position.copy(at);
      cam.lookAt(look);
    },
  };
}

/** a kit asset as its own mesh (first state, first LOD) */
export function kitMesh(village, name) {
  const a = village.data.assets[name];
  const g = a && village.geometryByName(Object.values(a.lods)[0][0]);
  const m = new THREE.Mesh(g || new THREE.BoxGeometry(0.3, 0.3, 0.3), village.kitMat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** world position of the child's hand ('L' or 'R') */
export function hand(life, side = 'R', out = new THREE.Vector3()) {
  life.child.root.updateMatrixWorld(true);
  return life.child.parts[`arm ${side}`].localToWorld(out.set(0, -0.4, -0.01));
}

/** the nearest pond edge to (x, z): {name, P, e: {d, p, n}} with n pointing into the water */
export function nearestPond(data, x, z) {
  let best = null;
  for (const [name, P] of Object.entries(data.pondShapes || {})) {
    const e = closestEdge(x, z, P.outline);
    if (!best || e.d < best.e.d) best = {name, P, e, inside: inside([x, z], P.outline)};
  }
  return best;
}
export {inside};

/** true when nothing tall stands within r metres (open ground for a kite, room for a fire) */
export function openAround(walk, x, z, ground, r) {
  return walk.nav && !walk.solidAt(x, z, ground + 0.6, ground + 4, r);
}

/** the first camera position (of the candidates, best first) with a clear view of `look`, for tight courtyards */
export function freeView(walk, look, candidates) {
  for (const c of candidates) {
    let clear = true;
    for (let i = 1; i <= 12 && clear; i++) {
      const p = c.clone().lerp(look, i / 14);
      if (walk.solidAt(p.x, p.z, p.y - 0.25, p.y + 0.25, 0.25)) clear = false;
    }
    if (clear && !walk.solidAt(c.x, c.z, c.y - 0.4, c.y + 0.4, 0.4)) return c;
  }
  return candidates[0];
}
