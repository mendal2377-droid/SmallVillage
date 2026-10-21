// 放风筝: a painted swallow kite (沙燕) over the open fields in spring and autumn. Stand with your back to
// the wind; hold to pull the kite up through the lulls, let go in the gusts so the spool pays out line.
// Pulling through a gust snaps the line; letting the kite sag in a lull brings it down. 80 m of line out
// and the kite is a dot in the sky.
import * as THREE from 'three';
import {toon, rnd, clamp, damp, lerp, smoothCamera, hand, openAround} from './common.js';
import {makeToon} from '../toon.js';

const MONTHS = [3, 4, 5, 9, 10, 11];
const GOAL = 80;

function swallowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.lineJoin = 'round';
  // wings and body
  g.fillStyle = '#f6efe0';
  g.strokeStyle = '#1f1d1a';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(128, 70);
  g.bezierCurveTo(90, 60, 30, 70, 8, 104);
  g.bezierCurveTo(40, 112, 80, 120, 104, 138);
  g.lineTo(108, 196);
  g.lineTo(88, 250);
  g.lineTo(122, 206);
  g.lineTo(128, 214);
  g.lineTo(134, 206);
  g.lineTo(168, 250);
  g.lineTo(148, 196);
  g.lineTo(152, 138);
  g.bezierCurveTo(176, 120, 216, 112, 248, 104);
  g.bezierCurveTo(226, 70, 166, 60, 128, 70);
  g.closePath();
  g.fill();
  g.stroke();
  // painted wing feathers and belly
  for (const s of [-1, 1]) {
    g.fillStyle = '#c9402c';
    g.beginPath();
    g.moveTo(128 + s * 22, 84);
    g.bezierCurveTo(128 + s * 60, 78, 128 + s * 96, 86, 128 + s * 112, 102);
    g.bezierCurveTo(128 + s * 80, 104, 128 + s * 50, 108, 128 + s * 24, 122);
    g.closePath();
    g.fill();
    g.fillStyle = '#2d5d8a';
    g.beginPath();
    g.arc(128 + s * 62, 98, 9, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#e8b830';
  g.beginPath();
  g.ellipse(128, 160, 14, 26, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1f1d1a';  // the head
  g.beginPath();
  g.arc(128, 66, 18, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#f6efe0';
  for (const s of [-1, 1]) { g.beginPath(); g.arc(128 + s * 7, 62, 4, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ribbon(color, len = 2.4, segs = 14) {
  const g = new THREE.PlaneGeometry(0.07, len, 1, segs);
  const m = new THREE.Mesh(g, toon(color));
  m.frustumCulled = false;
  return {mesh: m, segs, len, pos: g.attributes.position};
}

export function createKite(api) {
  const {scene, walk, life, crops, village} = api;
  const ground = () => village.data.nav.ground;

  const kiteMat = makeToon({kind: 'color', map: swallowTexture()});
  kiteMat.alphaTest = 0.5;
  const kg = new THREE.PlaneGeometry(1.3, 1.3, 6, 6);
  const kp = kg.attributes.position;
  for (let i = 0; i < kp.count; i++) kp.setZ(i, -0.18 * kp.getX(i) ** 2);  // bowed wings
  kg.computeVertexNormals();
  const kite = new THREE.Mesh(kg, kiteMat);
  kite.castShadow = true;
  const tails = [ribbon(0xc9402c), ribbon(0x2d5d8a)];
  const lineGeo = new THREE.BufferGeometry();
  const LN = 40, linePos = new Float32Array(LN * 3);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({color: 0x3c3a32, transparent: true, opacity: 0.75}));
  line.frustumCulled = false;
  const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 10).rotateZ(Math.PI / 2), toon(0x8a6a3c));
  const props = [kite, line, spool, ...tails.map((t) => t.mesh)];
  for (const o of props) { o.visible = false; scene.add(o); }

  const cam = smoothCamera();
  const S = {phase: 'off', t: 0, len: 5, elev: 0.3, tension: 0.2, pull: false, wind: 0.7, gustT: 4, gust: 0, windDir: new THREE.Vector3(),
    veer: 0, kitePos: new THREE.Vector3(), handPos: new THREE.Vector3(), best: 0, celebrated: false, fall: null, spoolSpin: 0, payT: 0};
  let clock = 0;

  function windNow(dt) {
    // a slow swell plus gusts that build, hold and fade
    S.gustT -= dt;
    if (S.gustT <= 0 && S.gust === 0) { S.gust = 0.0001; S.gustHold = 1 + rnd() * 1.6; api.sounds.gust(1); }
    if (S.gust > 0) {
      S.gustHold -= dt;
      S.gust = S.gustHold > 0 ? Math.min(1, S.gust + dt * 1.8) : S.gust - dt * 0.9;
      if (S.gust <= 0) { S.gust = 0; S.gustT = 3.5 + rnd() * 5; }
    }
    const swell = 0.6 + 0.25 * Math.sin(clock * 0.45) + 0.1 * Math.sin(clock * 1.3);
    S.wind = swell + S.gust * 0.75;
    S.veer = Math.sin(clock * 0.21) * 0.25;
  }

  function placeKite(dt) {
    hand(life, 'R', S.handPos);
    const dir = S.windDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), S.veer);
    const sway = Math.sin(clock * 1.7) * 0.06 * S.len * (0.4 + S.gust);
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    S.kitePos.copy(S.handPos).addScaledVector(dir, S.len * Math.cos(S.elev)).addScaledVector(side, sway);
    S.kitePos.y += S.len * Math.sin(S.elev);
    if (S.phase === 'down' || S.phase === 'lost') S.kitePos.copy(S.fall.pos);
    kite.position.copy(S.kitePos);
    // the kite faces the child, tilted back into the wind, rocking with the gusts
    kite.lookAt(S.handPos.x, S.kitePos.y - S.len * 0.15, S.handPos.z);
    kite.rotateZ(Math.sin(clock * 2.3) * 0.18 * (0.5 + S.gust));
    kite.rotateX(-0.25);
    // tails stream downwind and below
    const back = new THREE.Vector3(0, -0.6, 0).add(dir.clone().multiplyScalar(0.8)).normalize();
    tails.forEach((t, k) => {
      const root = new THREE.Vector3((k ? 0.12 : -0.12), -0.55, 0).applyQuaternion(kite.quaternion).add(kite.position);
      const P = t.pos, n = t.segs;
      for (let i = 0; i <= n; i++) {
        const f = i / n, w = Math.sin(clock * 7 - f * 6 + k) * 0.25 * f;
        const p = root.clone().addScaledVector(back, f * t.len).addScaledVector(side, w);
        P.setXYZ(i * 2, p.x - 0.035, p.y, p.z);
        P.setXYZ(i * 2 + 1, p.x + 0.035, p.y, p.z);
      }
      // PlaneGeometry rows run top to bottom: write rows in order
      P.needsUpdate = true;
      t.mesh.geometry.computeVertexNormals();
    });
    // the line: sags when slack, straight when tight
    const L = S.handPos.distanceTo(S.kitePos), sag = (1 - S.tension) * 0.12 * L + 0.02 * L;
    for (let i = 0; i < LN; i++) {
      const f = i / (LN - 1);
      const p = S.handPos.clone().lerp(S.kitePos, f);
      p.y -= Math.sin(f * Math.PI) * sag;
      linePos.set([p.x, p.y, p.z], i * 3);
    }
    lineGeo.attributes.position.needsUpdate = true;
    spool.position.copy(hand(life, 'L'));
    spool.rotation.y = api.kid().yaw;
    spool.rotation.x = S.spoolSpin;
  }

  function relaunch() {
    S.len = 5; S.elev = 0.35; S.tension = 0.2; S.celebrated = false; S.fall = null;
    S.phase = 'launch'; S.t = 0;
    kite.visible = line.visible = true;
    for (const t of tails) t.mesh.visible = true;
  }

  const A = {
    id: 'kite', icon: '🪁', zh: '放风筝', en: 'Kite', pauseWalk: true,
    available() {
      const k = api.kid();
      return MONTHS.includes(api.month()) && !api.wet() && api.sky() !== 'night'
        && (crops.fieldAt(k.pos.x, k.pos.z) || crops.onRoad(k.pos.x, k.pos.z)) && openAround(walk, k.pos.x, k.pos.z, ground(), 5);
    },
    start() {
      const k = api.kid();
      S.windDir.copy(k.fw);
      S.best = 0;
      clock = 0; S.gust = 0; S.gustT = 3;
      spool.visible = true;
      relaunch();
      cam.reset();
      api.second(null);
      api.say('背着风站好', 'Your back to the wind. Hold to toss the kite up and pull.');
      api.action('起飞 Launch · hold');
    },
    stop() {
      for (const o of props) o.visible = false;
      if (S.best >= 5) {
        api.record('kite', (r) => ({best: Math.max(r.best || 0, Math.round(S.best)), count: (r.count || 0) + 1}));
      }
      S.phase = 'off';
    },
    press() {
      S.pull = true;
      if (S.phase === 'launch') { S.phase = 'fly'; S.t = 0; S.elev = 0.55; api.sounds.whoosh(); }
      else if (S.phase === 'down' || S.phase === 'lost') relaunch();
    },
    release() { S.pull = false; },
    update(dt) {
      clock += dt;
      S.t += dt;
      windNow(dt);
      const gusty = S.wind > 1.05, lull = S.wind < 0.55;
      if (S.phase === 'fly') {
        // tension: pulling into the wind loads the line; letting go relieves it
        if (S.pull) S.tension = clamp(S.tension + dt * (S.wind * 0.95 - 0.38), 0.05, 1);
        else S.tension = clamp(S.tension - dt * 0.55, 0.05, 1);
        // height: the wind lifts, pulling lifts more in a lull, a slack line in a lull sinks
        let target = 0.25 + 0.45 * clamp(S.wind, 0, 1.3);
        if (S.pull) target += lull ? 0.35 : 0.15;
        else if (lull) target -= 0.35;
        S.elev = damp(S.elev, clamp(target, 0.02, 1.25), 1.2, dt);
        // line: pulling takes some in; a free spool pays out in good wind
        if (S.pull) S.len = Math.max(4, S.len - dt * 0.5);
        else if (S.wind > 0.6) {
          S.len += dt * (S.wind - 0.6) * 5.5;
          S.spoolSpin += dt * (S.wind - 0.6) * 25;
          if ((S.payT -= dt) <= 0) { S.payT = 0.12; api.sounds.tick(); }
        }
        S.best = Math.max(S.best, S.len);
        if (S.tension >= 1) {
          S.phase = 'lost'; S.t = 0;
          S.fall = {pos: S.kitePos.clone(), v: S.windDir.clone().multiplyScalar(4).setY(1.5)};
          api.sounds.snap(); api.buzz([30, 30, 60]);
        } else if (S.elev < 0.09 && S.len > 3) {
          S.phase = 'down'; S.t = 0;
          S.fall = {pos: S.kitePos.clone(), v: S.windDir.clone().multiplyScalar(-1).setY(-2)};
          api.sounds.boing();
        } else if (S.len >= GOAL && !S.celebrated) {
          S.celebrated = true;
          api.sounds.chime(); api.buzz([30, 50, 30]);
          api.toast(`🪁 风筝成了天上的小点 · ${GOAL} m of line out!`);
        }
      } else if (S.fall) {
        // falling (a slack kite) or drifting away (a snapped line)
        S.fall.v.y += (S.phase === 'down' ? -3 : -0.3) * dt;
        S.fall.pos.addScaledVector(S.fall.v, dt);
        const floor = ground() + 0.3;
        if (S.fall.pos.y < floor) { S.fall.pos.y = floor; S.fall.v.set(0, 0, 0); }
        if (S.phase === 'lost') { line.visible = S.t < 0.4; S.tension = 0; }
      }
      placeKite(dt);
      // the panel
      const h = Math.max(0, S.kitePos.y - ground());
      if (S.phase === 'launch') api.meter(null);
      else if (S.phase === 'fly') {
        api.meter(S.tension, `线 ${Math.round(S.len)} m · 高 ${Math.round(h)} m · 风 ${gusty ? '阵风 gust' : lull ? '风小 lull' : '稳 steady'}`,
          S.tension > 0.8 ? '#d0402a' : S.tension > 0.55 ? '#e0a020' : '#5f9a48');
        if (gusty) api.say('起阵风了！松手放线', 'A gust: let go so the spool pays out line.');
        else if (lull) api.say('风小了，拉！', 'The wind drops: hold to pull the kite up.');
        else api.say(S.celebrated ? '飞得真高！' : `放线 ${Math.round(S.len)} / ${GOAL} m`, S.celebrated ? 'Stop whenever you like; the record is kept.' : 'Steady wind: let it climb, pull only if it sags.');
        api.action(S.pull ? '拉 Pulling…' : '拉 Pull · hold', {urgent: gusty && S.pull});
      } else if (S.phase === 'down') {
        api.meter(null);
        api.say('风筝栽下来了', 'It came down in the lull. Tap to launch again.');
        api.action('再放 Launch again');
      } else if (S.phase === 'lost') {
        api.meter(null);
        api.say('线断了，风筝飞走了…', 'The line snapped in the gust. Tap for another kite.');
        api.action('再放 Another kite');
      }
    },
    camera(c, dt) {
      const k = api.kid();
      const head = k.pos.clone().setY(k.pos.y + 1.3);
      // low behind the child, looking up the line: the child at the bottom of the view, the kite high in it
      // the camera stands back and to the right and looks past the child, so the child stays left of the panel
      const narrow = c.aspect < 1;
      const want = head.clone().addScaledVector(S.windDir, narrow ? -9 : -7.5).addScaledVector(k.side, narrow ? 1.2 : 3.2).setY(k.pos.y + 1.5);
      const look = head.clone().addScaledVector(S.windDir, 8).addScaledVector(k.side, narrow ? 0.5 : 3.5);
      look.y -= narrow ? 1.2 : 0.7;
      look.y += clamp((S.kitePos.y - head.y) * 0.22, 0, 5);
      cam.update(c, want, look, dt, 3);
    },
    posture(rig, t) {
      const P = rig.parts;
      const tug = S.pull ? Math.sin(clock * 6) * 0.15 : 0;
      P['arm R'].rotation.x = (S.phase === 'fly' ? 2.1 : 1.4) - (S.pull ? 0.45 : 0) + tug;
      P['arm R'].rotation.z = -0.15;
      P['arm L'].rotation.x = 1.0;
      P['arm L'].rotation.z = 0.35;
      P.head.rotation.x = 0.35;  // looking up at the kite
      if (S.pull) { P.torso.rotation.x = 0.12; P['leg L'].rotation.x = 0.25; P['leg R'].rotation.x = -0.2; }
    },
    state: S,
  };
  return A;
}
