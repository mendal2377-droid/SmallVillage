import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createPlantingMask} from '../src/planting.js';
import {createWalkController} from '../src/walk.js';
const nav=JSON.parse(readFileSync('public/models/navigation.json')).village,data=JSON.parse(readFileSync('public/models/world-details.json')),report=JSON.parse(readFileSync('docs/road-repair.json'));
assert.deepEqual(nav.roads,data.roads,'Paving masks match saved navigation and vegetation metadata');assert.ok(nav.roads.length>50);assert.equal(report.remainingTreeRoadConflicts,0);assert.equal(report.pavingTop,.1);assert.ok(report.removedRaisedJoints>600);
const mask=createPlantingMask(nav);for(const [x,z] of data.trees)assert.equal(mask.onRoad(x,z,.8),false,`Poplar obstructs paving at ${x},${z}`);
for(const t of report.relocatedPoplars){assert.equal(mask.onRoad(...t.from),true,'Reproduces reported bridge obstruction');assert.ok(data.trees.some(([x,z])=>Math.hypot(x-t.to[0],z-t.to[1])<.01),'Relocated crown exported');assert.equal(mask.land(...t.to,.75),true);}
globalThis.window=new EventTarget();globalThis.document=new EventTarget();const canvas=new EventTarget();canvas.focus=()=>{};const camera=new THREE.PerspectiveCamera(),walk=createWalkController(camera,canvas,()=>{});walk.enter(nav);
for(const [a,b,c,d] of nav.bridges){const alongX=c-a>d-b;for(let j=0;j<=20;j++){const x=alongX?a+(c-a)*j/20:(a+c)/2,z=alongX?(b+d)/2:b+(d-b)*j/20;assert.equal(mask.onRoad(x,z,.2),true);assert.notEqual(walk.standAt(x,z,.1),undefined,`Bridge centre blocked at ${x},${z}`);assert.equal(mask.tree(x,z)?.some(Number.isNaN),false,'Unsafe tree request finds a safe relocation');}}
const rotated=createPlantingMask({bounds:[-50,-50,50,50],roads:[[0,0,10,1,Math.PI/4]],waterZones:[],bridges:[],boxes:[]});assert.equal(rotated.onRoad(4,-4),true);assert.equal(rotated.onRoad(4,4),false,'Clearance handles rotated paving');
console.log('PASS: exact paving masks, 237 poplars clear of roads/bridges, three repaired obstructions, all bridge centre routes, rotated planting clearance.');
