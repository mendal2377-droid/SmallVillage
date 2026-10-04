import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {createWalkController} from './walk.js';
import {createEnvironment} from './environment.js';
import {createGame} from './game/game.js';
import {createWorldDetails} from './world.js';
import {createMaps} from './map.js';
import {createIllustration,paintArchitecture} from './illustration.js';
import {createVillageAtmosphere} from './atmosphere.js';
import {loadPaintedAssets} from './painted.js';
import {extendWoodlandNavigation} from './woodland-layout.js';
import {createWoodland} from './woodland.js';
import {createHouseDoor} from './house-door.js';
import {extendCoastNavigation} from './coast-layout.js';
import {createCoast} from './coast.js';

export function createViewer(host,{onEnter=()=>{}}={}) {
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  host.replaceChildren(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Village world. WASD to walk, click or drag to look.');
  renderer.domElement.setAttribute('tabindex','0');
  const scene = new THREE.Scene();scene.background=new THREE.Color('#e3e8dc');
  const camera=new THREE.PerspectiveCamera(42,1,.1,3000);scene.add(camera);
  function syncCameraState(){host.dataset.cameraPosition=camera.position.toArray().map(v=>v.toFixed(3)).join(',');host.dataset.cameraLook=[camera.rotation.x,camera.rotation.y].map(v=>v.toFixed(3)).join(',');}
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.maxPolarAngle=Math.PI*.495;
  const walk=createWalkController(camera,renderer.domElement,(walking)=>{
    controls.enabled=!walking;host.dataset.navigationMode=walking?'walk':'orbit';syncCameraState();
    environment.setWalking(walking);
    if(walking)game.start(modelName);else game.stop();
    host.dispatchEvent(new CustomEvent('navigationchange',{detail:{walking}}));
  });
  const sceneVersion='village-comfort-20261004-1';
  const navigation=fetch(`/models/navigation.json?v=${sceneVersion}`).then(response=>{if(!response.ok)throw new Error('Navigation data unavailable');return response.json();});
  let navigationData;
  const sky=new THREE.HemisphereLight(0xe8eef1,0x858988,2.8);scene.add(sky);
  const sun=new THREE.DirectionalLight(0xfff7df,2.6);sun.position.set(-30,70,40);scene.add(sun);
  sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-35,right:35,top:35,bottom:-35,near:.5,far:220});sun.shadow.bias=-.0003;sun.shadow.normalBias=.03;scene.add(sun.target);
  const fill=new THREE.DirectionalLight(0xe6f0ff,1.4);fill.position.set(40,25,-30);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(1600,1600),new THREE.MeshStandardMaterial({color:'#b5bf9d',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.35;scene.add(floor);
  const environment=createEnvironment(scene,camera,sun,sky,fill,floor,host);
  const illustration=createIllustration(renderer,scene,camera,environment,host);let atmosphere,woodland,coast,houseDoor;
  const details=createWorldDetails({scene,camera,host,environment});
  function setWeather(value){environment.setWeather(value);game.refreshTools();host.dispatchEvent(new CustomEvent('environmentchange',{detail:{weather:environment.weather}}));}
  const maps=createMaps({host,camera,walk,environment,onEnter});
  const game=createGame({host,scene,camera,canvas:renderer.domElement,walk,environment,world:details,onHome:()=>maps.home(),onWeather:setWeather,onSeason:setSeason});
  const marker=new THREE.Group();scene.add(marker);
  const ring=new THREE.Mesh(new THREE.RingGeometry(12.5,13,64),new THREE.MeshBasicMaterial({color:'#d4b362',side:THREE.DoubleSide,transparent:true,opacity:.8}));ring.rotation.x=-Math.PI/2;ring.position.set(-31,.30,108);marker.add(ring);
  const labelCanvas=document.createElement('canvas');labelCanvas.width=384;labelCanvas.height=96;
  const ctx=labelCanvas.getContext('2d');ctx.fillStyle='#26372de8';ctx.roundRect(2,2,380,92,20);ctx.fill();ctx.fillStyle='#f6db94';ctx.font='500 34px sans-serif';ctx.textAlign='center';ctx.fillText('⌖  Your house',192,59);
  const pin=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(labelCanvas),depthTest:false}));pin.position.set(-37.8,7.8,112.3);pin.scale.set(9,2.25,1);marker.add(pin);
  let active=true,current,modelName='house',loadVersion=0,season='green';
  function setSeason(value){
    if(!['green','summer','corn','winter'].includes(value))return;
    season=value;
    current?.traverse(o=>{
      const tag=o.userData.season;if(!tag)return;
      if(o.userData.replacedVegetation){o.visible=false;return;}
      o.visible=tag==='leaves'?season!=='winter':tag===(season==='summer'?'corn':season);
      if(tag==='corn'&&o.material){
        const m=o.material;m.userData.autumnColor??=m.color.clone();
        m.color.copy(m.userData.autumnColor);
        if(season==='summer')m.color.set(m.name.includes('leaves')?'#68833f':'#7d8247');
      }
    });
    environment.setSeason(season);
    game.refreshTools();
    details.setSeason(season);
    host.dataset.season=season;
    host.dispatchEvent(new CustomEvent('environmentchange',{detail:{season}}));
    host.dataset.seasonMeshes=String([...current?.children||[]].filter(o=>o.userData.season&&o.visible).length);
  }
  function walkAt(place){
    if(!navigationData)return;
    const data=navigationData[modelName];
    walk.enter({...data,...(typeof place==='object'?place:modelName==='village'?data.places?.[place]:{})});
    host.dataset.walkLocation=typeof place==='object'?'activity':place||'start';
  }
  const cache=new Map();const draco=new DRACOLoader().setDecoderPath('/draco/');const loader=new GLTFLoader().setDRACOLoader(draco);
  function resize(){const {width,height}=host.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
  new ResizeObserver(resize).observe(host);
  function preset(name) {
    if(name==='walk'){if(navigationData)walk.enter(navigationData[modelName]);return;}
    walk.exit();camera.fov=42;
    const village=modelName==='village';
    const target=village?new THREE.Vector3(-15,0,65):new THREE.Vector3(0,2,0);
    const positions=village?{orbit:[650,700,800],top:[-15,1250,65.01],close:[65,85,185]}:{orbit:[27,23,30],top:[0,48,.01],close:[4,5,13]};
    if(village&&name==='close')target.set(-31,0,108);
    if(village&&name==='orbit'&&host.clientWidth<600){positions.orbit=[1350,1050,80];camera.fov=52;}
    camera.position.set(...positions[name]);controls.target.copy(target);controls.minDistance=village?6:2;controls.maxDistance=village?1900:100;camera.near=village?.5:.08;camera.far=3000;camera.updateProjectionMatrix();controls.update();resize();syncCameraState();
  }
  async function load(name,onProgress) {
    if(current&&modelName===name){preset('orbit');return;}
    const version=++loadVersion;
    if(!cache.has(name)) {
      const promise=loader.loadAsync(`/models/${name}.glb?v=${sceneVersion}`,(e)=>onProgress(e.total?`Loading model · ${Math.round(e.loaded/e.total*100)}%`:`Loading model · ${(e.loaded/1048576).toFixed(1)} MB`)).then(g=>g.scene);
      cache.set(name,promise);promise.catch(()=>cache.delete(name));
    }
    const [model,source,metadata,architecture]=await Promise.all([cache.get(name),navigation,fetch(`/models/world-details.json?v=${sceneVersion}`).then(r=>r.json()),fetch(`/models/atmosphere.json?v=${sceneVersion}`).then(r=>r.json()),loadPaintedAssets()]);
    const data={...source,village:extendCoastNavigation(extendWoodlandNavigation(source.village))};navigationData=data;
    if(version!==loadVersion)return;
    if(current)scene.remove(current);
    current=model;modelName=name;scene.add(model);environment.setModel(model,data[name]);details.install(model,metadata,data[name]);paintArchitecture(model);if(atmosphere)scene.remove(atmosphere.root);if(woodland)scene.remove(woodland.root);if(coast)scene.remove(coast.root);atmosphere=undefined;woodland=undefined;coast=undefined;if(name==='village'){atmosphere=createVillageAtmosphere({scene,camera,environment,nav:data[name],metadata:architecture,host});woodland=createWoodland({scene,camera,nav:data[name],environment,host});coast=createCoast({scene,camera,nav:data[name],environment,host});}maps.install(data[name],metadata);setSeason(season);preset('orbit');
    houseDoor?.dispose();houseDoor=createHouseDoor({scene,model,mode:name,camera,walk,host});
    host.dataset.loadedModel=name;
  }
  if(import.meta.env.DEV)window.__viewer={THREE,scene,camera,renderer,walk,environment,game,details,maps,illustration,get atmosphere(){return atmosphere;},get woodland(){return woodland;},get coast(){return coast;},get houseDoor(){return houseDoor;},get model(){return current;}};
  let previous=performance.now();
  function frame(now){const elapsedDt=Math.max(0,(now-previous)/1000),dt=Math.min(.1,elapsedDt);previous=now;if(active){houseDoor?.update(dt);if(walk.enabled){walk.update(dt);game.update(dt,now/1000,elapsedDt);}else controls.update();environment.update(dt,now/1000);details.update(dt,now/1000);atmosphere?.update(dt,now/1000);woodland?.update(dt,now/1000);coast?.update(dt,now/1000);maps.update(dt);marker.visible=modelName==='village'&&walk.enabled&&camera.position.distanceTo(pin.position)>45;host.dataset.houseHighlighted=String(marker.visible);illustration.render();syncCameraState();}requestAnimationFrame(frame);}requestAnimationFrame(frame);
  return {load,preset,setSeason,setWeather,walkAt,setLookOptions:walk.setLookOptions,levelLook:walk.levelLook,setHour:environment.setHour,setDaySpeed:environment.setDaySpeed,get hour(){return environment.hour;},setSound(value){game.audio.enabled=value;},gameAction:(name)=>game.action(name),pauseWalk(value){walk.pause(value);if(!value&&walk.enabled)renderer.domElement.focus({preventScroll:true});},walkInput:(direction,pressed)=>walk.input(direction,pressed),reset(){if(walk.enabled)walk.reset();else preset('orbit');},setActive(value){active=value;previous=performance.now();walk.pause(!value);if(value)resize();},exitWalk(){if(walk.enabled)preset('orbit');}};
}
