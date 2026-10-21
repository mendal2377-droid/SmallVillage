// 烤红薯: in autumn on the harvested fields, in winter in the home courtyard, a little fire of sticks inside a
// ring of stones. The side lying in the embers browns; poke it over (press) when it turns golden, switch
// between gentle and hot embers (B), and serve when both sides are done. Leave a side too long and it burns.
import * as THREE from 'three';
import {toon, glow, rnd, clamp, smoothCamera, particles, openAround, freeView} from './common.js';
import {makeToon} from '../toon.js';

const HOME = new THREE.Vector3(-33, 0, 112);  // the family courtyard

export function createRoast(api) {
  const {scene, walk, crops, village, life} = api;
  const ground = () => village.data.nav.ground;

  // ---- the fire pit
  const pit = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.075 + rnd() * 0.03, 0), toon(i % 2 ? 0x8a8676 : 0x76726a));
    s.position.set(Math.cos(a) * 0.33, 0.04, Math.sin(a) * 0.33);
    s.rotation.set(rnd() * 3, rnd() * 3, 0);
    s.scale.y = 0.7;
    pit.add(s);
  }
  for (let i = 0; i < 4; i++) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.62, 5).rotateZ(Math.PI / 2), toon(0x5a4630));
    st.position.y = 0.06;
    st.rotation.y = i * 0.8 + 0.3;
    pit.add(st);
  }
  const embers = new THREE.Mesh(new THREE.CircleGeometry(0.24, 16).rotateX(-Math.PI / 2), glow(0xd8582a, 0.85));
  embers.position.y = 0.03;
  pit.add(embers);
  const flames = [];
  for (let i = 0; i < 7; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 6).translate(0, 0.15, 0), glow(i % 2 ? 0xff9a3a : 0xffd070, 0.8));
    f.position.set((rnd() - 0.5) * 0.28, 0.04, (rnd() - 0.5) * 0.28);
    pit.add(f);
    flames.push(f);
  }
  // ---- the sweet potato: two halves so each side can show its own browning
  const potato = new THREE.Group();
  const halves = [0, 1].map((k) => {
    const g = new THREE.SphereGeometry(0.06, 12, 8, 0, Math.PI * 2, k ? Math.PI / 2 : 0, Math.PI / 2);
    const m = new THREE.Mesh(g, makeToon({kind: 'color', color: new THREE.Color(0x9a4a5a)}));
    m.scale.set(1.7, 1, 1);
    m.castShadow = true;
    potato.add(m);
    return m;
  });
  potato.position.y = 0.12;
  pit.add(potato);
  // opened at the end: the orange inside
  const inside = new THREE.Group();
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8, 0, Math.PI), toon(0x9a4a5a));
    const flesh = new THREE.Mesh(new THREE.CircleGeometry(0.058, 12), toon(0xf09a2a));
    h.add(flesh);
    h.scale.set(1, 1.05, 1.3);
    h.rotation.y = s > 0 ? Math.PI : 0;
    h.position.x = s * 0.08;
    inside.add(h);
  }
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, 1.0, 5).translate(0, 0.5, 0), toon(0x6a5236));
  const smoke = particles(scene, {n: 70, color: 0xb8b4a8, size: 0.35, opacity: 0.35, gravity: 0.25, drag: 0.6});
  const steam = particles(scene, {n: 40, color: 0xf4f2ea, size: 0.18, opacity: 0.5, gravity: 0.3, drag: 0.8});
  const sparks = particles(scene, {n: 40, color: 0xffb040, size: 0.04, additive: true, gravity: 0.5});
  for (const o of [pit, stick, inside]) { o.visible = false; scene.add(o); }

  const cam = smoothCamera();
  const S = {phase: 'off', sides: [0, 0], face: 0, heat: 'gentle', flip: 0, flipT: -1, poke: 0, t: 0, spot: new THREE.Vector3(), courtyard: false};
  let clock = 0, smokeT = 0, crackT = 0;
  const skin = new THREE.Color(0x9a4a5a), golden = new THREE.Color(0x8a4a24), dark = new THREE.Color(0x3a2418), burnt = new THREE.Color(0x141210);
  function shade(b) {
    const c = new THREE.Color();
    if (b < 0.7) return c.copy(skin).lerp(golden, b / 0.7);
    if (b < 1.15) return c.copy(golden).lerp(dark, (b - 0.7) / 0.45 * 0.5);
    return c.copy(dark).lerp(burnt, clamp((b - 1.15) / 0.15, 0, 1));
  }

  const A = {
    id: 'roast', icon: '🍠', zh: '烤红薯', en: 'Sweet potato', pauseWalk: true,
    available() {
      const m = api.month(), k = api.kid();
      if (api.wet() || api.sky() === 'summer storm') return false;
      const inYard = k.pos.distanceTo(HOME.clone().setY(k.pos.y)) < 9;
      if ([12, 1, 2].includes(m)) return inYard;
      return [10, 11].includes(m) && Boolean(crops.fieldAt(k.pos.x, k.pos.z)) && openAround(walk, k.pos.x, k.pos.z, ground(), 1.5);
    },
    start() {
      let k = api.kid();
      // the fire goes where there is room: ahead, to a side or behind; the child turns to face it
      const yaws = [0, -Math.PI / 2, Math.PI / 2, Math.PI].map((d) => k.yaw + d);
      const room = (y) => {
        const p = k.pos.clone().add(new THREE.Vector3(-Math.sin(y), 0, -Math.cos(y)).multiplyScalar(0.75));
        return !walk.solidAt(p.x, p.z, k.pos.y + 0.05, k.pos.y + 0.6, 0.4);
      };
      const yaw = yaws.find(room) ?? k.yaw;
      walk.place(k.pos.x, k.pos.y + walk.eyeHeight, k.pos.z, yaw, 0);
      k = api.kid();
      S.spot.copy(k.pos).addScaledVector(k.fw, 0.75);
      S.spot.y = k.pos.y;
      pit.position.copy(S.spot);
      pit.visible = stick.visible = true;
      inside.visible = false;
      potato.visible = true;
      potato.rotation.set(0, rnd() * 3, 0);
      S.sides = [0, 0]; S.face = 0; S.heat = 'gentle'; S.flip = 0; S.flipT = -1; S.phase = 'roast'; S.t = 0;
      halves.forEach((h) => h.material.color.copy(skin));
      cam.reset();
      // a clear view of the fire (the winter courtyard is small)
      const at = (a, b, h) => S.spot.clone().addScaledVector(k.side, a).addScaledVector(k.fw, b).setY(S.spot.y + h);
      S.camLook = S.spot.clone().addScaledVector(k.fw, -0.35).setY(S.spot.y + 0.35);
      S.camAt = freeView(walk, S.camLook, [at(2.3, 1.1, 1.35), at(-2.3, 1.1, 1.35), at(1.6, 1.8, 1.5), at(-1.6, 1.8, 1.5), at(1.2, -1.6, 1.8), at(0.8, 0.9, 1.6)]);
      api.second('🔥 小火 Gentle · B');
      api.say('埋在火里烤', 'The side in the embers browns. Turn it over when it is golden.');
      // the dog comes to sit by the fire
      if (life.dog) { life.dog.idle = 5; life.dog.goal = S.spot.clone().addScaledVector(k.side, 0.9).addScaledVector(k.fw, -0.2); }
    },
    stop() {
      for (const o of [pit, stick, inside]) o.visible = false;
      smoke.clear(); steam.clear(); sparks.clear();
      S.phase = 'off';
    },
    press() {
      if (S.phase !== 'roast') { if (S.phase === 'burnt' || S.phase === 'eaten') api.finish(null); return; }
      const ready = S.sides.every((b) => b >= 0.7 && b < 1.15);
      if (ready) {
        S.phase = 'serve'; S.t = 0;
        api.sounds.chime(); api.buzz([20, 40, 20]);
        api.record('roast', (r) => ({...r, count: (r.count || 0) + 1}));
        return;
      }
      if (S.flipT < 0) { S.flipT = 0; S.face = 1 - S.face; api.sounds.creak(); }
    },
    release() {},
    second() {
      if (S.phase !== 'roast') return;
      S.heat = S.heat === 'gentle' ? 'hot' : 'gentle';
      api.second(S.heat === 'hot' ? '🔥🔥 大火 Hot · B' : '🔥 小火 Gentle · B');
      for (let i = 0; i < 10; i++) sparks.emit(S.spot.x, S.spot.y + 0.1, S.spot.z, rnd() - 0.5, 1 + rnd(), rnd() - 0.5, 0.8);
    },
    always(dt) { smoke.update(dt); steam.update(dt); sparks.update(dt); },
    update(dt) {
      clock += dt; S.t += dt;
      const hot = S.heat === 'hot';
      // fire
      flames.forEach((f, i) => {
        f.scale.set(1, (hot ? 1.4 : 0.85) + Math.sin(clock * 11 + i * 2) * 0.25, 1);
        f.rotation.z = Math.sin(clock * 7 + i) * 0.15;
      });
      embers.material.opacity = 0.7 + Math.sin(clock * 9) * 0.15;
      if ((smokeT -= dt) <= 0) { smokeT = hot ? 0.12 : 0.22; smoke.emit(S.spot.x + rnd() * 0.2 - 0.1, S.spot.y + 0.35, S.spot.z + rnd() * 0.2 - 0.1, (rnd() - 0.5) * 0.2, 0.4, (rnd() - 0.5) * 0.2, 3); }
      if ((crackT -= dt) <= 0) { crackT = 0.15 + rnd() * (hot ? 0.4 : 0.9); api.sounds.crackle(); if (rnd() < 0.4) sparks.emit(S.spot.x, S.spot.y + 0.15, S.spot.z, rnd() - 0.5, 1.2, rnd() - 0.5, 0.6); }
      // browning: the side down in the embers cooks, the side up only warms
      if (S.phase === 'roast') {
        S.sides[S.face] += dt * (hot ? 0.115 : 0.065);
        S.sides[1 - S.face] += dt * 0.008;
        if (Math.max(...S.sides) >= 1.3) {
          S.phase = 'burnt'; S.t = 0;
          api.sounds.snap();
          api.record('roast', (r) => ({...r, burnt: (r.burnt || 0) + 1}));
        }
      }
      // the half facing up shows the side that is not in the fire
      halves[0].material.color.copy(shade(S.sides[S.face === 0 ? 1 : 0]));
      halves[1].material.color.copy(shade(S.sides[S.face]));
      if (S.flipT >= 0) {
        S.flipT += dt;
        const k = clamp(S.flipT / 0.35, 0, 1);
        // a half roll in the air; the colours above already follow the new side, so it settles back level
        potato.rotation.z = k * Math.PI;
        potato.position.y = 0.12 + Math.sin(k * Math.PI) * 0.12;
        if (k >= 1) { S.flipT = -1; potato.rotation.z = 0; }
      }
      // the stick in the child's hand reaches to the potato
      const k = api.kid();
      const from = k.pos.clone().addScaledVector(k.fw, 0.1).addScaledVector(k.side, 0.25).setY(k.pos.y + 0.55);
      const to = S.spot.clone().setY(S.spot.y + 0.12 + (S.flipT >= 0 ? 0.05 : 0));
      stick.position.copy(from);
      stick.lookAt(to);
      stick.rotateX(Math.PI / 2);
      if (S.phase === 'serve') {
        // lift it out, break it open, steam
        potato.visible = false;
        inside.visible = true;
        inside.position.copy(k.pos).addScaledVector(k.fw, 0.32).setY(k.pos.y + 0.62 + Math.min(1, S.t) * 0.1);
        inside.rotation.y = k.yaw;
        inside.children.forEach((h, i) => { h.position.x = (i ? 1 : -1) * (0.03 + Math.min(1, S.t / 0.6) * 0.07); });
        if (rnd() < dt * 14) steam.emit(inside.position.x, inside.position.y + 0.05, inside.position.z, (rnd() - 0.5) * 0.1, 0.3, (rnd() - 0.5) * 0.1, 1.6);
        if (S.t > 4) { S.phase = 'eaten'; }
      }
      // the panel
      const b = S.sides[S.face];
      const ready = S.sides.every((x) => x >= 0.7 && x < 1.15);
      if (S.phase === 'roast') {
        const word = b < 0.4 ? '还生 raw' : b < 0.7 ? '快了 nearly' : b < 1.15 ? '金黄 golden' : '要糊了！ burning';
        api.meter(b / 1.3, `这面 this side: ${word} · 两面 ${Math.round(S.sides[0] * 100)}% / ${Math.round(S.sides[1] * 100)}%`,
          b > 1.15 ? '#d0402a' : b >= 0.7 ? '#e0a020' : '#8a6a3c');
        api.say(ready ? '两面都好了！' : b >= 0.7 ? '这面黄了，翻！' : '慢慢烤…', ready ? 'Both sides are golden: serve it!'
          : b >= 0.7 ? 'This side is golden: turn it over.' : 'Gentle embers cook slowly; hot ones are faster but burn sooner.');
        api.action(ready ? '吃 Serve!' : '翻 Turn', {urgent: ready || b > 1.15});
      } else if (S.phase === 'serve' || S.phase === 'eaten') {
        api.meter(null);
        api.say('又香又甜！', 'Sweet and hot. The dog would like some too.');
        api.action('好吃 Done');
        api.second(null);
      } else if (S.phase === 'burnt') {
        api.meter(1, '糊了 burnt', '#3a2418');
        api.say('烤糊了…', 'Charred black. Turn it at golden, or use gentle embers.');
        api.action('再来 Done');
        api.second(null);
      }
    },
    camera(c, dt) {
      cam.update(c, S.camAt, S.camLook, dt, 3);
    },
    posture(rig) {
      // crouched by the fire, the stick in the right hand
      const P = rig.parts;
      P.hips.position.y -= 0.33;
      P['leg L'].rotation.x = P['leg R'].rotation.x = 1.5;
      P['knee L'].rotation.x = P['knee R'].rotation.x = -2.2;
      P.torso.rotation.x = -0.25;
      P['arm R'].rotation.x = 0.9;
      P['arm R'].rotation.z = -0.1;
      P['arm L'].rotation.x = S.phase === 'serve' || S.phase === 'eaten' ? 1.1 : 0.5;
      if (S.phase === 'serve' || S.phase === 'eaten') { P['arm R'].rotation.x = 1.1; P['arm R'].rotation.z = -0.25; P['arm L'].rotation.z = 0.25; }
      P.head.rotation.x = -0.25;
    },
    state: S,
  };
  return A;
}
