// Creatures for SmallVillage 2.0: part rigs from creatures.glb (built by kit/build_creatures.py), procedural
// gaits, the child avatar with a third-person camera, the dog companion and the animals living near the player.
// Animals of one species share one InstancedMesh per body part, so draw calls do not grow with their number.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';

const nameOf = (o) => o.userData.name || o.name;

export async function loadCreatures(material) {
  const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/'));
  const gltf = await loader.loadAsync('/models/v2/creatures.glb');
  const templates = {};
  gltf.scene.traverse((o) => {
    const n = nameOf(o);
    if (n.startsWith('RIG ')) templates[n.slice(4)] = o;
    if (o.isMesh) { o.material = material; o.castShadow = true; o.receiveShadow = true; }
  });
  return templates;
}

/** A posable rig: a clone of the template with its parts by name and their rest transforms. */
export function makeRig(template) {
  const root = template.clone(true);
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  return wrap(root);
}
function wrap(root) {
  const parts = {}, rest = {};
  root.traverse((o) => {
    const n = nameOf(o);
    const i = n.indexOf(':');
    if (i > 0) { parts[n.slice(i + 1)] = o; rest[n.slice(i + 1)] = {p: o.position.clone(), r: o.rotation.clone()}; }
  });
  return {root, parts, rest};
}
function reset(rig) {
  for (const [k, o] of Object.entries(rig.parts)) { o.position.copy(rig.rest[k].p); o.rotation.copy(rig.rest[k].r); }
}

// ---------------------------------------------------------------- gaits (creatures face -Z; +X rotation swings a limb forward)

export const POSE = {
  biped(rig, t, speed, phase) {
    reset(rig);
    const P = rig.parts, s = THREE.MathUtils.clamp(speed / 2.2, 0, 1.5);
    const a = Math.sin(phase) * 0.55 * s;
    P['leg L'].rotation.x = a;
    P['leg R'].rotation.x = -a;
    P['knee L'].rotation.x = -Math.max(0, Math.sin(phase - 1.2)) * 0.8 * s;
    P['knee R'].rotation.x = -Math.max(0, Math.sin(phase - 1.2 + Math.PI)) * 0.8 * s;
    P['arm L'].rotation.x = -a * 0.8;
    P['arm R'].rotation.x = a * 0.8;
    P['arm L'].rotation.z = -0.08;
    P['arm R'].rotation.z = 0.08;
    P.hips.position.y += Math.abs(Math.sin(phase)) * 0.035 * s;
    P.torso.rotation.y = Math.sin(phase) * 0.06 * s;
    P.torso.scale.y = 1 + Math.sin(t * 2.2) * 0.008 * (1 - Math.min(1, s));  // breathing when still
    P.head.rotation.x = Math.sin(t * 0.7) * 0.03;
  },
  quad(rig, t, speed, phase, {sit = 0, wag = 0.3, sniff = 0} = {}) {
    reset(rig);
    const P = rig.parts, s = THREE.MathUtils.clamp(speed / 2.5, 0, 1.4);
    const a = Math.sin(phase) * 0.55 * s;
    P['leg FL'].rotation.x = a;
    P['leg BR'].rotation.x = a;
    P['leg FR'].rotation.x = -a;
    P['leg BL'].rotation.x = -a;
    if (P.tail) P.tail.rotation.y = Math.sin(t * (6 + 10 * wag)) * (0.15 + 0.45 * wag);
    P.head.rotation.x = Math.sin(phase * 2) * 0.05 * s + sniff * 0.5 + Math.sin(t * 9) * 0.06 * sniff;
    if (sit > 0) {
      P.body.rotation.x = 0.45 * sit;
      P.body.position.y -= 0.07 * sit;
      P['leg BL'].rotation.x = P['leg BR'].rotation.x = -1.25 * sit;
      P['leg FL'].rotation.x = P['leg FR'].rotation.x = -0.45 * sit;
      P.head.rotation.x -= 0.4 * sit;
    }
  },
  bird(rig, t, speed, phase, {fly = 0, peck = 0, swim = false} = {}) {
    reset(rig);
    const P = rig.parts, s = THREE.MathUtils.clamp(speed / 0.8, 0, 1.5);
    if (P['leg L']) {
      P['leg L'].rotation.x = Math.sin(phase) * 0.6 * s - 1.3 * fly;
      P['leg R'].rotation.x = -Math.sin(phase) * 0.6 * s - 1.3 * fly;
    }
    const flap = fly ? Math.sin(t * 16) * 0.95 : Math.sin(t * 3) * 0.04;
    P['wing L'].rotation.z = -flap;
    P['wing R'].rotation.z = flap;
    P.head.position.z += -Math.sin(phase * 2) * 0.012 * s;
    P.head.rotation.x = -peck * 0.9;
    if (swim) P.body.position.y += Math.sin(t * 1.7 + phase) * 0.008;
  },
};

