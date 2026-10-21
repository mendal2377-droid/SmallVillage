// Painted toon shading for SmallVillage 2.0, ported from the Blender "SV Painted Toon" node group.
// Lighting is computed by MeshLambertMaterial (sun + ambient + shadows); the result is turned into a soft
// two-tone ramp between a cool shadow tint and a warm lit tint, with gentle grime toward the ground.
// Blender equivalence: DirectionalLight.intensity = sun strength, AmbientLight.intensity = PI * world strength,
// no tone mapping, ramp thresholds on the (white-albedo) irradiance as in Blender (0.22 .. 0.38).
import * as THREE from 'three';

export const toonUniforms = {
  uLit: {value: new THREE.Color(1.12, 1.03, 0.9)},
  uShadow: {value: new THREE.Color(1, 1, 1)},
  uShadowTint: {value: new THREE.Color(0.5, 0.55, 0.78)},
  uT0: {value: 0.22},
  uT1: {value: 0.38},
  uTime: {value: 0},
  uSkyHorizon: {value: new THREE.Color(0.9, 0.88, 0.8)},
  uWaterRect: {value: new THREE.Vector4(-1, -1, -1, -1)},
  uFieldA: {value: new THREE.Color(0.2, 0.42, 0.1)},
  uFieldB: {value: new THREE.Color(0.27, 0.48, 0.12)},
  // climate (Phase 8): wet ground and puddles, lying snow, rain rings on the ponds, wind in the trees and crops
  uWet: {value: 0},
  uSnow: {value: 0},
  uRain: {value: 0},
  uWind: {value: 0.2},
};

