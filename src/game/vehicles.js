import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Drivable village vehicles: the family's covered electric tricycle and a small farm tractor.
// Arcade bicycle-model steering over the exported floors, colliders, water and bridges.
const box=(w,h,d,color,opts={})=>new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(w,h,d)*.14),new THREE.MeshStandardMaterial({color,roughness:.6,...opts}));
const cylinder=(r,h,color,opts={},segments=18)=>new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),new THREE.MeshStandardMaterial({color,roughness:.7,...opts}));
function batch(group,skip=[]){group.updateMatrixWorld(true);const bins=new Map();for(const m of [...group.children]){if(!m.isMesh||skip.includes(m))continue;const mat=m.material,key=[mat.color.getHexString(),mat.roughness,mat.metalness,mat.opacity,mat.transparent].join(':');const geo=m.geometry.clone().applyMatrix4(m.matrix);if(!bins.has(key))bins.set(key,{material:mat,parts:[]});bins.get(key).parts.push(geo.index?geo.toNonIndexed():geo);group.remove(m);}for(const {material,parts} of bins.values()){group.add(new THREE.Mesh(mergeGeometries(parts),material));parts.forEach(g=>g.dispose());}}
function wheel(r,w,rim){
  const g=new THREE.Group(),tyre=new THREE.Mesh(new THREE.TorusGeometry(r-w*.48,w*.48,10,32),new THREE.MeshStandardMaterial({color:'#242521',roughness:.95}));tyre.rotation.y=Math.PI/2;g.add(tyre);
  const hub=cylinder(r*.55,w+.02,rim,{metalness:.4,roughness:.4},12);hub.rotation.z=Math.PI/2;g.add(hub);
  // Spokes make rolling visible.
  for(let i=0;i<12;i++){const s=box(w+.01,r*.9,.016,rim);s.rotation.x=i*Math.PI/6;g.add(s);}
  for(let i=0;i<24;i++)for(const side of [-1,1]){const a=i*Math.PI/12;const tread=box(w*.55,.04,r*.23,'#242521');tread.position.set(side*w*.20,Math.cos(a)*(r-.015),Math.sin(a)*(r-.015));tread.rotation.x=a;tread.rotation.y=side*.38;g.add(tread);}
  for(const side of [-1,1])for(let i=0;i<6;i++){const a=i*Math.PI/3;const bolt=new THREE.Mesh(new THREE.SphereGeometry(.014,6,4),new THREE.MeshStandardMaterial({color:'#9d9f97',metalness:.7,roughness:.3}));bolt.position.set(side*(w*.52),Math.cos(a)*r*.23,Math.sin(a)*r*.23);g.add(bolt);}
  batch(g);return g;
}
function lamp(){const m=new THREE.Mesh(new THREE.CircleGeometry(.08,16),new THREE.MeshStandardMaterial({color:'#fffbe6',emissive:'#fff1c0',emissiveIntensity:0}));return m;}
function buildTrike(){
  const g=new THREE.Group(),teal='#4c8a7a',canvas='#3f6f4f',wheels=[],steer=new THREE.Group(),lamps=[];
  const bed=box(1.1,.32,1.55,teal,{metalness:.3});bed.position.set(0,.55,.35);g.add(bed);
  const seat=box(.95,.12,.5,'#2b2f2d');seat.position.set(0,.8,.05);g.add(seat);
  const back=box(.95,.5,.08,'#2b2f2d');back.position.set(0,1.05,.32);g.add(back);
  const floor=box(.5,.08,.9,teal);floor.position.set(0,.42,-.55);g.add(floor);
  const shield=box(.55,.75,.08,teal,{metalness:.3});shield.position.set(0,.8,-.98);g.add(shield);
  // The green canvas hood over the rear bench, as parked in the courtyard.
  const roof=box(1.18,.05,1.9,canvas,{roughness:.9});roof.position.set(0,1.78,.15);g.add(roof);
  for(const x of [-.57,.57]){const side=box(.04,.75,1.0,canvas,{roughness:.9});side.position.set(x,1.38,.6);g.add(side);}
  const rear=box(1.18,.9,.04,canvas,{roughness:.9});rear.position.set(0,1.3,1.1);g.add(rear);
  for(const [x,z] of [[-.56,-.78],[.56,-.78],[-.56,1.08],[.56,1.08]]){const post=box(.04,1.4,.04,'#c9cdc9',{metalness:.6});post.position.set(x,1.1,z);g.add(post);}
  const windscreen=box(.9,.55,.03,'#cfe3e4',{transparent:true,opacity:.35,metalness:.2,roughness:.1});windscreen.position.set(0,1.5,-.78);windscreen.rotation.x=-.18;g.add(windscreen);
  const wiper=box(.012,.35,.015,'#303330');wiper.position.set(0,1.39,-.80);wiper.rotation.z=.45;g.add(wiper);
  for(const s of [-1,1]){const stalk=box(.025,.25,.025,'#8d9691',{metalness:.7});stalk.position.set(s*.32,1.20,-.86);stalk.rotation.z=-s*.35;g.add(stalk);const mirror=box(.13,.09,.035,'#bdc8cb',{metalness:.9,roughness:.15});mirror.position.set(s*.37,1.32,-.86);g.add(mirror);const grip=box(.12,.045,.045,'#282b27');grip.position.set(s*.25,1.06,-.95);g.add(grip);}
  for(let i=0;i<7;i++){const rib=box(.035,.17,1.3,'#438271',{metalness:.4});rib.position.set(-.45+i*.15,.50,.35);g.add(rib);}
  steer.position.set(0,0,-1.05);g.add(steer);
  const fork=box(.06,.75,.06,'#a9b0ad',{metalness:.6});fork.position.set(0,.6,0);fork.rotation.x=.25;steer.add(fork);
  const bar=box(.62,.04,.04,'#222');bar.position.set(0,1.05,.1);steer.add(bar);
  const front=wheel(.27,.12,'#9aa3a0');front.position.set(0,.27,-.08);steer.add(front);wheels.push([front,.27]);
  for(const x of [-.5,.5]){const w=wheel(.27,.14,'#9aa3a0');w.position.set(x,.27,.75);g.add(w);wheels.push([w,.27]);}
  const head=lamp();head.position.set(0,1.0,-1.03);head.rotation.y=Math.PI;g.add(head);lamps.push(head);
  for(const x of [-.45,.45]){const t=new THREE.Mesh(new THREE.PlaneGeometry(.12,.06),new THREE.MeshStandardMaterial({color:'#7a1612',emissive:'#ff2a1a',emissiveIntensity:.2}));t.position.set(x,.6,1.13);g.add(t);}
  batch(g,lamps);batch(steer);return {group:g,wheels,steer,lamps,spec:{name:'e-trike',label:'the e-trike',maxSpeed:9,reverse:3,accel:3.2,brake:8,wheelbase:1.8,maxSteer:.55,half:[.6,1.15],height:1.85,seat:[0,1.55,-.35],chase:[6,2.4]}};
}
function buildTractor(){
  const g=new THREE.Group(),red='#b3362b',wheels=[],steer=new THREE.Group(),lamps=[];
  const chassis=box(.7,.4,2.3,'#2a2c2b',{metalness:.4});chassis.position.set(0,.75,-.1);g.add(chassis);
  const hood=box(.8,.62,1.35,red,{metalness:.25,roughness:.45});hood.position.set(0,1.18,-.6);g.add(hood);
  const grille=box(.7,.5,.04,'#2c2e2d');grille.position.set(0,1.15,-1.29);g.add(grille);
  for(let i=0;i<11;i++){const slat=box(.022,.46,.03,'#9c9f92',{metalness:.65});slat.position.set(-.30+i*.06,1.15,-1.32);g.add(slat);}
  for(const s of [-1,1]){for(let i=0;i<8;i++){const vent=box(.015,.10,.025,'#272d28');vent.position.set(s*.407,1.27,-1.02+i*.08);g.add(vent);}const axle=cylinder(.07,.95,'#51564d',{metalness:.55});axle.rotation.z=Math.PI/2;axle.position.set(s*.25,.67,.62);g.add(axle);const step=box(.26,.05,.35,'#5c6056',{metalness:.5});step.position.set(s*.46,.65,.25);g.add(step);const pedal=box(.10,.05,.14,'#262b25');pedal.position.set(s*.18,.95,.04);g.add(pedal);}
  const tank=box(.82,.12,1.37,'#e2e4df');tank.position.set(0,1.5,-.6);g.add(tank);
  const exhaust=cylinder(.05,.9,'#3a3633',{metalness:.5},10);exhaust.position.set(.28,1.95,-.85);g.add(exhaust);
  const cap=cylinder(.07,.06,'#3a3633',{metalness:.5},10);cap.position.set(.28,2.42,-.85);g.add(cap);
  const seat=box(.5,.1,.45,'#202322');seat.position.set(0,1.42,.55);g.add(seat);
  const seatBack=box(.5,.35,.08,'#202322');seatBack.position.set(0,1.62,.78);g.add(seatBack);
  for(const x of [-.75,.75]){const fender=box(.36,.06,1.0,red,{metalness:.25});fender.position.set(x,1.42,.62);g.add(fender);}
  const column=box(.05,.6,.05,'#2d2f2e');column.position.set(0,1.62,.05);column.rotation.x=-.5;g.add(column);
  steer.position.set(0,1.9,-.12);g.add(steer);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.2,.025,8,20),new THREE.MeshStandardMaterial({color:'#111'}));ring.rotation.x=Math.PI/2+.5;steer.add(ring);
  const frontAxle=new THREE.Group();frontAxle.position.set(0,0,-1.05);g.add(frontAxle);
  // Steer about the vertical first, then roll about the axle.
  for(const x of [-.62,.62]){const w=wheel(.36,.2,'#e5c33a');w.rotation.order='YXZ';w.position.set(x,.36,0);frontAxle.add(w);wheels.push([w,.36]);}
  for(const x of [-.75,.75]){const w=wheel(.62,.34,'#e5c33a');w.position.set(x,.62,.62);g.add(w);wheels.push([w,.62]);}
  for(const x of [-.28,.28]){const l=lamp();l.position.set(x,1.2,-1.32);l.rotation.y=Math.PI;g.add(l);lamps.push(l);}
  batch(g,[...lamps,cap]);return {group:g,wheels,steer,frontAxle,lamps,exhaust:cap,spec:{name:'tractor',label:'the tractor',maxSpeed:6,reverse:2.2,accel:2,brake:6,wheelbase:1.7,maxSteer:.6,half:[.95,1.4],height:2.2,seat:[0,2.05,.5],chase:[7.5,3.2]}};
}
const builders={trike:buildTrike,tractor:buildTractor};
// Preferred parking per scene; a nearby clear spot is searched if this one is blocked.
const parking={
  house:[{kind:'trike',at:[1.6,5.3],yaw:Math.PI/2}],
  village:[{kind:'trike',at:[-33.5,127.5],yaw:Math.PI/2},{kind:'tractor',at:[-149,210.5],yaw:0}],
};

