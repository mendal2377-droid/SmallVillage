import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createWalkController} from '../src/walk.js';
import {createCreatures} from '../src/game/creatures.js';
import {createHouseDoor} from '../src/house-door.js';
import {extendWoodlandNavigation} from '../src/woodland-layout.js';
import {ACTIVITY_SITES,activitySpawn} from '../src/places.js';

globalThis.window=new EventTarget();globalThis.document=new EventTarget();
const canvas=new EventTarget();canvas.focus=()=>{};canvas.setPointerCapture=()=>{};
let captures=0;canvas.requestPointerLock=()=>captures++;
const camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene(),host={dataset:{}};
const walk=createWalkController(camera,canvas,()=>{});
const nav=extendWoodlandNavigation(JSON.parse(readFileSync('public/models/navigation.json')).village);
walk.enter(nav);
for(const site of ACTIVITY_SITES){const p=activitySpawn(nav,site);assert.ok(p,`${site.id} has an entry`);assert.notEqual(walk.standAt(p.spawn[0],p.spawn[2],nav.ground),undefined,`${site.id} enters on a free floor`);assert.ok(Math.hypot(p.spawn[0]-site.x,p.spawn[2]-site.z)<site.radius,'Entry stays in the encounter area');}

// A real rising floor with a level landing: eye smoothing must never alter collision height.
walk.enter({ground:0,bounds:[-10,-10,10,10],boxes:[],spawn:[0,1.65,2],surfaces:[{rect:[-2,-2,2,2],height:2,rise:-2,axis:'z'},{rect:[-2,-4,2,-2],height:2}]});
walk.input('forward',true);let maxJump=0;for(let i=0;i<180;i++){const y=camera.position.y;walk.update(1/60);maxJump=Math.max(maxJump,Math.abs(camera.position.y-y));}walk.input('forward',false);
assert.ok(walk.feet>1.4,'Climb the ramp without height lag blocking movement');assert.ok(maxJump<.02,'Eye height changes smoothly');
for(let i=0;i<60;i++)walk.update(1/60);assert.ok(Math.abs(camera.position.y-walk.feet-1.65)<.001,'Eye settles even while stationary');
walk.place(0,3.65,-3);walk.input('right',true);const start=camera.position.x;for(let i=0;i<30;i++)walk.update(1/60);walk.input('right',false);assert.ok(Math.abs(camera.position.x-start-.575)<.01,'Upstairs moves at a careful 1.15 m/s');
function pointer(type,x,y){const e=new Event(type);Object.assign(e,{pointerType:'mouse',pointerId:1,clientX:x,clientY:y});canvas.dispatchEvent(e);}
pointer('pointerdown',100,100);pointer('pointermove',140,120);pointer('pointerup',140,120);const normal=walk.yaw;assert.equal(captures,0,'Drag look does not unexpectedly capture the cursor');assert.notEqual(walk.pitch,0);walk.levelLook();assert.equal(walk.pitch,0);
walk.place(0,3.65,-3,0);walk.setLookOptions({sensitivity:.5});pointer('pointerdown',100,100);pointer('pointermove',140,120);pointer('pointerup',140,120);assert.ok(Math.abs(walk.yaw-normal*.5)<.00001,'Sensitivity reduces rotation');

walk.enter({...nav,...nav.places.forest});
const creatures=createCreatures({scene,camera,walk,host,audio:{play(){}},notice(){}});creatures.spawn();const companion=creatures.companion;
for(const p of [nav.places.forest.spawn,nav.places.avenue.spawn,[-36.26,5.39,112.8]]){walk.place(...p,0);for(let i=0;i<120;i++)creatures.update(1/60,i/60);assert.ok(companion.g.position.distanceTo(camera.position.clone().add(new THREE.Vector3(0,-walk.eyeHeight,0)))<2.2,'The same chicken follows into each area and upstairs');assert.ok(creatures.grab(true));assert.equal(creatures.held,companion);creatures.release();for(let i=0;i<120;i++)creatures.update(1/60,i/60);assert.equal(creatures.held,null,'Can land and summon again');}
creatures.stop();

walk.enter(nav);const model=new THREE.Group(),leaf=new THREE.Mesh(new THREE.BoxGeometry(.9,2.2,.065),new THREE.MeshBasicMaterial());leaf.name='V__Photo_storage_door_red';leaf.material.name='Web V | Photo storage door red';leaf.position.set(-28.4,1.52,106.03);model.add(leaf);scene.add(model);
const door=createHouseDoor({scene,model,mode:'village',camera,walk,host});walk.place(-32,2.07,109);door.update(.1);assert.equal(door.root.children.length,1);assert.equal(door.angle,0);assert.ok(walk.solidAt(-28.4,106.03,.46,2.15),'Closed photo door is solid');
walk.place(-28.4,2.07,107.7);for(let i=0;i<60;i++)door.update(1/60);assert.ok(door.angle>1.4);assert.equal(walk.solidAt(-28.4,106.03,.46,2.15),false,'Approaching opens the passage');walk.place(-32,2.07,110);for(let i=0;i<300;i++)door.update(1/60);assert.ok(door.angle<.001,'Door returns to its photo pose');door.dispose();
console.log('PASS: nine safe task entries, smooth stair height, careful upstairs speed, adjustable drag look, persistent flight companion and hinged photo door.');
