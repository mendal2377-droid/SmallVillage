// Main page: two ways to choose where to land.
//  - Map: the painted top-down map (Blender orthographic render, painted with paint_map.py), pan/zoom,
//    bilingual place pins; tapping anywhere lands there.
//  - 3D: the orbit overview with the same pins floating over their places.
import * as THREE from 'three';

export function createLanding({data, camera, renderer, onLand, getSeason}) {
  const sheet = data.mapSheet;
  const half = sheet.size / 2;
  const x0 = sheet.center[0] - half, z0 = sheet.center[1] - half;
  const toUV = (x, z) => [(x - x0) / sheet.size, (z - z0) / sheet.size];
  const fromUV = (u, v) => [x0 + u * sheet.size, z0 + v * sheet.size];

  // ---------------------------------------------------------------- 2D painted map
  const mapEl = document.getElementById('v2-map');
  const view = mapEl.querySelector('.v2-map-view');
  const img = mapEl.querySelector('img');
  const pinLayer = mapEl.querySelector('.v2-map-pins');
  let scale = 1, tx = 0, ty = 0;

  function fit() {
    const r = mapEl.getBoundingClientRect();
    const s = Math.min(r.width, r.height) * 0.96;
    view.style.width = view.style.height = `${s}px`;
    scale = Math.max(1, Math.min(scale, 5));
    clampPan();
    apply();
  }
  function clampPan() {
    const r = mapEl.getBoundingClientRect(), s = view.offsetWidth * scale;
    const mx = Math.max(0, (s - r.width) / 2 + 40), my = Math.max(0, (s - r.height) / 2 + 40);
    tx = Math.max(-mx, Math.min(mx, tx));
    ty = Math.max(-my, Math.min(my, ty));
  }
  function apply() {
    view.style.transform = `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(${scale})`;
    // keep pin labels a readable size while zooming
    pinLayer.style.setProperty('--inv', String(1 / scale));
  }
  function setSeason(season) {
    const src = sheet.images[season] || sheet.images.summer;
    if (!img.src.endsWith(src)) img.src = src;
  }

  function makePin(layer, place, extraClass = '') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `v2-pin v2-pin-${place.kind} ${extraClass}`;
    b.innerHTML = `<span class="v2-pin-dot"></span><span class="v2-pin-label"><b>${place.zh}</b><small>${place.en}</small></span>`;
    b.setAttribute('aria-label', `Land at ${place.en} (${place.zh})`);
    b.addEventListener('click', (e) => { e.stopPropagation(); onLand(place.position[0], place.position[1], place); });
    layer.appendChild(b);
    return b;
  }
  for (const place of data.places) {
    const [u, v] = toUV(place.position[0], place.position[1]);
    const b = makePin(pinLayer, place);
    b.style.left = `${u * 100}%`;
    b.style.top = `${v * 100}%`;
  }
  // the dream coast lives far beyond the real horizon: shown as a faded inset, not part of the map
  const dream = document.createElement('div');
  dream.className = 'v2-dream';
  dream.innerHTML = '<b>梦里的海</b><small>Dream coast · coming later</small>';
  mapEl.appendChild(dream);

  // pan / zoom / pinch; a tap that did not move lands at that spot
  const pointers = new Map();
  let moved = 0, pinch = null;
  mapEl.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.v2-pin, .v2-mode')) return;
    mapEl.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    moved = 0;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = {d: Math.hypot(a.x - b.x, a.y - b.y), scale};
    }
  });
  mapEl.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      scale = Math.max(1, Math.min(5, pinch.scale * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
    } else {
      tx += dx;
      ty += dy;
    }
    moved += Math.abs(dx) + Math.abs(dy);
    clampPan();
    apply();
  });
  function release(e) {
    const wasTap = pointers.size === 1 && moved < 6 && !pinch;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (wasTap && e.type === 'pointerup') {
      const r = view.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
      if (u > 0.02 && u < 0.98 && v > 0.02 && v < 0.98) {
        const [x, z] = fromUV(u, v);
        onLand(x, z, {id: 'here', zh: '这里', en: 'Here'});
      }
    }
  }
  mapEl.addEventListener('pointerup', release);
  mapEl.addEventListener('pointercancel', release);
  mapEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = mapEl.getBoundingClientRect();
    const cx = e.clientX - r.left - r.width / 2 - tx, cy = e.clientY - r.top - r.height / 2 - ty;
    const k = Math.exp(-e.deltaY * 0.0015), ns = Math.max(1, Math.min(5, scale * k));
    tx -= cx * (ns / scale - 1);
    ty -= cy * (ns / scale - 1);
    scale = ns;
    clampPan();
    apply();
  }, {passive: false});
  window.addEventListener('resize', fit);

  // ---------------------------------------------------------------- 3D map pins
  const pins3d = document.getElementById('v2-pins3d');
  const pins = data.places.map((place) => ({place, el: makePin(pins3d, place, 'v2-pin-3d'),
    pos: new THREE.Vector3(place.position[0], 18, place.position[1])}));
  const v = new THREE.Vector3();
  function updatePins3d() {
    if (pins3d.hidden) return;
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    for (const p of pins) {
      v.copy(p.pos).project(camera);
      const on = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      p.el.style.display = on ? '' : 'none';
      if (on) p.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px)`;
    }
  }

  // ---------------------------------------------------------------- modes
  const modeButtons = document.querySelectorAll('.v2-mode [data-mode]');
  let mode = 'map';
  function setMode(m) {
    mode = m;
    mapEl.hidden = m !== 'map';
    pins3d.hidden = m !== '3d';
    document.body.dataset.mode = m;
    for (const b of modeButtons) b.setAttribute('aria-pressed', String(b.dataset.mode === m));
    if (m === 'map') { setSeason(getSeason()); fit(); }
  }
  for (const b of modeButtons) b.addEventListener('click', () => setMode(b.dataset.mode));

  return {
    setMode, get mode() { return mode; }, setSeason, updatePins3d,
    hideAll() { mapEl.hidden = true; pins3d.hidden = true; document.body.dataset.mode = 'flying'; },
  };
}
