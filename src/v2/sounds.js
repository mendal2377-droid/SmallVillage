// Little sounds for the village activities, synthesised with WebAudio (nothing to download), and phone vibration.
const rnd = Math.random;


function createSounds() {
  let ctx = null, noise = null, motor = null;
  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function env(g, t, a, peak, decay) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay); }
  function tone(f0, f1, dur, vol = 0.2, type = 'sine') {
    const c = ac(); if (!c) return;
    const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.005, vol, dur); o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  function hiss(freq, q, dur, vol = 0.2, sweep = 1) {
    const c = ac(); if (!c) return;
    const t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noise; f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur); f.Q.value = q;
    env(g, t, 0.01, vol, dur); s.connect(f).connect(g).connect(c.destination); s.start(t, rnd() * 0.5); s.stop(t + dur + 0.05);
  }
  return {
    unlock: ac,
    whoosh: () => hiss(500, 0.8, 0.35, 0.12, 4),
    plop: () => { tone(520, 140, 0.12, 0.25); hiss(1200, 1.2, 0.12, 0.08); },
    tick: () => tone(1500, 900, 0.03, 0.05, 'triangle'),
    splash: (big = 1) => { hiss(900, 0.6, 0.35 + big * 0.25, 0.18 * big + 0.05, 0.4); tone(300, 90, 0.18, 0.12 * big); },
    creak: () => tone(140 + rnd() * 40, 110, 0.09, 0.035, 'sawtooth'),
    snap: () => { hiss(3000, 2, 0.12, 0.25); tone(1800, 400, 0.08, 0.1, 'square'); },
    chime: () => { tone(880, 880, 0.25, 0.12); setTimeout(() => tone(1320, 1320, 0.4, 0.1), 120); },
    boing: () => tone(300, 700, 0.18, 0.1, 'triangle'),
    pop: () => { hiss(2200, 0.7, 0.07, 0.35); tone(600 + rnd() * 400, 120, 0.05, 0.12, 'square'); },
    bang: () => { hiss(400, 0.5, 0.6, 0.4, 0.3); tone(90, 40, 0.4, 0.3); },
    crackle: () => hiss(3000 + rnd() * 2000, 3, 0.03, 0.06),
    gust: (v = 1) => hiss(300, 0.4, 1.2, 0.05 * v, 1.8),
    swish: () => hiss(1400, 0.9, 0.18, 0.12, 0.4),
    pick: () => tone(700 + rnd() * 200, 1000, 0.06, 0.06, 'triangle'),
    scrape: () => hiss(5000, 1.5, 0.3, 0.05, 0.6),
    beep: () => { tone(1200, 1200, 0.08, 0.08, 'square'); setTimeout(() => tone(1200, 1200, 0.08, 0.08, 'square'), 140); },
    hum: (on) => {
      // the electric tricycle's motor whine, a held tone whose pitch follows speed
      const c = ac(); if (!c) return null;
      if (on === false) { motor?.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.1); motor?.o.stop(c.currentTime + 0.5); motor = null; return null; }
      if (!motor) {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sawtooth'; o.frequency.value = 80; g.gain.value = 0.0001;
        o.connect(g).connect(c.destination); o.start();
        motor = {o, g};
      }
      return (speed) => {
        motor?.o.frequency.setTargetAtTime(70 + speed * 45, c.currentTime, 0.1);
        motor?.g.gain.setTargetAtTime(0.012 + Math.min(speed, 8) * 0.004, c.currentTime, 0.1);
      };
    },
  };
}
// phones shake on bites, jumps and snaps (browsers allow it only after the visitor has touched the page)
export const buzz = (p) => { try { if (navigator.userActivation?.hasBeenActive ?? true) navigator.vibrate?.(p); } catch { /* not allowed here */ } };

/** one shared set: browsers allow only a few audio contexts per page */
export const sounds = createSounds();
