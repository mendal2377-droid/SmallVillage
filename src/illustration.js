import * as THREE from 'three';
import {seeded} from './organic.js';
import {paintGround} from './painted.js';

// One colour/depth pass gives architecture, wildlife and held tools the same ink treatment.
// Depth contours avoid outlining every noisy painted texel. No extra geometry render is required.
export function createIllustration(renderer,scene,camera,environment,host){
  const target=new THREE.WebGLRenderTarget(1,1,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
  target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
  const uniforms={colour:{value:target.texture},depth:{value:target.depthTexture},pixel:{value:new THREE.Vector2()},near:{value:.1},far:{value:3000},day:{value:1}};
  const mat=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms,vertexShader:'varying vec2 uvPaint;void main(){uvPaint=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`
    uniform sampler2D colour;uniform sampler2D depth;uniform vec2 pixel;uniform float near;uniform float far;uniform float day;varying vec2 uvPaint;
    float viewDepth(vec2 p){float z=texture2D(depth,p).r;return near*far/(far-(far-near)*z);}
    float grain(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    void main(){vec2 p=uvPaint;vec3 c=texture2D(colour,p).rgb;float z=viewDepth(p);float edge=0.;
      edge=max(edge,abs(viewDepth(p+vec2(pixel.x,0.))-z));edge=max(edge,abs(viewDepth(p-vec2(pixel.x,0.))-z));
      edge=max(edge,abs(viewDepth(p+vec2(0.,pixel.y))-z));edge=max(edge,abs(viewDepth(p-vec2(0.,pixel.y))-z));
      float ink=smoothstep(.012,.055,edge/max(z,.2));
      float l=dot(c,vec3(.2126,.7152,.0722));float band=floor(l*12.+.5)/12.;c*=mix(1.,band/max(l,.045),.12*day);
      c*=mix(vec3(.92,.98,1.07),vec3(1.045,1.025,.94),smoothstep(.08,.9,l)*day);
      c=mix(c,c*.48+vec3(.008,.017,.014),ink*(.25+.13*day));
      float paper=(grain(gl_FragCoord.xy)-.5)*.008;c+=paper*(.25+.75*day);
      vec3 glow=texture2D(colour,p+pixel*3.).rgb+texture2D(colour,p-pixel*3.).rgb;c+=max(glow-vec3(1.15),vec3(0.))*.06*day;
      gl_FragColor=vec4(max(c,vec3(0.)),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  const canvasScene=new THREE.Scene(),flatCamera=new THREE.Camera();canvasScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),mat));
  const size=new THREE.Vector2();
  host.dataset.visualStyle='painted-illustration';
  return {target,render(){renderer.getDrawingBufferSize(size);if(target.width!==size.x||target.height!==size.y){target.setSize(size.x,size.y);uniforms.pixel.value.set(1/size.x,1/size.y);}uniforms.near.value=camera.near;uniforms.far.value=camera.far;uniforms.day.value=environment.daylight;
    renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(canvasScene,flatCamera);
  },dispose(){target.dispose();mat.dispose();canvasScene.children[0].geometry.dispose();}};
}

let paper;
function paintedPaper(){if(paper)return paper;const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),r=seeded(620);ctx.fillStyle='#f4f1e5';ctx.fillRect(0,0,128,128);
  for(let j=0;j<1900;j++){ctx.fillStyle=j%3?'#ffffff12':'#817b6611';ctx.fillRect(r()*128,r()*128,.4+r()*3,.4+r()*2);}
  for(let j=0;j<140;j++){ctx.strokeStyle='#928c7b09';ctx.beginPath();const x=r()*128,y=r()*128;ctx.moveTo(x,y);ctx.quadraticCurveTo(x+8,y-3,x+12+r()*10,y);ctx.stroke();}
  paper=new THREE.CanvasTexture(canvas);paper.wrapS=paper.wrapT=THREE.RepeatWrapping;paper.colorSpace=THREE.SRGBColorSpace;return paper;
}
export function paintArchitecture(model){model.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!m?.color||m.isShaderMaterial)continue;const n=m.name.toLowerCase();
  const palette=[[/white.*plaster|white tile facade|white ceramic|ivory ceramic|cream bed linen/,'#e4dcc3'],[/grey.*plaster|mottled grey|weathered grey/,'#a9b4a4'],[/house plaster 0/,'#d5cfb0'],[/house plaster 1/,'#c0ceb4'],[/house plaster 2|faded pink plaster/,'#d3b4a0'],[/roof tiles|brown roof/,'#998071'],[/red brick|aged red brick/,'#aa7861'],[/red coping|oxblood|burgundy enamel/,'#99584c'],[/blue corrugated|blue sheet roof/,'#648d99'],[/concrete roads|terrace concrete|clean concrete|courtyard concrete/,'#d0cab5'],[/bank grasses|green field$/,'#98ae69'],[/earth|wet mud/,'#b1a37c'],[/window frames|dark frames/,'#40594f']];
  const entry=palette.find(([pattern])=>pattern.test(n));if(entry)m.color.set(entry[1]);
  if(!/glass|glazing|water|snow|crop|leaves|foliage|window|curtain/.test(n)){m.map=paintedPaper();m.bumpMap=null;m.bumpScale=0;m.roughness=.94;m.metalness=Math.min(m.metalness||0,.12);m.needsUpdate=true;}
  if(/bank grasses|green field$|corn field floor|::map \| earth$/.test(n))paintGround(m);
}});}