// ---------------------------------------------------------------- a herd: many animals of one species, instanced by part

class Herd {
  constructor(scene, template, capacity, shadows = true) {
    this.shown = true;
    this.rig = wrap(template.clone(true));
    this.rig.root.updateMatrixWorld(true);
    this.meshes = [];
    this.rig.root.traverse((o) => {
      if (!o.isMesh) return;
      const im = new THREE.InstancedMesh(o.geometry, o.material, capacity);
      im.castShadow = shadows;  // little birds and cats: their shadows are too small to matter
      im.receiveShadow = true;
      im.frustumCulled = false;
      im.count = 0;
      scene.add(im);
      this.meshes.push([o, im]);
    });
  }
  write(list, pose) {
    let k = 0;
    for (const a of list) {
      if (!a.visible) continue;
      this.rig.root.position.copy(a.pos);
      this.rig.root.rotation.set(0, a.yaw, 0);
      this.rig.root.scale.setScalar(a.scale || 1);
      pose(this.rig, a);
      this.rig.root.updateMatrixWorld(true);
      for (const [o, im] of this.meshes) im.setMatrixAt(k, o.matrixWorld);
      k++;
    }
    for (const [, im] of this.meshes) { im.count = k; im.instanceMatrix.needsUpdate = true; im.visible = k > 0 && this.shown; }
  }
  set visible(v) { this.shown = v; for (const [, im] of this.meshes) im.visible = v; }
}

// ---------------------------------------------------------------- the child, the dog and the village animals

