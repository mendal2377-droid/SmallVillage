import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';

export function createViewer(host) {
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;renderer.toneMappingExposure = 1.15;
  host.replaceChildren(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Interactive 3D reconstruction. Drag to orbit, scroll to zoom.');
  renderer.domElement.setAttribute('tabindex','0');
  const scene = new THREE.Scene();scene.background=new THREE.Color('#e3e8dc');
  const camera=new THREE.PerspectiveCamera(42,1,.1,3000);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.maxPolarAngle=Math.PI*.495;
  const sky=new THREE.HemisphereLight(0xf6f9ef,0x7d8963,2.8);scene.add(sky);
  const sun=new THREE.DirectionalLight(0xfff7df,2.6);sun.position.set(-30,70,40);scene.add(sun);
  const fill=new THREE.DirectionalLight(0xe6f0ff,1.4);fill.position.set(40,25,-30);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(1600,1600),new THREE.MeshStandardMaterial({color:'#b5bf9d',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.35;scene.add(floor);
  let active=true,current,modelName='house',loadVersion=0;
  const cache=new Map();const draco=new DRACOLoader().setDecoderPath('/draco/');const loader=new GLTFLoader().setDRACOLoader(draco);
  function resize(){const {width,height}=host.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
  new ResizeObserver(resize).observe(host);
  function preset(name) {
    const village=modelName==='village';
    const target=village?new THREE.Vector3(0,0,0):new THREE.Vector3(0,2,0);
    const positions=village?{orbit:[250,240,290],top:[0,410,.01],close:[48,55,98]}:{orbit:[27,23,30],top:[0,48,.01],close:[4,5,13]};
    camera.position.set(...positions[name]);controls.target.copy(target);controls.minDistance=village?12:2;controls.maxDistance=village?800:100;camera.near=village?.5:.08;camera.far=3000;camera.updateProjectionMatrix();controls.update();resize();
  }
  async function load(name,onProgress) {
    const version=++loadVersion;
    if(!cache.has(name)) {
      const promise=loader.loadAsync(`/models/${name}.glb`,(e)=>onProgress(e.total?`Loading model · ${Math.round(e.loaded/e.total*100)}%`:`Loading model · ${(e.loaded/1048576).toFixed(1)} MB`)).then(g=>g.scene);
      cache.set(name,promise);promise.catch(()=>cache.delete(name));
    }
    const model=await cache.get(name);
    if(version!==loadVersion)return;
    if(current)scene.remove(current);
    current=model;modelName=name;scene.add(model);preset('orbit');
    host.dataset.loadedModel=name;
  }
  function frame(){if(active){controls.update();renderer.render(scene,camera);}requestAnimationFrame(frame);}frame();
  return {load,preset,setActive(value){active=value;if(value)resize();}};
}
