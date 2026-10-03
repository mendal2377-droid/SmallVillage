import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createWalkController} from '../src/walk.js';
import {createVehicles} from '../src/game/vehicles.js';
import {createToys} from '../src/game/toys.js';

globalThis.window=new EventTarget();globalThis.document=new EventTarget();
const canvas=new EventTarget();canvas.focus=()=>{};
const camera=new THREE.PerspectiveCamera();const scene=new THREE.Scene();scene.add(camera);
const walk=createWalkController(camera,canvas,()=>{});
const data=JSON.parse(readFileSync('public/models/navigation.json','utf8'));
const audio={play(){},engine(){},ambience(){}};
const step=(n,fn)=>{for(let i=0;i<n;i++)fn(1/60,i/60);};

// Vehicles in the village: ride the tractor up the field path, turn, stay out of the river, get off.
walk.enter(data.village);
const vehicles=createVehicles({scene,camera,walk,audio});
vehicles.spawn('village');
assert.deepEqual(vehicles.list.map(v=>v.kind),['trike','tractor'],'Both village vehicles parked');
for(const v of vehicles.list)assert.ok(!walk.inWater(v.x,v.z),`${v.kind} parked on dry ground`);
const tractor=vehicles.list.find(v=>v.kind==='tractor');
walk.place(tractor.x+1.6,1.75,tractor.z);
assert.ok(vehicles.nearest(camera.position).distance<1.6,'Close enough to climb on');
vehicles.mount(tractor);assert.equal(walk.driving,true);
const start=[tractor.x,tractor.z];
walk.input('forward',true);step(240,(dt,t)=>vehicles.update(dt,t,0));
assert.ok(start[1]-tractor.z>12,`Tractor drove north along the path (${start[1]-tractor.z} m)`);
assert.ok(tractor.speed<=6.01,'Tractor keeps to its top speed');
walk.input('right',true);step(120,(dt,t)=>vehicles.update(dt,t,0));walk.input('right',false);
assert.ok(tractor.yaw<-.5,'Steering right turns the tractor clockwise');
walk.input('forward',false);step(240,(dt,t)=>vehicles.update(dt,t,0));
assert.ok(Math.abs(tractor.speed)<.3,'Coasts to a stop');
assert.ok(vehicles.dismount(),'Can get off');assert.equal(walk.driving,false);
assert.ok(Math.abs(camera.position.y-(tractor.y+walk.eyeHeight))<.5,'Back on foot at eye height');

// Drive the trike straight at the east–west stream: it must stop at the bank, not cross the water.
const trike=vehicles.list.find(v=>v.kind==='trike');
Object.assign(trike,{x:-80,z:96.5,yaw:0,speed:0,y:.1});
vehicles.mount(trike);walk.input('forward',true);step(600,(dt,t)=>vehicles.update(dt,t,0));walk.input('forward',false);
assert.ok(trike.z>92.1&&trike.z<94.5,`Trike drove up to the bank and stopped before the stream (z=${trike.z.toFixed(2)})`);
vehicles.dismount();

// Toys in the courtyard: a slingshot pebble knocks a tin off the crate and startles the sparrows.
walk.enter(data.house);
const events=[];
const toys=createToys({scene,camera,walk,audio,onEvent:(type,detail)=>{events.push(type);return type==='query-snow'?false:undefined;}});
toys.spawn('house');
assert.equal(toys.stats.cans,11,'Six tins and five bottles set up');
toys.select('snowball');assert.equal(toys.tool,'hands','No snowballs without snow');
toys.select('slingshot');assert.equal(toys.tool,'slingshot');
for(let i=0;i<3&&!toys.stats.down;i++){walk.place(0,1.85,.6,-Math.PI/2,-.27+i*.03);toys.fire();step(60,(dt,t)=>toys.update(dt,t));}
assert.ok(toys.stats.down>=1,'Pebble knocked a tin over');
assert.ok(events.includes('can'),'Hit reported to the HUD');
toys.select('firecracker');walk.place(1.5,1.85,.6,-Math.PI/2,-.35);toys.fire();step(150,(dt,t)=>toys.update(dt,t));
assert.ok(events.includes('bang'),'Firecracker went off');
assert.ok(toys.stats.flying>0||events.includes('birds'),'Bang startled the birds');
toys.resetTargets();assert.equal(toys.stats.down,0,'Targets restack');
console.log('PASS: village vehicles drive, steer, stop at water and dismount; toys hit tins, bang and respect snow.');
