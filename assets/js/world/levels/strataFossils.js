// Procedural fossil geometry for the rock-layers station. Every geometry is about 1 unit across, lies in the x–y plane
// and bulges towards +z (the side that faces out of the cliff). Built once and shared by the InstancedMeshes in strata.js.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const TAU = Math.PI * 2;

/** Displace a geometry's vertices with f(x, y, z) → [x, y, z]; recompute normals. */
function shape(g, f) {
  const p = g.attributes.position, v = [0, 0, 0];
  for (let i = 0; i < p.count; i++) {
    v[0] = p.getX(i); v[1] = p.getY(i); v[2] = p.getZ(i);
    const r = f(v[0], v[1], v[2]);
    p.setXYZ(i, r[0], r[1], r[2]);
  }
  g.computeVertexNormals();
  return g;
}
const strip = (g) => { for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k); return g; };

/** Tube along a list of points with a radius per point. */
function varTube(pts, radii, radial = 14) {
  const pos = [], idx = [];
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), up = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    T.subVectors(b, a).normalize();
    N.crossVectors(up, T).normalize();
    B.crossVectors(T, N).normalize();
    for (let j = 0; j < radial; j++) {
      const t = (j / radial) * TAU, r = radii[i];
      pos.push(pts[i].x + (N.x * Math.cos(t) + B.x * Math.sin(t)) * r, pts[i].y + (N.y * Math.cos(t) + B.y * Math.sin(t)) * r, pts[i].z + (N.z * Math.cos(t) + B.z * Math.sin(t)) * r * 0.75);
    }
  }
  for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = a + radial, d = b + radial;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function trilobite() {
  // head shield (cephalon), segmented thorax with a raised central lobe, small tail (pygidium)
  const g = new THREE.SphereGeometry(0.5, 48, 32);
  return strip(shape(g, (x, y, z) => {
    const ly = y * 2;                                     // −1 … 1 along the body (head at +1)
    const w = 0.62 * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, -ly - 0.2) / 1.0, 2))) * (ly > 0.55 ? 1.08 : 1);
    let X = x * w * 2, Y = y * 1.0, Z = z * 0.32;
    if (Z > 0) {
      const ax = Math.abs(X);
      const lobe = Math.exp(-Math.pow(ax / 0.09, 2)) * 0.07;                 // raised axial lobe
      const seg = ly < 0.55 && ly > -0.75 ? Math.max(0, Math.cos(ly * Math.PI * 7)) * 0.025 * (1 - ax * 1.2) : 0;   // thorax segments
      const eye = ly > 0.6 ? Math.exp(-(Math.pow(ax - 0.17, 2) + Math.pow(ly - 0.78, 2)) / 0.003) * 0.05 : 0;
      const furrow = -Math.exp(-Math.pow((ax - 0.12) / 0.03, 2)) * 0.02;
      Z += lobe + seg + eye + furrow;
    }
    if (ly < -0.75) X *= 0.8;
    return [X, Y, Z];
  }));
}

function ammonite() {
  // a planar logarithmic coil with ribs; inner whorls show
  const pts = [], radii = [];
  const turns = 3.4, n = 260;
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * turns * TAU;
    const r = 0.035 * Math.exp(0.155 * t);
    pts.push(new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r, 0));
    radii.push(r * 0.42 * (1 + 0.09 * Math.max(0, Math.sin(t * 9))));
  }
  const g = varTube(pts, radii, 12);
  g.computeBoundingSphere();
  const s = 0.5 / g.boundingSphere.radius;
  g.scale(s, s, s);
  g.translate(-g.boundingSphere.center.x * s, -g.boundingSphere.center.y * s, 0);
  return g;
}

function shellFan(ribs = 22, flat = 0.32) {
  // brachiopod / clam: a ribbed fan-shaped valve with a beak
  const g = new THREE.SphereGeometry(0.5, 48, 24, 0, TAU, 0, Math.PI / 2);
  g.rotateX(Math.PI / 2);   // dome towards +z
  return strip(shape(g, (x, y, z) => {
    const a = Math.atan2(y, x), r = Math.hypot(x, y);
    const rib = 1 + 0.035 * Math.cos(a * ribs) * (r / 0.5);
    const beak = y < 0 ? 1 - 0.35 * Math.pow(-y / 0.5, 2) * (1 - Math.abs(x)) : 1;
    return [x * rib * beak * 1.05, y * 0.86 * rib, z * flat * rib];
  }));
}