export function createLife({scene, templates, walk, player, data, getMonth}) {
  const nav = data.nav;
  const solid = (x, z, y = nav.ground, r = 0.18) => walk.nav && walk.solidAt(x, z, y + 0.05, y + 0.6, r);
  const rnd = Math.random;

  // ---- the child avatar
  const child = makeRig(templates.child);
  child.root.visible = false;
  scene.add(child.root);
  const kid = {pos: new THREE.Vector3(), last: new THREE.Vector3(), speed: 0, phase: 0};

  // ---- the dog companion
  const dogRig = makeRig(templates.dog);
  dogRig.root.visible = false;
  scene.add(dogRig.root);
  const dog = {pos: new THREE.Vector3(), yaw: 0, speed: 0, phase: 0, sit: 0, idle: 0, sniff: 0, goal: null, active: false, ride: null};

  function clearLine(a, b) {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.4);
    for (let i = 1; i < n; i++) if (solid(a.x + (b.x - a.x) * i / n, a.z + (b.z - a.z) * i / n)) return false;
    return true;
  }
  function placeDog(near, behind = 12) {
    // somewhere with a clear run to the child (not behind a courtyard wall), as far out as possible
    for (let k = 0; k < 48; k++) {
      const a = rnd() * 6.283, r = behind * (1 - k / 60);
      const p = new THREE.Vector3(near.x + Math.cos(a) * r, nav.ground, near.z + Math.sin(a) * r);
      if (!solid(p.x, p.z) && clearLine(p, near)) { dog.pos.copy(p); return; }
    }
    dog.pos.set(near.x, nav.ground, near.z + 0.8);
  }

  function steer(from, dirYaw, step) {
    for (const off of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6]) {
      const yy = dirYaw + off;
      const x = from.x - Math.sin(yy) * step, z = from.z - Math.cos(yy) * step;
      if (!solid(x, z)) return {x, z, yaw: yy};
    }
    return null;
  }

  function updateDog(dt, t) {
    if (!dog.active) return;
    if (dog.ride) {  // riding along (the tricycle's cargo bed): sit, wag and look ahead
      dog.pos.copy(dog.ride.pos);
      dogRig.root.position.copy(dog.ride.pos);
      dogRig.root.rotation.y = dog.ride.yaw;
      POSE.quad(dogRig, t, 0, dog.phase, {sit: 1, wag: 0.9});
      return;
    }
    const fw = new THREE.Vector3(-Math.sin(walk.yaw), 0, -Math.cos(walk.yaw));
    const side = new THREE.Vector3(-fw.z, 0, fw.x);
    const heel = kid.pos.clone().addScaledVector(fw, -1.3).addScaledVector(side, 0.8);
    const toKid = dog.pos.distanceTo(kid.pos);
    if (toKid > 28) placeDog(kid.pos, 4);
    let target = heel;
    if (kid.speed < 0.2) {
      dog.idle += dt;
      if (dog.idle > 3 && (!dog.goal || dog.pos.distanceTo(dog.goal) < 0.4) && rnd() < 0.01) {
        const a = rnd() * 6.283;
        dog.goal = kid.pos.clone().add(new THREE.Vector3(Math.cos(a) * 3, 0, Math.sin(a) * 3));
      }
      if (dog.goal && dog.idle > 3) target = dog.goal;
    } else { dog.idle = 0; dog.goal = null; }
    const d = Math.hypot(target.x - dog.pos.x, target.z - dog.pos.z);
    const want = d > 0.45 ? Math.min(5.5, 0.6 + d * 1.4) : 0;
    dog.speed = THREE.MathUtils.damp(dog.speed, want, 6, dt);
    if (dog.speed > 0.05) {
      const yaw = Math.atan2(-(target.x - dog.pos.x), -(target.z - dog.pos.z));
      const s = steer(dog.pos, yaw, dog.speed * dt);
      if (s) { dog.pos.x = s.x; dog.pos.z = s.z; dog.yaw = lerpAngle(dog.yaw, s.yaw, 1 - Math.exp(-10 * dt)); }
      else dog.speed = 0;
    } else {
      dog.yaw = lerpAngle(dog.yaw, Math.atan2(-(kid.pos.x - dog.pos.x), -(kid.pos.z - dog.pos.z)), 1 - Math.exp(-3 * dt));
    }
    dog.phase += dt * (3 + dog.speed * 4.2);
    dog.sit = THREE.MathUtils.damp(dog.sit, kid.speed < 0.2 && dog.speed < 0.1 && dog.idle > 1.5 && !dog.goal ? 1 : 0, 4, dt);
    dog.sniff = THREE.MathUtils.damp(dog.sniff, dog.goal ? 1 : 0, 3, dt);
    dogRig.root.position.set(dog.pos.x, walk.feet ?? nav.ground, dog.pos.z);
    dogRig.root.rotation.y = dog.yaw;
    POSE.quad(dogRig, t, dog.speed, dog.phase, {sit: dog.sit, wag: kid.speed > 0.2 ? 0.9 : 0.5 + 0.5 * dog.sit, sniff: dog.sniff});
  }

  // ---- village animals near the player
  const herds = {};
  const animals = [];
  const SPECIES = {
    'hen brown': {count: 7, pose: 'bird'}, 'hen white': {count: 7, pose: 'bird'}, duck: {count: 8, pose: 'swim'},
    goose: {count: 4, pose: 'swim'}, goat: {count: 3, pose: 'quad'}, cat: {count: 3, pose: 'quad'},
    magpie: {count: 4, pose: 'bird'}, sparrow: {count: 10, pose: 'bird'},
  };
  for (const [sp, conf] of Object.entries(SPECIES)) herds[sp] = new Herd(scene, templates[sp], conf.count, sp === 'goat' || sp === 'goose');

  // habitats from the exported data
  const plots = [];
  for (const [key, recs] of Object.entries(data.instances)) {
    if (!key.startsWith('plot ')) continue;
    for (const r of recs) {
      // lane side of the plot, a little in front of the gate: local (5.5 * sx, -1.8) in Blender -> three
      const rot = r[3], sx = r[4], lx = 5.5 * sx, ly = -1.8;
      const bx = r[0] + Math.cos(rot) * lx - Math.sin(rot) * ly;
      const by = -r[2] + Math.sin(rot) * lx + Math.cos(rot) * ly;
      plots.push(new THREE.Vector3(bx, nav.ground, -by));
    }
  }
  const ponds = data.places.filter((p) => p.kind === 'water' && p.id.includes('pond')).map((p) => new THREE.Vector3(p.look[0], -0.68, p.look[1]));
  const roadPts = [];
  for (const R of Object.values(data.roads)) {
    if (R.width < 4) continue;
    for (let i = 0; i + 1 < R.pts.length; i++) {
      const [ax, az] = R.pts[i], [bx, bz] = R.pts[i + 1];
      const n = Math.max(1, Math.floor(Math.hypot(bx - ax, bz - az) / 25));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n, nx = -(bz - az), nz = bx - ax, L = Math.hypot(nx, nz) || 1;
        roadPts.push(new THREE.Vector3(ax + (bx - ax) * t + nx / L * (R.width / 2 + 4.5), nav.ground, az + (bz - az) * t + nz / L * (R.width / 2 + 4.5)));
      }
    }
  }
  const home = new THREE.Vector3(-31, 0.2, 111.5);

  function near(list, c, rmin, rmax) {
    const out = list.filter((p) => { const d = Math.hypot(p.x - c.x, p.z - c.z); return d >= rmin && d <= rmax; });
    return out.length ? out[Math.floor(rnd() * out.length)] : null;
  }
  function spawn(sp, c) {
    const conf = SPECIES[sp];
    let anchor = null;
    if (sp.startsWith('hen')) anchor = rnd() < 0.3 && c.distanceTo(home) < 120 ? home : near(plots, c, 8, 90);
    else if (sp === 'duck' || sp === 'goose') anchor = near(ponds, c, 0, 160);
    else if (sp === 'goat') anchor = near(roadPts, c, 15, 120);
    else if (sp === 'cat') anchor = near(plots, c, 6, 70);
    else if (sp === 'magpie') anchor = near(roadPts, c, 10, 100) || near(plots, c, 10, 80);
    else if (sp === 'sparrow') anchor = near(plots, c, 6, 60) || near(roadPts, c, 6, 60);
    if (!anchor) return null;
    const a = {sp, anchor: anchor.clone(), pos: anchor.clone(), yaw: rnd() * 6.283, speed: 0, phase: rnd() * 6, t0: rnd() * 10,
      goal: null, wait: rnd() * 3, peck: 0, fly: 0, visible: true, pose: conf.pose,
      radius: {goat: 2.2, duck: 7, goose: 7, cat: 6}[sp] ?? 3.5, scale: 0.9 + rnd() * 0.2};
    a.pos.x += (rnd() - 0.5) * 2;
    a.pos.z += (rnd() - 0.5) * 2;
    if (a.pose !== 'swim' && solid(a.pos.x, a.pos.z, a.pos.y)) a.pos.copy(anchor);
    return a;
  }

  let lastFill = null;
  function refill(c) {
    if (lastFill && lastFill.distanceTo(c) < 25 && animals.length) return;
    lastFill = c.clone();
    for (let i = animals.length - 1; i >= 0; i--) if (animals[i].pos.distanceTo(c) > 140) animals.splice(i, 1);
    const winter = [12, 1, 2].includes(getMonth());
    for (const [sp, conf] of Object.entries(SPECIES)) {
      const want = winter && (sp === 'duck' || sp === 'goose') ? Math.ceil(conf.count / 2) : conf.count;
      let have = animals.filter((a) => a.sp === sp).length;
      for (let k = 0; have < want && k < want * 3; k++) {
        const a = spawn(sp, c);
        if (!a) break;
        // sparrows come in little flocks around one anchor
        animals.push(a);
        have++;
      }
    }
  }

  function thinkAnimal(a, dt, t) {
    const sp = a.sp;
    a.wait -= dt;
    const toKid = Math.hypot(a.pos.x - kid.pos.x, a.pos.z - kid.pos.z);
    // small birds scatter when the child comes close
    if ((sp === 'sparrow' || sp === 'magpie') && toKid < (sp === 'sparrow' ? 4 : 7) && a.fly === 0) {
      const away = Math.atan2(-(a.pos.x - kid.pos.x), -(a.pos.z - kid.pos.z)) + Math.PI;
      a.fly = 1;
      a.flyT = 0;
      a.goal = a.pos.clone().add(new THREE.Vector3(-Math.sin(away) * 22, 0, -Math.cos(away) * 22));
    }
    if (a.fly > 0) {
      a.flyT += dt;
      const d = a.goal.clone().sub(a.pos);
      d.y = 0;
      const step = Math.min(d.length(), (sp === 'sparrow' ? 7 : 9) * dt);
      if (d.length() > 0.1) { a.yaw = Math.atan2(-d.x, -d.z); a.pos.addScaledVector(d.normalize(), step); }
      const left = Math.hypot(a.goal.x - a.pos.x, a.goal.z - a.pos.z);
      a.pos.y = nav.ground + Math.min(5, a.flyT * 6) * Math.min(1, left / 6);
      if (left < 0.2) { a.fly = 0; a.pos.y = nav.ground; a.anchor.copy(a.pos); a.wait = 2; }
      a.speed = 0;
      return;
    }
    if (!a.goal && a.wait <= 0) {
      const ang = rnd() * 6.283, r = rnd() * a.radius;
      a.goal = a.anchor.clone().add(new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r));
    }
    if (a.goal) {
      const d = a.goal.clone().sub(a.pos);
      d.y = 0;
      const dist = d.length();
      const v = {goat: 0.6, cat: 0.7, duck: 0.45, goose: 0.4, sparrow: 1.2, magpie: 1.0}[sp] ?? 0.55;
      if (dist < 0.15) { a.goal = null; a.wait = 1 + rnd() * 4; a.speed = 0; }
      else {
        const yaw = Math.atan2(-d.x, -d.z), step = Math.min(dist, v * dt);
        const nx = a.pos.x - Math.sin(yaw) * step, nz = a.pos.z - Math.cos(yaw) * step;
        if (a.pose === 'swim' || !solid(nx, nz, a.pos.y, 0.1)) { a.pos.x = nx; a.pos.z = nz; a.speed = v; }
        else { a.goal = null; a.wait = 1; a.speed = 0; }
        a.yaw = lerpAngle(a.yaw, yaw, 1 - Math.exp(-6 * dt));
      }
    } else a.speed = 0;
    a.phase += dt * (4 + a.speed * 10);
    a.peck = (sp.startsWith('hen') || sp === 'sparrow' || sp === 'magpie') && a.speed === 0 ? Math.max(0, Math.sin((t + a.t0) * 3)) ** 8 : 0;
  }

  const poseFn = {
    bird: (rig, a) => POSE.bird(rig, performance.now() / 1000 + a.t0, a.speed, a.phase, {fly: a.fly, peck: a.peck}),
    swim: (rig, a) => POSE.bird(rig, performance.now() / 1000 + a.t0, a.speed, a.phase, {swim: true, peck: a.peck}),
    quad: (rig, a) => POSE.quad(rig, performance.now() / 1000 + a.t0, a.speed, a.phase, {wag: a.sp === 'cat' ? 0.15 : 0.3}),
  };

  let enabled = false, firstPerson = false, posture = null;
  return {
    /** an activity pose applied on top of the walking pose (fishing), or null */
    setPosture(fn) { posture = fn; },
    child, dogRig, kid, dog, placeDog,
    get firstPerson() { return firstPerson; },
    setFirstPerson(v) { firstPerson = v; child.root.visible = enabled && !v; },
    start() {
      enabled = true;
      kid.pos.set(player.position.x, (walk.feet ?? nav.ground), player.position.z);
      kid.last.copy(kid.pos);
      child.root.visible = !firstPerson;
      dog.active = true;
      dogRig.root.visible = true;
      placeDog(kid.pos, 14);  // the dog comes running to meet you
      lastFill = null;
    },
    stop() {
      enabled = false;
      child.root.visible = false;
      dogRig.root.visible = false;
      dog.active = false;
    },
    update(dt, t) {
      if (enabled) {
        kid.pos.set(player.position.x, walk.feet ?? nav.ground, player.position.z);
        const moved = Math.hypot(kid.pos.x - kid.last.x, kid.pos.z - kid.last.z);
        kid.speed = THREE.MathUtils.damp(kid.speed, dt > 0 ? moved / dt : 0, 10, dt);
        kid.last.copy(kid.pos);
        kid.phase += moved * 3.1;
        child.root.position.copy(kid.pos);
        child.root.rotation.y = walk.yaw;
        POSE.biped(child, t, kid.speed, kid.phase);
        posture?.(child, t);
        updateDog(dt, t);
        refill(kid.pos);
      }
      for (const a of animals) thinkAnimal(a, dt, t);
      for (const [sp, herd] of Object.entries(herds)) {
        const list = animals.filter((a) => a.sp === sp);
        herd.write(list, poseFn[SPECIES[sp].pose]);
      }
    },
    animals,
  };
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return a + d * t;
}

