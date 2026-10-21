// 捉蜻蜓 / 捉萤火虫: summer with a bamboo net. By day, red dragonflies dart and hover by the ponds and perch on
// grass stems; walk up slowly (running scares them) and swing the net when one is perched or hovering close.
// On summer nights (dusk and night skies) fireflies blink over the fields and the water, and go into a glass
// bottle that glows at the child's side, to be let go at the end.
import * as THREE from 'three';
import {toon, glow, rnd, clamp, lerp, hand, nearestPond, particles} from './common.js';

const MONTHS = [6, 7, 8, 9];
const GOAL = 6;

function dragonflyModel() {
  const g = new THREE.Group();
  const red = toon(0xc8402a);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.005, 0.075, 6).rotateX(Math.PI / 2), red);
  body.position.z = 0.02;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), toon(0x7a2418));
  head.position.z = -0.02;
  const wingMat = new THREE.MeshBasicMaterial({color: 0xeef4f2, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false});
  const wings = [];
  for (const [x, z] of [[1, -0.008], [-1, -0.008], [1, 0.006], [-1, 0.006]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.014).rotateX(-Math.PI / 2).translate(x * 0.032, 0, 0), wingMat);
    w.position.z = z;
    g.add(w);
    wings.push(w);
  }
  g.add(body, head);
  g.scale.setScalar(1.8);  // a painted world: a little larger than life so they read on screen
  return {root: g, wings};
}

function stalk() {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.008, 0.8, 4).translate(0, 0.4, 0), toon(0x6e8a3a));
  m.castShadow = false;
  return m;
}

function makeNet() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 1.5, 6).translate(0, 0.75, 0), toon(0xb89a52));
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.008, 5, 18).rotateX(Math.PI / 2).translate(0, 1.67, 0), toon(0x8a6a3c));
  const bag = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.32, 14, 1, true).rotateX(Math.PI).translate(0, 1.52, 0),
    new THREE.MeshBasicMaterial({color: 0xf2efe6, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false}));
  g.add(pole, hoop, bag);
  return g;
}

