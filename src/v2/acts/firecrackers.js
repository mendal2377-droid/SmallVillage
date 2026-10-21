// 放鞭炮: Spring Festival (January and February) by the home gate. A string of firecrackers lies on the
// ground; hold to reach the glowing incense stick to the fuse (slowly, it takes a moment to catch), then
// the child runs back with hands over their ears while the string pops its way along in flashes and smoke,
// leaving the ground red with paper (满地红). B lights a fountain firework (花炮) as well.
import * as THREE from 'three';
import {toon, glow, rnd, clamp, smoothCamera, particles, hand, freeView} from './common.js';

const MONTHS = [1, 2];
const HOME = new THREE.Vector3(-36, 0, 118);
const N = 48;

export function createFirecrackers(api) {
  const {scene, village, walk} = api;
  const ground = () => village.data.nav.ground;

  const crackerGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.075, 6).rotateZ(Math.PI / 2);
  const crackers = new THREE.InstancedMesh(crackerGeo, toon(0xc8282a), N);
  crackers.castShadow = true;
  crackers.frustumCulled = false;
  const fuseLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({color: 0x5a4a30}));
  const incense = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.4, 4).translate(0, 0.2, 0), toon(0x7a3a2a));
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), glow(0xff6a2a, 1));
  incense.add(ember);
  ember.position.y = 0.4;
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), glow(0xfff0b0, 0.9));
  const fountainBase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.2, 10).translate(0, 0.1, 0), toon(0xd8a020));
  const smoke = particles(scene, {n: 120, color: 0xd8d4cc, size: 0.5, opacity: 0.3, gravity: 0.25, drag: 0.7});
  const sparks = particles(scene, {n: 400, color: 0xffd070, size: 0.06, additive: true, gravity: -4});
  // red paper stays on the ground until the festival is over
  const paper = particles(scene, {n: 600, color: 0xc8282a, size: 0.05, opacity: 1, gravity: -2.2, drag: 1.6, floor: village.data.nav.ground + 0.01, stay: 1e9});
  const fuseSparks = particles(scene, {n: 60, color: 0xffc060, size: 0.04, additive: true, gravity: -2});
  for (const o of [crackers, fuseLine, incense, flash, fountainBase]) { o.visible = false; scene.add(o); }

  const cam = smoothCamera();
  const S = {phase: 'off', t: 0, reach: 0, holding: false, pts: [], next: 0, popT: 0, spot: new THREE.Vector3(), kid0: new THREE.Vector3(), yaw: 0,
    back: new THREE.Vector3(), fountain: -1, fuseT: 0, fw: new THREE.Vector3(), side: new THREE.Vector3()};
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Vector3(0, 0, 0);

  function layString() {
    // the string snakes away from the child along the ground
    S.pts = [];
    const start = S.spot.clone();
    for (let i = 0; i < N; i++) {
      const f = i / (N - 1);
      const p = start.clone().addScaledVector(S.side, f * 2.6).addScaledVector(S.fw, Math.sin(f * Math.PI * 2) * 0.25 + f * 0.4);
      p.y = ground() + 0.016;
      S.pts.push({p, yaw: S.yaw + Math.PI / 2 + Math.cos(f * Math.PI * 2) * 0.5 + (i % 2 ? 0.5 : -0.5), live: true});
    }
    writeCrackers();
    fuseLine.geometry.setFromPoints([S.pts[0].p.clone().addScaledVector(S.side, -0.18).addScaledVector(S.fw, -0.12), S.pts[0].p]);
  }
  function writeCrackers() {
    S.pts.forEach((c, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.yaw);
      m4.compose(c.p, q, c.live ? one : zero);
      crackers.setMatrixAt(i, m4);
    });
    crackers.instanceMatrix.needsUpdate = true;
  }
  function fuseEnd() { return fuseLine.geometry.attributes.position.array.slice(0, 3); }

  const A = {
    id: 'firecrackers', icon: '🧨', zh: '放鞭炮', en: 'Firecrackers', pauseWalk: true,
    available() {
      const k = api.kid();
      return MONTHS.includes(api.month()) && !api.wet() && k.pos.distanceTo(HOME.clone().setY(k.pos.y)) < 18;
    },
    start() {
      const k = api.kid();
      S.kid0.copy(k.pos);
      // lay the string where there is room: ahead, to either side or behind, whichever is clear
      const g = ground(), neg = (v) => v.clone().negate();
      const layouts = [[k.fw, k.side], [k.side, neg(k.fw)], [neg(k.side), k.fw], [neg(k.fw), neg(k.side)]];
      const fits = ([f, sd]) => {
        for (let i = 0; i <= 8; i++) {
          const p = k.pos.clone().addScaledVector(f, 1.1 + (i / 8) * 0.4).addScaledVector(sd, 0.2 + (i / 8) * 2.6);
          if (walk.solidAt(p.x, p.z, g + 0.05, g + 0.8, 0.15)) return false;
        }
        return true;
      };
      const [f, sd] = layouts.find(fits) ?? layouts[0];
      S.fw.copy(f); S.side.copy(sd); S.yaw = Math.atan2(-f.x, -f.z);
      walk.place(k.pos.x, k.pos.y + walk.eyeHeight, k.pos.z, S.yaw, 0);  // turn to face the string
      S.spot.copy(k.pos).addScaledVector(f, 1.1).addScaledVector(sd, 0.2);
      S.back.copy(k.pos).addScaledVector(f, -2.6);
      if (walk.standAt(S.back.x, S.back.z, k.pos.y) === undefined) S.back.copy(k.pos).addScaledVector(sd, -2.2);
      if (walk.standAt(S.back.x, S.back.z, k.pos.y) === undefined) S.back.copy(k.pos);
      layString();
      const mid = S.spot.clone().addScaledVector(S.side, 1.0).setY(g + 0.4);
      const at = (a, b, h = 1.9) => S.kid0.clone().addScaledVector(S.fw, a).addScaledVector(S.side, b).setY(g + h);
      S.camAt = freeView(walk, mid, [at(-3.2, -2.2), at(-3.2, 2.2), at(-2.5, 0, 2.4), at(0.5, -3), at(1, 4.5), at(4, 1), at(-1.2, 0.6, 2.6)]);
      S.camLook = mid;
      crackers.visible = fuseLine.visible = incense.visible = true;
      S.phase = 'ready'; S.t = 0; S.reach = 0; S.next = 0; S.fountain = -1;
      cam.reset();
      api.second('🎆 花炮 Fountain · B');
      api.say(api.night() ? '过年了，放挂鞭' : '过年了！', 'Hold to reach the incense to the fuse. Slowly…');
      api.action('点 Light · hold');
    },
    stop() {
      for (const o of [crackers, fuseLine, incense, flash, fountainBase]) o.visible = false;
      fuseSparks.clear(); sparks.clear();
      if (S.phase !== 'ready') walk.place(S.back.x, (walk.feet ?? ground()) + walk.eyeHeight, S.back.z, S.yaw, 0);
      S.phase = 'off';
    },
    press() { S.holding = true; if (S.phase === 'done') api.finish(null); },
    release() { S.holding = false; },
    second() {
      if (S.fountain >= 0) return;
      S.fountain = 0;
      fountainBase.visible = true;
      fountainBase.position.copy(S.spot).addScaledVector(S.side, -0.9).addScaledVector(S.fw, 0.9).setY(ground());
      api.second(null);
      api.sounds.whoosh();
      api.record('firecrackers', (r) => ({...r, fountains: (r.fountains || 0) + 1}));
    },
    always(dt) {
      smoke.update(dt); sparks.update(dt); fuseSparks.update(dt);
      paper.update(dt);
      if (!MONTHS.includes(api.month())) paper.clear();
    },
    update(dt) {
      S.t += dt;
      const k = api.kid();
      // the incense stick in the right hand
      const h = hand(api.life, 'R');
      incense.position.copy(h);
      incense.lookAt(h.clone().addScaledVector(S.fw, 1).setY(h.y - 0.6));
      incense.rotateX(Math.PI / 2);
      ember.material.opacity = 0.7 + Math.sin(S.t * 12) * 0.3;
      if (S.phase === 'ready') {
        S.reach = clamp(S.reach + dt * (S.holding ? 0.75 : -1.4), 0, 1);
        api.meter(S.reach, '香头凑近引信 reaching the fuse', '#c8402a');
        if (S.reach >= 1) {
          S.phase = 'fuse'; S.t = 0;
          api.sounds.crackle(); api.buzz(30);
        }
      } else if (S.phase === 'fuse') {
        // the fuse fizzes for a moment while the child runs back and covers their ears
        const f = fuseEnd();
        if (rnd() < 0.7) fuseSparks.emit(f[0], f[1] + 0.02, f[2], rnd() - 0.5, 1 + rnd(), rnd() - 0.5, 0.25);
        if (rnd() < dt * 20) api.sounds.crackle();
        const run = clamp(S.t / 0.9, 0, 1);
        const p = S.kid0.clone().lerp(S.back, run);
        walk.place(p.x, (walk.feet ?? ground()) + walk.eyeHeight, p.z, S.yaw, 0);
        api.meter(null);
        api.say('快跑！', 'Run! Cover your ears!');
        api.action('…', {disabled: true});
        if (S.t > 1.5) { S.phase = 'pop'; S.t = 0; S.popT = 0; }
      } else if (S.phase === 'pop') {
        S.popT -= dt;
        while (S.popT <= 0 && S.next < N) {
          S.popT += 0.05 + rnd() * 0.06;
          const c = S.pts[S.next++];
          c.live = false;
          // bang: a flash, a puff of smoke, red paper everywhere
          flash.visible = true;
          flash.position.copy(c.p).setY(c.p.y + 0.1);
          flash.scale.setScalar(0.6 + rnd() * 0.8);
          flash.userData.t = 0.06;
          api.sounds.pop();
          for (let i = 0; i < 3; i++) smoke.emit(c.p.x, c.p.y + 0.1, c.p.z, (rnd() - 0.5) * 0.6, 0.4 + rnd() * 0.4, (rnd() - 0.5) * 0.6, 2.5);
          for (let i = 0; i < 9; i++) paper.emit(c.p.x, c.p.y + 0.05, c.p.z, (rnd() - 0.5) * 2.2, 1 + rnd() * 2.5, (rnd() - 0.5) * 2.2, 4, rnd() < 0.2 ? 0xe8a020 : null);
          if (S.next % 6 === 0) api.buzz(15);
        }
        writeCrackers();
        if (flash.visible && (flash.userData.t -= dt) <= 0) flash.visible = false;
        api.say('噼里啪啦！', 'Crackle crackle bang!');
        api.meter(S.next / N, `${S.next} / ${N}`, '#c8282a');
        if (S.next >= N && S.popT < -0.2) {
          flash.visible = false;
          S.phase = 'done'; S.t = 0;
          api.record('firecrackers', (r) => ({...r, count: (r.count || 0) + 1}));
          api.sounds.chime();
        }
      } else if (S.phase === 'done') {
        api.say('满地红！', 'The ground is red with paper: good luck for the new year.');
        api.action('过年好 Done');
        api.meter(null);
      }
      // the fountain firework: a golden spray for a few seconds
      if (S.fountain >= 0) {
        S.fountain += dt;
        const b = fountainBase.position;
        if (S.fountain < 7) {
          const n = Math.floor(dt * 160);
          for (let i = 0; i < n; i++) {
            const a = rnd() * 6.283, r = rnd() * 0.9;
            sparks.emit(b.x, b.y + 0.2, b.z, Math.cos(a) * r, 4 + rnd() * 2.5, Math.sin(a) * r, 1 + rnd() * 0.6, rnd() < 0.3 ? 0xffffff : null);
          }
          if (rnd() < dt * 12) api.sounds.crackle();
        }
      }
    },
    camera(c, dt) {
      const look = S.camLook.clone().setY(ground() + (S.fountain >= 0 && S.fountain < 7 ? 1.0 : 0.3));
      cam.update(c, S.camAt, look, dt, 3);
    },
    posture(rig, t) {
      const P = rig.parts;
      if (S.phase === 'ready') {
        // leaning out at arm's length, the other hand ready to cover an ear
        P.torso.rotation.x = -0.45 * S.reach;
        P.hips.position.y -= 0.12 * S.reach;
        P['knee L'].rotation.x = P['knee R'].rotation.x = -0.4 * S.reach;
        P['leg L'].rotation.x = P['leg R'].rotation.x = 0.25 * S.reach;
        P['arm R'].rotation.x = 0.6 + 0.9 * S.reach;
        P['arm L'].rotation.x = 2.6;
        P['arm L'].rotation.z = 0.9;
      } else if (S.phase === 'fuse' || S.phase === 'pop') {
        // hands over the ears, a little hop at each bang
        P['arm L'].rotation.x = P['arm R'].rotation.x = 2.75;
        P['arm L'].rotation.z = 1.05; P['arm R'].rotation.z = -1.05;
        if (S.phase === 'pop') P.hips.position.y += Math.abs(Math.sin(t * 18)) * 0.02;
      }
    },
    state: S,
  };
  return A;
}
