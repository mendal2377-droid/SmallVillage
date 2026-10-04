import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {extendWoodlandNavigation,WOODLAND} from '../src/woodland-layout.js';
import {createPlantingMask} from '../src/planting.js';
import {createWalkController} from '../src/walk.js';
const source=JSON.parse(readFileSync('public/models/navigation.json')).village,nav=extendWoodlandNavigation(source),mask=createPlantingMask(nav);
assert.equal(source.waterZones.length,9,'Base export stays unchanged');assert.equal(nav.waterZones.length,11);
assert.ok(nav.woodlandTrees.length>200);assert.deepEqual(nav,extendWoodlandNavigation(source),'Layout is reproducible');
for(const p of nav.woodlandTrees){assert.ok(!mask.onRoad(p.x,p.z,3.3),'Trunks clear all road and flower trail footprints');assert.ok(!mask.inWater(p.x,p.z,3.3),'Trunks clear pond banks');}
globalThis.window=new EventTarget();globalThis.document=new EventTarget();const canvas=new EventTarget();canvas.focus=()=>{};
const camera=new THREE.PerspectiveCamera(),walk=createWalkController(camera,canvas,()=>{});walk.enter({...nav,...nav.places.courtyard});
// Sample every half-metre of the new paths; include join corners and shore approaches.
for(let i=1;i<WOODLAND.trail.length;i++){
 const [x,z]=WOODLAND.trail[i-1],[a,b]=WOODLAND.trail[i],steps=Math.ceil(Math.hypot(a-x,b-z)*2);
 for(let j=0;j<=steps;j++){const t=j/steps,px=x+(a-x)*t,pz=z+(b-z)*t;assert.notEqual(walk.standAt(px,pz,.1),undefined,`Trail obstruction at ${px},${pz}`);}
}
assert.notEqual(walk.standAt(...[nav.places.forest.spawn[0],nav.places.forest.spawn[2],.1]),undefined,'Forest entry is safe');
for(const pond of WOODLAND.ponds)assert.ok(walk.inWater(...pond.center),'New ponds prevent walking through water');
function travel(x,z){const dx=x-camera.position.x,dz=z-camera.position.z,len=Math.hypot(dx,dz);walk.place(camera.position.x,camera.position.y,camera.position.z,Math.atan2(-dx,-dz));walk.input('forward',true);for(let i=0;i<Math.ceil(len/.02);i++)walk.update(.01);walk.input('forward',false);assert.ok(Math.hypot(camera.position.x-x,camera.position.z-z)<.07,`Connected route blocked towards ${x},${z}`);}
const route=[[-33.3,112.65],[-38.7,112.65],[-38.7,131.85],[.2,131.85],[110,132],[146,95],[181,82],[194,94]];
for(const p of route)travel(...p);for(const p of [...route].reverse().slice(1))travel(...p);travel(-38.7,112.65);travel(-33.3,112.65);travel(-32,109);
console.log(`PASS: ${nav.woodlandTrees.length} safe mixed trees, two solid water boundaries, every trail segment clear, walk from yard to forest and back in one world.`);
