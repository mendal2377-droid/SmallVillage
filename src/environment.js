import * as THREE from 'three';

// Sky, light, fog and precipitation for a time of day and weather. Precipitation is camera-centred and
// clipped by exported roof footprints. Sunrise is in the east (+x); the sun crosses the southern sky (+z).
export function createEnvironment(scene,camera,sun,sky,fill,floor,host){
  let weather='clear',season='green',nav,model,walking=false,sheltered=false,hour=14,daySpeed=0,flash=0,nextBolt=6;
  const listeners=new Set();
  const settings={
    clear:{top:'#8abcc8',horizon:'#e0e7c9',light:3.1,ambient:1.85,fill:.55,color:'#ffe9b4',fog:950,near:150,stars:1},
    overcast:{top:'#8d9ba6',horizon:'#c6cccd',light:.65,ambient:2.7,fill:.8,color:'#e3e8ec',fog:1100,near:350,stars:.15},
    rain:{top:'#637682',horizon:'#a1afb3',light:.4,ambient:2.3,fill:.7,color:'#dde7ed',fog:700,near:90,stars:0,drops:'rain',wind:.08,rate:11},
    storm:{top:'#5d6c7a',horizon:'#929ea4',light:.25,ambient:1.9,fill:.5,color:'#cfd9e2',fog:420,near:40,stars:0,drops:'rain',wind:.32,rate:15},
    snow:{top:'#a1b3c0',horizon:'#e3e8eb',light:.65,ambient:3,fill:.8,color:'#eff7ff',fog:900,near:350,stars:.1,drops:'snow',rate:1.3},
    fog:{top:'#b9c0c2',horizon:'#cfd4d2',light:.35,ambient:2.6,fill:.6,color:'#e8ecee',fog:150,near:6,stars:0},
    sunset:{top:'#6e7e93',horizon:'#ed9058',light:.85,ambient:.36,fill:.10,color:'#ffab61',fog:1500,near:350,stars:.8},
  };
  // The dome shader writes colours unconverted, so night tones are lighter here than they display.
  const night={top:new THREE.Color('#2a3a5c'),horizon:new THREE.Color('#44567a'),color:new THREE.Color('#9db2ff')};
  const dusk={horizon:new THREE.Color('#e99465'),top:new THREE.Color('#65768e'),color:new THREE.Color('#ffad65')};
  const lightningSky=new THREE.Color('#dfe6ff');
  const dome=new THREE.Mesh(new THREE.SphereGeometry(1400,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{top:{value:new THREE.Color()},horizon:{value:new THREE.Color()}},vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 top;uniform vec3 horizon;varying vec3 v;void main(){float h=clamp(normalize(v).y,0.,1.);gl_FragColor=vec4(mix(horizon,top,pow(h,.55)),1.);}'}));
  dome.renderOrder=-10;scene.add(dome);
  dome.material.uniforms.time={value:0};dome.material.uniforms.cloud={value:.35};dome.material.uniforms.day={value:1};
  dome.material.uniforms.warmGlow={value:0};dome.material.uniforms.sunDirection={value:new THREE.Vector3()};
  dome.material.uniforms.calm={value:0};
  dome.material.fragmentShader=`uniform vec3 top;uniform vec3 horizon;uniform float time;uniform float cloud;uniform float day;uniform float warmGlow;uniform float calm;uniform vec3 sunDirection;varying vec3 v;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}float fbm(vec2 p){return noise(p)*.5+noise(p*2.)*.25+noise(p*4.)*.125+noise(p*8.)*.0625;}
void main(){vec3 n=normalize(v);float h=clamp(n.y,0.,1.);vec3 c=mix(horizon,top,smoothstep(0.,mix(.45,.55,warmGlow),h));float facing=pow(max(0.,dot(n,sunDirection)),12.);float glow=warmGlow*facing*exp(-h*6.);c=mix(c,vec3(1.,.49,.16),glow*.70);c+=vec3(1.,.59,.22)*pow(max(0.,dot(n,sunDirection)),150.)*warmGlow*.5;vec2 p=n.xz/(max(n.y,.09))*2.5+vec2(time*.002,0);float f=fbm(p);float clouds=smoothstep(.55-cloud*.28,.70-cloud*.25,f)*smoothstep(.015,.18,h);vec3 cloudPaint=mix(horizon*.70,vec3(.93,.92,.86),smoothstep(.25,.65,f));c=mix(c,cloudPaint*(.25+.75*day),clouds*mix(.84,.025,calm));gl_FragColor=vec4(c,1.);
#include <colorspace_fragment>
}`;
  const starPositions=new Float32Array(900*3);
  for(let i=0;i<900;i++){const a=Math.random()*Math.PI*2,y=.08+Math.random()*.92,r=Math.sqrt(1-y*y);starPositions.set([Math.cos(a)*r*1300,y*1300,Math.sin(a)*r*1300],i*3);}
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(starPositions,3));
  const phases=new Float32Array(900),sizes=new Float32Array(900);for(let i=0;i<900;i++){phases[i]=Math.random()*6.28;sizes[i]=1.1+Math.random()*2;}
  starGeo.setAttribute('phase',new THREE.BufferAttribute(phases,1));starGeo.setAttribute('starSize',new THREE.BufferAttribute(sizes,1));
  const stars=new THREE.Points(starGeo,new THREE.ShaderMaterial({uniforms:{time:{value:0},visibility:{value:0}},transparent:true,depthWrite:false,fog:false,vertexShader:'attribute float phase;attribute float starSize;uniform float time;varying float brightness;varying float tint;void main(){brightness=.55+.45*sin(time*(.75+starSize*.2)+phase);tint=phase/6.28;gl_PointSize=starSize*(.85+.15*brightness);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float visibility;varying float brightness;varying float tint;void main(){float d=length(gl_PointCoord-.5);float a=(1.-smoothstep(.1,.5,d))*brightness*visibility;gl_FragColor=vec4(mix(vec3(.75,.85,1.),vec3(1.,.92,.72),tint),a);\n#include <colorspace_fragment>\n}'}));
  stars.renderOrder=-9;stars.frustumCulled=false;scene.add(stars);
  const disc=(color,size)=>{const m=new THREE.Mesh(new THREE.CircleGeometry(size,32),new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false,fog:false}));m.renderOrder=-8;m.frustumCulled=false;scene.add(m);return m;};
  const sunDisc=disc(0xfff1c8,26),moonDisc=disc(0xe9eefc,17);
  const count=650,rainPositions=new Float32Array(count*6),snowPositions=new Float32Array(count*3);
  const seeds=Array.from({length:count},()=>[Math.random()*30-15,Math.random()*18,Math.random()*30-15]);
  const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
  const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:0xbfd7df,transparent:true,opacity:.4,depthWrite:false}));rain.frustumCulled=false;scene.add(rain);
  const snowGeo=new THREE.BufferGeometry();snowGeo.setAttribute('position',new THREE.BufferAttribute(snowPositions,3));
  const snow=new THREE.Points(snowGeo,new THREE.PointsMaterial({color:0xffffff,size:.06,transparent:true,opacity:.8,depthWrite:false}));snow.frustumCulled=false;scene.add(snow);
  const top=new THREE.Color(),horizon=new THREE.Color(),light=new THREE.Color(),sunDir=new THREE.Vector3();
  let daylight=1;
  // A fixed golden-hour sun stands in for the original sunset preset.
  const effectiveHour=()=>weather==='sunset'?18.15:hour;
  function lighting(){
    const s=settings[weather],a=(effectiveHour()-6)/12*Math.PI,elevation=Math.sin(a)+(weather==='sunset'?.065:0);
    sunDir.set(Math.cos(a),Math.max(elevation,-.2),.38).normalize();
    // Twilight lingers until the sun is well below the horizon (about 19:00).
    daylight=THREE.MathUtils.smoothstep(elevation,-.42,.1);
    const glow=weather==='sunset'?1:Math.max(0,1-Math.abs(elevation-.04)/.24)*(s.stars>.5?1:.45);
    top.set(s.top).lerp(dusk.top,glow*.5).lerp(night.top,1-daylight);
    horizon.set(s.horizon).lerp(dusk.horizon,glow*.65).lerp(night.horizon,1-daylight);
    dome.material.uniforms.warmGlow.value=glow*daylight;dome.material.uniforms.sunDirection.value.copy(sunDir);
    dome.material.uniforms.calm.value=weather==='sunset'?1:0;
    light.set(s.color).lerp(dusk.color,glow*.7);
    // Below the horizon the key light becomes moonlight from the opposite side of the sky.
    if(daylight<.5){light.lerp(night.color,1-daylight*2);sun.position.copy(sunDir).multiplyScalar(-100).setY(Math.abs(sunDir.y)*100+30);}
    else sun.position.copy(sunDir).multiplyScalar(100);
    sun.position.x+=camera.position.x;sun.position.z+=camera.position.z;sun.target.position.set(camera.position.x,0,camera.position.z);
    sun.color.copy(light);
    sun.intensity=Math.max(s.light*daylight*(season==='winter'?.7:1),(1-daylight)*.22);
    sky.intensity=s.ambient*(.16+.84*daylight)+flash*7;
    fill.intensity=s.fill*(.25+.75*daylight);
    scene.background.copy(horizon);dome.material.uniforms.top.value.copy(top);dome.material.uniforms.horizon.value.copy(horizon);
    if(flash)dome.material.uniforms.top.value.lerp(lightningSky,Math.min(1,flash*2));
    scene.fog??=new THREE.Fog(horizon,s.near,s.fog);
    scene.fog.color.copy(horizon);scene.fog.near=walking?s.near:1600;scene.fog.far=walking?s.fog*(.55+.45*daylight):3000;
    stars.material.opacity=Math.pow(1-daylight,3)*s.stars;
    stars.material.uniforms.visibility.value=stars.material.opacity;host.dataset.nightStars=stars.material.opacity>.5?'twinkling':'hidden';host.dataset.summerNight=String(season==='summer'&&daylight<.1);
    sunDisc.material.opacity=s.stars>.5?daylight:0;moonDisc.material.opacity=(1-daylight)*Math.max(s.stars,.05);host.dataset.sunsetClouds=weather==='sunset'?'wisps':'normal';
    host.dataset.hour=effectiveHour().toFixed(2);host.dataset.daylight=daylight.toFixed(2);
  }
  function apply(){
    floor.material.color.set(season==='winter'?'#e2e7e8':season==='corn'?'#ac9f73':'#9eaa7c');
    const wet=settings[weather].drops==='rain';
    model?.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){
      if(m.roughness===undefined)continue;m.userData.dryRoughness??=m.roughness;
      // Wet concrete and roofs catch light; indoor furniture keeps its own finish.
      const outdoor=/concrete roads|flat concrete roof|grey roof tiles|terrace concrete|damp worn courtyard concrete|paving brick|wet mud|red brick/i.test(m.name);
      m.roughness=outdoor&&wet?Math.max(.18,m.userData.dryRoughness*.45):m.userData.dryRoughness;
    }});
    host.dataset.weather=weather;lighting();
  }
  function update(dt,time){
    if(daySpeed)hour=(hour+dt*daySpeed/60)%24;
    const s=settings[weather];
    if(weather==='storm'&&(nextBolt-=dt)<=0){flash=1;nextBolt=4+Math.random()*9;for(const fn of listeners)fn('lightning');}
    flash=Math.max(0,flash-dt*3.2);
    lighting();
    dome.position.copy(camera.position);stars.position.copy(camera.position);
    stars.material.uniforms.time.value=time;
    dome.material.uniforms.time.value=time;dome.material.uniforms.cloud.value=['overcast','rain','storm','snow'].includes(weather)?.95:weather==='sunset'?.1:.45;dome.material.uniforms.day.value=daylight;
    sunDisc.position.copy(camera.position).addScaledVector(sunDir,1250);sunDisc.lookAt(camera.position);
    moonDisc.position.copy(camera.position).addScaledVector(sunDir,-1250).setY(camera.position.y+Math.abs(sunDir.y)*1250+180);moonDisc.lookAt(camera.position);
    sheltered=(nav?.shelters||[]).some(({rect:[x0,z0,x1,z1],roof})=>camera.position.x>x0&&camera.position.x<x1&&camera.position.z>z0&&camera.position.z<z1&&camera.position.y<roof);
    rain.visible=s.drops==='rain'&&!sheltered;snow.visible=s.drops==='snow'&&!sheltered;
    rain.material.opacity=weather==='storm'?.55:.4;
    host.dataset.sheltered=String(sheltered);host.dataset.precipitation=rain.visible?'rain':snow.visible?'snow':'none';
    if(!rain.visible&&!snow.visible)return;
    const wind=s.wind||0;
    for(let i=0;i<count;i++){
      const [x,h,z]=seeds[i];
      const y=camera.position.y+((h-time*s.rate)%18+18)%18-2;
      const px=camera.position.x+x+(snow.visible?Math.sin(time*.7+i)*.6:0),pz=camera.position.z+z;
      if(rain.visible)rainPositions.set([px,y,pz,px-.08-wind*2,y+.6,pz+.03+wind],i*6);else snowPositions.set([px,y,pz],i*3);
    }
    (rain.visible?rainGeo:snowGeo).attributes.position.needsUpdate=true;
  }
  apply();
  return{update,
    setWeather(value){if(settings[value]){weather=value;apply();}},setSeason(value){season=value;apply();},setModel(value,data){model=value;nav=data;apply();},setWalking(value){walking=value;},
    setHour(value){hour=((Number(value)%24)+24)%24;lighting();},setDaySpeed(value){daySpeed=Number(value)||0;},
    on(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    get hour(){return effectiveHour();},get weather(){return weather;},get season(){return season;},get daylight(){return daylight;},get sheltered(){return sheltered;},
    get wet(){return settings[weather].drops==='rain';},get walking(){return walking;},weathers:Object.keys(settings)};
}
