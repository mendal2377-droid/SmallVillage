import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {extendWoodlandNavigation} from '../src/woodland-layout.js';
import {createWalkController} from '../src/walk.js';
import {POND_GARDEN,bridgeHeight,koiPose} from '../src/pond-layout.js';
import {createForestPonds} from '../src/forest-pond.js';
const source=JSON.parse(readFileSync('public/models/navigation.json')).village,nav=extendWoodlandNavigation(source);
globalThis.window=new EventTarget();globalThis.document=new EventTarget();const canvas=new EventTarget();canvas.focus=()=>{};
const camera=new THREE.PerspectiveCamera(),walk=createWalkController(camera,canvas,()=>{});walk.enter({...nav,...nav.places.forest});
function travel(x,z){const dx=x-camera.position.x,dz=z-camera.position.z,len=Math.hypot(dx,dz);walk.place(camera.position.x,camera.position.y,camera.position.z,Math.atan2(-dx,-dz));walk.input('forward',true);for(let i=0;i<Math.ceil(len/.005)&&Math.hypot(camera.position.x-x,camera.position.z-z)>.015;i++)walk.update(.01);walk.input('forward',false);assert.ok(Math.hypot(camera.position.x-x,camera.position.z-z)<.075,`Bridge approach blocked at ${x},${z}`);}
travel(195,122);travel(195,134);assert.ok(Math.abs(camera.position.y-(bridgeHeight(134)+1.65))<.02,'Deck raises the walking camera smoothly');travel(195,146);travel(192,179);travel(195,146);travel(195,122);travel(190,122);travel(179,132);
for(const pond of nav.woodland.ponds)assert.ok(walk.inWater(...pond.center));
assert.ok(!walk.inWater(195,134),'Only the bridge opens a water crossing');assert.ok(walk.inWater(198,134),'Water beside the rail stays blocked');
const scene=new THREE.Scene(),environment={season:'green',daylight:1,wet:false},host={dataset:{}},ponds=createForestPonds({parent:scene,scene,camera,nav,environment,host});
scene.background=new THREE.Color(0xaacccc);assert.equal(ponds.fish.length,48);assert.ok(ponds.pads.length>40);assert.ok(ponds.frogs.length>=6);
for(let time=0;time<120;time+=.5)for(const f of ponds.fish){const p=koiPose(f,time),zone=nav.woodland.ponds[f.pond];assert.ok(Math.hypot((p.x-zone.center[0])/zone.radius[0],(p.z-zone.center[1])/zone.radius[1])<.95,'Koi stays submerged inside its pond');assert.ok(p.y<-.3&&p.y>-.6);}
ponds.update(.1,1);assert.ok(ponds.pads.every(p=>p.visible));environment.season='winter';environment.daylight=.1;ponds.update(.1,2);assert.ok(ponds.pads.every(p=>!p.visible));assert.ok(ponds.waters.every(w=>w.material.uniforms.ice.value>0));
assert.equal(nav.pondGarden.bridge,POND_GARDEN.bridge);console.log(`PASS: bridge crossing and return, protected water, 48 bounded koi, ${ponds.pads.length} lilies, seasonal water and frogs.`);
