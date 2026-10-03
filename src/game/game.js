import * as THREE from 'three';
import {createAudio} from './audio.js';
import {createVehicles} from './vehicles.js';
import {createToys,TOOLS} from './toys.js';
import {createCreatures} from './creatures.js';

const $=(s)=>document.querySelector(s);
const WEATHER_LABEL={clear:'Clear',overcast:'Overcast',rain:'Rain',storm:'Thunderstorm',snow:'Snowfall',fog:'Fog',sunset:'Sunset'};
const SEASON_LABEL={green:'Spring',summer:'Summer',corn:'Autumn',winter:'Winter'};
const clock=(h)=>`${String(Math.floor(h)).padStart(2,'0')}:${String(Math.floor(h%1*60)).padStart(2,'0')}`;

// The play layer on top of the first-person walk: vehicles, toys, flashlight, sound and the HUD.
export function createGame({host,scene,camera,canvas,walk,environment,onWeather=()=>{},onSeason=()=>{}}){
  const audio=createAudio();
  let active=false,sceneName='house',noticeTimer,hudTimer=0,score=0,rings=0,startled=0,flashlightOn=false,prompt='';
  const vehicles=createVehicles({scene,camera,walk,audio});
  const creatures=createCreatures({scene,camera,walk,audio,notice,host});
  const toys=createToys({scene,camera,walk,audio,onEvent(type,detail){
    if(type==='query-snow')return environment.season==='winter'||environment.weather==='snow';
    if(type==='notice')notice(detail);
    if(type==='tool')renderTools();
    if(type==='can'){score=detail.down;host.dataset.cansDown=String(detail.down);if(detail.down&&detail.down===detail.total)notice('Every tin knocked down! Nice shooting.');}
    if(type==='targets')host.dataset.cansTotal=String(detail.total);
    if(type==='ring'){rings+=detail.score;notice(detail.score===10?'Bullseye! +10':`Target +${detail.score}`);}
    if(type==='birds'){startled+=detail.count;host.dataset.birdsStartled=String(startled);}
    if(type==='bang')host.dataset.bangs=String(Number(host.dataset.bangs||0)+1);
    renderScore();
  }});
  const torch=new THREE.SpotLight('#fff4dc',0,32,.42,.65,1.1);torch.visible=false;torch.position.set(.15,-.1,0);torch.target.position.set(0,0,-1);camera.add(torch,torch.target);
  environment.on(e=>{if(e==='lightning')audio.play('thunder');});

  function notice(text){const n=$('#hud-notice');n.textContent=text;n.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>n.hidden=true,2600);}
  function renderTools(){
    const bar=$('#hud-tools');
    bar.replaceChildren(...TOOLS.map(t=>{const b=document.createElement('button');b.type='button';b.dataset.tool=t.id;b.className=t.id===toys.tool?'active':'';
      b.disabled=!toys.available(t.id);b.title=`${t.label} (${t.key})`;b.setAttribute('aria-pressed',String(t.id===toys.tool));
      b.innerHTML=`<span aria-hidden="true">${t.icon}</span><small>${t.key}</small><em>${t.label}</em>`;
      b.addEventListener('click',()=>{toys.select(t.id);canvas.focus({preventScroll:true});});return b;}));
    host.dataset.tool=toys.tool;
  }
  function renderScore(){
    const s=toys.stats;$('#hud-score').textContent=`Tins ${s.down}/${s.cans}${rings?` · Target ${rings}`:''}${startled?` · Birds startled ${startled}`:''}`;
    $('#hud-score').hidden=!s.down&&!rings;
  }
  function renderStatus(){
    const v=vehicles.driving;
    $('#hud-status').textContent=`${clock(environment.hour)} · ${WEATHER_LABEL[environment.weather]} · ${SEASON_LABEL[environment.season]}`;
    $('#hud-speed').hidden=!v;
    if(v)$('#hud-speed').innerHTML=`<strong>${Math.round(Math.abs(v.speed)*3.6)}</strong> km/h${v.speed<-.1?' · R':''}`;
    $('#hud-tools').hidden=Boolean(v)||Boolean(creatures.held);$('#game-hud').classList.toggle('driving',Boolean(v));
    $('#hud-prompt').hidden=!prompt;$('#hud-prompt').innerHTML=prompt;
    $('#hud-use').hidden=!prompt;$('#hud-fire').hidden=Boolean(v)||Boolean(creatures.held)||toys.tool==='hands';
    $('#hud-flap').hidden=!creatures.held;$('#hud-descend').hidden=!creatures.held;
  }
  function interact(chickenFirst=false){
    if(!active||walk.paused)return;
    if(creatures.held){creatures.release();return;}
    if(vehicles.driving){if(!vehicles.dismount())notice('No room to get off here.');toys.setVisible(true);return;}
    if(chickenFirst||creatures.nearest().distance<1.9){if(creatures.grab()){toys.hold(false);toys.select('hands');toys.setVisible(false);return;}if(chickenFirst)return;}
    const {vehicle,distance}=vehicles.nearest(camera.position);
    if(vehicle&&distance<1.6){vehicles.mount(vehicle);toys.setVisible(false);notice(`On ${vehicle.spec.label}. W/S drive · A/D steer · Space brake · V view · F get off`);}
  }
  function setTorch(value){flashlightOn=value;torch.intensity=value?26:0;torch.visible=value;host.dataset.flashlight=String(value);}
  function cycleWeather(){const list=environment.weathers.filter(w=>w!=='sunset');const next=list[(list.indexOf(environment.weather)+1)%list.length];onWeather(next);notice(WEATHER_LABEL[next]);}

  window.addEventListener('keydown',e=>{
    if(!active||walk.paused||e.target.closest?.('input,textarea,select')||e.repeat)return;
    audio.start();
    const tool=TOOLS.find(t=>t.key===e.key);
    if(tool&&!vehicles.driving&&!creatures.held){toys.select(tool.id);return;}
    if(e.code==='KeyF'||e.code==='KeyE'){e.preventDefault();interact(e.code==='KeyE');}
    if(e.code==='KeyL'){setTorch(!flashlightOn);notice(flashlightOn?'Flashlight on':'Flashlight off');}
    if(e.code==='KeyV'&&vehicles.driving){vehicles.toggleView();}
    if(e.code==='KeyH')vehicles.horn();
    if(e.code==='KeyT'){environment.setHour(environment.hour+1);notice(`Time ${clock(environment.hour)}`);}
    if(e.code==='KeyG')cycleWeather();
    if(e.code==='KeyJ'){const list=Object.keys(SEASON_LABEL);onSeason(list[(list.indexOf(environment.season)+1)%list.length]);notice(SEASON_LABEL[environment.season]);renderTools();}
    if(e.code==='KeyR'){toys.resetTargets();notice('Targets reset');}
  });
  // Fire with the left button only once the mouse is captured, so the capturing click is not a shot.
  canvas.addEventListener('mousedown',e=>{if(active&&e.button===0&&document.pointerLockElement===canvas&&!vehicles.driving&&!creatures.held){audio.start();toys.hold(true);}});
  window.addEventListener('mouseup',()=>toys.hold(false));
  canvas.addEventListener('wheel',e=>{if(!active||vehicles.driving||document.pointerLockElement!==canvas)return;const usable=TOOLS.filter(t=>toys.available(t.id));const i=usable.findIndex(t=>t.id===toys.tool);toys.select(usable[(i+(e.deltaY>0?1:-1)+usable.length)%usable.length].id);},{passive:true});
  $('#hud-fire').addEventListener('pointerdown',e=>{e.preventDefault();audio.start();toys.hold(true);});
  for(const ev of ['pointerup','pointercancel','pointerleave'])$('#hud-fire').addEventListener(ev,()=>toys.hold(false));
  $('#hud-use').addEventListener('click',()=>{audio.start();interact();});

  return {
    audio,vehicles,toys,creatures,
    get active(){return active;},
    start(name){
      active=true;sceneName=name;score=rings=startled=0;
      vehicles.spawn(name);toys.spawn(name);creatures.spawn();toys.select('hands');toys.setVisible(true);
      $('#game-hud').hidden=false;renderTools();renderScore();
      host.dataset.game='on';host.dataset.vehicles=String(vehicles.list.length);
    },
    stop(){
      if(vehicles.driving)vehicles.dismount();
      creatures.stop();
      active=false;toys.hold(false);toys.clear();vehicles.spawn('none');setTorch(false);audio.engine(null,0);audio.ambience({});
      $('#game-hud').hidden=true;host.dataset.game='off';
    },
    action(name){if(name==='use')interact();if(name==='torch')setTorch(!flashlightOn);if(name==='reset')toys.resetTargets();},
    setTorch,
    refreshTools:renderTools,
    update(dt,time){
      if(!active)return;
      const darkness=1-environment.daylight;
      vehicles.update(dt,time,darkness);
      const carried=Boolean(creatures.held);creatures.update(dt,time);if(carried&&!creatures.held)toys.setVisible(true);
      toys.update(dt,time);
      if(creatures.held){prompt='<kbd>E</kbd> Land & release · <kbd>Space</kbd> Flap · <kbd>Ctrl</kbd> Descend';}
      else if(!vehicles.driving){
        // Re-apply the look direction each frame so firecracker shake never accumulates.
        const shake=toys.shake;camera.rotation.set(walk.pitch+(Math.random()-.5)*shake,walk.yaw+(Math.random()-.5)*shake,0,'YXZ');
        const {vehicle,distance}=vehicles.nearest(camera.position);
        prompt=creatures.nearest().distance<1.9?'<kbd>E</kbd> Hold chicken & fly':vehicle&&distance<1.6?`<kbd>F</kbd> Ride ${vehicle.spec.label}`:'';
      }else prompt=`<kbd>F</kbd> Get off · <kbd>V</kbd> View · <kbd>H</kbd> Horn`;
      const storm=environment.weather==='storm';
      audio.ambience({rain:environment.wet&&!environment.sheltered?(storm?1:.6):environment.wet?.2:0,wind:storm?.9:environment.weather==='snow'?.35:environment.weather==='fog'?.15:.08});
      host.dataset.driving=vehicles.driving?vehicles.driving.kind:'';host.dataset.speed=(vehicles.driving?.speed||0).toFixed(2);
      if((hudTimer-=dt)<=0){hudTimer=.2;renderStatus();if(darkness>.6&&!flashlightOn&&!host.dataset.torchHint){host.dataset.torchHint='1';notice('It is getting dark. Press L for a flashlight.');}}
    },
  };
}
