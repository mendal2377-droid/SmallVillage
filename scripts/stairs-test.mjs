import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createWalkController} from '../src/walk.js';

globalThis.window=new EventTarget();globalThis.document=new EventTarget();
const canvas=new EventTarget();canvas.focus=()=>{};
const camera=new THREE.PerspectiveCamera();
const walk=createWalkController(camera,canvas,()=>{});
const data=JSON.parse(readFileSync('public/models/navigation.json','utf8'));
walk.enter(data.house);
// Follow the real route with the same movement controller used by keyboard and touch.
function travel(direction,amount){
  walk.input(direction,true);
  for(let i=0;i<Math.round(amount/.02);i++)walk.update(.01);
  walk.input(direction,false);
}
function go(x,z,label){
  let dx=x-camera.position.x;travel(dx>0?'right':'left',Math.abs(dx));
  let dz=z-camera.position.z;travel(dz>0?'back':'forward',Math.abs(dz));
  assert.ok(Math.hypot(camera.position.x-x,camera.position.z-z)<.06,`${label}: blocked at ${camera.position.toArray()}, wanted ${x},${z}`);
}
go(-1.3,-2.2,'yard to stair entry');
go(-2.87,-2.2,'corner entry');
go(-2.87,-6.7,'climb first flight');
assert.ok(Math.abs(camera.position.y-3.73)<.02,'First landing height');
go(-4.26,-6.7,'turn on landing');
go(-4.26,-2.3,'climb return flight');
assert.ok(Math.abs(camera.position.y-5.39)<.02,'Second-floor eye height');
go(3.5,-2.3,'walk entire upper corridor');
const upperY=camera.position.y;
travel('back',4);
assert.equal(camera.position.y,upperY,'Cannot fall through balcony edge');
assert.ok(camera.position.z<-1.64,'Balcony stops movement');
go(3.5,-2.3,'return from glazing');
go(-4.26,-2.3,'return to stair head');
go(-4.26,3.8,'through green door onto terrace');
assert.ok(Math.abs(camera.position.y-5.39)<.02,'Terrace shares upstairs level');
travel('left',2);assert.ok(camera.position.x>-4.71,'Roof west parapet stops movement');
go(-4.26,3.8,'return from roof parapet');
go(-4.26,-2.3,'terrace back to stair head');
go(-4.26,-6.7,'descend return flight');
go(-2.87,-6.7,'turn on intermediate landing');
go(-2.87,-2.2,'descend first flight');
assert.ok(Math.abs(camera.position.y-2.07)<.02,'Ground floor restored');
go(-1.3,-2.2,'back to courtyard');
go(-1.3,-3.6,'enter meeting room');
go(-.5,-4.9,'meeting connecting doorway');
go(2.3,-4.9,'enter bedroom');
go(3.8,-4.9,'enter storage room');
go(3.6,-2.2,'storage to courtyard');
go(-1.3,-.72,'kitchen approach');
go(-3.3,-.72,'enter kitchen');
// The same exported stairs must also function in the full village coordinates.
const village=structuredClone(data.village);
village.spawn=[-33.3,1.85,106.8];walk.enter(village);
go(-34.87,106.8,'village stair entry');
go(-34.87,102.3,'village first flight');
go(-36.26,102.3,'village turning landing');
go(-36.26,106.7,'village second floor');
assert.ok(Math.abs(camera.position.y-5.39)<.02);
// Enter this same house from the village lane without changing scene or teleporting.
walk.enter({...data.village,...data.village.places.home});
go(-38.7,112.65,'walk village lane to pedestrian opening');
go(-33.3,112.65,'through red gate into courtyard');
go(-33.3,106.8,'yard to stairs in village');
go(-34.87,106.8,'village staircase');go(-34.87,102.3,'first flight');
go(-36.26,102.3,'turn');go(-36.26,106.7,'second floor');
go(-36.26,112.8,'walk onto roof from village');
assert.ok(Math.abs(camera.position.y-5.39)<.02,'Village roof eye height');
for(const [name,place] of Object.entries(data.village.places)){
  walk.enter({...data.village,...place});const start=camera.position.clone();travel('forward',.5);
  assert.ok(camera.position.distanceTo(start)>.35,`${name} starting point is obstructed`);
}
const water=data.village.waterZones.find(z=>z.shape==='rect').rect;
walk.enter({...data.village,spawn:[water[0]-1,1.75,10]});travel('right',4);
assert.ok(camera.position.x<water[0]-.15,'River bank prevents walking into water');
const bridge=data.village.bridges[0],bridgeZ=(bridge[1]+bridge[3])/2;
walk.enter({...data.village,spawn:[bridge[0]+.3,1.75,bridgeZ]});go(bridge[2]-.3,bridgeZ,'cross river on bridge');
console.log('PASS: all five rooms, two stair flights, upper corridor, balcony barrier, descent, and village stairs.');
