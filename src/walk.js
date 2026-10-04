import * as THREE from 'three';
import {inCoastWater} from './coast-layout.js';

// A grounded camera with a small circular footprint. Axis separation lets it slide along walls.
// The same floor/collision queries serve vehicles and thrown toys while the game layer is active.
export function createWalkController(camera, canvas, onChange) {
  let enabled=false, paused=false, driving=false, nav, boxes=[], yaw=0, pitch=0, drag=null, feet=0, sensitivity=1, captureMouse=false;
  const eyeHeight=1.65, maxStep=.26;let activityPace=1;
  const keys=new Set(), touches=new Set(), dynamic=new Map();
  const radius=.16;
  function clearInput(){keys.clear();touches.clear();drag=null;}
  function tightSpace(){return feet>1||(nav?.surfaces||[]).some(s=>s.rise&&camera.position.x>=s.rect[0]&&camera.position.x<=s.rect[2]&&camera.position.z>=s.rect[1]&&camera.position.z<=s.rect[3]);}
  function look(dx,dy){const rate=(tightSpace()?.0015:.002)*sensitivity;yaw-=THREE.MathUtils.clamp(dx,-160,160)*rate;pitch=THREE.MathUtils.clamp(pitch-THREE.MathUtils.clamp(dy,-160,160)*rate,-1.15,1.15);if(!driving)camera.rotation.set(pitch,yaw,0,'YXZ');}
  function floorAt(x,z,level=feet,step=maxStep){
    const candidates=[nav.ground ?? .2];
    for(const surface of nav.surfaces||[]){
      const [x0,z0,x1,z1]=surface.rect;
      if(x<x0||x>x1||z<z0||z>z1)continue;
      const t=surface.axis==='x'?(x-x0)/(x1-x0):(z-z0)/(z1-z0);
      candidates.push(surface.height+(surface.rise||0)*t);
    }
    // Only take a reachable surface; never drop through an upper floor or jump up a storey.
    return candidates.filter(h=>Math.abs(h-level)<=step).sort((a,b)=>b-a)[0];
  }
  function inWater(x,z,r=radius){
    if(inCoastWater(nav,x,z,r))return true;
    if((nav.bridges||[]).some(([x0,z0,x1,z1])=>x>=x0&&x<=x1&&z>=z0&&z<=z1))return false;
    return (nav.waterZones||[]).some(zone=>{
      if(zone.shape==='ellipse')return ((x-zone.center[0])/(zone.radius[0]+r))**2+((z-zone.center[1])/(zone.radius[1]+r))**2<1;
      const [x0,z0,x1,z1]=zone.rect;return x>x0-r&&x<x1+r&&z>z0-r&&z<z1+r;
    });
  }
  function hitBox(list,x,z,low,high,r,skip){
    return list.find(b=>{
      if(skip&&b.owner===skip)return false;
      if(b.high<=low||b.low>=high)return false;
      const localX=b.c*(x-b.cx)-b.s*(z-b.cz),localZ=b.s*(x-b.cx)+b.c*(z-b.cz);
      const dx=Math.max(0,Math.abs(localX)-b.hx),dz=Math.max(0,Math.abs(localZ)-b.hz);
      return dx*dx+dz*dz<r*r;
    });
  }
  // Solid geometry between world heights low and high within r of (x,z); water and bounds count as solid.
  function solidAt(x,z,low,high,r=radius,skip){
    const [xmin,zmin,xmax,zmax]=nav.bounds;
    if(x<xmin+r||x>xmax-r||z<zmin+r||z>zmax-r)return true;
    if(low<(nav.ground??.2)+.5&&inWater(x,z,r))return true;
    return Boolean(hitBox(boxes,x,z,low,high,r,skip)||hitBox([...dynamic.values()],x,z,low,high,r,skip));
  }
  function blocked(x,z,height){return solidAt(x,z,height+.04,height+eyeHeight+.08);}
  function move(dx,dz){
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.06));
    for(let i=0;i<steps;i++){
      for(const [ax,az] of [[dx/steps,0],[0,dz/steps]]){
        const x=camera.position.x+ax,z=camera.position.z+az,height=floorAt(x,z);
        if(height!==undefined&&!blocked(x,z,height)){feet=height;camera.position.x=x;camera.position.z=z;}
      }
    }
  }
  function axis(){
    return {
      forward:Number(keys.has('KeyW')||keys.has('ArrowUp')||touches.has('forward'))-Number(keys.has('KeyS')||keys.has('ArrowDown')||touches.has('back')),
      strafe:Number(keys.has('KeyD')||keys.has('ArrowRight')||touches.has('right'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')||touches.has('left')),
      fast:keys.has('ShiftLeft')||keys.has('ShiftRight'),brake:keys.has('Space')||touches.has('brake'),
      descend:keys.has('ControlLeft')||keys.has('ControlRight')||touches.has('descend'),
    };
  }
  const codes=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space','ControlLeft','ControlRight'];
  window.addEventListener('keydown',e=>{
    if(!enabled||paused||e.target.closest?.('input,textarea,select'))return;
    if(codes.includes(e.code)){e.preventDefault();keys.add(e.code);}
    if(e.code==='Escape'){clearInput();if(document.pointerLockElement===canvas)document.exitPointerLock();}
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',clearInput);
  document.addEventListener('visibilitychange',clearInput);
  document.addEventListener('pointerlockchange',clearInput);
  canvas.addEventListener('pointerdown',e=>{
    if(!enabled||paused||e.pointerType==='mouse'&&e.button===2)return;
    canvas.focus({preventScroll:true});
    if(captureMouse&&e.pointerType==='mouse' && !document.pointerLockElement){
      try{canvas.requestPointerLock?.()?.catch(()=>{});}catch{}
    }
    if(!document.pointerLockElement){drag={id:e.pointerId,x:e.clientX,y:e.clientY};try{canvas.setPointerCapture(e.pointerId);}catch{/* Pointer lock can acquire the mouse before pointer capture completes. */}}
  });
  canvas.addEventListener('pointermove',e=>{
    if(!enabled||paused||document.pointerLockElement===canvas||drag?.id!==e.pointerId)return;
    look(e.clientX-drag.x,e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY;
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>drag=null);
  window.addEventListener('pointerup',()=>drag=null);
  document.addEventListener('mousemove',e=>{if(enabled&&!paused&&document.pointerLockElement===canvas)look(e.movementX,e.movementY);});
  return {
    get enabled(){return enabled;},get paused(){return paused;},get nav(){return nav;},
    get yaw(){return yaw;},get pitch(){return pitch;},eyeHeight,
    get driving(){return driving;},set driving(value){driving=value;if(!value){feet=camera.position.y-eyeHeight;camera.rotation.set(pitch,yaw,0,'YXZ');}},
    get feet(){return feet;},get careful(){return tightSpace();},
    setLookOptions(options){if(options.sensitivity!==undefined)sensitivity=THREE.MathUtils.clamp(Number(options.sensitivity)||1,.3,1.5);if(options.captureMouse!==undefined){captureMouse=Boolean(options.captureMouse);if(!captureMouse&&document.pointerLockElement===canvas)document.exitPointerLock();}},
    levelLook(){pitch=0;camera.rotation.set(0,yaw,0,'YXZ');},
    axis,floorAt,solidAt,inWater,
    setActivityPace(value){activityPace=THREE.MathUtils.clamp(value,.3,1);},
    // Moving props (vehicles) register oriented boxes in the same shape as the exported colliders.
    setDynamic(id,box){if(box)dynamic.set(id,box);else dynamic.delete(id);},
    place(x,y,z,lookYaw=yaw,lookPitch=0){camera.position.set(x,y,z);feet=y-eyeHeight;yaw=lookYaw;pitch=lookPitch;camera.rotation.set(pitch,yaw,0,'YXZ');},
    standAt(x,z,feet){const height=floorAt(x,z,feet,.6);return height!==undefined&&!blocked(x,z,height)?height:undefined;},
    enter(data){nav=data;boxes=nav.boxes.map(([cx,cz,hx,hz,a,low=-100,high=100])=>({cx,cz,hx,hz,c:Math.cos(a),s:Math.sin(a),low,high}));enabled=true;paused=false;driving=false;clearInput();yaw=nav.yaw||0;pitch=nav.pitch||0;camera.position.fromArray(nav.spawn);feet=camera.position.y-eyeHeight;camera.rotation.set(pitch,yaw,0,'YXZ');camera.fov=64;camera.near=.04;camera.updateProjectionMatrix();canvas.focus({preventScroll:true});onChange(true);},
    exit(){enabled=false;driving=false;clearInput();if(document.pointerLockElement===canvas)document.exitPointerLock();onChange(false);},
    pause(value){paused=value;if(value){clearInput();if(document.pointerLockElement===canvas)document.exitPointerLock();}},
    input(direction,pressed){if(!enabled||paused)return;if(pressed)touches.add(direction);else touches.delete(direction);},
    reset(){if(enabled)this.enter(nav);},
    update(dt){
      if(!enabled||paused||driving)return;
      const {forward,strafe,fast}=axis();
      const length=Math.hypot(forward,strafe);
      if(length){const speed=(activityPace<1?2*activityPace:tightSpace()?1.15:fast?3.8:2)*Math.min(dt,.1)/length;
      move((strafe*Math.cos(yaw)-forward*Math.sin(yaw))*speed,(-forward*Math.cos(yaw)-strafe*Math.sin(yaw))*speed);}
      // Collision follows the actual floor; the eye eases over stair treads and landings.
      camera.position.y=THREE.MathUtils.damp(camera.position.y,feet+eyeHeight,14,Math.min(dt,.1));
    }
  };
}
