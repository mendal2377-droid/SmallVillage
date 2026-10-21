// The village soundscape, synthesised with WebAudio: wind in the poplars, rain, cicadas on summer afternoons,
// birdsong by day (sparrows and magpies), crows in winter, crickets and frogs on summer nights (frogs louder
// by the ponds), a rooster at dawn and a dog somewhere far off. It starts after the first touch or key (as
// browsers require) and can be muted from the calendar card.
import {sounds} from './sounds.js';

const KEY = 'sv2-sound';
const rnd = Math.random;

export function createAmbience({getState, button}) {
  let enabled = true;
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch { /* storage blocked */ }
  let ctx = null, master = null, wind = null, rain = null, cicada = null;
  const timers = {bird: 2, cricket: 1, frog: 2, crow: 5, rooster: 3, dog: 20};

  function loop(type, freq, q) {
    const s = ctx.createBufferSource();
    s.buffer = sounds.noise();
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    s.connect(f).connect(g).connect(master);
    s.start();
    return {f, g};
  }
  function build() {
    ctx = sounds.unlock();
    if (!ctx || master) return;
    master = ctx.createGain();
    master.gain.value = enabled ? 1 : 0;
    master.connect(ctx.destination);
    wind = loop('bandpass', 380, 0.6);
    rain = loop('highpass', 1400, 0.4);
    // cicadas: a bright buzz pulsing many times a second, swelling and fading in long waves
    const o = ctx.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = 4400;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 3;
    const am = ctx.createGain();
    am.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 48;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.5;
    lfo.connect(lfoGain).connect(am.gain);
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(bp).connect(am).connect(g).connect(master);
    o.start(); lfo.start();
    cicada = {g, am};
  }

  // ---- little events
  function blip(f0, f1, dur, vol, type = 'sine', at = 0, pan = 0) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (p) { p.pan.value = pan; o.connect(g).connect(p).connect(master); } else o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const sparrow = () => { const pan = rnd() * 1.6 - 0.8, n = 2 + Math.floor(rnd() * 4); for (let i = 0; i < n; i++) blip(3800 + rnd() * 1200, 2600 + rnd() * 800, 0.06, 0.03, 'sine', i * (0.09 + rnd() * 0.05), pan); };
  const songbird = () => { const pan = rnd() * 1.6 - 0.8, base = 2200 + rnd() * 1500; for (let i = 0; i < 5; i++) blip(base * (1 + (i % 2) * 0.25), base * (1.3 - (i % 3) * 0.15), 0.11, 0.025, 'sine', i * 0.13, pan); };
  const magpie = () => { const pan = rnd() * 1.6 - 0.8; for (let i = 0; i < 5; i++) blip(1400, 1100, 0.07, 0.03, 'square', i * 0.1, pan); };
  const crow = () => { const pan = rnd() * 1.6 - 0.8; for (let i = 0; i < 2 + Math.floor(rnd() * 2); i++) blip(620, 420, 0.28, 0.035, 'sawtooth', i * 0.45, pan); };
  const cricket = () => { const pan = rnd() * 1.6 - 0.8, f = 4200 + rnd() * 600; for (let i = 0; i < 3; i++) blip(f, f, 0.035, 0.018, 'sine', i * 0.06, pan); };
  const frog = (vol) => { const pan = rnd() * 1.6 - 0.8, f = 160 + rnd() * 90; blip(f, f * 0.8, 0.12, vol, 'square', 0, pan); blip(f * 1.1, f * 0.85, 0.14, vol, 'square', 0.17, pan); };
  const rooster = () => { const pan = rnd() * 1.2 - 0.6; blip(520, 700, 0.18, 0.03, 'sawtooth', 0, pan); blip(700, 760, 0.25, 0.035, 'sawtooth', 0.2, pan); blip(760, 480, 0.55, 0.03, 'sawtooth', 0.47, pan); };
  const dog = () => { const pan = rnd() * 1.6 - 0.8; for (let i = 0; i < 2 + Math.floor(rnd() * 2); i++) blip(420, 260, 0.12, 0.02, 'sawtooth', i * 0.32, pan); };

  function set(gain, v) { gain.gain.setTargetAtTime(v, ctx.currentTime, 0.4); }

  function updateButton() {
    if (!button) return;
    button.textContent = enabled ? '🔊 声音 Sound on' : '🔇 声音 Sound off';
    button.setAttribute('aria-pressed', String(enabled));
  }
  button?.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* ignore */ }
    build();
    if (master) master.gain.setTargetAtTime(enabled ? 1 : 0, ctx.currentTime, 0.2);
    updateButton();
  });
  updateButton();
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { if (enabled) build(); }, {once: true});

  return {
    get enabled() { return enabled; },
    update(dt) {
      if (!master || !enabled) return;
      const st = getState();
      const {month, el, weather, wind: w, rain: r, nearWater, outdoors} = st;
      const day = el > 2, night = el < -6;
      const summer = month >= 6 && month <= 8, warm = month >= 4 && month <= 9, winter = month === 12 || month <= 2;
      const wet = weather === 'rain' || weather === 'storm';
      set(wind.g, (0.015 + w * 0.09) * (outdoors ? 1 : 0.4));
      wind.f.frequency.setTargetAtTime(300 + w * 400, ctx.currentTime, 0.5);
      set(rain.g, r * 0.12);
      // cicadas: summer, hot hours, not in the rain
      const cic = summer && el > 20 && !wet ? 0.018 * (0.6 + 0.4 * Math.sin(performance.now() / 1000 * 0.15)) : 0;
      set(cicada.g, cic);
      cicada.am.gain.setTargetAtTime(cic ? 0.5 : 0, ctx.currentTime, 0.3);
      // events
      for (const k of Object.keys(timers)) timers[k] -= dt;
      if (timers.bird <= 0) {
        timers.bird = 1.5 + rnd() * (wet ? 12 : 4);
        if (day && !wet && !winter) (rnd() < 0.5 ? sparrow : rnd() < 0.6 ? songbird : magpie)();
        else if (day && winter && rnd() < 0.4) (rnd() < 0.5 ? sparrow : magpie)();
      }
      if (timers.crow <= 0) { timers.crow = 6 + rnd() * 10; if (winter && day) crow(); }
      if (timers.cricket <= 0) { timers.cricket = 0.25 + rnd() * 0.7; if (!day && month >= 7 && month <= 10 && !wet) cricket(); }
      if (timers.frog <= 0) {
        timers.frog = 0.4 + rnd() * 1.6;
        if ((night || el < 2) && warm && nearWater < 120) frog(0.03 * Math.max(0.15, 1 - nearWater / 120));
        else if (wet && warm && nearWater < 60 && rnd() < 0.4) frog(0.02);
      }
      if (timers.rooster <= 0) { timers.rooster = 25 + rnd() * 40; if (el > -8 && el < 10 && st.hour < 10) rooster(); }
      if (timers.dog <= 0) { timers.dog = 30 + rnd() * 60; if (rnd() < 0.6) dog(); }
    },
  };
}
