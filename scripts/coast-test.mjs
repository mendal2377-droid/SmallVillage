import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {extendWoodlandNavigation} from '../src/woodland-layout.js';
import {extendCoastNavigation,shoreX} from '../src/coast-layout.js';
import {createWalkController} from '../src/walk.js';
import {createPlantingMask} from '../src/planting.js';
import {createToys} from '../src/game/toys.js';
import {FIREWORK_LIMITS} from '../src/game/firework-launcher.js';
const source=JSON.parse(readFileSync('public/models/navigation.json')).village,base=extendWoodlandNavigation(source),nav=extendCoastNavigation(base);
assert.equal(base.bounds[2],315);assert.equal(nav.waterZones.length,11,'Ocean does not generate freshwater plants or fish');assert.deepEqual(nav,extendCoastNavigation(base));
globalThis.window=new EventTarget();globalThis.document=new EventTarget();const canvas=new EventTarget();canvas.focus=()=>{};
const camera=new THREE.PerspectiveCamera(),walk=createWalkController(camera,canvas,()=>{});walk.enter({...nav,...nav.places.coast});
for(let i=1;i<nav.coastTrail.length;i++){const [x,z]=nav.coastTrail[i-1],[a,b]=nav.coastTrail[i],n=Math.ceil(Math.hypot(a-x,b-z)*2);for(let j=0;j<=n;j++){const t=j/n;assert.notEqual(walk.standAt(x+(a-x)*t,z+(b-z)*t,.1),undefined,'Coast trail is standable');}}
const mask=createPlantingMask(nav);for(let z=-200;z<330;z+=2){const x=shoreX(z);assert.ok(walk.inWater(x+1,z));assert.equal(walk.standAt(x+1,z,.1),undefined,'Cannot walk into sea');assert.ok(mask.inWater(x+1,z));if(z<200)assert.notEqual(walk.standAt(x-10,z,.1),undefined,'Beach is dry ground');}
walk.place(300,1.75,128,-Math.PI/2);walk.input('forward',true);for(let i=0;i<7200;i++)walk.update(.01);walk.input('forward',false);assert.ok(camera.position.x>430,'Actual movement reaches beach from forest');
const scene=new THREE.Scene(),events=[];scene.add(camera);const toys=createToys({scene,camera,walk,audio:{play(){}},onEvent:(type,data)=>events.push({type,data})});toys.select('gatling');toys.hold(true);
for(let i=0;i<2000;i++){toys.update(.05,i*.05);assert.ok(toys.stats.fireworks.rockets<=FIREWORK_LIMITS.rockets);assert.ok(toys.stats.fireworks.sparks<=FIREWORK_LIMITS.sparks);}
assert.ok(toys.stats.fireworks.shots>400);assert.ok(toys.stats.fireworks.bursts>400);assert.equal(toys.stats.down,0);assert.ok(!events.some(e=>['can','bang','birds'].includes(e.type)),'Stars do not harm or scare targets');
toys.hold(false);const count=toys.stats.fireworks.shots;for(let i=0;i<40;i++)toys.update(.05,i);assert.equal(toys.stats.fireworks.shots,count,'Release stops continuous fire');
toys.hold(true);walk.pause(true);const paused=toys.stats.fireworks.shots;for(let i=0;i<10;i++)toys.update(.1,i);assert.equal(toys.stats.fireworks.shots,paused);walk.pause(false);toys.update(.1,0);assert.equal(toys.stats.fireworks.shots,paused,'Pause cancels held input');
toys.clear();assert.equal(toys.stats.fireworks.rockets,0);assert.equal(toys.stats.fireworks.sparks,0);
console.log('PASS: connected dry beach trail, shared sea boundary, sustained pooled fireworks, harmless bursts, release/pause/clear.');
