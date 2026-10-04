import * as THREE from 'three';
import {seeded,material,oval,stem,merged} from './organic.js';
import {koiMaterial} from './pond-materials.js';

export function koiGeometry(){
  const vertices=[],indices=[];const rings=20,sides=16;
  for(let j=0;j<=rings;j++){
    const t=j/rings,z=-.65+t*1.2,r=Math.pow(Math.sin(Math.PI*t),.7)*(.18-.065*t)+.009;
    for(let k=0;k<=sides;k++){const a=k/sides*Math.PI*2;vertices.push(Math.cos(a)*r,Math.sin(a)*r*.85,z);if(j<rings&&k<sides){const i=j*(sides+1)+k;indices.push(i,i+1,i+sides+1,i+1,i+sides+2,i+sides+1);}}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function finGeometry(points){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();return g;}
const bodyGeometry=koiGeometry();
const tailGeometry=finGeometry([[0,0,0],[-.24,.10,.3],[0,0,.19],[.24,.1,.3]]);
const sideFinGeometry=finGeometry([[0,0,0],[.20,-.025,.09],[.25,-.055,.29],[.03,-.02,.17]]);
const dorsalGeometry=finGeometry([[0,0,-.15],[0,.12,-.06],[0,.10,.33],[0,0,.40]]);
const fins=new THREE.MeshStandardMaterial({color:'#eee9d5',transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false,roughness:.45});
const eyeMat=material('#132a26'),irisMat=material('#c9b662');
export function createKoi(kind){
  const root=new THREE.Group();root.name='Swimming koi';root.add(new THREE.Mesh(bodyGeometry,koiMaterial(kind)));
  const tail=new THREE.Mesh(tailGeometry,fins);tail.position.z=.50;root.add(tail);
  const flippers=[];for(const side of [-1,1]){const fin=new THREE.Mesh(sideFinGeometry,fins);fin.position.set(side*.13,-.03,-.22);fin.scale.x=side;root.add(fin);flippers.push(fin);oval(root,[side*.075,.045,-.5],[.027,.027,.017],irisMat);oval(root,[side*.094,.048,-.507],[.013,.015,.012],eyeMat);}
  const dorsal=new THREE.Mesh(dorsalGeometry,fins);dorsal.position.y=.12;root.add(dorsal);
  return {root,tail,flippers};
}

export function lilyGeometry(radius=1){
  const v=[0,0,0],indices=[],uv=[.5,.5],segments=48;
  for(let j=0;j<=segments;j++){const a=.20+j/segments*(Math.PI*2-.40);v.push(Math.sin(a)*radius,.014*Math.sin(a*5),Math.cos(a)*radius);uv.push(.5+Math.sin(a)*.5,.5+Math.cos(a)*.5);if(j<segments)indices.push(0,j+1,j+2);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function lilyMaterial(){
  const m=material('#84a85e');m.roughness=.55;
  m.onBeforeCompile=s=>{s.vertexShader='varying vec3 lilyP;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nlilyP=position;');s.fragmentShader='varying vec3 lilyP;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float vein=pow(max(0.,cos(atan(lilyP.x,lilyP.z)*32.)),22.);
    diffuseColor.rgb*=.9+.13*sin(lilyP.x*14.+lilyP.z*9.)+vein*.15;
  `);};m.customProgramCacheKey=()=> 'lily-veins-v1';return m;
}
export function lotus(){
  const g=new THREE.Group(),petals=material('#eee1dd'),gold=material('#d7b856');
  for(let layer=0;layer<2;layer++)for(let j=0;j<10;j++){const a=j*Math.PI/5+layer*.3,p=oval(g,[Math.sin(a)*(.13-layer*.045),.09+layer*.06,Math.cos(a)*(.13-layer*.045)],[.045,.025+layer*.025,.14-layer*.04],petals);p.rotation.set(-.25-layer*.4,a,0);}
  oval(g,[0,.16,0],[.065,.045,.065],gold);for(let i=0;i<9;i++){const a=i*2.4;stem(g,[[Math.sin(a)*.045,.15,Math.cos(a)*.045],[Math.sin(a)*.07,.24,Math.cos(a)*.07]],.006,gold);}return merged(g);
}
export function pondFrog(){
  const g=new THREE.Group(),green=material('#769a4c'),cream=material('#dacba0'),black=material('#243e29'),gold=material('#c9bf65');
  oval(g,[0,.09,0],[.13,.08,.17],green);oval(g,[0,.07,-.13],[.115,.07,.095],green);oval(g,[0,.03,-.08],[.1,.028,.13],cream);
  for(const s of [-1,1]){oval(g,[s*.075,.135,-.16],[.045,.045,.035],gold);oval(g,[s*.079,.143,-.184],[.024,.027,.013],black);oval(g,[s*.14,.055,.08],[.07,.055,.10],green);
    stem(g,[[s*.09,.07,-.11],[s*.16,.025,-.13],[s*.19,.014,-.24]],.018,green);stem(g,[[s*.13,.05,.13],[s*.20,.02,.19],[s*.24,.012,.13]],.024,green);
    for(let j=0;j<3;j++){stem(g,[[s*.19,.014,-.24],[s*(.18+j*.025),.012,-.28-j*.012]],.006,cream);stem(g,[[s*.24,.012,.13],[s*(.22+j*.023),.008,.17]],.007,cream);}}
  for(let i=0;i<12;i++){const a=i*2.4;oval(g,[Math.sin(a)*.07,.165-Math.abs(Math.sin(a))*.016,Math.cos(a)*.10],[.022,.003,.028],black);}return merged(g);
}
export function pondTurtle(){
  const g=new THREE.Group(),shell=material('#58664b'),skin=material('#a2a174'),line=material('#2e4434');oval(g,[0,.10,0],[.28,.14,.36],shell);
  for(let i=0;i<5;i++){const a=i*1.256;oval(g,[Math.sin(a)*.14,.20,Math.cos(a)*.17],[.09,.012,.10],line);}
  oval(g,[0,.08,-.37],[.08,.065,.13],skin);for(const s of [-1,1]){oval(g,[s*.23,.04,-.20],[.11,.04,.12],skin);oval(g,[s*.23,.04,.23],[.1,.04,.13],skin);oval(g,[s*.062,.11,-.43],[.012,.012,.012],line);}return merged(g);
}

// Procedural foliage cards keep flowering crowns airy, with individually painted petals.
export function gardenCrownMaterial(kind){
  const mat=material('#ffffff');if(!document.createElement)return mat;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d'),r=seeded(kind==='maple'?98:71);
  for(let i=0;i<950;i++){const a=r()*6.28,rad=Math.sqrt(r())*105,x=128+Math.cos(a)*rad,y=128+Math.sin(a)*rad*.82,s=3+r()*6;
    ctx.fillStyle=kind==='maple'?['#ba6043','#bf8254','#91513d','#cd8c62'][i%4]:['#e8cbd1','#cba5b6','#ead9df','#c5cdb5'][i%4];ctx.beginPath();
    if(kind==='maple'){ctx.moveTo(x,y-s);for(let k=1;k<10;k++){const t=k*.628,rr=k%2?s*.45:s;ctx.lineTo(x+Math.sin(t)*rr,y-Math.cos(t)*rr);}ctx.closePath();}else ctx.ellipse(x,y,s,s*.65,r()*3,0,6.28);ctx.fill();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;mat.map=texture;mat.alphaTest=.5;mat.roughness=.88;return mat;
}
