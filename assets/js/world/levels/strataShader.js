// GLSL for the rock-layers block. The fragment shader runs the model's history backwards per pixel (the same loop as
// strataModel.js classify()), so the picture always matches what a click reports. Rock textures are procedural and are
// evaluated in "formation coordinates" (where the point was when its rock formed), so laminations, cross-beds, pebbles
// and joints tilt and flip with their layer. Units are metres.
import * as THREE from "three";
import { MAX_EVENTS, MAX_UNITS } from "./strataModel.js";

const NE = MAX_EVENTS, NU = MAX_UNITS;

export function makeUniforms() {
  return {
    uNEv: { value: 0 },
    uEvT: { value: new Array(NE).fill(-1) },
    uEvA: { value: Array.from({ length: NE }, () => new THREE.Vector4()) },
    uEvB: { value: Array.from({ length: NE }, () => new THREE.Vector4()) },
    uUnitA: { value: Array.from({ length: NU }, () => new THREE.Vector4()) },
    uUnitTint: { value: Array.from({ length: NU }, () => new THREE.Vector3(1, 1, 1)) },
    uTop: { value: 0 },
    uHover: { value: -1 },
    uSel: { value: -1 },
    uTime: { value: 0 },
    uBump: { value: 1 },
    uWet: { value: 0 },
    uDone: { value: new Array(NU).fill(0) },
  };
}

