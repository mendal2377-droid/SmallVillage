import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createWalkController} from '../src/walk.js';
import {createCreatures} from '../src/game/creatures.js';
globalThis.window=new EventTarget();globalThis.document=new EventTarget();const canvas=new EventTarget();canvas.focus=()=>{};
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();scene.add(camera);let changes=0;const walk=createWalkController(camera,canvas,()=>changes++),data=JSON.parse(readFileSync('public/models/navigation.json','utf8'));
walk.enter({...data.village,...data.village.places.courtyard});
const travel=(dir,m)=>{walk.input(dir,true);for(let i=0;i<Math.round(m/.02);i++)walk.update(.01);walk.input(dir,false);};
function go(x,z){const dx=x-camera.position.x;travel(dx>0?'right':'left',Math.abs(dx));const dz=z-camera.position.z;travel(dz>0?'back':'forward',Math.abs(dz));assert.ok(Math.hypot(camera.position.x-x,camera.position.z-z)<.06,`route blocked ${camera.position.toArray()} -> ${x},${z}`);}
// No scene switch or second enter call: yard -> open gate -> filmed lane -> village road -> field edge.
go(-33.3,112.65);go(-38.7,112.65);go(-38.7,131.85);go(.2,131.85);go(.2,155);assert.equal(changes,1,'Same navigation/world throughout');
go(.2,131.85);go(-38.7,131.85);go(-38.7,112.65);go(-33.3,112.65);go(-32,109);assert.equal(changes,1,'Walk back into the courtyard');
const host={dataset:{}},audio={play(){}},creatures=createCreatures({scene,camera,walk,audio,notice(){},host});creatures.spawn();
for(const kind of ['chicken','dog','cat','snake','cow','sheep'])assert.ok(creatures.list.some(a=>a.kind===kind),`${kind} exists on a clear floor`);
const chicken=creatures.list.find(a=>a.kind==='chicken'&&a.home.x<-450);walk.place(chicken.home.x,chicken.home.y+walk.eyeHeight,chicken.home.z,0);assert.ok(creatures.grab(),'Hold a nearby chicken');assert.equal(walk.driving,true,'Flight owns movement');
const step=(n)=>{for(let i=0;i<n;i++)creatures.update(1/60,i/60);};const start=camera.position.clone();walk.input('brake',true);step(300);walk.input('brake',false);assert.ok(camera.position.y>start.y+15,'Flapping lifts the player');
walk.input('right',true);step(300);walk.input('right',false);assert.ok(camera.position.x>start.x+45,'Fly across the village, above the ground');
creatures.release();step(900);assert.equal(creatures.held,null,'Controlled landing releases chicken');assert.equal(walk.driving,false,'Back to ground walking');assert.ok(Math.abs(camera.position.y-1.75)<.06,'Ground eye height restored');creatures.stop();
console.log('PASS: continuous yard/lane/road/field route in both directions; six animal kinds; chicken pickup, ascent, flight and safe landing.');
creatures.spawn();const indoor=creatures.list.find(a=>a.kind==='chicken');indoor.g.position.set(-32,.42,107.4);indoor.home.copy(indoor.g.position);walk.place(-32,2.07,107.4,0);assert.ok(creatures.grab());walk.input('brake',true);step(300);walk.input('brake',false);assert.ok(camera.position.y<3.74,'Flight cannot rise through the upper corridor floor');creatures.release();step(300);assert.equal(creatures.held,null);creatures.stop();console.log('PASS: indoor chicken flight respects floors and ceilings.');
