import './world.css';
const $=s=>document.querySelector(s);let viewer,pending,walking=false,hintTimer;
function closeMenu(){$('#walk-menu').hidden=true;for(const id of ['walk-menu-toggle','hud-status'])$('#'+id).setAttribute('aria-expanded','false');viewer?.pauseWalk(false);}
const time=h=>`${String(Math.floor(h)).padStart(2,'0')}:${String(Math.floor(h%1*60)).padStart(2,'0')}`;
function menu(){const open=$('#walk-menu').hidden;$('#walk-menu').hidden=!open;for(const id of ['walk-menu-toggle','hud-status'])$('#'+id).setAttribute('aria-expanded',String(open));viewer?.pauseWalk(open);if(open){$('#walk-time').value=viewer.hour;$('#walk-time-label').textContent=time(viewer.hour);}}
$('#canvas-host').addEventListener('navigationchange',({detail})=>{walking=detail.walking;for(const id of ['walk-toolbar','walk-crosshair','walk-pad'])$('#'+id).hidden=!walking;closeMenu();clearTimeout(hintTimer);$('#walk-help').hidden=!walking;$('#walk-help').textContent=matchMedia('(pointer:coarse)').matches?'Arrows to move · drag to look · Interact to hold a chicken':'WASD · click to look · F ride · E hold chicken · Space flap · weather at top left';if(walking)hintTimer=setTimeout(()=>$('#walk-help').hidden=true,6500);});
async function enter(place){$('#entry-error').hidden=true;$('#loading').hidden=false;document.querySelectorAll('[data-entry]').forEach(b=>b.disabled=true);try{pending??=import('./viewer.js').then(({createViewer})=>createViewer($('#canvas-host')));viewer=await pending;await viewer.load('village',p=>$('#loading-progress').textContent=p);viewer.setSeason($('#walk-season').value);viewer.setWeather($('#walk-weather').value);viewer.setActive(true);$('#entry').hidden=true;viewer.walkAt(place==='house'?'courtyard':'avenue');}catch(error){console.error(error);$('#entry-error').textContent='The 3D world could not load. Check your connection and enable WebGL, then try again.';$('#entry-error').hidden=false;pending=undefined;}finally{$('#loading').hidden=true;document.querySelectorAll('[data-entry]').forEach(b=>b.disabled=false);}}
document.querySelectorAll('[data-entry]').forEach(b=>b.addEventListener('click',()=>enter(b.dataset.entry)));
for(const id of ['walk-menu-toggle','hud-status'])$('#'+id).addEventListener('click',menu);
$('#walk-resume').addEventListener('click',closeMenu);
$('#walk-exit').addEventListener('click',()=>{viewer?.exitWalk();viewer?.setActive(false);$('#entry').hidden=false;});
$('#walk-weather').addEventListener('change',()=>viewer?.setWeather($('#walk-weather').value));
$('#walk-season').addEventListener('change',()=>viewer?.setSeason($('#walk-season').value));
$('#walk-time').addEventListener('input',()=>{viewer?.setHour($('#walk-time').value);$('#walk-time-label').textContent=time(Number($('#walk-time').value));});
$('#walk-day-speed').addEventListener('change',()=>viewer?.setDaySpeed($('#walk-day-speed').value));
$('#walk-sound').addEventListener('change',()=>viewer?.setSound($('#walk-sound').checked));
$('#walk-reset-targets').addEventListener('click',()=>{viewer?.gameAction('reset');closeMenu();});
$('#canvas-host').addEventListener('environmentchange',({detail})=>{if(detail.weather)$('#walk-weather').value=detail.weather;if(detail.season)$('#walk-season').value=detail.season;});
window.addEventListener('keydown',e=>{if(walking&&e.code==='Escape'&&!$('#walk-menu').hidden)closeMenu();});
for(const b of document.querySelectorAll('[data-walk]')){b.addEventListener('pointerdown',e=>{e.preventDefault();try{b.setPointerCapture(e.pointerId);}catch{}viewer?.walkInput(b.dataset.walk,true);});for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>viewer?.walkInput(b.dataset.walk,false));}
document.addEventListener('visibilitychange',()=>viewer?.setActive(!document.hidden&&walking));