const NOISE = /* glsl */`
varying vec3 vToonPos;
float svHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float svNoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(svHash(i), svHash(i + vec2(1, 0)), u.x), mix(svHash(i + vec2(0, 1)), svHash(i + vec2(1, 1)), u.x), u.y);
}
float svFbm(vec2 p){ float a = 0.5, s = 0.0; for (int k = 0; k < 4; k++){ s += a * svNoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

/**
 * kind: 'palette' (kit assets, map = palette texture), 'color' (home quarter), 'water', 'field'
 * sway: trees and crops bend in the wind (taller parts more)
 */
export function makeToon({kind = 'palette', map = null, color = null, opacity = 1, algae = 0, local = {}, sway = false, weather = true} = {}) {
  const mat = new THREE.MeshLambertMaterial({map, color: color ?? 0xffffff, side: THREE.DoubleSide,
    transparent: opacity < 1, opacity});
  mat.defines = mat.defines || {};
  if (kind === 'water') mat.defines.SV_WATER = '';
  if (kind === 'field') mat.defines.SV_FIELD = '';
  if (kind === 'palette') mat.defines.SV_PALETTE = '';
  if (sway) mat.defines.SV_SWAY = '';
  if (!weather) mat.defines.SV_DRY = '';  // creatures and carried things: no puddles or snow on them
  const u = {...toonUniforms, uAlgae: {value: algae}, ...local};
  mat.userData.svUniforms = u;  // uniform objects are shared by reference: update .value to change the shader
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vToonPos;\nuniform float uTime; uniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef SV_SWAY
          // bend with height: crops ripple, tree crowns rock; each plant has its own phase
          vec3 svBase = vec3(0.0);
          #ifdef USE_INSTANCING
            svBase = instanceMatrix[3].xyz;
          #endif
          #ifdef USE_BATCHING
            svBase = batchingMatrix[3].xyz;
          #endif
          float svH = max(position.y, 0.0);
          float svPh = uTime * (1.3 + uWind * 1.6) + svBase.x * 0.21 + svBase.z * 0.17;
          float svWave = sin(svPh) + 0.45 * sin(svPh * 2.3 + 1.7);
          float svAmt = (0.035 * svH + 0.0035 * svH * svH) * (0.15 + uWind) * 0.5;
          transformed.x += svWave * svAmt;
          transformed.z += cos(svPh * 0.8 + 0.6) * svAmt * 0.6;
        #endif`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 svW = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          svW = instanceMatrix * svW;
        #endif
        #ifdef USE_BATCHING
          svW = batchingMatrix * svW;
        #endif
        vToonPos = (modelMatrix * svW).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uLit; uniform vec3 uShadow; uniform vec3 uShadowTint; uniform float uT0; uniform float uT1;
        uniform float uTime; uniform vec3 uSkyHorizon; uniform vec4 uWaterRect; uniform float uAlgae;
        uniform vec3 uFieldA; uniform vec3 uFieldB;
        uniform float uWet; uniform float uSnow; uniform float uRain;
        ${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        #ifdef SV_FIELD
          // crop rows (N-S) as painted stripes plus large patch variation, colours from the crop calendar
          float patchN = svFbm(vToonPos.xz * 0.02);
          vec3 fc = mix(uFieldA, uFieldB, smoothstep(0.35, 0.65, patchN));
          float rows = 0.5 + 0.5 * sin(vToonPos.x * 6.2831 / 0.9);
          diffuseColor.rgb = fc * (1.0 - 0.18 * rows);
        #endif`)
      .replace('#include <opaque_fragment>', `
        vec3 svBase = max(diffuseColor.rgb, vec3(1e-4));
        vec3 svLight = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) / svBase;
        float svL = dot(svLight, vec3(0.2126, 0.7152, 0.0722));
        float svF = smoothstep(uT0, uT1, svL);
        vec3 svToon = mix(svBase * uShadowTint * uShadow, svBase * uLit, svF);
        // brush-like variation and soft grime toward the ground
        float svB = svFbm(vToonPos.xz * 0.35 + vToonPos.y * 0.2) + svNoise(vToonPos.xz * 6.0 + vToonPos.y * 3.0) - 1.0;
        svToon *= 1.0 + svB * 0.12;
        svToon *= mix(0.8, 1.0, clamp(vToonPos.y / 1.2, 0.0, 1.0));
        // ---- climate on the ground (not the clouds high up)
        #ifndef SV_DRY
        if (vToonPos.y < 60.0) {
          vec3 svN = inverseTransformDirection(normal, viewMatrix);
          float svUp = abs(svN.y);
          if (uWet > 0.001) {
            // wet things go darker; puddles collect on flat low ground and mirror the sky
            svToon *= 1.0 - uWet * (0.22 + 0.14 * svUp);
            float svPud = smoothstep(0.66, 0.71, svFbm(vToonPos.xz * 0.22)) * step(0.9, svUp) * step(vToonPos.y, 0.5) * uWet;
            vec3 svV = normalize(cameraPosition - vToonPos);
            float svFr = pow(1.0 - clamp(svV.y, 0.0, 1.0), 2.0);
            float svDrop = uRain * smoothstep(0.92, 1.0, svNoise(vToonPos.xz * 5.0 + vec2(uTime * 7.0, -uTime * 5.0)));
            svToon = mix(svToon, uSkyHorizon * (0.32 + 0.3 * svFr) + svDrop * 0.15, svPud * (0.45 + 0.4 * svFr));
          }
          if (uSnow > 0.001) {
            // lying snow on upward faces, patchy while it is thin
            float svSn = svFbm(vToonPos.xz * 0.5 + vToonPos.y * 0.3);
            float svCover = smoothstep(0.45, 0.7, svN.y + (svSn - 0.5) * 0.45) * smoothstep(1.05 - uSnow, 1.2 - uSnow, svSn + 0.35 * uSnow);
            vec3 svSnow = vec3(0.92, 0.95, 1.0) * mix(uShadowTint * uShadow * 1.15, uLit, svF);
            svToon = mix(svToon, svSnow, clamp(svCover, 0.0, 1.0));
          }
        }
        #endif
        bool svWater = false;
        #ifdef SV_WATER
          svWater = true;
        #endif
        #if defined(SV_PALETTE) && defined(USE_MAP)
          svWater = vMapUv.x > uWaterRect.x && vMapUv.x < uWaterRect.z && vMapUv.y > uWaterRect.y && vMapUv.y < uWaterRect.w;
        #endif
        if (svWater) {
          vec3 V = normalize(cameraPosition - vToonPos);
          float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
          float rip = svNoise(vToonPos.xz * 1.6 + vec2(uTime * 0.35, -uTime * 0.27)) * svNoise(vToonPos.xz * 2.3 - vec2(uTime * 0.22, uTime * 0.31));
          vec3 deep = vec3(0.06, 0.2, 0.17);
          vec3 w = mix(deep, uSkyHorizon * 0.85, 0.18 + 0.62 * fres) + (rip - 0.25) * 0.06;
          float alg = smoothstep(0.62 - uAlgae * 0.3, 0.66 - uAlgae * 0.3, svFbm(vToonPos.xz * 0.08));
          w = mix(w, vec3(0.5, 0.64, 0.16) * mix(uShadowTint * uShadow, uLit, 0.7), alg);
          if (uRain > 0.001) {
            // raindrop rings: one per small cell, each on its own beat
            vec2 svC = floor(vToonPos.xz * 1.4), svF2 = fract(vToonPos.xz * 1.4) - 0.5;
            float svP = fract(uTime * 1.1 + svHash(svC));
            vec2 svO = (vec2(svHash(svC + 3.1), svHash(svC + 7.7)) - 0.5) * 0.5;
            float svR = length(svF2 - svO);
            float svRing = smoothstep(0.035, 0.0, abs(svR - svP * 0.45)) * (1.0 - svP);
            w += svRing * uRain * 0.22 * (1.0 - alg);
            w *= 1.0 - 0.15 * uRain;
          }
          svToon = w * mix(vec3(1.0), uLit, 0.3);
        }
        outgoingLight = svToon;
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => `sv-toon-${kind}${sway ? '-sway' : ''}${weather ? '' : '-dry'}`;
  return mat;
}