const GLSL_COMMON = /* glsl */ `
uniform int uNEv;
uniform float uEvT[${NE}];
uniform vec4 uEvA[${NE}];
uniform vec4 uEvB[${NE}];
uniform vec4 uUnitA[${NU}];
uniform vec3 uUnitTint[${NU}];
uniform float uDone[${NU}];
uniform float uTop, uHover, uSel, uTime, uBump, uWet;
varying vec3 vWP;
varying vec3 vWN;
float sPx = 0.01;   // metres per pixel at this fragment
float aa(float wl){ return smoothstep(2.5, 6.0, wl / sPx); }

float h13(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h13(i), h13(i + vec3(1,0,0)), f.x), mix(h13(i + vec3(0,1,0)), h13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h13(i + vec3(0,0,1)), h13(i + vec3(1,0,1)), f.x), mix(h13(i + vec3(0,1,1)), h13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
// Voronoi: x = distance to nearest feature, y = gap to the second nearest, z = cell id
vec3 vor(vec3 p){
  vec3 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = vec3(h13(i + g), h13(i + g + 19.1), h13(i + g + 47.3)) * 0.8 + 0.1;
    vec3 r = g + o - f; float d = dot(r, r);
    if (d < d1){ d2 = d1; d1 = d; id = h13(i + g + 5.7); } else if (d < d2) d2 = d;
  }
  return vec3(sqrt(d1), sqrt(d2) - sqrt(d1), id);
}

// history backwards: which unit is this present-day point in, and where was it when that rock formed?
// B.z = the land surface just before the event (−1e9: unchanged); points above the surface at that time map to unit 0
void classify(vec2 p, out float unit, out vec2 q, out float frac){
  q = p; unit = 0.0; frac = 0.0;
  float ceil = uTop;
  for (int i = ${NE - 1}; i >= 0; i--){
    if (i >= uNEv) continue;
    if (q.y > ceil + 1e-4) return;
    float ty = uEvT[i]; vec4 A = uEvA[i]; vec4 B = uEvB[i];
    if (ty < 0.5){                       // deposit: A = (unit, base, t, full)
      if (A.z > 0.0 && q.y >= A.y && q.y <= A.y + A.z){ unit = A.x; frac = (q.y - A.y) / A.w; return; }
    } else if (ty < 1.5){                // tilt: A = (cos, sin, cx, cy)
      vec2 d = q - A.zw; q = vec2(A.x * d.x + A.y * d.y, -A.y * d.x + A.x * d.y) + A.zw;
    } else if (ty < 2.5){                // dyke: A = (x0, dx, dy, half), B = (unit, topAt)
      float dist = abs((q.x - A.x) * A.z - q.y * A.y);
      if (dist < A.w && q.y <= B.y){ unit = B.x; frac = dist / A.w; return; }
    }
    if (B.z > -1e8) ceil = B.z;
  }
}

// ---------- rocks: colour, roughness and a height (m) for bump ----------
vec3 sandstone(vec3 p, float fr, float sd, out float h, out float rough){
  float n = fbm(p * vec3(1.1, 2.6, 1.1) + sd * 13.0);
  vec3 c = mix(vec3(0.80, 0.66, 0.46), vec3(0.90, 0.80, 0.62), n);
  // cross-bedded sets: inside each set the laminae slope one way
  float sy = p.y / 0.34 + sd * 3.0, set = floor(sy), sl = fract(sy);
  float dir = h13(vec3(set, sd * 7.0, 1.0)) > 0.5 ? 1.0 : -1.0;
  float lam = sin(((p.x * 0.5 * dir) + p.y + n * 0.05) * 140.0);
  c *= 1.0 - 0.06 * smoothstep(0.6, 1.0, lam) * aa(0.045) - 0.1 * smoothstep(0.06, 0.0, sl) * aa(0.02);
  // iron staining (Liesegang bands)
  float s = fbm(p * 0.55 + vec3(sd * 4.0));
  vec3 iron = vec3(0.70, 0.40, 0.20);
  c = mix(c, iron, smoothstep(0.52, 0.74, s) * 0.45 * (0.6 + 0.4 * sin(s * 60.0)));
  // grains, coarser at the base of the bed (graded bedding), plus scattered pebbles near the base
  float g = (vnoise(p * 34.0) - 0.5) * aa(0.03);
  c += g * 0.06 * (1.4 - fr);
  vec3 v = vor(p * 9.0 + sd * 3.0);
  float peb = (1.0 - smoothstep(0.0, 0.3, fr)) * step(0.72, v.z) * smoothstep(0.30, 0.22, v.x);
  c = mix(c, mix(vec3(0.92, 0.9, 0.86), vec3(0.45, 0.42, 0.4), h13(vec3(v.z * 91.0))), peb);
  h = 0.004 * g + 0.012 * n + 0.012 * peb * (0.3 - v.x);
  rough = 0.93;
  return c;
}
vec3 shale(vec3 p, float fr, float sd, out float h, out float rough){
  float n = fbm(p * vec3(1.5, 6.0, 1.5) + sd * 9.0);
  vec3 c = mix(vec3(0.33, 0.34, 0.35), vec3(0.47, 0.47, 0.46), n);
  float lam = sin(p.y * 95.0 + n * 3.0) * aa(0.066);
  c *= 1.0 + 0.035 * lam;
  float part = smoothstep(0.94, 1.0, sin(p.y * 22.0 + n * 1.5 + sd * 10.0)) * (0.6 + 0.4 * vnoise(p * vec3(0.4, 2.0, 0.4))) * aa(0.28);
  c *= 1.0 - 0.22 * part;
  c = mix(c, vec3(0.50, 0.42, 0.33), smoothstep(0.6, 0.8, fbm(p * 0.7 + 3.0)) * 0.35);   // weathering stains
  h = -0.012 + 0.004 * lam - 0.01 * part;
  rough = 0.82;
  return c;
}
vec3 limestone(vec3 p, float fr, float sd, out float h, out float rough){
  float n = fbm(p * 1.4 + sd * 5.0);
  vec3 c = mix(vec3(0.78, 0.76, 0.69), vec3(0.89, 0.87, 0.81), n);
  vec3 v = vor(p * 11.0 + sd * 2.0);                                   // shell fragments
  float frag = smoothstep(0.16, 0.10, v.x) * step(0.55, v.z);
  c = mix(c, v.z > 0.8 ? vec3(0.96, 0.95, 0.91) : vec3(0.62, 0.6, 0.55), frag * 0.7 * aa(0.09));
  float sty = smoothstep(0.035, 0.0, abs(fract(p.y * 2.1 + 0.07 * vnoise(p * 7.0) + sd) - 0.5) - 0.0);   // stylolites
  c *= 1.0 - 0.28 * sty;
  float jt = smoothstep(0.012, 0.0, abs(fract(p.x * 0.42 + sd + 0.12 * vnoise(p * vec3(1.5, 3.0, 1.5))) - 0.5)) * step(0.35, vnoise(vec3(floor(p.x * 0.42 + sd + 0.5), p.y * 1.3, sd)));   // joints, at right angles to bedding
  c *= 1.0 - 0.45 * jt;
  h = 0.012 + 0.006 * n + 0.004 * frag - 0.03 * jt - 0.006 * sty;
  rough = 0.72;
  return c;
}
vec3 conglomerate(vec3 p, float fr, float sd, out float h, out float rough){
  float sc = mix(2.6, 12.0, smoothstep(0.0, 0.8, fr));                 // big pebbles at the base, smaller up the bed
  vec3 v = vor(p * sc + sd * 5.0);
  float inside = smoothstep(0.43, 0.36, v.x);
  float k = v.z;
  vec3 pc = k < 0.3 ? vec3(0.58, 0.58, 0.6) : k < 0.5 ? vec3(0.92, 0.9, 0.86) : k < 0.65 ? vec3(0.6, 0.3, 0.24) : k < 0.85 ? vec3(0.32, 0.33, 0.33) : vec3(0.72, 0.62, 0.46);
  pc *= 0.85 + 0.3 * vnoise(p * 30.0);
  vec3 mtx = vec3(0.58, 0.48, 0.36) * (0.9 + 0.2 * vnoise(p * 28.0));
  vec3 c = mix(mtx, pc, inside);
  h = inside * sqrt(max(0.0, 0.18 - v.x * v.x)) / sc + 0.004 * vnoise(p * 28.0);
  rough = mix(0.95, 0.6, inside);
  return c;
}
vec3 coal(vec3 p, float fr, float sd, out float h, out float rough){
  float b = sin(p.y * 45.0 + vnoise(p * 3.0) * 4.0) * aa(0.14);
  vec3 c = vec3(0.075, 0.075, 0.08) * (1.0 + 0.25 * smoothstep(0.3, 1.0, b)) * (0.85 + 0.3 * vnoise(p * 6.0));
  float cx = p.x * 2.1 + 0.35 * vnoise(p * vec3(2.0, 4.0, 2.0));
  float cleat = smoothstep(0.03, 0.0, abs(fract(cx) - 0.5)) * step(0.45, vnoise(vec3(floor(cx), p.y * 6.0, 1.0))) * aa(0.1);
  c *= 1.0 - 0.5 * cleat;
  h = -0.004 - 0.008 * cleat;
  rough = mix(0.55, 0.32, smoothstep(0.3, 1.0, b));
  return c;
}
vec3 tuff(vec3 p, float fr, float sd, out float h, out float rough){
  float n = fbm(p * 2.0 + sd * 6.0);
  vec3 c = mix(vec3(0.70, 0.66, 0.62), vec3(0.84, 0.79, 0.75), n);
  float sp = smoothstep(0.8, 0.86, vnoise(p * 40.0)) * aa(0.04);
  c = mix(c, vec3(0.32, 0.3, 0.29), sp * 0.6);
  vec3 v = vor(p * 12.0 + sd);
  float lap = (1.0 - smoothstep(0.0, 0.35, fr)) * smoothstep(0.32, 0.22, v.x) * step(0.5, v.z);   // lapilli settle first
  c = mix(c, vec3(0.93, 0.9, 0.86), lap);
  c *= 1.0 + 0.03 * sin(p.y * 60.0);
  h = 0.002 * sp + 0.006 * n + 0.01 * lap;
  rough = 0.95;
  return c;
}
vec3 granite(vec3 p, float sd, out float h, out float rough){
  vec3 v = vor(p * 16.0);
  float k = v.z;
  vec3 c = k < 0.5 ? vec3(0.72, 0.55, 0.5) : k < 0.72 ? vec3(0.8, 0.78, 0.76) : k < 0.92 ? vec3(0.56, 0.55, 0.56) : vec3(0.2, 0.2, 0.21);
  c = mix(vec3(0.6, 0.5, 0.48), c, aa(0.06));
  vec3 v2 = vor(p * 3.0 + 7.0);                                   // larger mottling so it reads as granite from a distance
  c *= 0.82 + 0.3 * v2.z;
  c = mix(c, c * vec3(1.08, 0.9, 0.88), smoothstep(0.4, 0.7, fbm(p * 0.9)));
  c *= 0.92 + 0.16 * vnoise(p * 40.0) * aa(0.025);
  c = mix(c, vec3(0.6, 0.5, 0.42), smoothstep(0.55, 0.8, fbm(p * 0.8)) * 0.3);
  h = 0.004 * k - 0.004 * smoothstep(0.05, 0.0, v.y);
  rough = 0.66;
  return c;
}
vec3 dolerite(vec3 p, float fr, out float h, out float rough){
  vec3 c = vec3(0.17, 0.2, 0.19) * (0.9 + 0.2 * vnoise(p * 18.0));
  c = mix(c, vec3(0.45, 0.47, 0.45), smoothstep(0.74, 0.8, vnoise(p * 50.0)) * 0.6 * aa(0.03) * (1.0 - smoothstep(0.6, 0.95, fr)));   // fine crystals; glassy chilled margins
  c *= 1.0 - 0.3 * smoothstep(0.8, 1.0, fr);
  c = mix(c, vec3(0.45, 0.33, 0.22), smoothstep(0.6, 0.85, fbm(p * 1.2)) * 0.35);   // rusty weathering
  h = 0.02 + 0.003 * vnoise(p * 18.0);
  rough = 0.6;
  return c;
}
vec3 claystone(vec3 p, float fr, float sd, out float h, out float rough){
  float m = smoothstep(0.4, 0.62, fbm(p * vec3(1.4, 2.4, 1.4) + sd * 8.0));
  vec3 c = mix(vec3(0.5, 0.32, 0.26), vec3(0.5, 0.47, 0.42), m * 0.55);
  c *= 1.0 + 0.04 * sin(p.y * 70.0 + vnoise(p * 3.0) * 2.0);
  c *= 0.92 + 0.16 * vnoise(p * 20.0);
  h = -0.014 + 0.003 * vnoise(p * 20.0);
  rough = 0.9;
  return c;
}

vec3 rockColor(int id, vec3 p, float fr, float sd, out float h, out float rough){
  if (id == 1) return sandstone(p, fr, sd, h, rough);
  if (id == 2) return shale(p, fr, sd, h, rough);
  if (id == 3) return limestone(p, fr, sd, h, rough);
  if (id == 4) return conglomerate(p, fr, sd, h, rough);
  if (id == 5) return coal(p, fr, sd, h, rough);
  if (id == 6) return tuff(p, fr, sd, h, rough);
  if (id == 7) return dolerite(p, fr, h, rough);
  if (id == 8) return claystone(p, fr, sd, h, rough);
  if (id == 9){
    // coal measures: thin beds of shale, sandstone and coal; a thick coal seam at the top (the Bulli Seam)
    float b = fr * 9.0 + 0.25 * vnoise(p * 1.5);
    float k = h13(vec3(floor(b), 3.0, sd));
    if (fr > 0.9 || k > 0.8) return coal(p, fract(b), sd, h, rough);
    if (k > 0.45) return sandstone(p * vec3(1.0, 1.6, 1.0), fract(b), sd + 0.3, h, rough) * vec3(0.86, 0.86, 0.9);
    return shale(p, fract(b), sd, h, rough);
  }
  return granite(p, sd, h, rough);
}
`;

