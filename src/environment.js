import * as THREE from 'three';

// Camera-centred precipitation, clipped by exported roof footprints. No audio or screen overlays.
export function createEnvironment(scene,camera,sun,sky,fill,floor,host){
  let weather='clear',season='green',nav,model,walking=false,sheltered=false;
  const settings={
    clear:{top:'#76afd2',horizon:'#dde8e3',light:2.6,ambient:2.8,fill:1.2,color:'#fff4dd',fog:1800},
    overcast:{top:'#8d9ba6',horizon:'#c6cccd',light:.65,ambient:2.7,fill:.8,color:'#e3e8ec',fog:1100},
    rain:{top:'#637682',horizon:'#a1afb3',light:.4,ambient:2.3,fill:.7,color:'#dde7ed',fog:700},
    snow:{top:'#a1b3c0',horizon:'#e3e8eb',light:.65,ambient:3,fill:.8,color:'#eff7ff',fog:900},
    sunset:{top:'#536e91',horizon:'#edb57b',light:1.6,ambient:1.8,fill:.7,color:'#ffb36a',fog:1500},
  };
  const dome=new THREE.Mesh(new THREE.SphereGeometry(1400,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color()},horizon:{value:new THREE.Color()}},vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 top;uniform vec3 horizon;varying vec3 v;void main(){float h=clamp(normalize(v).y,0.,1.);gl_FragColor=vec4(mix(horizon,top,pow(h,.55)),1.);}'}));
  dome.renderOrder=-10;scene.add(dome);
  const count=650,rainPositions=new Float32Array(count*6),snowPositions=new Float32Array(count*3);
  const seeds=Array.from({length:count},()=>[Math.random()*30-15,Math.random()*18,Math.random()*30-15]);
  const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
  const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:0xbfd7df,transparent:true,opacity:.4,depthWrite:false}));rain.frustumCulled=false;scene.add(rain);
  const snowGeo=new THREE.BufferGeometry();snowGeo.setAttribute('position',new THREE.BufferAttribute(snowPositions,3));
  const snow=new THREE.Points(snowGeo,new THREE.PointsMaterial({color:0xffffff,size:.06,transparent:true,opacity:.8,depthWrite:false}));snow.frustumCulled=false;scene.add(snow);
  function apply(){
    const s=settings[weather];sun.intensity=s.light*(season==='winter'?.7:1);sky.intensity=s.ambient;fill.intensity=s.fill;
    sun.color.set(s.color);sun.position.set(weather==='sunset'?-150:-30,weather==='sunset'?25:70,40);
    scene.background.set(s.horizon);dome.material.uniforms.top.value.set(s.top);dome.material.uniforms.horizon.value.set(s.horizon);
    scene.fog=new THREE.Fog(scene.background,weather==='rain'?90:350,s.fog);
    floor.material.color.set(season==='winter'?'#e2e7e8':season==='corn'?'#ac9f73':'#9eaa7c');
    model?.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){
      if(m.roughness===undefined)continue;m.userData.dryRoughness??=m.roughness;
      // Wet concrete and roofs catch light; indoor furniture keeps its own finish.
      const outdoor=/road|concrete|roof|paving|mud|brick/i.test(m.name)&&!/Interior|Roof kitchen/i.test(m.name);
      m.roughness=outdoor&&weather==='rain'?Math.max(.18,m.userData.dryRoughness*.45):m.userData.dryRoughness;
    }});
    host.dataset.weather=weather;
  }
  function update(dt,time){
    dome.position.copy(camera.position);
    sheltered=(nav?.shelters||[]).some(({rect:[x0,z0,x1,z1],roof})=>camera.position.x>x0&&camera.position.x<x1&&camera.position.z>z0&&camera.position.z<z1&&camera.position.y<roof);
    rain.visible=weather==='rain'&&!sheltered;snow.visible=weather==='snow'&&!sheltered;
    host.dataset.sheltered=String(sheltered);host.dataset.precipitation=rain.visible?'rain':snow.visible?'snow':'none';
    if(!rain.visible&&!snow.visible)return;
    for(let i=0;i<count;i++){
      const [x,h,z]=seeds[i];const rate=rain.visible?11:1.3;
      const y=camera.position.y+((h-time*rate)%18+18)%18-2;
      const px=camera.position.x+x+(snow.visible?Math.sin(time*.7+i)*.6:0),pz=camera.position.z+z;
      if(rain.visible){rainPositions.set([px,y,pz,px-.08,y+.6,pz+.03],i*6);}else snowPositions.set([px,y,pz],i*3);
    }
    (rain.visible?rainGeo:snowGeo).attributes.position.needsUpdate=true;
  }
  apply();return{update,setWeather(value){if(settings[value]){weather=value;apply();}},setSeason(value){season=value;apply();},setModel(value,data){model=value;nav=data;apply();},setWalking(value){walking=value;}};
}
