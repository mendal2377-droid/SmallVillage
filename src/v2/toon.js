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
 */
export function makeToon({kind = 'palette', map = null, color = null, opacity = 1, algae = 0, local = {}} = {}) {
  const mat = new THREE.MeshLambertMaterial({map, color: color ?? 0xffffff, side: THREE.DoubleSide,
    transparent: opacity < 1, opacity});
  mat.defines = mat.defines || {};
  if (kind === 'water') mat.defines.SV_WATER = '';
  if (kind === 'field') mat.defines.SV_FIELD = '';
  if (kind === 'palette') mat.defines.SV_PALETTE = '';
  const u = {...toonUniforms, uAlgae: {value: algae}, ...local};
  mat.userData.svUniforms = u;  // uniform objects are shared by reference: update .value to change the shader
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vToonPos;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 svW = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          svW = instanceMatrix * svW;
        #endif
        vToonPos = (modelMatrix * svW).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uLit; uniform vec3 uShadow; uniform vec3 uShadowTint; uniform float uT0; uniform float uT1;
        uniform float uTime; uniform vec3 uSkyHorizon; uniform vec4 uWaterRect; uniform float uAlgae;
        uniform vec3 uFieldA; uniform vec3 uFieldB;
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
          svToon = w * mix(vec3(1.0), uLit, 0.3);
        }
        outgoingLight = svToon;
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => `sv-toon-${kind}`;
  return mat;
}
