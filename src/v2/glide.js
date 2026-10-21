// Paraglider landing: the visitor glides down from the sky to the chosen place and lands on foot.
// A striped canopy with lines hangs above the camera; the camera follows a cubic Bezier from ~300 m up
// and ~420 m back, banking into the turn and swaying gently, flares in the last seconds, then hands over
// to walking. Any key or tap skips. Repeat visits use a shorter glide.
import * as THREE from 'three';

const EYE = 1.65;

function buildCanopy() {
  const g = new THREE.Group();
  g.name = 'paraglider canopy';
  // arc-shaped wing above and slightly ahead of the pilot, in alternating red / yellow cells
  // ahead of and above the pilot: the arc frames the top of a forward view and the tips curve away past the edges
  const R = 4.4, top = 2.7, cells = 14, a0 = -1.05, a1 = 1.05, z0 = -3.4, z1 = -5.0;
  const pos = [], col = [];
  const red = new THREE.Color(0.78, 0.12, 0.08), yellow = new THREE.Color(0.95, 0.72, 0.12), white = new THREE.Color(0.94, 0.92, 0.86);
  const at = (i, z) => {
    const a = a0 + (a1 - a0) * i / cells;
    return [Math.sin(a) * R, top - R * (1 - Math.cos(a)) + (z === z1 ? 0.25 : 0), z];
  };
  for (let i = 0; i < cells; i++) {
    // separate vertices per cell so each cell keeps one flat colour
    const c = i % 3 === 1 ? white : i % 2 ? yellow : red;
    const q = [at(i, z0), at(i + 1, z0), at(i + 1, z1), at(i, z1)];
    for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(...q[k]); col.push(c.r, c.g, c.b); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const wing = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({vertexColors: true, side: THREE.DoubleSide, fog: false, transparent: true}));
  g.add(wing);
  // suspension lines from the leading edge to two risers just above the pilot's shoulders
  const lines = [];
  for (let i = 0; i <= cells; i += 2) {
    const a = a0 + (a1 - a0) * i / cells;
    const x = Math.sin(a) * R, y = top - R * (1 - Math.cos(a));
    const riser = x < 0 ? -0.28 : 0.28;
    lines.push(x, y, z0 - 0.1, riser, -0.35, -0.35);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({color: 0x3a3a3a, fog: false, transparent: true})));
  g.visible = false;
  return g;
}

export function createGlider(scene, camera) {
  if (!camera.parent) scene.add(camera);
  const canopy = buildCanopy();
  camera.add(canopy);
  let flight = null;
  const p = new THREE.Vector3(), t = new THREE.Vector3(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), roll = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1), up = new THREE.Vector3(0, 1, 0);

  function bezier(P, u, out) {
    const v = 1 - u;
    return out.set(0, 0, 0).addScaledVector(P[0], v * v * v).addScaledVector(P[1], 3 * v * v * u)
      .addScaledVector(P[2], 3 * v * u * u).addScaledVector(P[3], u * u * u);
  }
  function tangent(P, u, out) {
    const v = 1 - u;
    return out.set(0, 0, 0).addScaledVector(P[1].clone().sub(P[0]), 3 * v * v)
      .addScaledVector(P[2].clone().sub(P[1]), 6 * v * u).addScaledVector(P[3].clone().sub(P[2]), 3 * u * u).normalize();
  }

  function setOpacity(o) {
    canopy.children.forEach((c) => { c.material.opacity = o; });
  }

  return {
    get active() { return Boolean(flight); },
    /** target: ground point (Vector3); from: where the visitor is now (camera position); opts.onLand(x, z, yaw) */
    fly(target, {groundY = 0.1, onLand = () => {}, label = '', facing = null} = {}) {
      const short = Number(localStorage.getItem('sv2-glides') || 0) > 0;
      try { localStorage.setItem('sv2-glides', String(Number(localStorage.getItem('sv2-glides') || 0) + 1)); } catch { /* private mode */ }
      // final approach along the place's view (land facing it); otherwise come in from the camera's side
      const from = facing ? new THREE.Vector3(-facing.x, 0, -facing.z)
        : new THREE.Vector3(camera.position.x - target.x, 0, camera.position.z - target.z);
      if (from.length() < 1e-3) from.set(-0.7, 0, 0.7);
      from.normalize();
      const side = new THREE.Vector3(-from.z, 0, from.x);
      const end = new THREE.Vector3(target.x, groundY + EYE, target.z);
      const P = [
        end.clone().addScaledVector(from, 420).addScaledVector(side, -60).setY(groundY + 300),
        end.clone().addScaledVector(from, 260).addScaledVector(side, 90).setY(groundY + 210),
        end.clone().addScaledVector(from, 70).addScaledVector(side, facing ? 0 : -25).setY(groundY + 26),
        end,
      ];
      flight = {P, time: 0, duration: short ? 6.5 : 11, onLand, label, bank: 0};
      canopy.visible = true;
      canopy.scale.setScalar(1);
      setOpacity(1);
      camera.fov = 60;
      camera.updateProjectionMatrix();
    },
    skip() { if (flight) flight.time = flight.duration; },
    update(dt) {
      if (!flight) return false;
      const F = flight;
      F.time = Math.min(F.duration, F.time + dt);
      const u0 = F.time / F.duration;
      // steady glide that slows into a flare over the last stretch
      const u = 1 - Math.pow(1 - u0, 1.7);
      bezier(F.P, u, p);
      tangent(F.P, Math.min(u, 0.985), t);
      // bank into the turn: compare heading now with heading a little later
      const ahead = tangent(F.P, Math.min(1, u + 0.05), new THREE.Vector3());
      const turn = t.x * ahead.z - t.z * ahead.x;
      F.bank = THREE.MathUtils.damp(F.bank, THREE.MathUtils.clamp(turn * 6, -0.35, 0.35), 3, dt);
      const sway = Math.sin(F.time * 1.1) * 0.035 * (1 - u0);
      const flare = THREE.MathUtils.smoothstep(u0, 0.82, 1.0);
      const look = p.clone().add(t).add(new THREE.Vector3(0, -0.25 * (1 - flare) + 0.1 * flare, 0));
      camera.position.copy(p);
      m.lookAt(p, look, up);
      q.setFromRotationMatrix(m);
      roll.setFromAxisAngle(zAxis, F.bank + sway);
      camera.quaternion.copy(q).multiply(roll);
      // the canopy folds away as the feet touch down
      const fold = THREE.MathUtils.smoothstep(u0, 0.9, 1.0);
      setOpacity(1 - fold);
      canopy.position.y = fold * 2.5;
      if (F.time >= F.duration) {
        canopy.visible = false;
        flight = null;
        const yaw = Math.atan2(-t.x, -t.z);
        F.onLand(F.P[3].x, F.P[3].z, yaw);
      }
      return true;
    },
  };
}
