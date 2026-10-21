// Climate and seasons for SmallVillage 2.0 (Phase 8). A monthly calendar for the North China Plain, the sun
// where it really stands for the month and hour (35° N), a sky blended from the painted presets by sun height
// and weather, and the weather itself: rain with puddles and rings on the ponds, snow falling and lying,
// fog, thunderstorms with lightning, and wind that moves the trees, the crops and the clouds.
// A small calendar card lets the visitor choose the month, the hour and the weather (or let the calendar
// choose), and lets time run.
import * as THREE from 'three';
import {toonUniforms} from './toon.js';
import {placeClouds} from './village.js';

const {clamp, damp, lerp, smoothstep} = THREE.MathUtils;

export const MONTH_ZH = ['', '一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
export const WEATHER = {
  clear: {zh: '晴', en: 'Clear', icon: '☀️'},
  cloudy: {zh: '多云', en: 'Cloudy', icon: '⛅'},
  overcast: {zh: '阴', en: 'Overcast', icon: '☁️'},
  rain: {zh: '雨', en: 'Rain', icon: '🌧'},
  storm: {zh: '雷雨', en: 'Storm', icon: '⛈'},
  snow: {zh: '雪', en: 'Snow', icon: '🌨'},
  fog: {zh: '雾', en: 'Fog', icon: '🌫'},
};
// how often each weather comes in each month (relative weights): dry sunny winters with fog and some snow,
// windy springs, a rainy summer with thunderstorms in July and August, clear golden autumns
const CALENDAR = {
  1: {clear: 4, cloudy: 2, overcast: 1, fog: 2.5, snow: 1.5},
  2: {clear: 4, cloudy: 2, overcast: 1.5, fog: 1.5, snow: 1.2, rain: 0.3},
  3: {clear: 4, cloudy: 2.5, overcast: 1.5, rain: 1, fog: 0.5, snow: 0.2},
  4: {clear: 4, cloudy: 2.5, overcast: 1.5, rain: 1.5},
  5: {clear: 5, cloudy: 2, overcast: 1, rain: 1.2, storm: 0.4},
  6: {clear: 4, cloudy: 2.5, overcast: 1, rain: 1.5, storm: 1},
  7: {clear: 3, cloudy: 2.5, overcast: 1.5, rain: 2.5, storm: 1.8},
  8: {clear: 3.5, cloudy: 2.5, overcast: 1.5, rain: 2, storm: 1.2},
  9: {clear: 5, cloudy: 2, overcast: 1, rain: 1.2, storm: 0.2},
  10: {clear: 6, cloudy: 2, overcast: 1, rain: 0.6, fog: 0.5},
  11: {clear: 4, cloudy: 2, overcast: 1.5, fog: 1.5, rain: 0.5, snow: 0.2},
  12: {clear: 4, cloudy: 2, overcast: 1.5, fog: 2, snow: 1},
};
const BASE_WIND = {1: 0.35, 2: 0.4, 3: 0.65, 4: 0.6, 5: 0.45, 6: 0.3, 7: 0.25, 8: 0.25, 9: 0.3, 10: 0.3, 11: 0.4, 12: 0.4};
const WEATHER_WIND = {clear: 0, cloudy: 0.1, overcast: 0.1, rain: 0.2, storm: 0.6, snow: 0.05, fog: -0.25};
export const possible = (w, month) => (w === 'snow' ? [11, 12, 1, 2, 3].includes(month) : w === 'storm' ? [5, 6, 7, 8, 9].includes(month) : true);
const LAT = THREE.MathUtils.degToRad(35);
const HOUR_WORDS = [[5, '凌晨'], [7, '清晨'], [11, '上午'], [13, '中午'], [17, '下午'], [19, '傍晚'], [24, '夜里']];

/** sun elevation and azimuth (degrees from north towards east) on the 15th of the month at local solar time */
export function sunAt(month, hour) {
  const doy = (month - 1) * 30.4 + 15;
  const dec = THREE.MathUtils.degToRad(-23.44 * Math.cos((2 * Math.PI / 365) * (doy + 10)));
  const H = THREE.MathUtils.degToRad(15 * (hour - 12));
  const el = Math.asin(Math.sin(LAT) * Math.sin(dec) + Math.cos(LAT) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(LAT) - Math.tan(dec) * Math.cos(LAT)) + Math.PI;
  return {el: THREE.MathUtils.radToDeg(el), az: THREE.MathUtils.radToDeg(az)};
}

function mixP(A, B, t) {
  if (t <= 0) return {...A};
  if (t >= 1) return {...B};
  const out = {};
  for (const k of Object.keys(A)) {
    const a = A[k], b = B[k];
    if (Array.isArray(a) && typeof a[0] === 'number') out[k] = a.map((v, i) => lerp(v, b[i], t));
    else if (typeof a === 'number') out[k] = lerp(a, b, t);
    else out[k] = t < 0.5 ? a : b;
  }
  return out;
}

export function createClimate({scene, camera, village, sky, quality, onMonth, sounds}) {
  const data = village.data;
  const presets = data.sky;
  const params = new URLSearchParams(location.search);
  const S = {
    month: Number(params.get('month')) || new Date().getMonth() + 1,
    hour: params.has('hour') ? Number(params.get('hour')) : 15,
    choice: params.get('weather') || 'auto',  // 'auto' lets the calendar choose
    weather: 'clear', runs: false, override: params.get('sky') || null,
    wet: 0, snow: 0, rain: 0, wind: 0.3, gust: 0, flash: 0, flashT: 6, thunder: [],
    sun: {el: 40, az: 200}, cloudsFor: '', clouds: null,
  };

  // ---------------------------------------------------------------- the calendar's weather for a month
  function pickWeather(month) {
    // the same "day" gives the same weather: seeded by the real date and the month shown
    const d = new Date();
    let seed = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate() + month * 7919;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    r(); r();
    const w = CALENDAR[month];
    let x = r() * Object.values(w).reduce((a, b) => a + b, 0);
    for (const [k, v] of Object.entries(w)) { x -= v; if (x <= 0) return k; }
    return 'clear';
  }
  function resolveWeather() {
    S.weather = S.choice === 'auto' ? pickWeather(S.month) : possible(S.choice, S.month) ? S.choice : pickWeather(S.month);
  }

  // ---------------------------------------------------------------- the sky for month, hour and weather
  const BANDS = [[-12, 'night'], [-5, 'dusk'], [3, 'golden sunset'], [16, 'spring clear'], [38, 'summer afternoon']];
  function clearSky(el) {
    if (el <= BANDS[0][0]) return {...presets.night};
    for (let i = 0; i + 1 < BANDS.length; i++) {
      const [e0, a] = BANDS[i], [e1, b] = BANDS[i + 1];
      if (el <= e1) return mixP(presets[a], presets[b], smoothstep(el, e0, e1));
    }
    return {...presets['summer afternoon']};
  }
  const OVERLAY = {cloudy: ['overcast', 0.3], overcast: ['overcast', 0.85], rain: ['overcast', 0.95], storm: ['summer storm', 0.95],
    snow: ['snow day', 0.9], fog: ['winter haze morning', 0.75]};
  const CLOUDS = {clear: null, cloudy: ['cumulus', 'cumulus small'], overcast: ['stratus', 'cumulus'], rain: ['stratus'],
    storm: ['thunderhead', 'stratus'], snow: ['stratus'], fog: []};
  function skyParams() {
    S.sun = sunAt(S.month, S.hour);
    const {el, az} = S.sun;
    let P = clearSky(el);
    const season = data.seasonOfMonth[String(S.month)];
    const day = smoothstep(el, -6, 8);
    if (season === 'winter' && el > -2) P = mixP(P, presets[el < 14 ? 'winter sunrise frost' : 'winter haze morning'], 0.45 * day);
    const o = OVERLAY[S.weather];
    if (o) {
      const W = presets[o[0]];
      // by day the weather preset takes over; by night it only greys and darkens the night sky
      P = mixP(P, W, o[1] * day);
      if (day < 1) {
        const k = (1 - day) * o[1] * 0.3;
        for (const key of ['horizon', 'mid', 'zenith', 'lit', 'ambient']) P[key] = P[key].map((v) => v * (1 - k));
      }
      P.sun_strength *= 1 - o[1] * 0.75;
    }
    // light from where the sun really is (the moon's direction from the night preset after dark)
    if (el > -4) { P.sun_el = Math.max(el, 4); P.sun_az = az; }
    else {
      // after dark the light comes from the moon, where it is drawn in the sky
      const m = moonAt();
      if (m.el > 5) { P.sun_el = m.el; P.sun_az = m.az; }
    }
    P.fog_density *= {fog: 5, rain: 2, snow: 1.3, storm: 1.8, overcast: 1.25}[S.weather] ?? 1;
    P.clouds = CLOUDS[S.weather] ?? P.clouds;
    return P;
  }

  let lastQ = null;
  // the moon, simply: about half a day behind the sun (a moon near full, rising around dusk)
  function moonAt() { return sunAt(S.month, (S.hour + 11.2) % 24); }
  const dirOf = ({el, az}) => {
    const e = THREE.MathUtils.degToRad(el), a = THREE.MathUtils.degToRad(az);
    return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
  };
  // how many windows are lit: lights come on at dusk, most homes are lit in the evening, then fewer and fewer
  // as the night goes on; a few early risers before dawn
  const LIT = [[0, 0.16], [1, 0.08], [3, 0.04], [5, 0.12], [6.5, 0.06], [8, 0], [16.5, 0], [18, 0.45], [19.5, 0.82], [21, 0.75], [22, 0.5], [23, 0.3], [24, 0.16]];
  function litFraction(h) {
    for (let i = 0; i + 1 < LIT.length; i++) {
      const [h0, f0] = LIT[i], [h1, f1] = LIT[i + 1];
      if (h >= h0 && h <= h1) return lerp(f0, f1, (h - h0) / (h1 - h0));
    }
    return 0;
  }
  function nightUniforms() {
    const u = sky.domeMat.uniforms;
    const sun = S.override ? {el: presets[S.override].sun_el, az: presets[S.override].sun_az} : S.sun;
    const night = S.override ? (S.override === 'night' ? 1 : S.override === 'dusk' ? 0.6 : 0) : 1 - smoothstep(S.sun.el, -10, -2);
    u.uSun.value.copy(S.override === 'night' ? new THREE.Vector3(0, -1, 0) : dirOf(sun));
    u.uMoon.value.copy(dirOf(S.override ? {el: 40, az: 150} : moonAt()));
    u.uNight.value = night;
    const w = S.override ? 'clear' : S.weather;
    u.uClear.value = {clear: 1, cloudy: 0.7, overcast: 0.12, rain: 0.05, storm: 0, snow: 0.05, fog: 0.15}[w] ?? 1;
    // windows and lamps: on from dusk (and on dark stormy days a little)
    const glow = S.override ? night : 1 - smoothstep(S.sun.el, -6, 3);
    toonUniforms.uNightGlow.value = Math.max(glow, ['storm', 'rain'].includes(w) && S.sun.el < 25 ? 0.35 : 0);
    toonUniforms.uLitFrac.value = S.override ? (night > 0.5 ? 0.6 : 0) : Math.max(litFraction(S.hour), w === 'storm' ? 0.3 : 0);
  }

  function applySky() {
    const P = S.override ? presets[S.override] : skyParams();
    sky.apply(P);
    scene.fog.density *= quality().fog;
    S.baseAmb = sky.amb.intensity;
    S.baseZenith = sky.domeMat.uniforms.uZ.value.clone();
    nightUniforms();
    // clouds only change with the weather (placement is costly)
    const key = `${S.override ?? S.weather}|${quality().clouds}|${(P.clouds || []).join()}`;
    if (key !== S.cloudsFor) {
      S.cloudsFor = key;
      S.clouds = placeClouds(scene, village, S.override ?? `sky ${S.weather}`, quality().clouds, P.clouds);
    }
  }

  // ---------------------------------------------------------------- weather effects near the camera
  const BOX = 60, BOXH = 30;
  function makeRain(n) {
    const pos = new Float32Array(n * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({color: 0x8c9aa4, transparent: true, opacity: 0.55, depthWrite: false}));
    m.frustumCulled = false;
    const drops = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) drops.set([Math.random() * BOX, Math.random() * BOXH, Math.random() * BOX], i * 3);
    return {mesh: m, drops, n};
  }
  function makeSnow(n) {
    const pos = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const x = c.getContext('2d'), grd = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.8)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = grd; x.fillRect(0, 0, 32, 32);
    const m = new THREE.Points(g, new THREE.PointsMaterial({size: 0.13, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, color: 0xdde4ec}));
    m.frustumCulled = false;
    const flakes = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) flakes.set([Math.random() * BOX, Math.random() * BOXH, Math.random() * BOX, Math.random() * 6.28], i * 4);
    return {mesh: m, flakes, n};
  }
  let rain = null, snow = null;
  function ensureFx() {
    const hi = quality().clouds >= 1;
    if (!rain || rain.hi !== hi) {
      for (const f of [rain, snow]) if (f) scene.remove(f.mesh);
      rain = makeRain(hi ? 2600 : 1200); rain.hi = hi;
      snow = makeSnow(hi ? 3200 : 1500);
      scene.add(rain.mesh, snow.mesh);
    }
  }
  const windDir = new THREE.Vector2(0.8, 0.6).normalize();
  function stepFx(dt, cam) {
    ensureFx();
    const ox = cam.position.x - BOX / 2, oz = cam.position.z - BOX / 2, oy = Math.max(cam.position.y - 6, data.nav.ground);
    rain.mesh.visible = S.rain > 0.02;
    if (rain.mesh.visible) {
      const P = rain.mesh.geometry.attributes.position.array, D = rain.drops;
      const vy = 11, vx = windDir.x * S.wind * 3, vz = windDir.y * S.wind * 3;
      const shown = Math.floor(rain.n * S.rain);
      for (let i = 0; i < rain.n; i++) {
        let y = D[i * 3 + 1] - vy * dt, x = D[i * 3] + vx * dt, z = D[i * 3 + 2] + vz * dt;
        if (y < 0) y += BOXH;
        x = ((x % BOX) + BOX) % BOX; z = ((z % BOX) + BOX) % BOX;
        D[i * 3] = x; D[i * 3 + 1] = y; D[i * 3 + 2] = z;
        const wx = ox + x, wy = oy + y, wz = oz + z;
        const k = i < shown ? 0.05 : 0;  // streak length along the fall
        P.set([wx, wy, wz, wx - vx * k, wy + vy * k, wz - vz * k], i * 6);
      }
      rain.mesh.geometry.attributes.position.needsUpdate = true;
      rain.mesh.material.opacity = 0.35 + 0.35 * S.rain;
    }
    snow.mesh.visible = S.weather === 'snow' && !S.override;
    if (snow.mesh.visible) {
      const P = snow.mesh.geometry.attributes.position.array, F = snow.flakes;
      for (let i = 0; i < snow.n; i++) {
        F[i * 4 + 3] += dt * 1.3;
        let y = F[i * 4 + 1] - 1.1 * dt, x = F[i * 4] + (Math.sin(F[i * 4 + 3]) * 0.4 + windDir.x * S.wind * 1.5) * dt, z = F[i * 4 + 2] + (Math.cos(F[i * 4 + 3] * 0.8) * 0.4 + windDir.y * S.wind * 1.5) * dt;
        if (y < 0) y += BOXH;
        x = ((x % BOX) + BOX) % BOX; z = ((z % BOX) + BOX) % BOX;
        F[i * 4] = x; F[i * 4 + 1] = y; F[i * 4 + 2] = z;
        P.set([ox + x, oy + y, oz + z], i * 3);
      }
      snow.mesh.geometry.attributes.position.needsUpdate = true;
    }
  }

  function stepLightning(dt) {
    if (S.weather !== 'storm' || S.override) { S.flash = 0; return; }
    S.flashT -= dt;
    if (S.flashT <= 0) {
      S.flashT = 5 + Math.random() * 10;
      S.flash = 1;
      S.flashK = 0;
      const delay = 0.6 + Math.random() * 2.5;  // thunder follows, nearer storms sooner
      S.thunder.push(delay);
    }
    if (S.flash > 0) {
      S.flashK += dt;
      // a double flicker
      const f = S.flashK < 0.08 ? 1 : S.flashK < 0.16 ? 0.2 : S.flashK < 0.26 ? 0.8 : Math.max(0, 1 - (S.flashK - 0.26) * 5);
      sky.amb.intensity = S.baseAmb * (1 + 2.5 * f);
      sky.domeMat.uniforms.uZ.value.copy(S.baseZenith).lerp(new THREE.Color(0.85, 0.88, 1), f * 0.6);
      if (S.flashK > 0.5) { S.flash = 0; sky.amb.intensity = S.baseAmb; sky.domeMat.uniforms.uZ.value.copy(S.baseZenith); }
    }
    for (let i = S.thunder.length - 1; i >= 0; i--) {
      S.thunder[i] -= dt;
      if (S.thunder[i] <= 0) { S.thunder.splice(i, 1); sounds?.bang(); }
    }
  }

  // ---------------------------------------------------------------- the calendar card
  const card = document.createElement('section');
  card.className = 'v2-cal';
  card.setAttribute('aria-label', 'Calendar and weather');
  card.innerHTML = `
    <button type="button" class="v2-cal-chip" aria-expanded="false"></button>
    <div class="v2-cal-body" hidden>
      <div class="v2-cal-row"><button type="button" data-m="-1" aria-label="Previous month">◀</button><b class="v2-cal-month"></b><button type="button" data-m="1" aria-label="Next month">▶</button></div>
      <label class="v2-cal-hour"><span></span><input type="range" min="0" max="23.75" step="0.25"></label>
      <div class="v2-cal-weather" role="group" aria-label="Weather"></div>
      <div class="v2-cal-row v2-cal-small">
        <label><input type="checkbox" class="v2-cal-run"> ⏩ 时间走 Time runs</label>
        <button type="button" class="v2-cal-sound"></button>
      </div>
    </div>`;
  document.body.append(card);
  const chip = card.querySelector('.v2-cal-chip'), body = card.querySelector('.v2-cal-body');
  const monthEl = card.querySelector('.v2-cal-month'), hourIn = card.querySelector('.v2-cal-hour input'), hourTxt = card.querySelector('.v2-cal-hour span');
  const wEl = card.querySelector('.v2-cal-weather'), runIn = card.querySelector('.v2-cal-run'), soundBtn = card.querySelector('.v2-cal-sound');
  for (const k of ['auto', ...Object.keys(WEATHER)]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.w = k;
    b.textContent = k === 'auto' ? '📅 跟日子 Auto' : `${WEATHER[k].icon} ${WEATHER[k].zh}`;
    b.title = k === 'auto' ? 'Weather from the calendar' : WEATHER[k].en;
    b.addEventListener('click', () => { S.choice = k; S.override = null; resolveWeather(); refresh(); });
    wEl.append(b);
  }
  chip.addEventListener('click', () => { body.hidden = !body.hidden; chip.setAttribute('aria-expanded', String(!body.hidden)); });
  card.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => setMonth(((S.month - 1 + Number(b.dataset.m) + 12) % 12) + 1)));
  hourIn.addEventListener('input', () => { S.hour = Number(hourIn.value); S.override = null; refresh(false); });
  runIn.addEventListener('change', () => { S.runs = runIn.checked; });

  const hh = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  function hourWord(h) {
    // evening lasts while the sky is still light (long summer evenings, short winter ones)
    if (h >= 16 && h < 21.5) return S.sun.el > 6 ? '下午' : S.sun.el > -7 ? '傍晚' : '夜里';
    for (const [lim, w] of HOUR_WORDS) if (h < lim) return w;
    return '夜里';
  }
  function updateCard() {
    const W = WEATHER[S.weather];
    // a clear night shows the moon, not the sun
    const icon = S.sun.el < -4 && (S.weather === 'clear' || S.weather === 'cloudy') ? (S.weather === 'clear' ? '🌙' : '☁️🌙') : W.icon;
    chip.textContent = S.override ? `📅 ${MONTH_ZH[S.month]} · ${S.override}` : `📅 ${MONTH_ZH[S.month]} · ${hourWord(S.hour)} ${hh(S.hour)} · ${icon} ${W.zh}`;
    monthEl.textContent = `${MONTH_ZH[S.month]} · ${['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][S.month]}`;
    hourIn.value = String(S.hour);
    hourTxt.textContent = `${hourWord(S.hour)} ${hh(S.hour)} · 太阳 sun ${Math.round(S.sun.el)}°`;
    for (const b of wEl.children) {
      const k = b.dataset.w;
      b.setAttribute('aria-pressed', String(k === S.choice));
      b.disabled = k !== 'auto' && !possible(k, S.month);
    }
  }
  function refresh(weatherToo = true) {
    if (weatherToo) resolveWeather();
    applySky();
    updateCard();
  }
  function setMonth(m) {
    S.month = m;
    S.snap = true;  // a different month: the ground is as that month leaves it, not melting from the last one
    resolveWeather();
    onMonth?.(m);
    applySky();
    updateCard();
  }
  resolveWeather();

  // ---------------------------------------------------------------- per frame
  let skyT = 0;
  const api = {
    state: S, card, soundBtn,
    get month() { return S.month; },
    get weather() { return S.weather; },
    setMonth, refresh,
    setHour(h) { S.hour = ((h % 24) + 24) % 24; S.override = null; refresh(false); },
    setWeather(w) { S.choice = w; S.override = null; refresh(); },
    setOverride(name) { S.override = name; applySky(); updateCard(); },
    applySky,
    /** a preset-like name for the activities and the fishing words */
    skyName() {
      if (S.override) return S.override;
      const {el} = S.sun, morning = S.hour < 12;
      if (S.weather === 'storm') return 'summer storm';
      if (S.weather === 'snow') return 'snow day';
      if (S.weather === 'rain') return 'rain';
      if (S.weather === 'fog') return 'winter haze morning';
      if (el < -6) return 'night';
      if (el < 2) return morning ? 'dawn' : 'dusk';
      if (el < 12) return morning ? 'dawn' : 'golden sunset';
      if (S.weather === 'overcast') return 'overcast';
      const season = data.seasonOfMonth[String(S.month)];
      return season === 'winter' ? 'winter sunrise frost' : season === 'summer' && !morning ? 'summer afternoon' : 'spring clear';
    },
    update(dt, cam) {
      // time runs: one village hour every 40 seconds
      if (S.runs) {
        S.hour = (S.hour + dt / 40) % 24;
        if ((skyT -= dt) <= 0) { skyT = 0.5; applySky(); updateCard(); }
      }
      const w = S.override ? 'clear' : S.weather;
      const wetTarget = {rain: 1, storm: 1, snow: 0.25, fog: 0.3}[w] ?? 0;
      const snowTarget = w === 'snow' ? 0.85 : [1, 2].includes(S.month) && !S.override && w !== 'rain' ? 0.35 : S.month === 12 && w === 'fog' ? 0.2 : 0;
      const rainTarget = {rain: 0.7, storm: 1}[w] ?? 0;
      if (S.snap) { S.snap = false; S.wet = wetTarget; S.snow = snowTarget; }
      S.wet = damp(S.wet, wetTarget, wetTarget > S.wet ? 0.5 : 0.25, dt);  // wets quickly, dries more slowly
      S.snow = damp(S.snow, snowTarget, snowTarget > S.snow ? 0.25 : 0.5, dt);
      S.rain = damp(S.rain, rainTarget, 1.5, dt);
      // wind: the month's breeze, the weather's push, and gusts
      S.gust = Math.max(0, Math.sin(performance.now() / 1000 * 0.37) * Math.sin(performance.now() / 1000 * 0.13 + 1)) * 0.35;
      const windTarget = clamp(BASE_WIND[S.month] + (WEATHER_WIND[w] ?? 0) + S.gust, 0.05, 1.2);
      S.wind = damp(S.wind, windTarget, 0.8, dt);
      toonUniforms.uWet.value = S.wet;
      toonUniforms.uSnow.value = S.snow;
      toonUniforms.uRain.value = S.rain;
      toonUniforms.uWind.value = S.wind;
      if (S.clouds) S.clouds.rotation.y += dt * 0.0004 * (0.3 + S.wind);  // the clouds drift
      stepFx(dt, cam);
      stepLightning(dt);
    },
  };
  updateCard();
  return api;
}
