// 拾麦穗: wheat harvest in May and early June. A combine harvester works up and down the field, throwing out
// chaff and dropping the odd ear of wheat; the child follows with a bamboo basket and picks up the ears
// (walk up to one and press E). It stops and beeps if the child gets in its way. A basket holds 30 ears.
import * as THREE from 'three';
import {toon, rnd, clamp, kitMesh, particles} from './common.js';

const GOAL = 30;

function earGeometry() {
  // a small golden ear on a short straw, lying on the ground (long axis along x)
  const head = new THREE.CapsuleGeometry(0.014, 0.07, 3, 6).rotateZ(Math.PI / 2).translate(0.05, 0.014, 0);
  const straw = new THREE.CylinderGeometry(0.003, 0.003, 0.14, 4).rotateZ(Math.PI / 2).translate(-0.06, 0.006, 0);
  const g = new THREE.BufferGeometry();
  const parts = [head, straw].map((x) => x.toNonIndexed());
  const pos = [], nor = [];
  for (const p of parts) { pos.push(...p.attributes.position.array); nor.push(...p.attributes.normal.array); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.scale(2.2, 2.2, 2.2);  // larger than life so they show in the stubble
  return g;
}

export function createGlean(api) {
  const {scene, walk, life, crops, village} = api;
  const ground = () => village.data.nav.ground;

  const MAX = 90;
  const ears = new THREE.InstancedMesh(earGeometry(), toon(0xf0c450), MAX);
  ears.count = 0;
  ears.frustumCulled = false;
  ears.castShadow = true;
  const combine = kitMesh(village, 'combine harvester');
  const basket = kitMesh(village, 'bamboo basket');
  basket.scale.setScalar(0.62);
  const inBasket = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.08, 10), toon(0xd8b050));
  basket.add(inBasket);
  const chaff = particles(scene, {n: 160, color: 0xe6cf8a, size: 0.09, opacity: 0.8, gravity: -1.2, drag: 1.2});
  const dust = particles(scene, {n: 60, color: 0xc8b890, size: 0.9, opacity: 0.22, gravity: 0.2, drag: 0.8});
  for (const o of [ears, combine, basket]) { o.visible = false; scene.add(o); }

  const S = {phase: 'off', list: [], count: 0, picking: -1, pickT: 0, pickFrom: new THREE.Vector3(),
    cPos: new THREE.Vector3(), cDir: new THREE.Vector3(), cYaw: 0, cSpeed: 1.6, cMin: 0, cMax: 0, cS: 0, cTurn: 0, stopped: false, beepT: 0, dropT: 1};
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  let clock = 0;

  // harvested: behind the combine's current run (up to the edge of its cutter), along the length of the run
  function cutFn(x, z) {
    const dx = x - S.origin.x, dz = z - S.origin.z;
    const along = dx * S.axis.x + dz * S.axis.z, across = dx * S.away.x + dz * S.away.z;
    return Math.abs(along) < 42 && across < 2.3 && across > -45;
  }
  function onField(x, z) {
    const f = crops.fieldAt(x, z);
    return f && f !== 'vegetables';
  }
  function addEar(x, z) {
    if (S.list.length >= MAX || !onField(x, z)) return;
    S.list.push({x, z, yaw: rnd() * 6.283, picked: false});
  }
  function writeEars() {
    let k = 0;
    for (const e of S.list) {
      if (e.picked) continue;
      q.setFromAxisAngle(up, e.yaw);
      m4.compose(new THREE.Vector3(e.x, ground() + 0.005, e.z), q, one);
      ears.setMatrixAt(k++, m4);
    }
    ears.count = k;
    ears.instanceMatrix.needsUpdate = true;
  }

  function moveCombine(dt, kid) {
    // up and down a straight run across the field, turning round at each end
    const toKid = Math.hypot(kid.pos.x - S.cPos.x, kid.pos.z - S.cPos.z);
    const ahead = new THREE.Vector3(kid.pos.x - S.cPos.x, 0, kid.pos.z - S.cPos.z).dot(S.cDir);
    S.stopped = toKid < 4.2 && ahead > -1.5;  // the driver stops for children in front of the cutter
    if (S.stopped) {
      if ((S.beepT -= dt) <= 0) { S.beepT = 1.6; api.sounds.beep(); }
    } else if (S.cTurn > 0) {
      S.cTurn -= dt;
      S.cYaw += Math.PI * dt / 2.5;
      if (S.cTurn <= 0) { S.cDir.negate(); S.cYaw = Math.atan2(-S.cDir.x, -S.cDir.z); }
    } else {
      S.cS += S.cSpeed * dt * Math.sign(S.cDir.dot(S.axis));
      S.cPos.copy(S.origin).addScaledVector(S.axis, S.cS);
      if (S.cS > S.cMax || S.cS < S.cMin) {
        // at the end of a run it turns round and takes the next swath, a combine's width further into the wheat
        S.cS = clamp(S.cS, S.cMin, S.cMax); S.cTurn = 2.5;
        S.origin.addScaledVector(S.away, 4.4);
        crops.setCut(cutFn);
      }
      // chaff out of the back, dust around, an ear now and then
      const back = S.cPos.clone().addScaledVector(S.cDir, -3.6);
      for (let i = 0; i < 3; i++) chaff.emit(back.x + rnd() - 0.5, ground() + 2.2, back.z + rnd() - 0.5, -S.cDir.x * 2 + rnd() - 0.5, 0.6 + rnd(), -S.cDir.z * 2 + rnd() - 0.5, 1.5);
      if (rnd() < dt * 3) dust.emit(S.cPos.x + rnd() * 4 - 2, ground() + 0.5, S.cPos.z + rnd() * 4 - 2, rnd() - 0.5, 0.3, rnd() - 0.5, 3);
      if ((S.dropT -= dt) <= 0) {
        S.dropT = 0.6 + rnd() * 0.8;
        addEar(back.x + (rnd() - 0.5) * 3.5, back.z + (rnd() - 0.5) * 3.5);
      }
    }
    combine.position.set(S.cPos.x, ground(), S.cPos.z);
    combine.rotation.y = S.cYaw;
    combine.position.y += Math.sin(clock * 9) * 0.01;
    // the combine is solid: the child walks round it
    const c = Math.cos(S.cYaw), s = Math.sin(S.cYaw);
    const mid = S.cPos.clone().addScaledVector(S.cDir, -0.7);
    walk.setDynamic('combine', {cx: mid.x, cz: mid.z, hx: 2.3, hz: 3.0, c, s, low: -10, high: 10});
  }

  const A = {
    id: 'glean', icon: '🌾', zh: '拾麦穗', en: 'Glean wheat', pauseWalk: false,
    available() {
      const m = api.month(), k = api.kid();
      return (m === 5 || m === 6) && !api.wet() && !api.night() && onField(k.pos.x, k.pos.z);
    },
    start() {
      const k = api.kid();
      S.list = []; S.count = 0; S.picking = -1;
      for (let i = 0; i < 26; i++) {
        const a = rnd() * 6.283, r = 1.5 + rnd() * 11;
        addEar(k.pos.x + Math.cos(a) * r, k.pos.z + Math.sin(a) * r);
      }
      // the combine works a run across the field, starting off to one side ahead of the child
      S.axis = k.side.clone();
      S.away = k.fw.clone();
      S.origin = k.pos.clone().addScaledVector(k.fw, 16);
      crops.setCut(cutFn);  // the ground between the child and the combine is already cut: stubble
      S.cMin = -35; S.cMax = 35; S.cS = -20;
      S.cDir.copy(S.axis);
      S.cYaw = Math.atan2(-S.cDir.x, -S.cDir.z);
      S.cPos.copy(S.origin).addScaledVector(S.axis, S.cS);
      S.cTurn = 0;
      ears.visible = combine.visible = basket.visible = true;
      inBasket.scale.set(1, 0.01, 1);
      writeEars();
      api.say('跟在收割机后面拾麦穗', 'Follow the combine and pick up the ears it drops: walk up to one and press E.');
      api.action('拾 Pick up · E');
    },
    stop() {
      if (S.count) {
        api.record('glean', (r) => ({best: Math.max(r.best || 0, S.count), total: (r.total || 0) + S.count}));
        api.toast(`🌾 拾了 ${S.count} 穗麦子 · ${S.count} ears of wheat in the basket`);
      }
      for (const o of [ears, combine, basket]) o.visible = false;
      walk.setDynamic('combine', null);
      crops.setCut(null);
      chaff.clear(); dust.clear();
      S.phase = 'off';
    },
    press() {
      if (S.picking >= 0) return;
      const k = api.kid();
      let best = -1, bd = 1.4;
      S.list.forEach((e, i) => {
        if (e.picked) return;
        const d = Math.hypot(e.x - k.pos.x, e.z - k.pos.z);
        if (d < bd) { bd = d; best = i; }
      });
      if (best < 0) { api.sounds.boing(); return; }
      S.picking = best; S.pickT = 0;
      S.list[best].picked = true;
      S.pickFrom.set(S.list[best].x, ground() + 0.02, S.list[best].z);
      writeEars();
    },
    release() {},
    always(dt) { chaff.update(dt); dust.update(dt); },
    update(dt) {
      clock += dt;
      const k = api.kid();
      moveCombine(dt, k);
      // the basket on the left arm
      basket.position.copy(k.pos).addScaledVector(k.side, -0.36).addScaledVector(k.fw, 0.04).setY(k.pos.y + 0.42);
      basket.rotation.y = k.yaw;
      inBasket.scale.y = Math.max(0.01, S.count / GOAL);
      inBasket.position.y = 0.04 + 0.18 * (S.count / GOAL);
      // an ear flies from the ground into the basket
      if (S.picking >= 0) {
        S.pickT += dt;
        const f = clamp(S.pickT / 0.45, 0, 1);
        if (f >= 1) {
          S.picking = -1; S.count++;
          api.sounds.pick();
          if (S.count >= GOAL) { api.sounds.chime(); api.finish(null); return; }
        }
      }
      if (rnd() < dt) writeEars();
      // nearest ear for the hint
      let nd = Infinity;
      for (const e of S.list) if (!e.picked) nd = Math.min(nd, Math.hypot(e.x - k.pos.x, e.z - k.pos.z));
      api.meter(S.count / GOAL, `${S.count} / ${GOAL} 穗 ears`, '#c8a040');
      if (S.stopped) api.say('收割机停下来按喇叭了', 'The driver stopped for you. Step out of its way.');
      else api.say(nd < 1.4 ? '脚边有一穗！' : '跟着收割机走', nd < 1.4 ? 'An ear at your feet: press E.' : `Nearest ear ${Number.isFinite(nd) ? Math.round(nd) + ' m' : 'behind the combine'}.`);
    },
    posture(rig) {
      const P = rig.parts;
      if (S.picking >= 0) {
        const f = Math.sin(clamp(S.pickT / 0.45, 0, 1) * Math.PI);
        P.torso.rotation.x = -1.0 * f;
        P.hips.position.y -= 0.12 * f;
        P['knee L'].rotation.x = P['knee R'].rotation.x = -0.6 * f;
        P['leg L'].rotation.x = P['leg R'].rotation.x = 0.4 * f;
        P['arm R'].rotation.x = 0.9 * f;
      }
      P['arm L'].rotation.x = 0.6;
      P['arm L'].rotation.z = -0.3;  // out to the basket on the left side
    },
    state: S,
  };
  return A;
}