export function createVehicles({scene,camera,walk,audio}){
  const list=[];let driving=null,view='chase',camYaw=0,lookBase=0,smoke=[];
  const headlight=new THREE.SpotLight('#fff3d2',0,45,.5,.5,1.2);headlight.visible=false;scene.add(headlight,headlight.target);
  const puffGeo=new THREE.SphereGeometry(.12,8,6);
  function footprint(v,x=v.x,z=v.z,yaw=v.yaw){
    const [hx,hz]=v.spec.half,c=Math.cos(yaw),s=Math.sin(yaw);
    // Sample corners and side midpoints of the body rectangle in world space.
    return [[-hx,-hz],[hx,-hz],[-hx,hz],[hx,hz],[-hx,0],[hx,0],[0,-hz],[0,hz]].map(([lx,lz])=>[x+lx*c+lz*s,z-lx*s+lz*c]);
  }
  function clear(v,x,z,yaw,y){
    // The body may overhang a ditch edge on narrow field paths; only the centre line must stay out of water.
    return footprint(v,x,z,yaw).every(([px,pz],i)=>!walk.solidAt(px,pz,y+(i>=6?.35:.6),y+v.spec.height,.08,v))&&!walk.inWater(x,z,.05);
  }
  function collider(v){
    const [hx,hz]=v.spec.half;
    // Same convention as exported boxes: localX=c·dx−s·dz, localZ=s·dx+c·dz.
    return {cx:v.x,cz:v.z,hx,hz,c:Math.cos(v.yaw),s:Math.sin(v.yaw),low:v.y,high:v.y+v.spec.height,owner:v};
  }
  function spawn(sceneName){
    for(const v of list){scene.remove(v.group);walk.setDynamic(v.id,null);}
    list.length=0;driving=null;
    const nav=walk.nav;if(!nav)return;
    for(const [i,p] of (parking[sceneName]||[]).entries()){
      const built=builders[p.kind]();const v={...built,id:'vehicle-'+i,kind:p.kind,x:p.at[0],z:p.at[1],y:nav.ground??.2,yaw:p.yaw,speed:0,steerAngle:0,roll:0};
      v.group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
      v.y=walk.floorAt(v.x,v.z,v.y,.6)??v.y;
      search:for(let r=0;r<14;r+=1.5)for(let a=0;a<Math.PI*2;a+=Math.PI/6){
        const x=p.at[0]+Math.cos(a)*r,z=p.at[1]+Math.sin(a)*r,y=walk.floorAt(x,z,nav.ground??.2,.6);
        if(y!==undefined&&clear(v,x,z,v.yaw,y)){v.x=x;v.z=z;v.y=y;break search;}
      }
      v.group.position.set(v.x,v.y,v.z);v.group.rotation.y=v.yaw;scene.add(v.group);list.push(v);walk.setDynamic(v.id,collider(v));
    }
  }
  function nearest(position){
    let best=null,distance=Infinity;
    for(const v of list){const d=Math.hypot(position.x-v.x,position.z-v.z)-Math.max(...v.spec.half);if(d<distance){distance=d;best=v;}}
    return {vehicle:best,distance};
  }
  function mount(v){driving=v;walk.driving=true;camYaw=v.yaw;lookBase=walk.yaw;audio.play('door');}
  function dismount(){
    const v=driving;if(!v)return false;
    // Step out on the driver's left, then right, behind or in front, wherever the floor is clear.
    const [hx,hz]=v.spec.half,c=Math.cos(v.yaw),s=Math.sin(v.yaw);
    for(const [lx,lz] of [[-hx-.5,0],[hx+.5,0],[0,hz+.6],[0,-hz-.6],[-hx-.5,hz],[hx+.5,hz]]){
      const x=v.x+lx*c+lz*s,z=v.z-lx*s+lz*c,h=walk.standAt(x,z,v.y);
      if(h!==undefined){driving=null;v.speed=0;walk.driving=false;walk.place(x,h+walk.eyeHeight,z,v.yaw);audio.play('door');audio.engine(null,0);headlight.visible=false;return true;}
    }
    return false;
  }
  function drive(v,dt,input,darkness){
    const s=v.spec;let {forward,strafe,brake}=input;
    if(forward>0)v.speed+=(v.speed<0?s.brake:s.accel)*dt;
    else if(forward<0)v.speed-=(v.speed>0?s.brake:s.accel)*dt;
    else v.speed-=Math.sign(v.speed)*Math.min(Math.abs(v.speed),1.8*dt);
    if(brake)v.speed*=Math.pow(.02,dt);
    v.speed=THREE.MathUtils.clamp(v.speed,-s.reverse,s.maxSpeed);if(Math.abs(v.speed)<.02&&!forward)v.speed=0;
    v.steerAngle=THREE.MathUtils.damp(v.steerAngle,-strafe*s.maxSteer*(1-Math.min(.5,Math.abs(v.speed)/s.maxSpeed*.5)),8,dt);
    const steps=Math.max(1,Math.ceil(Math.abs(v.speed*dt)/.08));
    for(let i=0;i<steps;i++){
      const d=v.speed*dt/steps,yaw=v.yaw+d/s.wheelbase*Math.tan(v.steerAngle);
      const x=v.x-Math.sin(yaw)*d,z=v.z-Math.cos(yaw)*d,y=walk.floorAt(x,z,v.y,.45);
      if(y===undefined||!clear(v,x,z,yaw,y)){
        if(Math.abs(v.speed)>2.5)audio.play('thud');
        v.speed*=-.25;break;
      }
      v.x=x;v.z=z;v.yaw=yaw;v.y=THREE.MathUtils.damp(v.y,y,12,dt/steps);
    }
    headlight.visible=darkness>.25;headlight.intensity=darkness*60;
    const fwd=new THREE.Vector3(-Math.sin(v.yaw),0,-Math.cos(v.yaw));
    headlight.position.set(v.x,v.y+1.1,v.z).addScaledVector(fwd,s.half[1]);headlight.target.position.copy(headlight.position).addScaledVector(fwd,10).setY(v.y);
    audio.engine(v.kind,v.speed);
  }
  function placeCamera(v,dt){
    const s=v.spec;
    // Mouse look orbits the chase camera; it eases back behind the vehicle once moving.
    if(Math.abs(v.speed)>1)lookBase=THREE.MathUtils.damp(lookBase,walk.yaw,1.2,dt);
    camYaw=THREE.MathUtils.damp(camYaw,v.yaw,4,dt);
    const yaw=camYaw+(walk.yaw-lookBase),pitch=THREE.MathUtils.clamp(walk.pitch,-.6,.5);
    if(view==='seat'){
      const [sx,sy,sz]=s.seat,c=Math.cos(v.yaw),si=Math.sin(v.yaw);
      camera.position.set(v.x+sx*c+sz*si,v.y+sy,v.z-sx*si+sz*c);camera.rotation.set(pitch,v.yaw+(walk.yaw-lookBase),0,'YXZ');return;
    }
    const [dist,height]=s.chase,target=new THREE.Vector3(v.x,v.y+1.3,v.z);
    let d=dist;
    // Pull the camera in rather than looking through walls in narrow lanes.
    for(let t=1.5;t<=dist;t+=.5){
      const x=v.x+Math.sin(yaw)*t,z=v.z+Math.cos(yaw)*t;
      if(walk.solidAt(x,z,v.y+height*.6,v.y+height+.4,.25,v)){d=Math.max(1.2,t-.6);break;}
    }
    camera.position.set(v.x+Math.sin(yaw)*d,v.y+height*(d/dist)+.6-pitch*3,v.z+Math.cos(yaw)*d);
    camera.lookAt(target);
  }
  function animate(v,dt,time,darkness){
    v.group.position.set(v.x,v.y,v.z);v.group.rotation.y=v.yaw;
    const travel=v.speed*dt;
    for(const [w,r] of v.wheels)w.rotation.x-=travel/r;
    if(v.steer)v.steer.rotation.y=v.steerAngle*(v.kind==='tractor'?-2:1);
    if(v.frontAxle)v.frontAxle.children.forEach(w=>w.rotation.y=v.steerAngle);
    // Diesel judder and exhaust puffs on the tractor.
    if(v.kind==='tractor'&&v===driving){v.group.position.y+=Math.sin(time*38)*.012;if(Math.random()<dt*(4+Math.abs(v.speed)*2))puff(v);}
    for(const l of v.lamps)l.material.emissiveIntensity=v===driving||darkness>.5?2.5*Math.max(darkness,.2):0;
  }
  function puff(v){
    const m=new THREE.Mesh(puffGeo,new THREE.MeshBasicMaterial({color:'#5d5f5c',transparent:true,opacity:.5,depthWrite:false}));
    v.exhaust.getWorldPosition(m.position);scene.add(m);smoke.push({m,life:1.4});
  }
  return {
    get driving(){return driving;},get list(){return list;},
    get view(){return view;},toggleView(){view=view==='chase'?'seat':'chase';},
    spawn,nearest,mount,dismount,
    horn(){if(driving)audio.play('horn');},
    update(dt,time,darkness){
      for(const v of list){
        if(v===driving)drive(v,dt,walk.axis(),darkness);
        animate(v,dt,time,darkness);walk.setDynamic(v.id,v===driving?null:collider(v));
      }
      if(driving)placeCamera(driving,dt);else headlight.visible=false;
      smoke=smoke.filter(p=>{p.life-=dt;p.m.position.y+=dt*.9;p.m.scale.multiplyScalar(1+dt*1.2);p.m.material.opacity=Math.max(0,p.life*.35);if(p.life<=0){scene.remove(p.m);p.m.material.dispose();}return p.life>0;});
    },
  };
}