/** Patch a MeshStandardMaterial into the strata material. */
export function strataMaterial(U) {
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\n" + GLSL_COMMON)
      .replace("#include <color_fragment>", /* glsl */ `#include <color_fragment>
        float sUnit; vec2 sQ; float sFrac;
        classify(vWP.xy, sUnit, sQ, sFrac);
        int ui = int(sUnit + 0.5);
        vec4 UA = uUnitA[ui];                       // (rock id, seed, full thickness, base)
        float sH, sRough;
        sPx = max(1e-4, length(fwidth(vWP)));
        vec3 rc = rockColor(int(UA.x + 0.5), vec3(sQ, vWP.z), sFrac, UA.y, sH, sRough) * uUnitTint[ui];
        // graded base: in these beds (river sand, flood gravel, ash fall) coarse grains settle first, so each bed fines upwards.
        // This normal grading is the way-up clue on overturned cliffs. Mud, lime and coal beds are drawn ungraded.
        int rid = int(UA.x + 0.5);
        if (rid == 1 || rid == 4 || rid == 6) {
          float gb = 1.0 - smoothstep(0.0, 0.4, sFrac);                 // strongest at the base, gone by 40 % up the bed
          float sc = mix(6.0, 14.0, smoothstep(0.0, 0.4, sFrac));        // and the grains get smaller upward
          vec3 gv = vor(vec3(sQ, vWP.z) * sc + UA.y * 9.0);
          float grit = gb * smoothstep(0.46, 0.3, gv.x) * step(0.15, gv.z);
          vec3 gc = gv.z > 0.7 ? vec3(0.16, 0.15, 0.15) : gv.z > 0.45 ? vec3(0.5, 0.3, 0.22) : vec3(0.93, 0.91, 0.87);
          gc *= 0.8 + 0.4 * smoothstep(0.46, 0.1, gv.x);                 // rounded grains: lit centres
          rc = mix(rc * (1.0 - 0.38 * gb), gc, min(1.0, grit * 1.1));   // the coarse base reads darker and grittier
          sH += grit * 0.025 * (0.46 - gv.x);
        }
        // a fine dark seam at each bedding plane
        if (UA.x > 0.5 && UA.x < 6.5 || UA.x > 7.5) rc *= 1.0 - 0.25 * smoothstep(0.035, 0.0, sFrac * UA.z);
        // weathering: soft blotches, and dark streaks where rain water runs down the cliff face
        float side = 1.0 - step(0.5, abs(vWN.y));
        float macro = fbm(vWP * 0.35 + 11.0);
        rc *= 0.86 + 0.24 * macro;
        float streak = smoothstep(0.55, 0.85, fbm(vec3(vWP.x * 2.2 + vWP.z * 2.2, vWP.y * 0.12, 3.0))) * side;
        rc *= 1.0 - 0.22 * streak;
        if (vWN.y > 0.5) rc *= 0.92;                 // the top surface is weathered
        if (vWN.y < -0.5) rc *= 0.55;
        float wet = uWet * step(0.5, vWN.y);
        rc *= 1.0 - 0.35 * wet; sRough = mix(sRough, 0.25, wet);
        vec3 sEmit = vec3(0.0);
        if (abs(sUnit - uHover) < 0.5) sEmit += rc * 0.16 + vec3(0.012);
        if (abs(sUnit - uSel) < 0.5) sEmit += vec3(0.05, 0.035, 0.0) * (0.7 + 0.3 * sin(uTime * 4.0)) + rc * 0.08;
        if (uDone[ui] > 0.5) rc = mix(rc, rc * vec3(0.92, 1.04, 0.95), 0.6);
        diffuseColor.rgb = rc;`)
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = sRough;")
      .replace("#include <normal_fragment_maps>", /* glsl */ `#include <normal_fragment_maps>
        {
          vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
          float hx = dFdx(sH), hy = dFdy(sH);
          vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
          float det = dot(dpdx, r1);
          vec3 grad = sign(det) * (hx * r1 + hy * r2);
          normal = normalize(abs(det) * normal - uBump * grad);
        }`)
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += sEmit;");
  };
  m.customProgramCacheKey = () => "strata1";
  return m;
}
