import assert from 'node:assert/strict';
import * as THREE from 'three';
import {weaponAimDirection} from '../src/game/weapon-aim.js';
import {createToys} from '../src/game/toys.js';
const camera=new THREE.PerspectiveCamera(60,1.7,.1,1000),scene=new THREE.Scene();scene.add(camera);camera.position.set(7,4,10);
camera.rotation.set(.2,.8,0,'YXZ');
for(const aspect of [1.7,.53]){
  camera.aspect=aspect;camera.updateProjectionMatrix();
  for(const [x,y] of [[0,0],[-.7,.5],[.8,-.4]]){
    const dir=weaponAimDirection(camera,{x,y}),projected=camera.position.clone().addScaledVector(dir,10).project(camera);
    assert.ok(Math.abs(projected.x-x)<1e-9&&Math.abs(projected.y-y)<1e-9,'Aim ray projects back to the chosen screen position');
  }
}
const events=[],toys=createToys({scene,camera,walk:{paused:false,nav:{ground:0},solidAt:()=>false,setDynamic(){}},audio:{play(){}},onEvent(type,detail){if(type==='query-snow')return true;if(type==='toy-shot')events.push(detail);}});
for(const tool of ['slingshot','water','firecracker','snowball','gatling']){
  toys.select(tool);toys.setAim(-.65,.35);toys.fire();
  assert.deepEqual(events.at(-1).aim,[-.65,.35],`${tool} uses cursor aim`);
  const ray=new THREE.Vector3(...events.at(-1).direction),expected=weaponAimDirection(camera,{x:-.65,y:.35});assert.ok(ray.distanceTo(expected)<1e-9);
  if(tool!=='gatling'){
    const p=toys.projectiles.at(-1),projected=p.mesh.position.clone().project(camera);
    assert.ok(Math.abs(projected.x+.65)<1e-8&&Math.abs(projected.y-.35)<1e-8,'Projectile originates on the reticle ray without sideways parallax');
    assert.ok(p.vel.dot(expected)>0,'Projectile travels toward the selected aim');
  }
  // Clear the cooldown before selecting the next tool, without advancing physics.
  toys.update(.95,1);toys.clear();
}
toys.select('slingshot');toys.setAim(.7,-.2);toys.hold(true);toys.setAim(-.5,.4);toys.hold(false);assert.deepEqual(events.at(-1).aim,[-.5,.4],'Charged release can switch aim to the other side');
toys.clear();console.log('PASS: aimed camera rays in landscape/portrait, all five toys, projectile origin and charged release.');
