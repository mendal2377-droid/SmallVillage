// 电三轮: the family's electric tricycle, parked in the courtyard gateway. Climb on and ride the lanes and
// field roads with the dog sitting in the cargo bed. Hold to go (Space, W or the button), S to brake,
// A/D or ◀ ▶ to steer, B for reverse, H for the horn. It parks wherever you get off.
import * as THREE from 'three';
import {clamp, damp, smoothCamera, kitMesh} from './common.js';

const WHEELBASE = 2.05, MAX = 7.5, MAX_BACK = 2;

export function createTricycle(api) {
  const {scene, walk, village, life} = api;
  const ground = () => village.data.nav.ground;

  const trike = kitMesh(village, 'electric tricycle');
  scene.add(trike);
  trike.visible = false;
  const gp = village.groups.find((g) => g.key === 'electric tricycle');
  const rec = gp?.list[0]?.[0];
  const S = {phase: 'off', pos: new THREE.Vector3(rec ? rec[0] : -26.5, 0, rec ? rec[2] : 110.6), yaw: rec ? rec[3] : Math.PI / 2,
    speed: 0, steer: 0, lean: new Set(), go: false, brake: false, reverse: false, km: 0, top: 0, taken: false, motor: null, bumpT: 0};
  const cam = smoothCamera();

  function takeOver() {
    // the first ride replaces the static courtyard instance with a mesh of our own that can move and park anywhere
    if (S.taken) return;
    S.taken = true;
    if (rec) { rec[4] = rec[5] = rec[6] = 0; village.updateLod(api.camera, true); }
    trike.visible = true;
    place();
  }
  const fwd = () => new THREE.Vector3(-Math.sin(S.yaw), 0, -Math.cos(S.yaw));
  function place() {
    trike.position.set(S.pos.x, ground(), S.pos.z);
    trike.rotation.y = S.yaw;
  }
  function parkCollider(on) {
    const fw = fwd(), mid = S.pos.clone().addScaledVector(fw, 0.41);
    walk.setDynamic('tricycle', on ? {cx: mid.x, cz: mid.z, hx: 0.63, hz: 1.35, c: Math.cos(S.yaw), s: Math.sin(S.yaw), low: -10, high: 10} : null);
  }
  function blocked(p, fw, dir) {
    const side = new THREE.Vector3(-fw.z, 0, fw.x);
    const lead = p.clone().addScaledVector(fw, dir > 0 ? 1.75 : -1.0);
    const lo = ground() + 0.2, hi = ground() + 1.6;  // low enough that the ponds and ditches count
    return [-0.5, 0, 0.5].some((o) => {
      const q = lead.clone().addScaledVector(side, o);
      return walk.solidAt(q.x, q.z, lo, hi, 0.25);
    });
  }
  function seat() {
    const fw = fwd();
    return S.pos.clone().addScaledVector(fw, 0.72);
  }

  const A = {
    id: 'tricycle', icon: '🛺', zh: '开电三轮', en: 'Tricycle', pauseWalk: true,
    available() {
      const k = api.kid();
      return Math.hypot(k.pos.x - S.pos.x, k.pos.z - S.pos.z) < 3.4 && Math.abs(k.pos.y - ground()) < 0.5;
    },
    start() {
      takeOver();
      parkCollider(false);
      S.speed = 0; S.steer = 0; S.lean.clear(); S.go = S.brake = S.reverse = false;
      S.motor = api.sounds.hum(true);
      cam.reset();
      if (life.dog) life.dog.ride = {pos: new THREE.Vector3(), yaw: S.yaw};
      api.second('倒车 Reverse · B');
      api.say('坐好，出发！', 'Hold to go, S to brake, A/D or ◀ ▶ to steer, H for the horn.');
      api.sounds.beep();
    },
    stop() {
      S.motor = api.sounds.hum(false);
      S.speed = 0;
      parkCollider(true);
      // step off on the left, somewhere with room
      const fw = fwd(), side = new THREE.Vector3(-fw.z, 0, fw.x);
      let off = null;
      for (const [a, b] of [[-1.1, 0.7], [1.1, 0.7], [-1.1, -0.4], [1.1, -0.4], [0, 2.4], [0, -1.8]]) {
        const p = S.pos.clone().addScaledVector(side, a).addScaledVector(fw, b);
        const h = walk.standAt(p.x, p.z, ground());
        if (h !== undefined) { off = p.setY(h); break; }
      }
      off ??= S.pos.clone().addScaledVector(side, -1.1).setY(ground());
      walk.place(off.x, off.y + walk.eyeHeight, off.z, S.yaw, 0);
      if (life.dog?.ride) {
        life.dog.ride = null;
        life.dog.pos.copy(S.pos).addScaledVector(side, 1.2).setY(ground());  // hops down beside the tricycle
      }
      if (S.km > 0.001) api.record('tricycle', (r) => ({km: (r.km || 0) + S.km, top: Math.max(r.top || 0, S.top)}));
      S.km = 0; S.top = 0;
      S.phase = 'off';
    },
    press() { S.go = true; },
    release() { S.go = false; },
    lean(dir, on) { if (on) S.lean.add(dir); else S.lean.delete(dir); },
    second() { S.reverse = !S.reverse; api.second(S.reverse ? '前进 Forward · B' : '倒车 Reverse · B'); api.sounds.beep(); },
    key(code, down) {
      if (code === 'KeyW' || code === 'ArrowUp') S.go = down;
      else if (code === 'KeyS' || code === 'ArrowDown') S.brake = down;
      else if (code === 'KeyH' && down) api.sounds.beep();
    },
    update(dt) {
      const steerIn = (S.lean.has(1) ? 1 : 0) - (S.lean.has(-1) ? 1 : 0);
      // steer less at speed, like a real handlebar
      S.steer = damp(S.steer, steerIn * (0.5 - Math.min(0.25, Math.abs(S.speed) * 0.03)), 5, dt);
      if (S.brake) S.speed = Math.sign(S.speed) * Math.max(0, Math.abs(S.speed) - 6 * dt);
      else if (S.go && !S.reverse) S.speed = Math.min(MAX, S.speed + (S.speed < 0 ? 5 : 2.2 - S.speed * 0.15) * dt);
      else if (S.go && S.reverse) S.speed = Math.max(-MAX_BACK, S.speed - 1.6 * dt);
      else S.speed = Math.sign(S.speed) * Math.max(0, Math.abs(S.speed) - 0.9 * dt);  // coasting
      const fw = fwd();
      if (Math.abs(S.speed) > 0.01) {
        if (blocked(S.pos, fw, Math.sign(S.speed))) {
          if (Math.abs(S.speed) > 1.5) { api.sounds.boing(); api.buzz(60); }
          S.speed = -S.speed * 0.15;
        } else {
          S.yaw -= (S.speed / WHEELBASE) * Math.tan(S.steer) * dt;
          S.pos.addScaledVector(fw, S.speed * dt);
          S.km += Math.abs(S.speed) * dt / 1000;
        }
      }
      S.top = Math.max(S.top, Math.abs(S.speed) * 3.6);
      place();
      trike.rotation.z = -S.steer * Math.min(1, Math.abs(S.speed) / 5) * 0.08;  // leaning into the turn
      S.motor?.(Math.abs(S.speed) * (S.go ? 1 : 0.4));
      // the child on the seat, the dog in the cargo bed
      const s = seat();
      walk.place(s.x, ground() + 0.14 + walk.eyeHeight, s.z, S.yaw, 0);
      if (life.dog?.ride) {
        life.dog.ride.pos.copy(S.pos).addScaledVector(fw, -0.3).setY(ground() + 0.52);
        life.dog.ride.yaw = S.yaw;
      }
      const kmh = Math.abs(S.speed) * 3.6;
      api.meter(kmh / (MAX * 3.6), `${Math.round(kmh)} km/h${S.reverse ? ' · 倒车 R' : ''}`, kmh > 22 ? '#e0a020' : '#5f9a48');
      api.action(S.go ? '走 Going…' : '走 Go · hold');
      api.say(S.speed < -0.1 ? '倒车，请注意' : kmh > 20 ? '慢点开！' : '嘀嘀——', S.speed < -0.1 ? 'Reversing, please mind…' : kmh > 20 ? 'Slow down a bit!' : 'S to brake, ✕ to get off.');
    },
    camera(c, dt) {
      const fw = fwd();
      const want = S.pos.clone().addScaledVector(fw, -5.2).setY(ground() + 2.5);
      const look = S.pos.clone().addScaledVector(fw, 3).setY(ground() + 0.9);
      cam.update(c, want, look, dt, 4);
    },
    posture(rig) {
      const P = rig.parts;
      P['leg L'].rotation.x = P['leg R'].rotation.x = 1.45;
      P['knee L'].rotation.x = P['knee R'].rotation.x = -1.35;
      P['arm L'].rotation.x = P['arm R'].rotation.x = 1.15;
      P['arm L'].rotation.z = 0.12 + S.steer * 0.4;
      P['arm R'].rotation.z = -0.12 + S.steer * 0.4;
      P.torso.rotation.y = -S.steer * 0.3;
    },
    state: S,
  };
  return A;
}