export function createBugs(api) {
  const {scene, walk, life, crops, village} = api;
  const data = village.data;
  const ground = () => data.nav.ground;

  const net = makeNet();
  const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 10),
    new THREE.MeshBasicMaterial({color: 0xdfeee8, transparent: true, opacity: 0.35, depthWrite: false}));
  const flies = particles(scene, {n: 60, color: 0xeaff80, size: 0.3, additive: true, gravity: 0});
  const freed = particles(scene, {n: 40, color: 0xeaff80, size: 0.3, additive: true, gravity: 0.15, drag: 0.4});
  const dfModels = Array.from({length: 8}, () => dragonflyModel());
  const stalks = Array.from({length: 8}, () => stalk());
  for (const o of [net, jar, ...dfModels.map((d) => d.root), ...stalks]) { o.visible = false; scene.add(o); }

  const S = {phase: 'off', night: false, bugs: [], caught: 0, swing: -1, swingHit: false, msgT: 0, msg: null, hoop: new THREE.Vector3(), reachA: new THREE.Vector3()};
  const seg = new THREE.Line3();
  const segDist = (p, a, b) => { seg.set(a, b); return seg.closestPointToPoint(p, true, new THREE.Vector3()).distanceTo(p); };
  let clock = 0;
  const kidSpeed = {last: new THREE.Vector3(), v: 0};

  function landPoint(c, rmin, rmax, overWater = false) {
    for (let k = 0; k < 30; k++) {
      const a = rnd() * 6.283, r = rmin + rnd() * (rmax - rmin);
      const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      const pond = nearestPond(data, x, z);
      const wet = pond?.inside;
      if (wet && !overWater) continue;
      if (walk.solidAt(x, z, ground() + 0.6, ground() + 2, 0.3)) continue;  // inside walls or trees
      return new THREE.Vector3(x, ground(), z);
    }
    return c.clone().add(new THREE.Vector3(rnd() * 4 - 2, 0, rnd() * 4 - 2));
  }

  function spawn() {
    const k = api.kid();
    S.bugs = [];
    const n = S.night ? 16 : 8;
    for (let i = 0; i < n; i++) {
      const home = landPoint(k.pos, 3, S.night ? 14 : 10, true);
      const b = {i, home, pos: home.clone().setY(ground() + 0.6 + rnd() * 1.2), goal: null, mode: 'hover', t: rnd() * 2, caught: false,
        phase: rnd() * 6, blink: rnd() * 6, stalk: null};
      S.bugs.push(b);
      if (!S.night) { dfModels[i].root.visible = true; dfModels[i].root.position.copy(b.pos); }
    }
  }

  function nextMove(b) {
    // dragonflies: dart to a new spot, hover there, sometimes perch on a grass stem
    const r = rnd();
    if (b.mode === 'dart' && r < 0.35) {
      const p = landPoint(b.home, 0, 6);
      const s = stalks[b.i];
      s.position.copy(p);
      s.visible = true;
      b.stalk = p.clone().setY(p.y + 0.8);
      b.goal = b.stalk.clone();
      b.mode = 'land';
      b.t = 0;
      return;
    }
    if (b.mode === 'dart' || b.mode === 'perch') {
      b.mode = 'hover'; b.t = 1 + rnd() * 2.5; b.goal = null;
      if (b.stalk) { stalks[b.i].visible = false; b.stalk = null; }
      return;
    }
    const p = landPoint(b.home, 0, 7, true).setY(ground() + 0.5 + rnd() * 1.3);
    b.goal = p; b.mode = 'dart'; b.t = 0;
  }

  function updateDragonfly(b, dt, kid) {
    const near = b.pos.distanceTo(kid.pos.clone().setY(b.pos.y));
    // running children scare them off
    if (near < 3 && kidSpeed.v > 2.6 && b.mode !== 'flee') {
      const away = b.pos.clone().sub(kid.pos).setY(0).normalize();
      b.goal = b.pos.clone().addScaledVector(away, 7).setY(ground() + 1.8);
      b.mode = 'flee';
      if (b.stalk) { stalks[b.i].visible = false; b.stalk = null; }
    }
    b.t -= dt;
    if (b.goal) {
      const speed = b.mode === 'flee' ? 7 : b.mode === 'land' ? 1.6 : 4.5;
      const d = b.goal.clone().sub(b.pos), L = d.length();
      if (L > 0.03) {
        b.pos.addScaledVector(d.normalize(), Math.min(L, speed * dt));
        b.yaw = Math.atan2(-d.x, -d.z);
      } else if (b.mode === 'land') { b.mode = 'perch'; b.t = 3 + rnd() * 5; b.goal = null; }
      else if (b.mode === 'flee') { b.home = b.pos.clone().setY(ground()); b.mode = 'hover'; b.t = 2; b.goal = null; }
      else { b.mode = 'hover'; b.t = 0.8 + rnd() * 2.5; b.goal = null; }
    } else if (b.t <= 0) nextMove(b);
    const m = dfModels[b.i];
    const bob = b.mode === 'hover' ? Math.sin(clock * 5 + b.phase) * 0.04 : 0;
    m.root.position.set(b.pos.x, b.pos.y + bob, b.pos.z);
    m.root.rotation.y = (b.yaw ?? 0) + (b.mode === 'hover' ? Math.sin(clock * 1.3 + b.phase) * 0.3 : 0);
    const flap = b.mode === 'perch' ? 0 : Math.sin(clock * 70 + b.phase) * 0.6;
    m.wings.forEach((w, k) => { w.rotation.z = (k % 2 ? -1 : 1) * flap; });
  }

  function updateFirefly(b, dt) {
    // fireflies drift slowly about their home and blink
    b.phase += dt * 0.5;
    const p = b.home;
    b.pos.set(p.x + Math.sin(b.phase * 1.3 + b.i) * 2.2, ground() + 0.7 + Math.sin(b.phase * 0.9 + b.i * 2) * 0.5 + 0.4, p.z + Math.cos(b.phase * 1.1 + b.i * 3) * 2.2);
  }

  function swingAt(dt, kid) {
    if (S.swing < 0) return;
    S.swing += dt;
    const k = clamp(S.swing / 0.42, 0, 1);
    // check the hoop's sweep against the bugs while it passes
    if (k > 0.25 && k < 0.8 && !S.swingHit) {
      for (const b of S.bugs) {
        if (b.caught) continue;
        if (segDist(b.pos, S.reachA, S.hoop) > (S.night ? 0.5 : 0.45)) continue;
        const odds = S.night ? 0.85 : {perch: 1, hover: 0.75, land: 0.6, dart: 0.25, flee: 0.05}[b.mode];
        if (rnd() < odds) {
          b.caught = true;
          S.swingHit = true;
          S.caught++;
          if (!S.night) { dfModels[b.i].root.visible = false; stalks[b.i].visible = false; }
          api.sounds.pick(); api.buzz(30);
          S.msg = ['捉到了！', `${S.caught} / ${GOAL} in the ${S.night ? 'bottle' : 'jar'}`]; S.msgT = 1.6;
        } else if (!S.night) {
          b.mode = 'flee';
          b.goal = b.pos.clone().add(new THREE.Vector3(rnd() * 8 - 4, 1.5, rnd() * 8 - 4));
          S.msg = ['差一点！', 'Just missed: it saw the net coming.']; S.msgT = 1.6;
        }
        break;
      }
    }
    if (k >= 1) S.swing = -1;
  }

  function finishRecord() {
    if (S.caught > 0) {
      api.record(S.night ? 'fireflies' : 'bugs', (r) => ({best: Math.max(r.best || 0, S.caught), total: (r.total || 0) + S.caught}));
    }
  }

  const A = {
    id: 'bugs', icon: '🪰', zh: '捉蜻蜓', en: 'Dragonflies', pauseWalk: false,
    available() {
      if (!MONTHS.includes(api.month()) || api.wet()) return false;
      const k = api.kid();
      S.night = api.night();
      A.icon = S.night ? '✨' : '🪰';
      A.zh = S.night ? '捉萤火虫' : '捉蜻蜓';
      A.en = S.night ? 'Fireflies' : 'Dragonflies';
      const pond = nearestPond(data, k.pos.x, k.pos.z);
      const byWater = pond && pond.e.d < 30;
      return S.night ? (byWater || crops.fieldAt(k.pos.x, k.pos.z)) : byWater;
    },
    start() {
      S.night = api.night();
      S.caught = 0; S.swing = -1; S.msg = null; S.msgT = 0;
      net.visible = jar.visible = true;
      kidSpeed.last.copy(api.kid().pos);
      spawn();
      api.say(S.night ? '萤火虫一闪一闪' : '蜻蜓在塘边飞', S.night ? 'Walk up to the blinking lights and swing the net (E).'
        : 'Walk slowly (running scares them). Swing (E) when one hovers or perches near.');
      api.action('挥网 Swing · E');
      api.meter(0, `0 / ${GOAL}`);
    },
    stop() {
      finishRecord();
      // let the fireflies go: they rise out of the bottle
      if (S.night && S.caught) {
        const p = jar.position;
        for (let i = 0; i < S.caught; i++) freed.emit(p.x, p.y, p.z, rnd() - 0.5, 0.6 + rnd() * 0.5, rnd() - 0.5, 6);
        api.toast(`✨ 放了 ${S.caught} 只萤火虫 · You let ${S.caught} fireflies go`);
      } else if (S.caught) api.toast(`🪰 捉了 ${S.caught} 只蜻蜓，又放飞了 · ${S.caught} dragonflies caught and let go`);
      for (const o of [net, jar, ...dfModels.map((d) => d.root), ...stalks]) o.visible = false;
      flies.clear();
      S.bugs = [];
      S.phase = 'off';
    },
    press() {
      if (S.swing < 0) { S.swing = 0; S.swingHit = false; api.sounds.swish(); }
    },
    release() {},
    always(dt) { freed.update(dt); },
    update(dt) {
      clock += dt;
      const kid = api.kid();
      const moved = kid.pos.distanceTo(kidSpeed.last);
      kidSpeed.v = lerp(kidSpeed.v, moved / Math.max(dt, 1e-3), 0.2);
      kidSpeed.last.copy(kid.pos);
      // the net in the right hand: held up, then swept down and across on a swing
      const h = hand(life, 'R');
      const k = S.swing < 0 ? 0 : clamp(S.swing / 0.42, 0, 1);
      const elev = lerp(1.1, -0.05, Math.sin(k * Math.PI / 2));
      const yawOff = S.swing < 0 ? 0.35 : lerp(0.9, -0.7, k);
      net.position.copy(h);
      net.rotation.set(0, 0, 0);
      net.rotation.order = 'YXZ';
      net.rotation.y = kid.yaw + yawOff;
      net.rotation.x = -(Math.PI / 2 - elev);
      net.updateMatrixWorld(true);
      S.hoop.set(0, 1.84, 0).applyMatrix4(net.matrixWorld);  // the far rim of the hoop
      S.reachA.set(0, 0.95, 0).applyMatrix4(net.matrixWorld);  // the pole's far half also sweeps them in
      swingAt(dt, kid);
      // the jar hangs at the left hip
      jar.position.copy(kid.pos).addScaledVector(kid.side, -0.2).add(new THREE.Vector3(0, 0.72, 0)).addScaledVector(kid.fw, 0.05);
      for (const b of S.bugs) {
        if (b.caught) continue;
        if (S.night) updateFirefly(b, dt); else updateDragonfly(b, dt, kid);
      }
      // fireflies: free ones blink, caught ones glow in the bottle
      if (S.night) {
        let i = 0;
        for (const b of S.bugs) {
          b.blink += dt;
          const on = b.caught || Math.sin(b.blink * 2.2 + b.i) > 0.2;
          if (!on) continue;
          const p = b.caught ? jar.position.clone().add(new THREE.Vector3(Math.sin(clock * 2 + b.i) * 0.03, Math.sin(clock * 1.3 + b.i) * 0.04, Math.cos(clock * 2 + b.i) * 0.03)) : b.pos;
          flies.emit(p.x, p.y, p.z, 0, 0, 0, 0.05);
          i++;
        }
      }
      flies.update(dt);
      // when the visible ones have gone, a few new ones come by
      if (S.bugs.filter((b) => !b.caught).length < 3) {
        const add = landPoint(kid.pos, 5, 10, true);
        const free = S.night ? S.bugs.length : dfModels.findIndex((d, j) => !S.bugs.some((b) => b.i === j && !b.caught));
        if (free >= 0 && (S.night ? S.bugs.length < 30 : true)) {
          const b = {i: free, home: add, pos: add.clone().setY(ground() + 1), goal: null, mode: 'hover', t: 1, caught: false, phase: rnd() * 6, blink: 0, stalk: null};
          S.bugs = S.bugs.filter((x) => !(x.i === free && x.caught) || S.night);
          S.bugs.push(b);
          if (!S.night) dfModels[free].root.visible = true;
        }
      }
      S.msgT -= dt;
      if (S.msgT > 0 && S.msg) api.say(...S.msg);
      else {
        const nearest = Math.min(...S.bugs.filter((b) => !b.caught).map((b) => b.pos.distanceTo(kid.pos.clone().setY(b.pos.y))));
        const perched = S.bugs.some((b) => !b.caught && b.mode === 'perch' && b.pos.distanceTo(kid.pos.clone().setY(b.pos.y)) < 6);
        if (S.night) api.say('萤火虫一闪一闪', nearest < 2 ? 'Close enough: swing!' : 'Walk up to a blinking light.');
        else api.say(kidSpeed.v > 2.6 ? '跑太快会吓跑它们' : perched ? '有一只停在草上！' : '蜻蜓在塘边飞',
          kidSpeed.v > 2.6 ? 'Running scares them. Walk slowly.' : perched ? 'One is resting on a grass stem: creep up and swing.' : nearest < 2 ? 'Close enough: swing!' : 'Walk slowly towards one.');
      }
      api.meter(S.caught / GOAL, `${S.caught} / ${GOAL}`, '#5f9a48');
      if (S.caught >= GOAL) api.finish(null);
    },
    posture(rig) {
      const P = rig.parts;
      const k = S.swing < 0 ? 0 : clamp(S.swing / 0.42, 0, 1);
      P['arm R'].rotation.x = S.swing < 0 ? 1.5 : lerp(2.5, 0.8, k);
      P['arm R'].rotation.z = S.swing < 0 ? -0.1 : lerp(0.3, -0.6, k);
      P.torso.rotation.y = S.swing < 0 ? 0 : lerp(-0.3, 0.4, k);
    },
    state: S,
  };
  return A;
}
