// The village activities besides fishing: a small framework that offers what fits the place, the month and
// the sky, gives each activity the shared panel (message, meter, action button, lean and second buttons) and
// keyboard/touch controls, and keeps a diary of little records (童年小事) shown in the journal.
// Each activity lives in ./acts/ and is a plain object:
//   {id, icon, zh, en, pauseWalk, available() -> bool, start(), update(dt), stop(), press(), release(),
//    lean(dir, on)?, second()?, camera(cam, dt)?, posture(rig, t)?, timeScale?}
import * as THREE from 'three';
import {sounds, buzz} from './sounds.js';
import {createKite} from './acts/kite.js';
import {createBugs} from './acts/bugs.js';
import {createRoast} from './acts/roast.js';
import {createGlean} from './acts/glean.js';
import {createIce} from './acts/ice.js';
import {createFirecrackers} from './acts/firecrackers.js';
import {createTricycle} from './acts/tricycle.js';

const DIARY_KEY = 'sv2-diary';
function loadDiary() {
  try { const d = JSON.parse(localStorage.getItem(DIARY_KEY)); if (d && typeof d === 'object') return d; } catch { /* private window */ }
  return {};
}

export function createActivities(ctx) {
  const {walk, player, life, getMonth, getSky} = ctx;
  let diary = loadDiary();

  // ---------------------------------------------------------------- shared UI (styled like the fishing panel)
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="v2-offers" class="v2-offers"></div>
    <section id="v2-act" class="v2-fish" hidden aria-label="Activity">
      <p class="v2-fish-msg"><b></b><span></span></p>
      <div class="v2-fish-meter" hidden><div class="v2-fish-bar"><i></i></div><small></small></div>
      <div class="v2-fish-row">
        <button type="button" data-lean="-1" aria-label="Left (A)">◀</button>
        <button type="button" class="v2-fish-act"></button>
        <button type="button" data-lean="1" aria-label="Right (D)">▶</button>
      </div>
      <div class="v2-fish-row v2-fish-small">
        <button type="button" class="v2-act-second" hidden></button>
        <button type="button" class="v2-act-stop">✕ 不玩了 Stop · Esc</button>
      </div>
    </section>
    <p id="v2-toast" class="v2-toast" hidden role="status"></p>`;
  document.body.append(...wrap.children);
  const offersEl = document.getElementById('v2-offers'), hud = document.getElementById('v2-act'), toast = document.getElementById('v2-toast');
  // the fishing button joins the row of offers
  const fishGo = document.getElementById('v2-fish-go');
  if (fishGo) offersEl.append(fishGo);
  const msgB = hud.querySelector('.v2-fish-msg b'), msgS = hud.querySelector('.v2-fish-msg span');
  const meterEl = hud.querySelector('.v2-fish-meter'), bar = hud.querySelector('.v2-fish-bar i'), meterTxt = hud.querySelector('.v2-fish-meter small');
  const actBtn = hud.querySelector('.v2-fish-act'), secondBtn = hud.querySelector('.v2-act-second');
  const leanBtns = hud.querySelectorAll('[data-lean]');
  const walkPad = document.getElementById('v2-pad');
  let padWasHidden = true;

  // ---------------------------------------------------------------- what every activity gets
  const api = {
    ...ctx, sounds, buzz,
    get diary() { return diary; },
    say(zh, en = '') { if (msgB.textContent !== zh) msgB.textContent = zh; if (msgS.textContent !== en) msgS.textContent = en; },
    meter(value, text = '', color = '#5f9a48') {
      meterEl.hidden = value === null;
      if (value === null) return;
      bar.style.width = `${THREE.MathUtils.clamp(value, 0, 1) * 100}%`;
      bar.style.background = color;
      if (meterTxt.textContent !== text) meterTxt.textContent = text;
    },
    action(label, {urgent = false, disabled = false} = {}) {
      if (actBtn.textContent !== label) actBtn.textContent = label;
      actBtn.disabled = disabled;
      actBtn.classList.toggle('v2-fish-urgent', urgent);
    },
    second(label) { secondBtn.hidden = !label; if (label && secondBtn.textContent !== label) secondBtn.textContent = label; },
    leanButtons(on) { for (const b of leanBtns) b.hidden = !on; hud.classList.toggle('v2-fish-fighting', on); },
    /** a short message that stays a few seconds after the activity ends */
    toast(text, secs = 3.5) { toast.textContent = text; toast.hidden = false; toastT = secs; },
    /** update one record of the diary and save it */
    record(id, fn) { diary[id] = fn(diary[id] || {}); try { localStorage.setItem(DIARY_KEY, JSON.stringify(diary)); } catch { /* storage blocked */ } },
    finish(text) { if (text) api.toast(text); stop(); },
    kid() {
      const yaw = walk.yaw;
      return {pos: new THREE.Vector3(player.position.x, walk.feet ?? ctx.village.data.nav.ground, player.position.z), yaw,
        fw: new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), side: new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))};
    },
    month: () => getMonth(),
    sky: () => getSky(),
    night: () => ['night', 'dusk'].includes(getSky()),
    wet: () => ['summer storm', 'snow day', 'rain'].includes(getSky()),
  };
  let toastT = 0;

  const all = [createKite, createBugs, createRoast, createGlean, createIce, createFirecrackers, createTricycle].map((f) => f(api));
  let current = null, offers = [], offerT = 0;

  function start(a) {
    if (current || !a) return;
    sounds.unlock();
    current = a;
    toast.hidden = true;
    hud.hidden = false;
    hud.dataset.act = a.id;
    hud.toggleAttribute('data-walking', !a.pauseWalk);
    api.leanButtons(Boolean(a.lean) && a.pauseWalk);
    api.second(null);
    api.meter(null);
    api.action('…');
    offersEl.hidden = true;
    if (a.pauseWalk) {
      walk.pause(true);
      padWasHidden = walkPad?.hidden ?? true;
      if (walkPad) walkPad.hidden = true;
    }
    if (a.posture) life.setPosture(a.posture);
    a.start();
  }
  function stop() {
    if (!current) return;
    const a = current;
    current = null;
    a.stop();
    life.setPosture(null);
    if (a.pauseWalk) {
      walk.pause(false);
      if (walkPad) walkPad.hidden = padWasHidden;
    }
    hud.hidden = true;
    offersEl.hidden = false;
    offerT = 0;
    ctx.onStop?.();
  }

  function refreshOffers() {
    const busy = ctx.fishing?.active || !walk.enabled;
    offers = busy ? [] : all.filter((a) => { try { return a.available(); } catch { return false; } });
    const ids = offers.map((a) => a.id).join();
    if (offersEl.dataset.ids !== ids) {
      offersEl.dataset.ids = ids;
      for (const b of offersEl.querySelectorAll('.v2-offer')) b.remove();
      offers.forEach((a, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'v2-offer';
        b.textContent = `${a.icon} ${a.zh} ${a.en}${i === 0 ? ' · E' : ''}`;
        b.addEventListener('click', () => start(a));
        offersEl.prepend(b);
      });
    }
  }

  // ---------------------------------------------------------------- input
  const press = () => { sounds.unlock(); current?.press?.(); };
  const release = () => current?.release?.();
  actBtn.addEventListener('pointerdown', (e) => { actBtn.setPointerCapture(e.pointerId); press(); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) actBtn.addEventListener(ev, release);
  for (const b of leanBtns) {
    const d = Number(b.dataset.lean);
    b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); current?.lean?.(d, true); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => current?.lean?.(d, false));
  }
  secondBtn.addEventListener('click', () => current?.second?.());
  hud.querySelector('.v2-act-stop').addEventListener('click', () => current?.end ? current.end() : stop());
  const canvas = document.querySelector('#v2-canvas canvas');
  canvas?.addEventListener('pointerdown', (e) => { if (current?.pauseWalk && e.button === 0) press(); });
  addEventListener('pointerup', () => { if (current?.pauseWalk) release(); });
  const held = new Set();
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input,select,textarea') || e.repeat) return;
    if (!current) { if (e.code === 'KeyE' && offers[0]) start(offers[0]); return; }
    held.add(e.code);
    const paused = current.pauseWalk;
    if (e.code === 'KeyE' || (paused && e.code === 'Space')) { e.preventDefault(); press(); }
    else if (paused && (e.code === 'KeyA' || e.code === 'ArrowLeft')) current.lean?.(-1, true);
    else if (paused && (e.code === 'KeyD' || e.code === 'ArrowRight')) current.lean?.(1, true);
    else if (e.code === 'KeyB') current.second?.();
    else if (e.code === 'Escape') current.end ? current.end() : stop();
    current?.key?.(e.code, true);
  });
  addEventListener('keyup', (e) => {
    held.delete(e.code);
    if (!current) return;
    const paused = current.pauseWalk;
    if (e.code === 'KeyE' || (paused && e.code === 'Space')) release();
    else if (paused && (e.code === 'KeyA' || e.code === 'ArrowLeft')) current.lean?.(-1, false);
    else if (paused && (e.code === 'KeyD' || e.code === 'ArrowRight')) current.lean?.(1, false);
    current?.key?.(e.code, false);
  });
  addEventListener('blur', () => { if (current) { release(); current.lean?.(-1, false); current.lean?.(1, false); } });

  // ---------------------------------------------------------------- the diary page of the journal
  const RECORDS = [
    ['kite', '🪁', '放风筝 Kite', (r) => r.best ? `线放到 ${r.best} m · ${r.count} 次` : ''],
    ['bugs', '🪰', '捉蜻蜓 Dragonflies', (r) => r.best ? `一次最多 ${r.best} 只 · 共 ${r.total}` : ''],
    ['fireflies', '✨', '萤火虫 Fireflies', (r) => r.best ? `一瓶最多 ${r.best} 只 · 共 ${r.total}` : ''],
    ['roast', '🍠', '烤红薯 Sweet potatoes', (r) => r.count ? `烤好 ${r.count} 个${r.burnt ? ` · 烤糊 ${r.burnt}` : ''}` : ''],
    ['glean', '🌾', '拾麦穗 Gleaning', (r) => r.best ? `一篮最多 ${r.best} 穗 · 共 ${r.total}` : ''],
    ['ice', '⛸', '打出溜滑 Ice slide', (r) => r.best ? `最远 ${r.best} m · 摔了 ${r.falls || 0} 次` : ''],
    ['firecrackers', '🧨', '放鞭炮 Firecrackers', (r) => r.count ? `放了 ${r.count} 挂${r.fountains ? ` · 花炮 ${r.fountains}` : ''}` : ''],
    ['tricycle', '🛺', '电三轮 Tricycle', (r) => r.km ? `开了 ${r.km.toFixed(2)} km · 最快 ${Math.round(r.top || 0)} km/h` : ''],
  ];
  ctx.fishing?.setJournalExtra(() => {
    const items = RECORDS.map(([id, icon, name, fmt]) => {
      const txt = diary[id] ? fmt(diary[id]) : '';
      return `<li class="${txt ? '' : 'v2-journal-unknown'}"><span class="v2-diary-icon">${icon}</span><b>${name}</b><small>${txt || '还没玩过 not yet'}</small></li>`;
    }).join('');
    return `<h3 class="v2-diary-title">童年小事 · Little things</h3><ul class="v2-journal-grid v2-diary">${items}</ul>`;
  });

  // ---------------------------------------------------------------- per frame
  return {
    get active() { return Boolean(current); },
    get current() { return current; },
    get offers() { return offers; },
    get timeScale() { return current?.timeScale ?? 1; },
    /** true while the running activity frames its own shots */
    get ownsCamera() { return Boolean(current?.camera); },
    all, api, start, stop, press, release,
    byId: (id) => all.find((a) => a.id === id),
    clearDiary() { diary = {}; try { localStorage.removeItem(DIARY_KEY); } catch { /* ignore */ } },
    update(dt) {
      if (toastT > 0 && (toastT -= dt) <= 0) toast.hidden = true;
      for (const a of all) a.always?.(dt);  // things that live on after an activity (red paper on the ground, ice)
      offerT -= dt;
      if (!current && offerT <= 0) { offerT = 0.4; refreshOffers(); }
      if (current && !walk.enabled) stop();
      current?.update(dt);
    },
    updateCamera(cam, dt) { current?.camera?.(cam, dt); },
  };
}
