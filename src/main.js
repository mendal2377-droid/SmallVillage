import './style.css';

const $ = (selector) => document.querySelector(selector);
const stage = $('#stage');
const image = $('#scene-image');
const imageInfo = {
  courtyard: ['Life around the courtyard', 'Reconstructed courtyard with a glazed balcony, blue shed and hanging laundry'],
  alley: ['The familiar way home', 'Narrow brick alley with ivy, puddles, overhead wires and a red entrance gate'],
  entrance: ['Through the red gate', 'Burgundy double entrance gate with an open pedestrian door into the courtyard'],
  context: ['A home in its surroundings', 'Elevated view of the courtyard house in the interpretive village'],
  village: ['The village, reimagined', 'Aerial view of the interpretive village model'],
};
let selectedModel = 'house';
let currentImage = 'courtyard';
let mode = 'render';
let viewer;
let viewerPromise;
let changeId = 0;

function showImage(key) {
  currentImage = key;
  image.src = `/images/${key}.webp`;
  image.alt = imageInfo[key][1];
  $('#view-title').textContent = imageInfo[key][0];
  document.querySelectorAll('[data-image]').forEach((b) => {
    const active = b.dataset.image === key;
    b.classList.toggle('active', active);b.setAttribute('aria-pressed', String(active));
  });
}
function setModeUI(next) {
  mode = next;
  const is3d = mode === '3d';
  stage.classList.toggle('is-3d', is3d);
  image.hidden = is3d;$('#canvas-host').hidden = !is3d;$('#viewer-controls').hidden = !is3d;
  $('#render-mode').classList.toggle('selected', !is3d);$('#three-mode').classList.toggle('selected', is3d);
  $('#render-mode').setAttribute('aria-pressed', String(!is3d));$('#three-mode').setAttribute('aria-pressed', String(is3d));
  $('#interaction-hint').textContent = is3d ? 'Drag to orbit · scroll or pinch to zoom · right-drag to pan' : 'Four views of the reconstructed house and its adjoining lane.';
  $('#view-eyebrow').textContent = is3d ? 'INTERACTIVE 3D SCENE' : 'A CLOSER LOOK';
  if (!is3d) {$('#loading').hidden = true;showImage(currentImage);}
  if (viewer) viewer.setActive(is3d);
}
async function enter3D() {
  const requestId = ++changeId;
  setModeUI('3d');
  $('#loading').hidden = false;$('#loading-progress').textContent = 'Loading 3D viewer';
  try {
    viewerPromise ??= import('./viewer.js').then(({createViewer}) => createViewer($('#canvas-host')));
    viewer = await viewerPromise;
    if(requestId !== changeId || mode !== '3d') return;
    await viewer.load(selectedModel, (progress) => {
      if(requestId === changeId) $('#loading-progress').textContent = progress;
    });
    if(requestId !== changeId || mode !== '3d') return;
    viewer.setActive(true);$('#loading').hidden = true;
    $('#view-title').textContent = selectedModel === 'house' ? 'The courtyard house, in 3D' : 'Explore the surrounding village';
    document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === 'orbit'));
  } catch (error) {
    console.error('3D viewer:', error);
    if(requestId !== changeId) return;
    setModeUI('render');
    $('#interaction-hint').textContent = 'The 3D scene could not open on this device. You can still explore all rendered views or download the Blender file.';
    viewerPromise = undefined;
  }
}
$('#three-mode').addEventListener('click', enter3D);
$('#render-mode').addEventListener('click', () => {changeId++;setModeUI('render');});
document.querySelectorAll('[data-image]').forEach(button => button.addEventListener('click', () => {
  selectedModel = 'house';
  document.querySelectorAll('[data-model]').forEach(b => {const on=b.dataset.model==='house';b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
  $('#scene-badge').textContent = '01 / THE COURTYARD HOUSE';
  changeId++;setModeUI('render');showImage(button.dataset.image);
}));
document.querySelectorAll('[data-model]').forEach(button => button.addEventListener('click', () => {
  selectedModel = button.dataset.model;
  document.querySelectorAll('[data-model]').forEach(b => {const on=b===button;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
  $('#scene-badge').textContent = selectedModel === 'house' ? '01 / THE COURTYARD HOUSE' : '02 / THE SURROUNDING VILLAGE';
  if (mode === '3d') enter3D(); else showImage(selectedModel === 'house' ? 'courtyard' : 'village');
}));
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  viewer?.preset(button.dataset.view);
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b === button));
}));
$('#reset-view').addEventListener('click', () => {
  viewer?.preset('orbit');document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active',b.dataset.view==='orbit'));
});
$('#fullscreen').addEventListener('click', async () => {
  try {if(document.fullscreenElement) await document.exitFullscreen();else if(stage.requestFullscreen) await stage.requestFullscreen();} catch { $('#interaction-hint').textContent='Fullscreen is unavailable in this browser.'; }
});
document.addEventListener('visibilitychange',()=>viewer?.setActive(!document.hidden && mode==='3d'));
