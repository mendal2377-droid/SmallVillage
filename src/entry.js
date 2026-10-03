import './world.css';
import './adventure.css';
const $=s=>document.querySelector(s);let viewer,pending,walking=false,hintTimer;
function closeMenu(){$('#walk-menu').hidden=true;for(const id of ['walk-menu-toggle','hud-status'])$('#'+id).setAttribute('aria-expanded','false');viewer?.pauseWalk(false);}
const time=h=>`${String(Math.floor(h)).padStart(2,'0')}:${String(Math.floor(h%1*60)).padStart(2,'0')}`;
function menu(){const open=$('#walk-menu').hidden;$('#walk-menu').hidden=!open;for(const id of ['walk-menu-toggle','hud-status'])$('#'+id).setAttribute('aria-expanded',String(open));viewer?.pauseWalk(open);if(open){$('#walk-time').value=viewer.hour;$('#walk-time-label').textContent=time(viewer.hour);}}
$('#canvas-host').addEventListener('navigationchange',({detail})=>{walking=detail.walking;for(const id of ['walk-toolbar','walk-crosshair','walk-pad'])$('#'+id).hidden=!walking;closeMenu();clearTimeout(hintTimer);$('#walk-help').hidden=!walking;$('#walk-help').textContent=matchMedia('(pointer:coarse)').matches?'Arrows to move · drag to look · Interact to hold a chicken':'WASD · click to look · F ride · E hold chicken · Space flap · weather at top left';if(walking)hintTimer=setTimeout(()=>$('#walk-help').hidden=true,6500);});
async function boot(){if(pending)return pending;$('#loading').hidden=false;pending=import('./viewer.js').then(async({createViewer})=>{viewer=createViewer($('#canvas-host'),{onEnter:enter});await viewer.load('village',p=>$('#loading-progress').textContent=p);$('#canvas-host').dataset.overview='ready';return viewer;}).catch(error=>{console.error(error);$('#entry-error').textContent='The village could not load. Check your connection and enable WebGL, then reload.';$('#entry-error').hidden=false;pending=undefined;throw error;}).finally(()=>$('#loading').hidden=true);return pending;}
async function enter(place){try{viewer=await boot();viewer.setActive(true);$('#entry').hidden=true;viewer.walkAt(place.place);}catch{/* The overview displays loading errors. */}}
function summerNight(){viewer?.setWeather('clear');viewer?.setSeason('summer');viewer?.setHour(22);viewer?.setDaySpeed(0);$('#walk-time').value=22;$('#walk-time-label').textContent='22:00';$('#walk-day-speed').value='0';$('#summer-night').textContent='☾ Summer night · choose a pin';}
$('#summer-night').addEventListener('click',summerNight);
$('#walk-summer-night').addEventListener('click',()=>{summerNight();closeMenu();});
for(const id of ['walk-menu-toggle','hud-status'])$('#'+id).addEventListener('click',menu);
$('#walk-resume').addEventListener('click',closeMenu);
$('#walk-exit').textContent='Overview';
$('#walk-exit').addEventListener('click',()=>{viewer?.exitWalk();viewer?.setActive(true);$('#entry').hidden=false;});
$('#walk-weather').addEventListener('change',()=>viewer?.setWeather($('#walk-weather').value));
$('#walk-season').addEventListener('change',()=>viewer?.setSeason($('#walk-season').value));
$('#walk-time').addEventListener('input',()=>{viewer?.setHour($('#walk-time').value);$('#walk-time-label').textContent=time(Number($('#walk-time').value));});
$('#walk-day-speed').addEventListener('change',()=>viewer?.setDaySpeed($('#walk-day-speed').value));
$('#walk-sound').addEventListener('change',()=>viewer?.setSound($('#walk-sound').checked));
$('#walk-reset-targets').addEventListener('click',()=>{viewer?.gameAction('reset');closeMenu();});
$('#canvas-host').addEventListener('environmentchange',({detail})=>{if(detail.weather)$('#walk-weather').value=detail.weather;if(detail.season)$('#walk-season').value=detail.season;});
window.addEventListener('keydown',e=>{if(walking&&e.code==='Escape'&&!$('#walk-menu').hidden)closeMenu();});
for(const b of document.querySelectorAll('[data-walk]')){b.addEventListener('pointerdown',e=>{e.preventDefault();try{b.setPointerCapture(e.pointerId);}catch{}viewer?.walkInput(b.dataset.walk,true);});for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>viewer?.walkInput(b.dataset.walk,false));}
document.addEventListener('visibilitychange',()=>{viewer?.setActive(!document.hidden);if(!document.hidden&&!$('#walk-menu').hidden)viewer?.pauseWalk(true);});
boot().catch(()=>{});
