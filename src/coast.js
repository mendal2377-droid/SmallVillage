import * as THREE from 'three';
import {shoreX,COAST} from './coast-layout.js';
import {seeded,material,stem,merged,instances} from './organic.js';
import {canopyGeometry,paintedMaterial,paintGround} from './painted.js';
import {createPlantingMask} from './planting.js';

const shorelineGLSL=`float shore(float z){return 468.+25.*sin(z*.007)+9.*sin(z*.025)+50.*exp(-pow((z-245.)/48.,2.));}`;
function ribbon(rows){const p=[],idx=[];for(let i=0;i<rows.length;i++){for(const v of rows[i])p.push(...v);if(i){const k=i*2;idx.push(k-2,k-1,k,k-1,k+1,k);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;}
export function createCoast({scene,camera,nav,environment,host}){
  const root=new THREE.Group();root.name='Illustrated coast and beach';scene.add(root);const r=seeded(819),mask=createPlantingMask(nav);
  const grass=material('#c7d0a3');paintGround(grass);const sand=material('#e8d7af'),wetSand=material('#bcbf9e');
  sand.onBeforeCompile=s=>{s.vertexShader='varying vec3 sandWorld;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nsandWorld=(modelMatrix*vec4(transformed,1.)).xyz;');s.fragmentShader='varying vec3 sandWorld;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=.97+.025*sin(sandWorld.x*2.7+sin(sandWorld.z*.6))+.012*sin(sandWorld.z*12.1+sandWorld.x*8.);');};sand.customProgramCacheKey=()=> 'painted-sand-ripples';
  const land=[],beach=[],wash=[];
  for(let z=-700;z<=800;z+=4){const x=shoreX(z);land.push([[300,.106,z],[x-35,.106,z]]);beach.push([[x-35,.108,z],[x,.108,z]]);wash.push([[x-4,.112,z],[x,.112,z]]);}
  for(const [rows,mat] of [[land,grass],[beach,sand],[wash,wetSand]]){mat.side=THREE.DoubleSide;const m=new THREE.Mesh(ribbon(rows),mat);m.receiveShadow=true;root.add(m);}
  const pathRows=nav.coastTrail.map(([x,z],i,a)=>{const before=a[Math.max(0,i-1)],after=a[Math.min(a.length-1,i+1)],dx=after[0]-before[0],dz=after[1]-before[1],len=Math.hypot(dx,dz)||1;return [-1,1].map(s=>[x-dz/len*1.5*s,.119,z+dx/len*1.5*s]);});
  const path=new THREE.Mesh(ribbon(pathRows),material('#d4c59b'));root.add(path);
  // A continuous ocean with moving offshore swells, travelling breakers and lace at the shoreline.
  // Its broad colour masses and broken white strokes keep the water in the painted world palette.
  const uniforms={clock:{value:0},day:{value:1},storm:{value:0},fogColor:{value:new THREE.Color()},fogNear:{value:150},fogFar:{value:950}};
  const oceanMat=new THREE.ShaderMaterial({uniforms,side:THREE.DoubleSide,
    vertexShader:`uniform float clock;uniform float storm;varying vec3 water;varying float depth;${shorelineGLSL}
      void main(){vec3 p=position;float d=max(0.,p.x-shore(p.z));p.y=.025+(sin(d*.17-clock*1.1+p.z*.019)*.07+sin(p.x*.09+p.z*.11-clock*.7)*.035)*smoothstep(0.,15.,d)*(1.+storm);vec4 world=modelMatrix*vec4(p,1.);water=world.xyz;vec4 mv=viewMatrix*world;depth=-mv.z;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float clock;uniform float day;uniform float storm;uniform vec3 fogColor;uniform float fogNear;uniform float fogFar;varying vec3 water;varying float depth;${shorelineGLSL}
      float noise(vec2 p){return sin(p.x*2.7+sin(p.y*3.1))*sin(p.y*4.3+p.x*.7);}
      void main(){float d=max(0.,water.x-shore(water.z));float grain=noise(water.xz*.065);vec3 c=mix(vec3(.08,.48,.52),vec3(.025,.17,.30),smoothstep(8.,180.,d));c+=grain*.025;
      float phase=d*.23+clock*.85+sin(water.z*.06)*.28+noise(water.xz*.03)*.15;
      float crest=pow(max(0.,sin(phase)),18.);float broken=smoothstep(-.5,.7,noise(water.xz*.12));float surf=crest*(.38+broken*.62)*(1.-smoothstep(60.,170.,d))*smoothstep(.2,5.,d);
      float lace=(1.-smoothstep(.2,2.9+sin(clock+water.z*.1)*1.2,d))*(.6+.4*grain);float glint=pow(max(0.,sin(water.x*.46+water.z*.65+clock*.65)),32.)*.12*smoothstep(35.,100.,d);
      c=mix(c,vec3(.88,.93,.85),clamp(surf+lace+glint,0.,.9));c*=mix(.17,1.,day)*(1.-storm*.15);c=mix(c,fogColor,smoothstep(fogNear,fogFar,depth));gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
  // Dense cross-shore samples provide real swell silhouettes rather than a flat reflective sheet.
  const seaP=[],seaI=[],cols=100,rows=250;for(let j=0;j<=rows;j++){const z=-1500+j*12,x=shoreX(z);for(let i=0;i<=cols;i++)seaP.push(x+(COAST.seaEnd-x)*(i/cols)**1.65,0,z);}
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;seaI.push(a,b,a+1,a+1,b,b+1);}
  const seaGeo=new THREE.BufferGeometry();seaGeo.setAttribute('position',new THREE.Float32BufferAttribute(seaP,3));seaGeo.setIndex(seaI);seaGeo.computeBoundingSphere();const sea=new THREE.Mesh(seaGeo,oceanMat);sea.name='Turquoise surf';root.add(sea);
  const rockMat=material('#7e887d'),rockGeo=new THREE.IcosahedronGeometry(1,1),rocks=new THREE.InstancedMesh(rockGeo,rockMat,nav.coastRocks.length),dummy=new THREE.Object3D();
  nav.coastRocks.forEach((p,i)=>{dummy.position.set(p.x,p.s*.5,p.z);dummy.scale.set(p.s,p.s*.9,p.s);dummy.rotation.set(r()*.4,r()*6.28,r()*.3);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);});rocks.computeBoundingSphere();rocks.castShadow=rocks.receiveShadow=true;root.add(rocks);
  const treePts=[],grassPts=[];
  for(let i=0;i<900;i++){const z=-190+r()*510,x=shoreX(z)-42-r()*115;if(!mask.land(x,z,.7))continue;grassPts.push({x,z,y:.11,scale:1+r(),angle:r()*6.28});if(i%35===0&&x<shoreX(z)-55)treePts.push({x,z,y:.1,scale:.55+r()*.35,angle:.6+r()*.6});}
  const grassMat=paintedMaterial('meadow','#dbd1a6'),tuft=new THREE.Group(),card=new THREE.PlaneGeometry(1.5,.6);card.translate(0,.3,0);const uv=card.attributes.uv;for(let i=0;i<uv.count;i++)uv.setY(i,uv.getY(i)*.35);tuft.add(new THREE.Mesh(card,grassMat));const cross=card.clone();cross.rotateY(Math.PI/2);tuft.add(new THREE.Mesh(cross,grassMat));const grassGroup=instances(merged(tuft),grassPts);root.add(grassGroup);
  const tree=new THREE.Group(),bark=material('#7c725e');stem(tree,[[0,0,0],[-.25,2,0],[-1.3,4.5,.1],[-2.4,6.7,.4]],.18,bark);for(let i=0;i<4;i++)stem(tree,[[-.5,3,0],[-2-i*.4,4.4+i*.7,Math.sin(i)*1.2]],.055,bark);
  const leaves=paintedMaterial('foliage','#c6c7a0'),crown=new THREE.Mesh(canopyGeometry(0,r),leaves);crown.position.set(-2,-1,0);crown.scale.set(1,.65,1);tree.add(crown);const trees=instances(merged(tree),treePts);root.add(trees);
  const pebbleMat=material('#c7bda0'),pebbles=new THREE.InstancedMesh(rockGeo,pebbleMat,70);for(let i=0;i<70;i++){const z=-180+r()*480;dummy.position.set(shoreX(z)-6-r()*22,.16,z);dummy.scale.set(.1+r()*.23,.045+r()*.08,.1+r()*.18);dummy.rotation.set(0,r()*6.28,0);dummy.updateMatrix();pebbles.setMatrixAt(i,dummy.matrix);}pebbles.computeBoundingSphere();root.add(pebbles);
  const drift=new THREE.Group();for(let i=0;i<7;i++){const z=-170+r()*350,x=shoreX(z)-16-r()*12;if(mask.onRoad(x,z,2))continue;stem(drift,[[x,.24,z],[x+1,.18,z+.3],[x+2.3,.2,z+.6]],.09,bark);}root.add(merged(drift));
  // Small gull silhouettes wheel over the surf; six merged birds avoid a large particle flock.
  const gulls=[];for(let i=0;i<6;i++){const g=new THREE.Group(),m=new THREE.MeshBasicMaterial({color:'#dbe1d5',side:THREE.DoubleSide});for(const s of [-1,1]){const wing=new THREE.Mesh(new THREE.ConeGeometry(.22,1,3),m);wing.rotation.z=s*1.25;wing.scale.z=.15;wing.position.x=s*.35;g.add(wing);}root.add(g);gulls.push(g);}
  host.dataset.coast='ready';host.dataset.coastRocks=String(nav.coastRocks.length);
  return {root,sea,uniforms,update(dt,time){uniforms.clock.value=time;uniforms.day.value=environment.daylight;uniforms.storm.value=environment.weather==='storm'?1:0;if(scene.fog){uniforms.fogColor.value.copy(scene.fog.color);uniforms.fogNear.value=scene.fog.near;uniforms.fogFar.value=scene.fog.far;}const near=camera.position.y>50||camera.position.x>240;trees.visible=grassGroup.visible=near;grassMat.color.set(environment.season==='winter'?'#c8c6b6':'#dbd1a6');gulls.forEach((g,i)=>{const a=time*.08+i*1.1;g.position.set(shoreX(110)+30+Math.sin(a)*65,12+i*2+Math.sin(a*2)*2,110+Math.cos(a)*110);g.rotation.set(Math.sin(time*1.4+i)*.12,-a,Math.sin(a)*.2);g.visible=near;});}};
}
