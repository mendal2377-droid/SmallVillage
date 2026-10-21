// 打出溜滑: in winter the ponds freeze over. Step onto the ice, hold to take a run-up, let go to slide;
// lean (A/D) to steer, but lean hard at speed and the child lands on their bottom (摔了个屁股墩儿).
// The longest slide is kept in the diary. The ice sheets themselves show on every pond from December to
// February.
import * as THREE from 'three';
import {rnd, clamp, damp, lerp, smoothCamera, nearestPond, inside, particles} from './common.js';
import {makeToon} from '../toon.js';

const FROZEN = [12, 1, 2];

function iceTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 256);
  // skate scratches and cracks, very light
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = `rgba(150, 175, 185, ${0.15 + Math.random() * 0.25})`;
    g.lineWidth = 0.6 + Math.random() * 1.2;
    g.beginPath();
    let x = Math.random() * 256, y = Math.random() * 256;
    g.moveTo(x, y);
    for (let k = 0; k < 3; k++) { x += (Math.random() - 0.5) * 90; y += (Math.random() - 0.5) * 30; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createIce(api) {
  const {scene, walk, village} = api;
  const data = village.data;

  // ---- ice sheets over the ponds (built once, shown in the frozen months)
  let sheets = null;
  function buildSheets() {
    sheets = new THREE.Group();
    sheets.name = 'pond ice';
    const map = iceTexture();
    map.repeat.set(1 / 9, 1 / 9);
    const mat = makeToon({kind: 'color', map, color: new THREE.Color(0xd3e4e6), opacity: 0.93});
    for (const P of Object.values(data.pondShapes || {})) {
      const shape = new THREE.Shape(P.outline.map(([x, z]) => new THREE.Vector2(x, -z)));
      const g = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, mat);
      m.position.y = P.water + 0.04;
      m.receiveShadow = true;
      m.renderOrder = 1;
      sheets.add(m);
    }
    scene.add(sheets);
  }

  const shavings = particles(scene, {n: 80, color: 0xf4fafa, size: 0.06, opacity: 0.9, gravity: -6});
  const cam = smoothCamera();
  const S = {phase: 'off', pond: null, P: null, iceY: 0, bank: new THREE.Vector3(), bankYaw: 0, pos: new THREE.Vector3(), yaw: 0, speed: 0,
    steer: 0, keys: new Set(), wobble: 0, from: null, last: 0, best: 0, falls: 0, t: 0, scrapeT: 0};

  function steerInput() { return (S.keys.has(1) ? 1 : 0) - (S.keys.has(-1) ? 1 : 0); }

  function moveOnIce(dt) {
    const fw = new THREE.Vector3(-Math.sin(S.yaw), 0, -Math.cos(S.yaw));
    const step = fw.clone().multiplyScalar(S.speed * dt);
    const next = S.pos.clone().add(step);
    // stay a little inside the outline; bump against the bank
    const ahead = next.clone().addScaledVector(fw, 0.5);
    if (!inside([ahead.x, ahead.z], S.P.outline)) {
      if (S.speed > 1.5) { api.sounds.boing(); api.buzz(40); }
      S.speed = 0;
      return false;
    }
    S.pos.copy(next);
    walk.place(S.pos.x, S.iceY + walk.eyeHeight, S.pos.z, S.yaw, -0.1);
    return true;
  }

  const A = {
    id: 'ice', icon: '⛸', zh: '打出溜滑', en: 'Ice slide', pauseWalk: true,
    available() {
      if (!FROZEN.includes(api.month())) return false;
      const k = api.kid();
      const p = nearestPond(data, k.pos.x, k.pos.z);
      return Boolean(p && !p.inside && p.e.d < 4.5);
    },
    start() {
      const k = api.kid();
      const p = nearestPond(data, k.pos.x, k.pos.z);
      S.pond = p.name; S.P = p.P; S.iceY = p.P.water + 0.04;
      S.bank.copy(k.pos); S.bankYaw = k.yaw;
      S.yaw = Math.atan2(-p.e.n.x, -p.e.n.z);
      S.pos.copy(p.e.p).addScaledVector(p.e.n, 1.2);
      S.speed = 0; S.steer = 0; S.wobble = 0; S.from = null; S.last = 0; S.best = 0; S.falls = 0; S.keys.clear();
      S.phase = 'stand'; S.t = 0;
      walk.place(S.pos.x, S.iceY + walk.eyeHeight, S.pos.z, S.yaw, -0.1);
      cam.reset();
      api.say('上冰了！', 'Hold to take a run-up, let go to slide. A/D or ◀ ▶ to lean and steer.');
      api.action('跑 Run · hold');
    },
    stop() {
      if (S.best > 0) api.record('ice', (r) => ({best: Math.max(r.best || 0, +S.best.toFixed(1)), falls: (r.falls || 0) + S.falls}));
      if (S.best > 0) api.toast(`⛸ 最远滑了 ${S.best.toFixed(1)} m${S.falls ? ` · 摔了 ${S.falls} 次` : ''}`);
      // back onto the bank
      const h = walk.standAt(S.bank.x, S.bank.z, data.nav.ground) ?? data.nav.ground;
      walk.place(S.bank.x, h + walk.eyeHeight, S.bank.z, S.bankYaw, 0);
      S.phase = 'off';
    },
    press() {
      if (S.phase === 'fallen') { if (S.t > 0.8) { S.phase = 'stand'; S.t = 0; } return; }
      if (S.phase === 'stand' || S.phase === 'slide' && S.speed < 0.6) { S.phase = 'run'; S.t = 0; }
    },
    release() {
      if (S.phase === 'run') {
        if (S.speed < 1) { S.phase = 'stand'; return; }
        S.phase = 'slide'; S.t = 0; S.from = S.pos.clone(); S.wobble = 0;
        api.sounds.swish();
      }
    },
    lean(dir, on) { if (on) S.keys.add(dir); else S.keys.delete(dir); },
    always(dt) {
      const on = FROZEN.includes(api.month());
      if (on && !sheets) buildSheets();
      if (sheets) sheets.visible = on;
      shavings.update(dt);
    },
    update(dt) {
      S.t += dt;
      const steer = steerInput();
      S.steer = damp(S.steer, steer, 6, dt);
      if (S.phase === 'stand') {
        S.yaw -= steer * dt * 1.6;  // turn on the spot
        walk.place(S.pos.x, S.iceY + walk.eyeHeight, S.pos.z, S.yaw, -0.1);
      } else if (S.phase === 'run') {
        // short slippery steps: the speed builds, with a little wobble
        S.speed = Math.min(4.6, S.speed + dt * 3.2);
        S.yaw -= steer * dt * 1.2;
        if (!moveOnIce(dt)) S.phase = 'stand';
        if (S.t > 2.2) A.release();  // the run-up is a few metres at most
      } else if (S.phase === 'slide') {
        S.speed = Math.max(0, S.speed - dt * (1.1 + Math.abs(S.steer) * 0.6));  // a good slide is several metres
        S.yaw -= S.steer * dt * 0.9 * clamp(S.speed / 3, 0.3, 1);
        // leaning hard at speed: the wobble builds until the child goes over
        S.wobble = clamp(S.wobble + dt * (Math.abs(steer) && S.speed > 2.4 ? 1.7 : -0.8), 0, 1.2);
        const moved = moveOnIce(dt);
        S.last = S.from.distanceTo(S.pos);
        if ((S.scrapeT -= dt) <= 0 && S.speed > 0.5) { S.scrapeT = 0.35; api.sounds.scrape(); }
        if (rnd() < dt * S.speed * 2) shavings.emit(S.pos.x, S.iceY + 0.03, S.pos.z, rnd() - 0.5, 0.6, rnd() - 0.5, 0.4);
        if (S.wobble >= 1.2) {
          S.phase = 'fallen'; S.t = 0; S.falls++;
          api.sounds.boing(); api.buzz([60, 40, 60]);
        } else if (S.speed <= 0 || !moved) {
          S.best = Math.max(S.best, S.last);
          S.phase = 'stand'; S.t = 0;
          if (S.last > 3) api.sounds.chime();
        }
      } else if (S.phase === 'fallen') {
        S.speed = Math.max(0, S.speed - dt * 1.6);  // sliding along on the bottom
        moveOnIce(dt);
        if (S.from) S.last = S.from.distanceTo(S.pos);
      }
      // the panel
      if (S.phase === 'stand') {
        api.say(S.last > 0 ? `滑了 ${S.last.toFixed(1)} m！` : '站在冰上', S.best ? `Best ${S.best.toFixed(1)} m. Turn with A/D, hold to run again.` : 'Hold to run, let go to slide.');
        api.action('跑 Run · hold');
        api.meter(null);
      } else if (S.phase === 'run') {
        api.say('跑！', 'Let go to slide.');
        api.action('松手滑 Let go to slide');
        api.meter(S.speed / 4.6, `${S.speed.toFixed(1)} m/s`, '#5f8aa8');
      } else if (S.phase === 'slide') {
        api.say(S.wobble > 0.6 ? '要摔了！' : '出溜——', S.wobble > 0.6 ? 'Wobbling: stop leaning!' : `${S.last.toFixed(1)} m`);
        api.action('滑行中 Sliding…', {disabled: true});
        api.meter(S.wobble / 1.2, `${S.last.toFixed(1)} m · 晃 wobble`, S.wobble > 0.6 ? '#d0402a' : '#5f8aa8');
      } else if (S.phase === 'fallen') {
        api.say('摔了个屁股墩儿！', 'Down on the ice! Tap to get up.');
        api.action('起来 Get up', {disabled: S.t < 0.8});
        api.meter(null);
      }
    },
    camera(c, dt) {
      const fw = new THREE.Vector3(-Math.sin(S.yaw), 0, -Math.cos(S.yaw));
      const want = S.pos.clone().addScaledVector(fw, -4.2).setY(S.iceY + 2.0);
      const look = S.pos.clone().addScaledVector(fw, 3).setY(S.iceY + 0.6);
      cam.update(c, want, look, dt, S.phase === 'fallen' ? 2 : 3.5);
    },
    posture(rig, t) {
      const P = rig.parts;
      if (S.phase === 'slide') {
        // one foot ahead, arms out like wings, swaying with the lean and the wobble
        P['leg L'].rotation.x = 0.45; P['leg R'].rotation.x = -0.3;
        P['knee L'].rotation.x = -0.2; P['knee R'].rotation.x = -0.4;
        P.hips.position.y -= 0.06;
        P['arm L'].rotation.z = -1.3 + Math.sin(t * 9) * S.wobble * 0.4;  // arms out like wings
        P['arm R'].rotation.z = 1.3 + Math.sin(t * 9 + 1) * S.wobble * 0.4;
        P['arm L'].rotation.x = P['arm R'].rotation.x = 0.2;
        P.torso.rotation.z = -S.steer * 0.3 + Math.sin(t * 11) * S.wobble * 0.15;
        P.torso.rotation.y = 0.5;
        P.hips.rotation.y = 0.5;
      } else if (S.phase === 'fallen') {
        // sitting on the ice, legs out, arms back
        P.hips.position.y -= 0.5;
        P['leg L'].rotation.x = P['leg R'].rotation.x = 1.45;
        P['knee L'].rotation.x = P['knee R'].rotation.x = -0.15;
        P.torso.rotation.x = 0.35;
        P['arm L'].rotation.x = P['arm R'].rotation.x = -0.6;
        P['arm L'].rotation.z = -0.4; P['arm R'].rotation.z = 0.4;
        P.head.rotation.z = Math.sin(t * 3) * 0.1;
      } else if (S.phase === 'run') {
        P['arm L'].rotation.z = -0.5; P['arm R'].rotation.z = 0.5;  // arms out for balance
      }
    },
    state: S,
  };
  return A;
}
