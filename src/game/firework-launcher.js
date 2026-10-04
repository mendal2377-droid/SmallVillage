import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Fixed pools keep sustained firing affordable. These stars never hit targets or creatures.
export const FIREWORK_LIMITS={rockets:10,sparks:960,cadence:.19};
export function createFireworkLauncher({scene,walk,audio,onEvent=()=>{}}){
  const palette=['#ffd27a','#ef99bc','#80ded5','#b8a2ef','#dceab1'].map(c=>new THREE.Color(c));
  const model=new THREE.Group(),barrels=new THREE.Group();model.name='Toy starburst Gatling';model.add(barrels);
  const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.45});
  const aqua=mat('#57b9b1'),cream=mat('#f2d99b'),pink=mat('#df8fa8');
  const body=new THREE.Mesh(new RoundedBoxGeometry(.18,.15,.20,3,.025),aqua);body.position.z=.08;model.add(body);
  const grip=new THREE.Mesh(new RoundedBoxGeometry(.07,.14,.07,3,.015),pink);grip.position.set(0,-.115,.13);grip.rotation.x=.25;model.add(grip);
  for(let i=0;i<6;i++){const a=i*Math.PI/3,b=new THREE.Mesh(new THREE.CylinderGeometry(.021,.024,.24,10),i%2?aqua:cream);b.rotation.x=Math.PI/2;b.position.set(Math.cos(a)*.055,Math.sin(a)*.055,-.11);barrels.add(b);const rim=new THREE.Mesh(new THREE.TorusGeometry(.022,.006,5,10),pink);rim.position.set(b.position.x,b.position.y,-.23);barrels.add(rim);}
  const badgeShape=new THREE.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5+Math.PI/2,r=i%2?.025:.055;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?badgeShape.lineTo(x,y):badgeShape.moveTo(x,y);}badgeShape.closePath();const badge=new THREE.Mesh(new THREE.ShapeGeometry(badgeShape),cream);badge.rotation.y=Math.PI/2;badge.position.set(.094,0,.09);model.add(badge);
  const root=new THREE.Group();root.name='Pooled toy fireworks';scene.add(root);
  const rockets=Array.from({length:FIREWORK_LIMITS.rockets},()=>{const mesh=new THREE.Mesh(new THREE.SphereGeometry(.065,6,4),new THREE.MeshBasicMaterial({color:palette[0],toneMapped:false}));mesh.visible=false;root.add(mesh);return {mesh,vel:new THREE.Vector3(),age:0,life:0,color:palette[0]};});
  const n=FIREWORK_LIMITS.sparks,positions=new Float32Array(n*3),colors=new Float32Array(n*3),fades=new Float32Array(n),particles=Array.from({length:n},()=>({vel:new THREE.Vector3(),life:0,total:1}));let cursor=0,shots=0,bursts=0,spin=0;
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.setAttribute('fade',new THREE.BufferAttribute(fades,1));
  const points=new THREE.Points(geo,new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,toneMapped:false,
    vertexShader:'attribute float fade;varying vec3 tint;varying float alpha;void main(){tint=color;alpha=fade;vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(150./max(1.,-p.z),1.,16.);gl_Position=projectionMatrix*p;}',
    fragmentShader:'varying vec3 tint;varying float alpha;void main(){vec2 p=gl_PointCoord-.5;float d=length(p);float star=1.-smoothstep(.15,.5,d);float ray=(1.-smoothstep(.04,.09,min(abs(p.x),abs(p.y))))*(1.-smoothstep(.3,.5,d));float a=max(star,ray)*alpha;if(a<.02)discard;gl_FragColor=vec4(tint,a);\n#include <colorspace_fragment>\n}'}));points.frustumCulled=false;root.add(points);
  function spark(at,v,color,life){const i=cursor++%n,p=particles[i];p.vel.copy(v);p.life=p.total=life;positions.set(at.toArray(),i*3);colors.set(color.toArray(),i*3);fades[i]=1;}
  function burst(rocket){const at=rocket.mesh.position,c=rocket.color;for(let i=0;i<52;i++){const a=i/52*Math.PI*2,angle=i%5/5*Math.PI*2,speed=2.2+Math.random()*2.6,v=new THREE.Vector3(Math.cos(a)*Math.sin(angle),Math.sin(a),Math.cos(a)*Math.cos(angle)).multiplyScalar(speed);spark(at,v,c,1.2+Math.random()*.5);}rocket.life=0;rocket.mesh.visible=false;bursts++;audio.play('firework-pop');onEvent('firework-burst',bursts);}
  return {model,barrels,root,
    fire(origin,direction){const rocket=rockets.find(p=>p.life<=0);if(!rocket)return false;rocket.age=0;rocket.life=1.05;rocket.color=palette[shots%palette.length];rocket.mesh.material.color.copy(rocket.color);rocket.mesh.position.copy(origin);rocket.mesh.visible=true;rocket.vel.copy(direction).add(new THREE.Vector3(0,.32,0)).normalize().multiplyScalar(20);shots++;audio.play('firework-launch');onEvent('firework-shot',shots);return true;},
    update(dt,holding){spin=THREE.MathUtils.damp(spin,holding?22:0,6,dt);barrels.rotation.z+=spin*dt;
      for(const p of rockets){if(p.life<=0)continue;p.life-=dt;p.age+=dt;const steps=Math.max(1,Math.ceil(p.vel.length()*dt/.18));for(let i=0;i<steps;i++){p.mesh.position.addScaledVector(p.vel,dt/steps);const a=p.mesh.position;if(p.age>.08&&(a.y<(walk.nav?.ground??.1)+.1||walk.solidAt(a.x,a.z,a.y-.06,a.y+.06,.06))){p.life=0;break;}}spark(p.mesh.position,new THREE.Vector3(0,.1,0),p.color,.3);if(p.life<=0)burst(p);}
      for(let i=0;i<n;i++){const p=particles[i];if(p.life<=0){fades[i]=0;continue;}p.life=Math.max(0,p.life-dt);p.vel.y-=1.8*dt;positions[i*3]+=p.vel.x*dt;positions[i*3+1]+=p.vel.y*dt;positions[i*3+2]+=p.vel.z*dt;fades[i]=p.life/p.total;}
      for(const a of Object.values(geo.attributes))a.needsUpdate=true;
    },
    clear(){for(const p of rockets){p.life=0;p.mesh.visible=false;}for(const p of particles)p.life=0;fades.fill(0);geo.attributes.fade.needsUpdate=true;spin=0;},
    get stats(){return {shots,bursts,rockets:rockets.filter(p=>p.life>0).length,sparks:particles.filter(p=>p.life>0).length};},
  };
}