function fish() {
  const body = shape(new THREE.SphereGeometry(0.5, 40, 20), (x, y, z) => {
    const t = x / 0.5;                                     // −1 tail … 1 head
    const h = 0.26 * Math.pow(Math.max(0, 1 - t * t), 0.6) * (t > 0 ? 1 : 0.85 + 0.15 * (1 + t));
    let Z = z * 0.12;
    if (Z > 0) Z += 0.012 * Math.max(0, Math.cos(t * 26)) * (Math.abs(y) < h * 0.6 * 2 ? 1 : 0);   // ribs
    return [x, y * 2 * h, Z];
  });
  const tail = new THREE.ConeGeometry(0.17, 0.26, 3, 1);
  tail.rotateZ(-Math.PI / 2); tail.scale(1, 1.2, 0.15); tail.translate(-0.56, 0, 0);
  const fin = new THREE.ConeGeometry(0.07, 0.18, 3, 1);
  fin.scale(1.4, 1, 0.12); fin.translate(0.05, 0.15, 0);
  return mergeGeometries([strip(body), strip(tail), strip(fin)].map((g) => g.toNonIndexed()));
}

function fern() {
  const parts = [];
  const stem = varTube(Array.from({ length: 30 }, (_, i) => new THREE.Vector3(Math.sin(i / 29 * 1.2) * 0.06, -0.5 + i / 29, 0)), Array.from({ length: 30 }, (_, i) => 0.012 * (1 - i / 40)), 6);
  parts.push(stem.toNonIndexed());
  for (let i = 1; i < 18; i++) for (const side of [-1, 1]) {
    const y = -0.45 + i * 0.053, len = 0.26 * Math.sin((i / 18) * Math.PI) + 0.05;
    const leaf = new THREE.SphereGeometry(0.5, 10, 6);
    leaf.scale(len, 0.045, 0.02);
    leaf.translate(side * len * 0.5, 0, 0.01);
    leaf.rotateZ(side * 0.35);
    leaf.translate(Math.sin((y + 0.5) * 1.2) * 0.06, y, 0);
    parts.push(strip(leaf).toNonIndexed());
  }
  return mergeGeometries(parts);
}

function leafBlade(w = 0.3, curve = 0.08, glosso = false) {
  const g = new THREE.SphereGeometry(0.5, 36, 18);
  return strip(shape(g, (x, y, z) => {
    const t = y / 0.5;
    const width = glosso ? w * Math.pow(Math.max(0, 1 - Math.pow((t - 0.15) / 1.15, 2)), 0.7) : w * Math.pow(Math.max(0, 1 - t * t), 0.8) * (1 - 0.25 * t);
    const X = x * 2 * width + curve * t * t;
    let Z = z * 0.05;
    if (Z > 0) Z += 0.012 * Math.exp(-Math.pow((X - curve * t * t) / 0.015, 2)) + (glosso ? 0.004 * Math.cos(Math.atan2(X, t) * 40) : 0);   // midrib, net veins
    return [X, y, Z];
  }));
}

function bone(len = 1) {
  const g = new THREE.CapsuleGeometry(0.1, 0.7 * len, 8, 24);
  g.rotateZ(Math.PI / 2);
  return strip(shape(g, (x, y, z) => {
    const e = Math.abs(x) / (0.45 * len);
    const knob = e > 0.75 ? 1 + 0.9 * Math.pow((e - 0.75) / 0.25, 1.5) * (0.8 + 0.4 * Math.abs(Math.sin(Math.atan2(y, z) * 2))) : 1 - 0.15 * Math.sin(e * Math.PI);
    return [x, y * knob, z * knob * 0.8];
  }));
}

function sharkTooth() {
  const g = new THREE.ConeGeometry(0.3, 0.8, 24, 6);
  return strip(shape(g, (x, y, z) => {
    const serr = 1 + 0.03 * Math.sin(y * 60);
    const root = y < -0.32 ? 1.25 : 1;
    return [x * serr * root, y, z * 0.28];
  }));
}

export const FOSSIL_GEOMS = {
  trilobite: { geo: trilobite, size: 0.6, stone: "#5a5048", alive: "#8a5a3c" },
  brachiopod: { geo: () => shellFan(26, 0.32), size: 0.45, stone: "#e5dac3", alive: "#c9a27a" },
  shell: { geo: () => shellFan(16, 0.28), size: 0.45, stone: "#efe6d2", alive: "#d8b48e" },
  fish: { geo: fish, size: 0.85, stone: "#4c4640", alive: "#8fb6c9" },
  fern: { geo: fern, size: 0.8, stone: "#2b2925", alive: "#4f8a3a" },
  glossopteris: { geo: () => leafBlade(0.2, 0.02, true), size: 0.65, stone: "#2f2b26", alive: "#5c8a3f" },
  leaf: { geo: () => leafBlade(0.17, 0.08), size: 0.55, stone: "#3b342b", alive: "#6f9a4a" },
  ammonite: { geo: ammonite, size: 0.7, stone: "#cdb99b", alive: "#b98a5c" },
  dinoBone: { geo: () => bone(1), size: 1.1, stone: "#7b5b43", alive: "#d8c4a8" },
  mammalBone: { geo: () => bone(0.7), size: 0.75, stone: "#86684e", alive: "#e0d0b8" },
  sharkTooth: { geo: sharkTooth, size: 0.35, stone: "#3f3a35", alive: "#f1ece2" },
};
