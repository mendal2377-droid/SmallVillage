import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
const M={};
let coat;
function skin(color){if(M[color])return M[color];if(!coat&&document.createElement){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#d7d4cb';x.fillRect(0,0,128,128);for(let i=0;i<2800;i++){const a=Math.random()*128,b=Math.random()*128;x.strokeStyle=i%3?'#faf6df42':'#504d3826';x.lineWidth=.6;x.beginPath();x.moveTo(a,b);x.lineTo(a+2,b+4);x.stroke();}coat=new THREE.CanvasTexture(c);coat.wrapS=coat.wrapT=THREE.RepeatWrapping;coat.colorSpace=THREE.SRGBColorSpace;}return M[color]=new THREE.MeshStandardMaterial({color,roughness:.88,...(coat?{map:coat,bumpMap:coat,bumpScale:.004}:{})});}
const sphere=new THREE.SphereGeometry(1,16,10);
function egg(g,p,s,color){const m=new THREE.Mesh(sphere,skin(color));m.position.set(...p);m.scale.set(...s);g.add(m);return m;}
function tube(g,points,r,color,segments=20){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const m=new THREE.Mesh(new THREE.TubeGeometry(curve,segments,r,8,false),skin(color));g.add(m);return m;}
function cowMaterial(){const m=skin('#e8e1cf').clone();if(!document.createElement)return m;const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#eae5d6';x.fillRect(0,0,256,256);for(const [a,b,r] of [[40,50,26],[138,95,32],[214,218,37],[45,210,30]]){x.fillStyle='#39362e';x.beginPath();for(let i=0;i<20;i++){const angle=i/20*6.28,rr=r*(.85+Math.sin(i*2.4)*.17),px=a+Math.cos(angle)*rr,py=b+Math.sin(angle)*rr;if(i)x.lineTo(px,py);else x.moveTo(px,py);}x.closePath();x.fill();}m.map=new THREE.CanvasTexture(c);m.map.colorSpace=THREE.SRGBColorSpace;m.color.set('#ffffff');return m;}
function cone(g,p,r,h,color,rx=0){const m=new THREE.Mesh(new THREE.ConeGeometry(r,h,10),skin(color));m.position.set(...p);m.rotation.x=rx;g.add(m);return m;}
// Merge stationary anatomy by material; articulated legs/wings remain separate for gait animation.
function batch(root){root.updateMatrixWorld(true);const groups=new Map();for(const m of [...root.children]){if(!m.isMesh)continue;const geo=m.geometry.clone().applyMatrix4(m.matrix);if(!groups.has(m.material))groups.set(m.material,[]);groups.get(m.material).push(geo);root.remove(m);}for(const [material,parts] of groups){const mesh=new THREE.Mesh(mergeGeometries(parts.map(g=>g.index?g.toNonIndexed():g)),material);mesh.castShadow=true;root.add(mesh);parts.forEach(g=>g.dispose());}}

export function buildCreature(kind,variant=0){const g=new THREE.Group();g.name=kind;const legs=[],wings=[];let head,tail;
  if(kind==='chicken'||kind==='bird'){
    const bird=kind==='bird',brown=variant%2===0,c=bird?'#8c7456':brown?'#b18b5d':'#eee5d2',dark=bird?'#433a2e':'#624a37';
    egg(g,[0,.40,0],[.18,.23,.27],c);egg(g,[0,.51,-.19],[.095,.19,.10],c);egg(g,[0,.66,-.26],[.105,.10,.10],c);
    for(const s of [-1,1]){egg(g,[s*.091,.69,-.29],[.013,.018,.013],'#181b17');egg(g,[s*.097,.697,-.292],[.004,.004,.004],'#f5ead1');}
    cone(g,[0,.65,-.38],.038,.10,'#ba8d36',-Math.PI/2);
    if(!bird){for(let i=0;i<4;i++)egg(g,[0,.77-i*.008,-.29+i*.03],[.023,.045,.025],'#ba3022');egg(g,[0,.60,-.27],[.036,.065,.02],'#b33226');}
    for(const s of [-1,1]){const w=new THREE.Group();w.position.set(s*.15,.45,-.03);g.add(w);for(let j=0;j<6;j++){const f=egg(w,[s*(.025+j*.007),-.045-j*.014,.04+j*.019],[.033,.13+j*.008,.08],j%2?c:dark);f.rotation.x=-.32-j*.035;}wings.push(w);
      const leg=new THREE.Group();leg.position.set(s*.08,.22,.05);g.add(leg);tube(leg,[[0,0,0],[0,-.15,0],[0,-.19,-.07]],.012,'#b79750');for(let k=-1;k<=1;k++)tube(leg,[[0,-.19,-.035],[k*.035,-.20,-.11]],.007,'#b79750');legs.push(leg);}
    for(let j=-2;j<=2;j++){const f=egg(g,[j*.030,.57,.26],[.018,.20,.07],dark);f.rotation.x=.70;f.rotation.z=j*.20;}
    batch(g);if(bird)g.scale.setScalar(.38);
  }else if(kind==='snake'){
    const points=[];for(let i=0;i<16;i++)points.push([Math.sin(i*.7)*.11,.045,(-i/15+.5)*1.3]);tail=tube(g,points,.035,'#726447',48);const pos=tail.geometry.attributes.position,uv=tail.geometry.attributes.uv;for(let i=0;i<pos.count;i++){const t=uv.getX(i),p=tail.geometry.parameters.path.getPointAt(t),factor=1-.90*Math.pow(t,2);pos.setXYZ(i,p.x+(pos.getX(i)-p.x)*factor,p.y+(pos.getY(i)-p.y)*factor,p.z+(pos.getZ(i)-p.z)*factor);}tail.geometry.computeVertexNormals();const sm=tail.material.clone();tail.material=sm;sm.userData.clock={value:0};sm.onBeforeCompile=s=>{s.uniforms.slitherTime=sm.userData.clock;s.vertexShader='uniform float slitherTime;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.x+=sin(position.z*11.-slitherTime*3.)*.06*(1.-smoothstep(.4,.65,position.z));');};head=egg(g,[0,.055,.66],[.045,.032,.075],'#6a6046');for(const s of [-1,1])egg(g,[s*.039,.073,.68],[.006,.005,.006],'#11140d');batch(g);
  }else{
    const cow=kind==='cow',sheep=kind==='sheep',cat=kind==='cat',h=cow?1.05:sheep?.58:cat?.28:.46,length=cow?1.45:sheep?.85:cat?.5:.75,width=cow?.38:sheep?.29:cat?.12:.17,c=cow?'#e8e1cf':sheep?'#d9d1ba':cat?'#bd9a75':'#a38360';
    if(cow){const torso=new THREE.Mesh(new RoundedBoxGeometry(width*2,.73,length,4,.20),cowMaterial());torso.position.y=h;g.add(torso);egg(g,[0,h-.41,length*.27],[.13,.12,.16],'#c4aa97');for(const x of [-.07,.07])for(const z of [length*.21,length*.32])egg(g,[x,h-.54,z],[.020,.045,.020],'#b49786');}
    else egg(g,[0,h,0],[width,sheep?.32:cat?.16:.24,length*.5],c);
    // A tapered neck and chest join the muzzle to the torso instead of leaving separate ellipsoids.
    egg(g,[0,h+.045,-length*.37],[width*.70,cow?.30:sheep?.22:cat?.14:.20,length*.24],c);
    if(sheep){for(let j=0;j<160;j++){const a=j*2.4,z=(j/160-.5)*length*.89,t=Math.sqrt(Math.max(0,1-(z/(length*.5))**2));egg(g,[Math.cos(a)*width*.96*t,h+Math.sin(a)*.31*t,z],[.046,.052,.049],j%3?'#dbd4c0':'#c9c2ac');}}
    head=new THREE.Group();head.position.set(0,h+.06,-length*.47);g.add(head);egg(head,[0,.06,-.12],[width*.66,cat?.12:.19,cat?.13:.22],c);
    egg(head,[0,-.04,cat?-.23:-.29],[width*.61,cat?.055:.09,cat?.055:.12],cow?'#948c7a':sheep?'#77725f':c);
    egg(head,[0,-.015,cat?-.284:-.38],[width*.28,.028,.022],cow?'#777262':'#2a2824');
    for(const s of [-1,1]){egg(head,[s*width*.54,.10,-.20],[.018,.024,.014],'#171b17');egg(head,[s*width*.56,.11,-.211],[.005,.005,.004],'#f2eee1');if(!cat){const ear=egg(head,[s*width*.8,.20,-.09],[.12,.045,.045],c);ear.rotation.z=-s*.5;}
      if(cat){cone(head,[s*.085,.21,-.085],.047,.12,c);cone(head,[s*.085,.217,-.097],.025,.076,'#b17e71');}
      if(cow)tube(head,[[s*.19,.21,-.08],[s*.22,.32,-.06],[s*.18,.39,-.05]],.026,'#b9b198');}
    for(const s of [-1,1])for(const z of [-length*.32,length*.32]){const leg=new THREE.Group();leg.position.set(s*width*.64,h-.15,z);g.add(leg);const lh=h-.15;egg(leg,[0,-lh*.28,0],[width*.21,lh*.32,width*.22],c);tube(leg,[[0,-lh*.45,0],[0,-lh*.75,.035],[0,-lh+.035,-.02]],cow?.045:cat?.018:.03,c);egg(leg,[0,-lh+.035,-.025],[cow?.065:cat?.035:.048,.04,.08],cow||sheep?'#4a463d':c);batch(leg);legs.push(leg);}
    const t=new THREE.Group();t.position.set(0,h,length*.48);g.add(t);tail=t;tube(t,[[0,0,0],[.06,-.06,.18],[.13,cat?.15:-.25,.32],[.12,cat?.3:-.32,.37]],cat?.025:cow?.021:.025,c);if(cow)egg(t,[.12,-.32,.37],[.04,.09,.04],'#39352c');batch(t);batch(head);batch(g);
  }
  return {g,legs,wings,head,tail,kind};
}

export function createCreatures({scene,camera,walk,audio,notice,host}){
  const root=new THREE.Group();root.name='Village animals';scene.add(root);let animals=[],held=null,landing=false,altitude=0,velocity=0;
  const homes=[['chicken',-32,110],['chicken',-31,112],['chicken',-38.7,121],['chicken',-154.5,202],['chicken',-485,241],['chicken',-284,48],['dog',-38.7,123],['cat',-32,107.8],['dog',-470,241],['cat',-285,48],['cow',-171,214],['cow',-175,218],['cow',-181,217],['sheep',-490,255],['sheep',-494,257],['sheep',-488,259],['sheep',-491,261],['sheep',-495,261],['snake',-264,110],['snake',-144,222]];
  function spawn(){root.visible=true;if(animals.length)return;for(const [i,[kind,x,z]] of homes.entries()){let px=x,pz=z,y;for(let j=0;j<40;j++){px=x+Math.sin(j*2.4)*j*.13;pz=z+Math.cos(j*2.4)*j*.13;y=walk.standAt(px,pz,.2);if(y!==undefined)break;}if(y===undefined)continue;const a={...buildCreature(kind,i),home:new THREE.Vector3(px,y,pz),yaw:i*2.4,t:i*.3,phase:i,kind};a.g.position.copy(a.home);root.add(a.g);animals.push(a);}host.dataset.animals=String(animals.length);}
  function nearest(){let a=null,d=Infinity;for(const b of animals){if(b.kind!=='chicken')continue;const dist=b.g.position.distanceTo(camera.position.clone().add(new THREE.Vector3(0,-walk.eyeHeight,0)));if(dist<d){d=dist;a=b;}}return {animal:a,distance:d};}
  function grab(){if(held){release();return true;}const n=nearest();if(n.distance>1.9)return false;held=n.animal;landing=false;altitude=camera.position.y;velocity=0;walk.driving=true;audio.play('flap');notice('Chicken held! WASD steer · Space flap up · Ctrl descend · E land and release');host.dataset.chicken='held';return true;}
  function touchdown(){const feet=camera.position.y-walk.eyeHeight;let floor=walk.nav.ground??.1;for(const s of walk.nav.surfaces||[]){const [x0,z0,x1,z1]=s.rect,x=camera.position.x,z=camera.position.z;if(x<x0||x>x1||z<z0||z>z1)continue;const t=s.axis==='x'?(x-x0)/(x1-x0):(z-z0)/(z1-z0),h=s.height+(s.rise||0)*t;if(h<=feet+.04&&h>floor)floor=h;}return floor;}
  function release(){if(!held)return;const floor=touchdown();if(floor!==undefined&&camera.position.y-floor-walk.eyeHeight<.18&&walk.standAt(camera.position.x,camera.position.z,floor)!==undefined){drop(floor);}else{landing=true;notice('Gliding down. Steer to an open lane or terrace to land.');}}
  function drop(floor){const a=held;held=null;landing=false;walk.driving=false;camera.position.y=floor+walk.eyeHeight;a.g.position.set(camera.position.x,floor,camera.position.z);a.home.copy(a.g.position);a.g.rotation.set(0,walk.yaw,0);velocity=0;host.dataset.chicken='';}
  function flightBlocked(x,z,low,high){if(walk.solidAt(x,z,low,high,.18))return true;return (walk.nav.surfaces||[]).some(s=>{const [x0,z0,x1,z1]=s.rect;if(x<x0||x>x1||z<z0||z>z1)return false;const t=s.axis==='x'?(x-x0)/(x1-x0):(z-z0)/(z1-z0),h=s.height+(s.rise||0)*t;return h>low&&h<high;});}
  function flight(dt,time){const p=camera.position,{forward,strafe,brake,descend}=walk.axis(),ground=touchdown();if(brake)landing=false;velocity=THREE.MathUtils.damp(velocity,landing||descend?-3:brake?4:-.35,3,dt);const dy=velocity*dt,nextY=THREE.MathUtils.clamp(p.y+dy,walk.eyeHeight+.1,70);
    if(!flightBlocked(p.x,p.z,nextY-walk.eyeHeight+.02,nextY+.05))p.y=nextY;else velocity=0;
    const len=Math.hypot(forward,strafe)||1,speed=brake||p.y>(ground??.1)+walk.eyeHeight+.35?11:2;
    const dx=(strafe*Math.cos(walk.yaw)-forward*Math.sin(walk.yaw))*speed*dt/len,dz=(-forward*Math.cos(walk.yaw)-strafe*Math.sin(walk.yaw))*speed*dt/len;
    for(let j=0;j<Math.max(1,Math.ceil(speed*dt/.10));j++){const n=Math.max(1,Math.ceil(speed*dt/.10));for(const [ax,az] of [[dx/n,0],[0,dz/n]]){const x=p.x+ax,z=p.z+az;if(!flightBlocked(x,z,p.y-walk.eyeHeight+.02,p.y+.05))p.set(x,p.y,z);}}
    const f=touchdown();if(f!==undefined&&velocity<=0&&p.y<=f+walk.eyeHeight+.04){p.y=f+walk.eyeHeight;velocity=0;if(landing&&walk.standAt(p.x,p.z,f)!==undefined)drop(f);}
    if(!held)return;altitude=p.y;camera.rotation.set(walk.pitch,walk.yaw,0,'YXZ');const offset=new THREE.Vector3(.0,-.44,-.65).applyEuler(camera.rotation);held.g.position.copy(p).add(offset);held.g.rotation.set(.15,walk.yaw,0);held.wings.forEach((w,i)=>w.rotation.z=(i?1:-1)*(.5+Math.sin(time*25)*.8));host.dataset.flightAltitude=(p.y-(f??.1)-walk.eyeHeight).toFixed(2);
  }
  return {spawn,nearest,grab,release,get held(){return held;},get list(){return animals;},stop(){if(held){held.g.position.copy(held.home);held=null;landing=false;walk.driving=false;}root.visible=false;host.dataset.chicken='';},update(dt,time){if(walk.paused)return;if(held)flight(dt,time);for(const a of animals){if(a===held)continue;a.t-=dt;const p=a.g.position,dist=p.distanceTo(camera.position);if(a.t<0){a.yaw+=(Math.random()-.5)*1.3;a.t=1.5+Math.random()*4;if(p.distanceTo(a.home)>8)a.yaw=Math.atan2(p.x-a.home.x,p.z-a.home.z);}
    if(a.kind==='snake')a.g.traverse(o=>{if(o.material?.userData.clock)o.material.userData.clock.value=time;});
    for(const w of a.wings)w.rotation.z=THREE.MathUtils.damp(w.rotation.z,0,5,dt);
    const moving=a.t>1&&dist<150,speed=a.kind==='cow'?.28:a.kind==='snake'?.20:a.kind==='sheep'?.4:.32;
    if(moving){const x=p.x-Math.sin(a.yaw)*dt*speed,z=p.z-Math.cos(a.yaw)*dt*speed,f=walk.standAt(x,z,p.y);if(f!==undefined){p.set(x,f,z);a.phase+=dt*speed*11;}else a.yaw+=dt*3;}a.g.rotation.y=a.yaw;a.legs.forEach((l,i)=>l.rotation.x=moving?Math.sin(a.phase+(i%3===0?0:Math.PI))*.35:0);if(a.tail)a.tail.rotation.y=Math.sin(time*2+a.phase)*.22;if(a.head)a.head.rotation.x=a.kind==='cow'||a.kind==='sheep'?Math.sin(time*.7+a.phase)*.18:Math.sin(time*1.2)*.045;}}
  };
}