/** Third-person follow camera with a boom that shortens against walls (uses the walk controller's collisions). */
export function createFollowCamera(camera, walk) {
  const want = new THREE.Vector3(), look = new THREE.Vector3();
  let boom = 3.2;
  return {
    /** true while the camera is too boxed in to sit behind the child (it then looks through the child's eyes) */
    tight: false,
    update(player, dt, snap = false) {
      const yaw = walk.yaw, pitch = THREE.MathUtils.clamp(walk.pitch, -0.6, 0.5);
      const head = new THREE.Vector3(player.position.x, (walk.feet ?? 0) + 1.25, player.position.z);
      const back = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch) + 0.28, Math.cos(yaw) * Math.cos(pitch)).normalize();
      // shorten the boom where a wall or tree is behind the child
      let len = 3.2;
      for (let d = 0.6; d <= 3.2; d += 0.2) {
        const p = head.clone().addScaledVector(back, d);
        if (walk.solidAt(p.x, p.z, p.y - 0.2, p.y + 0.2, 0.2)) { len = Math.max(0.6, d - 0.3); break; }
      }
      boom = snap ? len : THREE.MathUtils.damp(boom, len, len < boom ? 20 : 4, dt);
      this.tight = boom < 1.1;
      if (this.tight) {
        camera.position.copy(player.position);
        camera.quaternion.copy(player.quaternion);
        return;
      }
      want.copy(head).addScaledVector(back, boom);
      if (snap) camera.position.copy(want); else camera.position.lerp(want, 1 - Math.exp(-12 * dt));
      look.copy(head).add(new THREE.Vector3(-Math.sin(yaw), Math.sin(pitch), -Math.cos(yaw)).multiplyScalar(2));
      camera.lookAt(look);
    },
  };
}
