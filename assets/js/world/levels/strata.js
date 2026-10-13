// Station 1: Rock layers (Y8 7.3.8, the law of superposition and relative age).
// A cut-away block of ground, 14 m wide. Build mode: choose where sediment comes from and watch each layer settle on top of
// the last, burying living things as fossils; then tilt it, wear it down, cut it with a dyke or turn it over.
// Date the cliff: challenge cliffs (flat, tilted, the real Illawarra escarpment; Extension: dyke, overturned) where students
// tap the layers from oldest to youngest. All geometry comes from strataModel.js; the rock is drawn by strataShader.js.
// Units: 1 world unit = 1 m.
import * as THREE from "three";
import * as K from "../../kit.js";
import { softDot } from "../materials.js";
import { createStrata, makeCliff, W, D, BOTTOM, ROCKS, ENVS, ENV, FOSSILS, MAX_EVENTS, MAX_UNITS, rng } from "./strataModel.js";
import { makeUniforms, strataMaterial } from "./strataShader.js";
import { FOSSIL_GEOMS } from "./strataFossils.js";
import * as C from "./strataContent.js";

const MAX_TOP = 11.5;
const TOPICS = ["superposition", "relative-dating", "fossils", "sedimentary-rocks"];
const WATER = {
  sea: { depth: 2.4, color: "#3f9bb5", opacity: 0.32 },
  deep: { depth: 3.6, color: "#1f4f72", opacity: 0.45 },
  river: { depth: 0.9, color: "#6f8f6a", opacity: 0.38 },
  swamp: { depth: 0.55, color: "#4d5a32", opacity: 0.5 },
};

function injectCss() {
  if (document.getElementById("dt-strata-css")) return;
  const s = document.createElement("style");
  s.id = "dt-strata-css";
  s.textContent = `
    .lbl3d.dt-letter { font: 700 15px/1 "Space Grotesk", Inter, sans-serif; color: #fff; background: rgba(12,18,28,0.78); border: 1px solid rgba(255,255,255,0.35);
      padding: 4px 7px; border-radius: 8px; pointer-events: none; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
    .lbl3d.dt-letter small { font: 600 11px/1 Inter, sans-serif; opacity: 0.85; margin-left: 4px; }
    .lbl3d.dt-letter.ok { background: rgba(21,128,61,0.88); border-color: rgba(187,247,208,0.7); }
    .lbl3d.dt-letter.num { background: rgba(180,83,9,0.9); border-color: rgba(253,230,138,0.7); }
    .dt-envs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 6px 0 10px; }
    .dt-envs button { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 7px 4px; font-size: 0.74rem; line-height: 1.15; }
    .dt-envs button i { width: 26px; height: 12px; border-radius: 3px; display: block; border: 1px solid rgba(0,0,0,0.25); }
    .dt-envs button[aria-pressed="true"] { outline: 2px solid var(--accent); outline-offset: 0; }
    .dt-col { display: flex; gap: 10px; align-items: stretch; }
    .dt-col .bar { width: 46px; display: flex; flex-direction: column-reverse; border-radius: 4px; overflow: hidden; border: 1px solid var(--line, rgba(127,127,127,0.35)); min-height: 150px; }
    .dt-col .bar div { min-height: 3px; }
    .dt-col ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column-reverse; justify-content: space-between; font-size: 0.78rem; color: var(--ink-dim); flex: 1; }
    .dt-col ol li b { color: var(--ink); }
    .dt-progress { font-size: 0.82rem; color: var(--ink-dim); margin: 6px 0; }
    .dt-fb { font-size: 0.85rem; margin: 8px 0 0; padding: 8px 10px; border-radius: 8px; background: rgba(127,127,127,0.12); }
    .dt-fb.good { background: rgba(34,197,94,0.15); }
    .dt-fb.bad { background: rgba(239,68,68,0.13); }
    .dt-law { font-size: 0.86rem; line-height: 1.45; margin: 0 0 10px; }
    .dt-mix li { margin-bottom: 6px; } .dt-mix s { color: var(--ink-faint); }`;
  document.head.appendChild(s);
}

/** A soft round contact shadow under the block. */
function shadowTex() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 256;
  const g = cv.getContext("2d");
  const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  gr.addColorStop(0, "rgba(0,0,0,0.55)"); gr.addColorStop(0.55, "rgba(0,0,0,0.22)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(cv);
}

/** A small tree-fern: trunk plus a crown of fronds (swamp forest, buried to make coal). */
function treeFernGeometry() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.07, 0.11, 2.2, 8, 4); trunk.translate(0, 1.1, 0);
  parts.push(trunk);
  for (let i = 0; i < 9; i++) {
    const f = new THREE.PlaneGeometry(0.22, 1.3, 1, 6);
    const p = f.attributes.position;
    for (let k = 0; k < p.count; k++) { const y = p.getY(k) + 0.65; p.setXYZ(k, p.getX(k) * (1 - y / 1.5), y, -0.25 * y * y); }
    f.rotateX(-0.9); f.rotateY((i / 9) * Math.PI * 2); f.translate(0, 2.2, 0);
    parts.push(f);
  }
  const pos = [], nor = [], col = [];
  parts.forEach((g, i) => {
    const n = g.toNonIndexed(); n.computeVertexNormals();
    pos.push(...n.attributes.position.array); nor.push(...n.attributes.normal.array);
    const c = i === 0 ? [0.33, 0.24, 0.16] : [0.3 + 0.05 * (i % 3), 0.48 + 0.04 * (i % 2), 0.2];
    for (let k = 0; k < n.attributes.position.count; k++) col.push(...c);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return g;
}

export function create(engine) {
  const lens = engine.lens;
  injectCss();
  const root = new THREE.Group();
  const U = makeUniforms();

  // ---------- state ----------
  let mode = "build";                         // "build" | "date"
  let buildS = createStrata({ seed: (Math.random() * 1e6) | 0 });
  let env = "river";
  let auto = false;
  let showNumbers = false;
  let selected = null;                         // { unit } or { fossil }
  let tiltDeg = 25;
  const ch = { kind: "flat", S: null, need: [], tapped: [], mistakes: 0, done: false, revealed: false, fb: "", fbKind: "", question: null, answered: false, seed: 1 };
  const tr = { envs: new Set(), oldest: false, fossil: false, flatClean: false, tiltOldest: false, illawarra: false, dyke: false, over: false };
  const M = () => (mode === "build" ? buildS : ch.S);

  // ---------- block ----------
  const blockGeo = new THREE.BoxGeometry(W, 1, D, 1, 1, 1);
  blockGeo.translate(0, 0.5, 0);
  const block = new THREE.Mesh(blockGeo, strataMaterial(U));
  block.userData.keepMaterial = true;
  block.position.y = BOTTOM;
  root.add(block);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.9, D * 2.6), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, opacity: 0.8 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = BOTTOM - 0.02;
  root.add(shadow);

  // ---------- lights (engine lights are tuned for cells: a daylight rig instead while mounted) ----------
  const lights = new THREE.Group();
  const sun = new THREE.DirectionalLight("#ffe6c2", 2.2); sun.position.set(-12, 15, 13);
  const sky = new THREE.HemisphereLight("#b4cfe8", "#5e5244", 0.4);
  const fill = new THREE.DirectionalLight("#c8dcff", 0.45); fill.position.set(14, 4, 6);
  lights.add(sun, sky, fill);
  root.add(lights);

  // ---------- fossils: one InstancedMesh per type ----------
  const fossilMeshes = {};
  const CAP = 24;
  for (const [type, def] of Object.entries(FOSSIL_GEOMS)) {
    const geo = def.geo();
    const mat = new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.62, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.6 });
    const im = new THREE.InstancedMesh(geo, mat, CAP);
    im.count = 0;
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
    im.userData.type = type; im.userData.recs = [];
    im.frustumCulled = false;
    fossilMeshes[type] = im;
    root.add(im);
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _c2 = new THREE.Color();

  function layoutFossils(S, t) {
    for (const im of Object.values(fossilMeshes)) { im.count = 0; im.userData.recs.length = 0; }
    const put = (f, alive, k) => {
      const im = fossilMeshes[f.type]; if (!im || im.count >= CAP) return;
      const def = FOSSIL_GEOMS[f.type];
      const sz = def.size * 1.35;
      if (alive) {
        // living on the sea floor or land surface, near the front edge
        const crawl = f.type === "trilobite" && !engine.reducedMotion ? Math.sin(t * 0.8 + f.rot * 5) * 0.4 : 0;
        _p.set(f.x + crawl, S.top + 0.05 * sz, D / 2 - 0.5);
        _e.set(-Math.PI / 2, 0, f.rot, "XYZ");
      } else {
        _p.set(f.px, f.py, D / 2 - 0.035 * sz);
        _e.set(0, 0, f.angle + (f.rot - Math.PI) * 0.12);
      }
      _q.setFromEuler(_e); _s.setScalar(sz);
      _m.compose(_p, _q, _s);
      im.setMatrixAt(im.count, _m);
      _c.set(def.stone);
      if (alive) _c.lerp(_c2.set(def.alive), k);
      im.setColorAt(im.count, _c);
      im.userData.recs.push(f);
      im.count++;
    };
    // buried fossils showing on the front face
    for (const f of S.visibleFossils()) put(f, false, 0);
    // living things on the surface of the layer being laid down (they get buried as it rises)
    const g = S.growing;
    if (g) for (const f of g.fossils) {
      const bury = f.f * g.full;
      if (g.t < bury - 0.35 || g.t >= bury) continue;
      put({ ...f, unit: g.id, living: true }, true, 1);
    }
    for (const im of Object.values(fossilMeshes)) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); }
    // a living organism that was selected has now been buried: drop the stale "alive" card
    if (selected?.fossil?.living && !Object.values(fossilMeshes).some((im) => im.userData.recs.some((r) => r.living && r.id === selected.fossil.id))) { selected = null; refreshPanel(); }
  }

  // ---------- deposition scene: water, falling sediment, swamp plants ----------
  const waterMat = new THREE.MeshPhysicalMaterial({ color: "#3f9bb5", transparent: true, opacity: 0, roughness: 0.08, metalness: 0, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });
  const water = new THREE.Mesh(new THREE.BoxGeometry(W, 1, D), waterMat);
  water.geometry.translate(0, 0.5, 0);
  water.visible = false;
  water.renderOrder = 2;
  root.add(water);
  const surfGeo = new THREE.PlaneGeometry(W, D, 42, 22); surfGeo.rotateX(-Math.PI / 2);
  const surfMat = new THREE.MeshPhysicalMaterial({ color: "#bfe3ee", transparent: true, opacity: 0, roughness: 0.04, metalness: 0, clearcoat: 1, depthWrite: false, envMapIntensity: 1.5 });
  const surf = new THREE.Mesh(surfGeo, surfMat);
  surf.visible = false; surf.renderOrder = 3;
  root.add(surf);
  const surfBase = surfGeo.attributes.position.array.slice();

  const NP = 260;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(NP * 3), pVel = new Float32Array(NP);
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ size: 0.12, map: softDot(), transparent: true, depthWrite: false, color: "#e2c48f", opacity: 0 });
  const grains = new THREE.Points(pGeo, pMat);
  grains.frustumCulled = false; grains.visible = false;
  root.add(grains);

  const fernGeo = treeFernGeometry();
  const ferns = new THREE.InstancedMesh(fernGeo, new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }), 16);
  ferns.count = 0; ferns.visible = false;
  root.add(ferns);
  const fernSpots = Array.from({ length: 16 }, (_, i) => [-W / 2 + 0.8 + ((i * 0.618) % 1) * (W - 1.6), -D / 2 + 0.7 + ((i * 0.381 + 0.2) % 1) * (D - 1.4), 0.75 + ((i * 0.53) % 1) * 0.5]);

  let fx = 0;   // deposition scene fade 0…1
  function sceneFor(u) { return u ? ENV[u.env] : null; }
  function resetGrain(i, e, top, h) {
    pPos[i * 3] = (Math.random() - 0.5) * (W - 0.4);
    pPos[i * 3 + 1] = top + Math.random() * h;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * (D - 0.4);
    pVel[i] = 0.35 + Math.random() * 0.5;
  }

  function updateScene(dt, t) {
    const S = M();
    const g = mode === "build" ? S.growing : null;
    const e = sceneFor(g);
    fx = THREE.MathUtils.clamp(fx + (g ? dt * 1.5 : -dt * 0.8), 0, 1);
    const last = e || lastEnv;
    if (e) lastEnv = e;
    const w = last && last.water ? WATER[last.water] : null;
    const vis = fx > 0.01 && !!last;
    // water above the growing layer
    water.visible = surf.visible = vis && !!w;
    if (w) {
      waterMat.color.set(w.color); waterMat.opacity = w.opacity * fx; surfMat.opacity = 0.45 * fx;
      water.position.y = S.top; water.scale.y = w.depth;
      surf.position.y = S.top + w.depth;
      const a = surfGeo.attributes.position.array, amp = engine.reducedMotion ? 0 : last.water === "river" ? 0.03 : 0.06;
      for (let i = 0; i < a.length; i += 3) a[i + 1] = surfBase[i + 1] + amp * (Math.sin(surfBase[i] * 1.3 + t * 1.6) + Math.sin(surfBase[i + 2] * 1.9 - t * 1.2) * 0.6);
      surfGeo.attributes.position.needsUpdate = true;
      surfGeo.computeVertexNormals();
    }
    U.uWet.value = vis && w ? fx : 0;
    // falling sediment
    grains.visible = vis;
    if (vis) {
      pMat.color.set(last.sediment);
      pMat.opacity = 0.85 * fx;
      pMat.size = last.id === "flood" ? 0.26 : last.id === "deepSea" ? 0.07 : 0.12;
      const h = w ? w.depth : 7;
      const drift = last.water === "river" ? 0.9 : 0;
      for (let i = 0; i < NP; i++) {
        let y = pPos[i * 3 + 1];
        if (!g || y < S.top || y > S.top + h + 0.5 || pPos[i * 3] === 0) { if (g) resetGrain(i, last, S.top, h); else continue; }
        const sp = (last.id === "flood" ? 1.6 : last.id === "deepSea" ? 0.35 : last.id === "volcano" ? 0.9 : 0.6) * pVel[i];
        pPos[i * 3 + 1] -= sp * dt;
        pPos[i * 3] += drift * dt;
        if (pPos[i * 3] > W / 2 - 0.1) pPos[i * 3] = -W / 2 + 0.1;
      }
      pGeo.attributes.position.needsUpdate = true;
    }
    // swamp forest: tree ferns standing on the growing peat
    const sw = g && g.env === "swamp";
    ferns.visible = !!sw;
    if (sw) {
      ferns.count = fernSpots.length;
      fernSpots.forEach(([x, z, s], i) => {
        _p.set(x, g.base + 0.02, z); _e.set(0, i * 1.7, (Math.sin(t * 0.5 + i) * 0.03) * (engine.reducedMotion ? 0 : 1)); _q.setFromEuler(_e); _s.setScalar(s);
        _m.compose(_p, _q, _s); ferns.setMatrixAt(i, _m);
      });
      ferns.instanceMatrix.needsUpdate = true;
    }
  }
  let lastEnv = null;

  // ---------- uniforms from the model ----------
  function sync(S) {
    U.uNEv.value = S.events.length;
    S.events.forEach((e, i) => {
      if (e.type === "deposit") { const u = S.units[e.unit]; U.uEvT.value[i] = 0; U.uEvA.value[i].set(u.id, u.base, u.t, u.full); U.uEvB.value[i].set(0, 0, u.base, 0); }
      else if (e.type === "tilt") { U.uEvT.value[i] = 1; U.uEvA.value[i].set(e.c, e.s, e.cx, e.cy); U.uEvB.value[i].set(0, 0, e.topBefore, 0); }
      else if (e.type === "dyke") { U.uEvT.value[i] = 2; U.uEvA.value[i].set(e.x0, e.dx, e.dy, e.half); U.uEvB.value[i].set(e.unit, e.topAt, -1e9, 0); }
      else { U.uEvT.value[i] = 3; U.uEvB.value[i].set(0, 0, e.topBefore, 0); }
    });
    S.units.forEach((u, i) => {
      U.uUnitA.value[i].set(ROCKS[u.rock].glsl, u.seed, u.full || 1, u.base || 0);
      U.uUnitTint.value[i].set(...u.tint);
      U.uDone.value[i] = mode === "date" && ch.tapped.includes(u.id) ? 1 : 0;
    });
    U.uTop.value = S.top;
    block.scale.y = Math.max(0.05, S.top - BOTTOM);
  }

  // ---------- labels on the cliff face ----------
  const labels = [];
  let labelSig = "";
  function clearLabels() { for (const l of labels) l.el.remove(); labels.length = 0; labelSig = ""; }
  function refreshLabels() {
    const S = M();
    let want = [];
    if (mode === "date" && S) {
      const vis = S.visibleUnits();
      const order = ch.need;
      for (const v of vis) {
        if (v.unit === 0) continue;
        const u = S.units[v.unit];
        const k = ch.tapped.indexOf(v.unit);
        const showNum = ch.revealed ? order.indexOf(v.unit) + 1 : k >= 0 ? k + 1 : 0;
        const cls = k >= 0 ? "ok" : ch.revealed ? "num" : "";
        const name = S.realPlace && (k >= 0 || ch.revealed) ? `<small>${u.name}</small>` : u.kind === "dyke" && (k >= 0 || ch.revealed) ? "<small>dyke</small>" : "";
        want.push({ x: v.x, y: v.y, html: `${showNum ? `${C.ord(showNum)} · ` : ""}${u.label}${name}`, cls });
      }
    } else if (mode === "build" && showNumbers && S) {
      const vis = S.visibleUnits();
      const layers = S.ageOrder().filter((u) => u.id !== 0);
      for (const v of vis) {
        if (v.unit === 0 || v.area < 0.004) continue;
        const k = layers.findIndex((u) => u.id === v.unit) + 1;
        const u = S.units[v.unit];
        want.push({ x: v.x, y: v.y, html: `${C.ord(k)}${u.kind === "dyke" ? "<small>dyke</small>" : ""}`, cls: "num" });
      }
    }
    const sig = JSON.stringify(want.map((w) => [w.html, w.cls, w.x.toFixed(1), w.y.toFixed(1)]));
    if (sig === labelSig) return;
    clearLabels();
    labelSig = sig;
    for (const w of want) {
      const el = engine.label(w.html, `dt-letter ${w.cls}`);
      labels.push({ el, v: new THREE.Vector3(w.x, w.y, D / 2 + 0.05) });
    }
  }
  function placeLabels() {
    for (const l of labels) engine.place(l.el, l.v);
  }

  // ---------- picking ----------
  const pickables = [block, ...Object.values(fossilMeshes)];
  const tip = { title: "", kind: "" };
  let hover = null;   // { unit } | { fossil }
  let lastPX = -1, lastPY = -1;
  const ray = new THREE.Raycaster();
  function hitAt(cx, cy) {
    engine.setRay(cx, cy);
    const hits = engine.ray.intersectObjects(pickables, false);
    for (const h of hits) {
      if (h.object === block) {
        const S = M(); const p = h.point;
        const c = S.classify(p.x, p.y);
        if (c.unit < 0) continue;
        return { unit: c.unit, point: p };
      }
      const rec = h.object.userData.recs?.[h.instanceId];
      if (rec) return { fossil: rec, unit: rec.unit, point: h.point };
    }
    return null;
  }
  function tipFor(h) {
    const S = M();
    if (!h) return "";
    const u = S.units[h.unit];
    if (h.fossil) {
      if (h.fossil.living) return `Living ${FOSSILS[h.fossil.type].name.toLowerCase().replace(/ (shell|bone|tooth|frond|leaf)$/, "")}`;
      return `Fossil: ${FOSSILS[h.fossil.type].name.toLowerCase()}`;
    }
    if (mode === "date") {
      if (h.unit === 0) return "Basement rock (leave it out)";
      return S.realPlace && (ch.tapped.includes(h.unit) || ch.revealed) ? `${u.label}: ${u.name}` : `${u.kind === "dyke" ? "Dyke" : "Layer"} ${u.label}${ch.done ? "" : " · tap to put it next"}`;
    }
    if (h.unit === 0) return "Basement rock (older than every layer)";
    if (u.kind === "dyke") return "Dyke (igneous rock)";
    return `Layer ${S.layers().indexOf(u) + 1}: ${u.name.toLowerCase()}`;
  }

  // ---------- actions ----------
  function deposit(id = env) {
    const S = buildS;
    if (S.growing) return;
    if (S.top > MAX_TOP) { engine.toast("The block is full. Wear the top away or start again."); auto = false; refreshPanel(); return; }
    if (S.events.length >= MAX_EVENTS || S.units.length >= MAX_UNITS) { engine.toast("That's as many events as this model can hold. Start again to build a new block."); auto = false; refreshPanel(); return; }
    S.deposit(id);
    tr.envs.add(id);
    selected = null;
    dirty = true;
    refreshPanel();
  }
  function doTilt(deg) {
    if (buildS.layers().length < 2) { engine.toast("Lay down at least two layers first."); return; }
    if (!buildS.tilt(deg)) return;
    dirty = true; selected = null;
    engine.toast(Math.abs(deg) >= 179 ? "Earth movements folded the layers right over: this stack is now upside down." : `The block was tilted ${Math.abs(Math.round(deg))}° by Earth movements, then the top was worn flat.`, 3600);
    refreshPanel();
  }
  function doDyke() {
    if (buildS.layers().length < 2) { engine.toast("Lay down at least two layers first."); return; }
    if (!buildS.intrude(-4 + Math.random() * 8, (Math.random() - 0.5) * 30, 0.7 + Math.random() * 0.4)) return;
    dirty = true; selected = null;
    engine.toast("Magma forced its way up a crack and cooled into a dyke.");
    refreshPanel();
  }
  function doErode() {
    if (!buildS.layers().length) return;
    if (!buildS.erode(1 + Math.random() * 0.6)) return;
    dirty = true; selected = null;
    refreshPanel();
  }
  function restart() {
    buildS = createStrata({ seed: (Math.random() * 1e6) | 0 });
    auto = false; selected = null; dirty = true;
    refreshPanel();
  }
  function newCliff(kind = ch.kind) {
    ch.kind = kind; ch.seed = (Math.random() * 1e6) | 0;
    ch.S = makeCliff(kind, ch.seed);
    const vis = new Set(ch.S.visibleUnits().map((v) => v.unit));
    ch.need = ch.S.ageOrder().filter((u) => u.id !== 0 && vis.has(u.id)).map((u) => u.id);
    Object.assign(ch, { tapped: [], mistakes: 0, done: false, revealed: false, fb: "", fbKind: "", question: null, answered: false });
    selected = null; dirty = true;
    refreshPanel();
    frameTo(ch.S);
  }
  function tap(unit) {
    if (ch.done || ch.revealed) return;
    const S = ch.S;
    if (ch.tapped.includes(unit)) { ch.fb = "You've already placed that one."; ch.fbKind = ""; refreshPanel(); return; }
    const want = ch.need[ch.tapped.length];
    if (unit === want) {
      ch.tapped.push(unit);
      const u = S.units[unit];
      ch.fb = ch.tapped.length === 1 ? `✅ ${S.realPlace ? u.name : u.kind === "dyke" ? "The dyke" : `Layer ${u.label}`} is the oldest.` : `✅ ${S.realPlace ? u.name : u.kind === "dyke" ? "The dyke" : `Layer ${u.label}`} is next.`;
      ch.fbKind = "good";
      if (ch.tapped.length === ch.need.length) finishCliff();
    } else {
      ch.mistakes++;
      ch.fb = C.wrongTap(S, unit, want, lens.band);
      ch.fbKind = "bad";
    }
    dirty = true;
    refreshPanel();
  }
  function finishCliff() {
    ch.done = true;
    const S = ch.S;
    const clean = ch.mistakes === 0;
    if (ch.kind === "flat" && clean) tr.flatClean = true;
    if (ch.kind === "illawarra") tr.illawarra = true;
    if (ch.kind === "dyke") tr.dyke = true;
    if (ch.kind === "overturned") tr.over = true;
    ch.fb = `🎉 All ${ch.need.length} in order${clean ? " with no mistakes" : ` (${ch.mistakes} mistake${ch.mistakes > 1 ? "s" : ""})`}. ${
      ch.kind === "overturned" ? "The oldest layer was on top: the stack had been turned over, so you had to work out which way was up first." :
      ch.kind === "dyke" ? "The dyke is younger than the layers it cuts, and older than the layer laid across its worn-down top." :
      ch.kind === "tilted" ? "Even tilted, each layer is still on top of the older ones: you follow the layers along the slope." :
      ch.kind === "illawarra" ? "The coal measures at the bottom formed in Permian swamps, around 260 million years ago; the Hawkesbury Sandstone on top is about 15 million years younger." :
      "The bottom layer formed first and the top layer last."}`;
    ch.fbKind = "good";
    ch.question = C.fossilQuestion(S, rng(ch.seed + 3));
    engine.toast("Cliff dated! 🎉");
  }

  // ---------- camera ----------
  const tanH = Math.tan(THREE.MathUtils.degToRad(19));
  function viewFor(S) {
    const top = S ? S.top : 0;
    const hh = (Math.max(top, 3) - BOTTOM) * 0.62 + 1.2, hw = W * 0.74;
    const asp = engine.camera.aspect || 1.5;
    const dist = Math.max(hh / tanH, hw / (tanH * asp)) * 1.05;
    return { target: new THREE.Vector3(0.6, (Math.max(top, 3) + BOTTOM) / 2, 0), distance: dist, dir: new THREE.Vector3(0.42, 0.3, 1) };
  }
  function frameTo(S) {
    const v = viewFor(S);
    engine.fly(v.target, v.target.clone().addScaledVector(v.dir.clone().normalize(), v.distance), 0.9);
  }

  // ---------- panel ----------
  let panelBuilt = false, panelRoot = null, quizHost = null, missionsApi = null;
  const els = {};
  let dirty = true;

  function buildPanel() {
    panelRoot = document.createElement("div");
    panelRoot.style.display = "contents";
    const band = lens.band;

    const intro = K.card(panelRoot, "Rock layers");
    intro.insertAdjacentHTML("beforeend", `<p class="dt-law">${C.P(C.LAW, band)}</p>`);
    els.modeSeg = K.segmented(intro, [{ value: "build", label: "Build layers" }, { value: "date", label: "Date the cliff" }], mode, (v) => setMode(v));

    // build mode
    els.build = K.card(panelRoot, "Lay down layers");
    els.build.insertAdjacentHTML("beforeend", `<p class="hint" style="margin:0">Where is the sediment coming from?</p>`);
    const grid = document.createElement("div"); grid.className = "dt-envs"; els.build.appendChild(grid);
    els.envBtns = ENVS.map((e) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn";
      b.innerHTML = `<i style="background:${ROCKS[e.rock].color}"></i>${e.label}<small style="opacity:.7">→ ${ROCKS[e.rock].name.split(" (")[0].toLowerCase()}</small>`;
      b.setAttribute("aria-pressed", String(e.id === env));
      b.addEventListener("click", () => { env = e.id; els.envBtns.forEach((x, i) => x.setAttribute("aria-pressed", String(ENVS[i].id === env))); });
      grid.appendChild(b);
      return b;
    });
    const r1 = K.buttonRow(els.build);
    els.depBtn = K.button(r1, "Lay down a layer", () => deposit(), { kind: "primary" });
    els.autoBtn = K.button(r1, "▶ Time-lapse", () => { auto = !auto; refreshPanel(); });
    els.build.insertAdjacentHTML("beforeend", `<p class="hint" style="margin:12px 0 4px">Then change the rocks</p>`);
    K.slider(els.build, { label: "Tilt angle", min: -45, max: 45, step: 5, value: tiltDeg, format: (v) => `${v > 0 ? "" : v < 0 ? "−" : ""}${Math.abs(v)}°`, onInput: (v) => (tiltDeg = v) });
    const r2 = K.buttonRow(els.build);
    els.tiltBtn = K.button(r2, "Tilt the block", () => { if (!tiltDeg) engine.toast("Set a tilt angle first."); else doTilt(tiltDeg); });
    els.erodeBtn = K.button(r2, "Wear the top away", () => doErode());
    if (lens.atLeast("ext")) {
      const r3 = K.buttonRow(els.build);
      els.dykeBtn = K.button(r3, "Intrude a dyke", () => doDyke());
      els.overBtn = K.button(r3, "Overturn (fold)", () => doTilt(180));
    }
    const r4 = K.buttonRow(els.build);
    K.button(r4, "Start again", () => restart());
    K.checkbox(els.build, "Number the rocks in order of formation", showNumbers, (v) => { showNumbers = v; dirty = true; });

    // date mode
    els.date = K.card(panelRoot, "Date the cliff");
    const kinds = lens.filter(C.CHALLENGES);
    els.kindSeg = K.segmented(els.date, kinds.map((k) => ({ value: k.id, label: k.label })), ch.kind, (v) => newCliff(v));
    els.kindSeg.el.style.flexWrap = "wrap";
    for (const bt of els.kindSeg.el.children) bt.style.flex = "1 0 30%";
    els.dateIntro = document.createElement("p"); els.dateIntro.style.margin = "10px 0 4px"; els.date.appendChild(els.dateIntro);
    els.dateProg = document.createElement("div"); els.dateProg.className = "dt-progress"; els.date.appendChild(els.dateProg);
    els.dateFb = document.createElement("div"); els.dateFb.className = "dt-fb"; els.dateFb.setAttribute("aria-live", "polite"); els.date.appendChild(els.dateFb);
    els.dateQ = document.createElement("div"); els.date.appendChild(els.dateQ);
    const r5 = K.buttonRow(els.date);
    K.button(r5, "New cliff", () => newCliff(ch.kind), { kind: "primary" });
    els.revealBtn = K.button(r5, "Show the answer", () => { ch.revealed = true; ch.fb = "Here is the true order (1st = oldest). Try a new cliff to score it yourself."; ch.fbKind = ""; dirty = true; refreshPanel(); });

    // selected
    els.sel = K.card(panelRoot, "Selected");
    els.selBody = document.createElement("div"); els.sel.appendChild(els.selBody);

    // column
    els.col = K.card(panelRoot, "Rock column (centre of the cliff)");
    els.colBody = document.createElement("div"); els.col.appendChild(els.colBody);

    els.what = K.card(panelRoot, "What's happening");
    els.whatBody = document.createElement("div"); els.what.appendChild(els.whatBody);

    missionsApi = K.missions(panelRoot, lens.filter(MISSIONS), (m) => engine.toast(`Mission complete: ${m.text}`));

    quizHost = document.createElement("div"); quizHost.style.display = "contents"; panelRoot.appendChild(quizHost);
    K.quiz(quizHost, lens.filter(C.QUIZ));

    const mix = K.card(panelRoot, "Common mix-ups");
    mix.insertAdjacentHTML("beforeend", `<ul class="dt-mix" style="margin:0;padding-left:18px;font-size:0.82rem">${C.MIXUPS.map((m) => `<li><s>${m.wrong}</s><br>${m.right}</li>`).join("")}</ul>`);
    const simp = K.card(panelRoot, "What's simplified");
    simp.insertAdjacentHTML("beforeend", `<ul style="margin:0;padding-left:18px;font-size:0.8rem;color:var(--ink-dim)">${C.SIMPLIFICATIONS.map((s) => `<li>${s}</li>`).join("")}</ul>`);
    const src = K.card(panelRoot, "Sources");
    src.insertAdjacentHTML("beforeend", `<ul style="margin:0;padding-left:18px;font-size:0.78rem;color:var(--ink-dim)">${C.SOURCES.map((s) => `<li>${s}</li>`).join("")}</ul>`);
    panelBuilt = true;
  }

  const MISSIONS = [
    { text: "Lay down layers from three different places (for example river sand, sea mud and swamp).", check: () => tr.envs.size >= 3 && !buildS.growing },
    { text: "Click the oldest layer you have laid down (before you change the rocks).", check: () => tr.oldest },
    { text: "Click a fossil on the cliff face.", check: () => tr.fossil },
    { text: "Date the cliff: put a flat cliff in order with no mistakes.", check: () => tr.flatClean },
    { text: "Tilt your block, then click its oldest layer again.", check: () => tr.tiltOldest },
    { text: "Date the real Illawarra escarpment.", check: () => tr.illawarra },
    { band: "ext", text: "Date a cliff with a dyke in it.", check: () => tr.dyke },
    { band: "ext", text: "Date an overturned cliff (find which way was up).", check: () => tr.over },
  ];

  function setMode(v) {
    if (v === mode) return;
    mode = v;
    selected = null; hover = null;
    const allowed = lens.filter(C.CHALLENGES).some((k) => k.id === ch.kind);
    if (mode === "date" && (!ch.S || !allowed)) newCliff(allowed ? ch.kind : "flat");
    else frameTo(M());
    dirty = true;
    refreshPanel();
  }

  function refreshPanel() {
    if (!panelBuilt) return;
    const band = lens.band;
    els.modeSeg.set(mode);
    els.build.style.display = mode === "build" ? "" : "none";
    els.date.style.display = mode === "date" ? "" : "none";
    const S = M();
    if (mode === "build") {
      els.depBtn.disabled = !!buildS.growing || buildS.top > MAX_TOP;
      els.autoBtn.textContent = auto ? "⏸ Stop time-lapse" : "▶ Time-lapse";
      els.autoBtn.setAttribute("aria-pressed", String(auto));
      const n = buildS.layers().length;
      els.tiltBtn.disabled = n < 2 || !!buildS.growing;
      els.erodeBtn.disabled = n < 1 || !!buildS.growing;
      if (els.dykeBtn) els.dykeBtn.disabled = n < 2 || !!buildS.growing;
      if (els.overBtn) els.overBtn.disabled = n < 2 || !!buildS.growing;
    } else {
      els.kindSeg.set(ch.kind);
      const k = C.CHALLENGES.find((c) => c.id === ch.kind);
      els.dateIntro.innerHTML = k.intro;
      els.dateProg.textContent = ch.revealed ? "Answer shown." : `Placed ${ch.tapped.length} of ${ch.need.length}${ch.mistakes ? ` · mistakes: ${ch.mistakes}` : ""}`;
      els.dateFb.innerHTML = ch.fb || "Tap the oldest rock first. Leave out the unlettered rock at the very bottom.";
      els.dateFb.className = `dt-fb ${ch.fbKind}`;
      els.revealBtn.disabled = ch.done || ch.revealed;
      // follow-up fossil question
      els.dateQ.innerHTML = "";
      if (ch.done && ch.question) {
        const q = ch.question;
        els.dateQ.insertAdjacentHTML("beforeend", `<p style="margin:10px 0 6px"><b>Bonus:</b> ${q.q}</p>`);
        const opts = document.createElement("div"); opts.className = "opts"; els.dateQ.appendChild(opts);
        const show = (i) => {
          opts.children[i].classList.add(i === q.answer ? "right" : "wrong");
          opts.children[q.answer].classList.add("right");
          els.dateQ.insertAdjacentHTML("beforeend", `<p class="dt-fb ${i === q.answer ? "good" : "bad"}">${i === q.answer ? "✅" : "❌"} ${q.why}</p>`);
        };
        q.options.forEach((o, i) => K.button(opts, o, () => { if (ch.answered !== false) return; ch.answered = i; show(i); }));
        if (ch.answered !== false) show(ch.answered);
      }
    }
    // selected card
    if (selected && S) {
      els.sel.style.display = "";
      const h2 = els.sel.querySelector("h2");
      if (selected.fossil) {
        h2.textContent = (selected.fossil.living ? "Living: " : "Fossil: ") + FOSSILS[selected.fossil.type].name;
        els.selBody.innerHTML = selected.fossil.living
          ? `<p>${FOSSILS[selected.fossil.type].what[0].toUpperCase() + FOSSILS[selected.fossil.type].what.slice(1)}, alive (or just died) on the surface while this layer builds up. If sediment buries it quickly, its hard parts may become a fossil in this layer.</p>`
          : C.fossilCard(S, selected.fossil, band, { challenge: mode === "date" });
      } else {
        const u = S.units[selected.unit];
        h2.textContent = mode === "date" && !S.realPlace ? `${u.kind === "dyke" ? "Dyke" : "Layer"} ${u.label}: ${u.name}` : u.kind === "layer" && mode === "build" ? `Layer ${S.layers().indexOf(u) + 1}: ${u.name}` : u.name;
        els.selBody.innerHTML = C.unitCard(S, selected.unit, band, { challenge: mode === "date", reveal: mode === "build" || ch.done || ch.revealed });
      }
    } else els.sel.style.display = "none";
    refreshColumn();
    els.whatBody.innerHTML = mode === "build" ? C.narrative(buildS, band, { selected: selected?.unit }) : dateNarrative();
  }

  function dateNarrative() {
    const S = ch.S; if (!S) return "";
    const band = lens.band;
    const k = ch.kind;
    const out = [];
    if (k === "flat") out.push("These layers are lying flat, just as they were laid down. Nothing has disturbed them, so the law of superposition applies directly: lower means older.");
    if (k === "tilted") out.push("Earth movements tilted these layers after they formed, then erosion planed the top flat. They are still in order, oldest underneath: follow each layer along its slope.");
    if (k === "illawarra") out.push("This is the real sequence exposed in the Illawarra escarpment, from the coal measures at the base of the cliffs up to the Hawkesbury Sandstone on top. The layers are almost flat, so superposition works directly.");
    if (k === "dyke") out.push("A dyke of dolerite cuts across some layers. Cross-cutting relationships: a rock that cuts across others is younger than them. The top layer was laid down later on the worn-flat surface, across the dyke.");
    if (k === "overturned") out.push("Earth movements can fold layers so far that they end up upside down. Look for a way-up clue: these sand, gravel and ash beds are normally graded, so pebbles and coarse grains mark the original bottom of each bed.");
    if (ch.done || ch.revealed) {
      const order = ch.need.map((id) => (S.realPlace ? S.units[id].name : S.units[id].label));
      out.push(`True order, oldest to youngest: <b>${order.join(" → ")}</b>.`);
    }
    return out.map((p) => `<p>${p}</p>`).join("");
  }

  let colSig = "";
  function refreshColumn() {
    const S = M(); if (!S) return;
    const runs = S.column(0.6).filter((r) => r.y1 - r.y0 > 0.02);
    const sig = (mode + runs.map((r) => `${r.unit}:${r.y0.toFixed(2)}`).join(",") + ch.tapped.length + ch.revealed + lens.band + showNumbers);
    if (sig === colSig) return;
    colSig = sig;
    const H = S.top - BOTTOM;
    const order = S.ageOrder().filter((u) => u.id !== 0);
    const name = (u) => {
      if (u.id === 0) return "Basement rock";
      if (mode === "date") return S.realPlace && (ch.tapped.includes(u.id) || ch.revealed) ? `<b>${u.label}</b> ${u.name}` : `<b>${u.label}</b> ${u.kind === "dyke" ? "dyke" : u.name.split(" (")[0].toLowerCase()}`;
      return `<b>${u.kind === "dyke" ? "Dyke" : `Layer ${S.layers().indexOf(u) + 1}`}</b> ${u.name.split(" (")[0].toLowerCase()}${showNumbers ? ` · ${C.ord(order.indexOf(u) + 1)}` : ""}`;
    };
    els.colBody.innerHTML = `<div class="dt-col"><div class="bar">${runs.map((r) => `<div style="flex:${((r.y1 - r.y0) / H).toFixed(4)};background:${ROCKS[S.units[r.unit].rock].color}"></div>`).join("")}</div>
      <ol>${runs.map((r) => `<li style="flex:${((r.y1 - r.y0) / H).toFixed(4)};display:flex;align-items:center;gap:5px">${name(S.units[r.unit])}</li>`).join("")}</ol></div>
      <p class="hint" style="margin:8px 0 0">${mode === "date" ? "Read from the bottom up. This is the order you see, which is not always the order they formed." : "Read from the bottom up, as a geologist logs a cliff."}</p>`;
  }

  // ---------- level object ----------
  let savedLights = null, savedEnvI = null;
  const level = {
    title: "Rock layers",
    topics: TOPICS,
    root, pickables,
    portals: [],
    metersPerUnit: 1,
    get model() { return M(); },                 // for tests and the console
    refresh() { dirty = true; refreshPanel(); },
    get showScale() { return !(mode === "date" && ch.S?.realPlace); },
    get view() { return viewFor(M()); },
    minDistance: 5, maxDistance: 70, near: 0.1, far: 600,
    minPolar: 0.15, maxPolar: Math.PI * 0.62,
    env: { bg: ["#7fa9cf", "#ddd3c2", "#c5d6e6"], fog: ["#d3dce4", 0.003], exposure: 0.82, bloom: [0.04, 0.4, 0.96], aperture: 0.0003 },
    info() { return hover ? tip : null; },
    onClick(e, hit) {
      const h = hitAt(e.clientX, e.clientY);
      if (!h) { selected = null; refreshPanel(); return true; }
      const S = M();
      if (mode === "date") {
        if (h.fossil && !h.fossil.living) selected = { fossil: h.fossil, unit: h.unit };
        else selected = { unit: h.unit };
        if (h.unit === 0 && !ch.done) { ch.fb = C.wrongTap(S, 0, ch.need[ch.tapped.length], lens.band); ch.fbKind = ""; }
        else if (h.unit > 0) tap(h.unit);
        refreshPanel();
        return true;
      }
      if (h.fossil) { selected = { fossil: h.fossil, unit: h.unit }; if (!h.fossil.living) tr.fossil = true; }
      else selected = { unit: h.unit };
      // missions: the oldest layer (the first one laid down)
      const first = S.layers()[0];
      if (!h.fossil && first && h.unit === first.id && S.layers().length >= 2) {
        if (!S.disturbed()) tr.oldest = true;
        else if (S.hasType("tilt") && !S.isOverturned(first.id)) tr.tiltOldest = true;
      }
      refreshPanel();
      return true;
    },
    mountPanel(el) {
      if (!panelBuilt) buildPanel();
      el.appendChild(panelRoot);
      refreshPanel();
      dirty = true;
      if (savedLights === null) { savedLights = engine.lights.visible; engine.lights.visible = false; }
      if (savedEnvI === null) { savedEnvI = engine.scene.environmentIntensity; engine.scene.environmentIntensity = 0.25; }
    },
    unmountPanel() {
      clearLabels();
      if (savedLights !== null) { engine.lights.visible = savedLights; savedLights = null; }
      if (savedEnvI !== null) { engine.scene.environmentIntensity = savedEnvI; savedEnvI = null; }
    },
    onLens() {
      if (!panelRoot) return;
      const parent = panelRoot.parentNode;
      panelRoot.remove();
      panelBuilt = false;
      buildPanel();
      if (!lens.filter(C.CHALLENGES).some((k) => k.id === ch.kind)) { if (mode === "date") newCliff("flat"); else { ch.S = null; ch.kind = "flat"; } }
      parent?.appendChild(panelRoot);
      refreshPanel();
    },
    update(dt, t, realDt) {
      U.uTime.value = t;
      const S = M();
      if (mode === "build") {
        if (S.growing) {
          S.grow(dt);
          dirty = true;
          if (!S.growing) refreshPanel();
        } else if (auto && dt > 0) {
          autoT -= dt;
          if (autoT <= 0) {
            autoT = 0.8;
            if (S.top > MAX_TOP || S.events.length >= MAX_EVENTS) { auto = false; refreshPanel(); }
            else {
              let id; const prev = S.layers().at(-1)?.env;
              do id = ENVS[Math.floor(Math.random() * ENVS.length)].id; while (id === prev || (!S.layers().length && id === "volcano"));
              deposit(id);
            }
          }
        }
      }
      if (dirty && S) {
        sync(S);
        layoutFossils(S, t);
        refreshLabels();
        dirty = !!(S.growing);
        if (S.growing) { uiT -= realDt; if (uiT <= 0) { uiT = 0.25; els.whatBody && (els.whatBody.innerHTML = C.narrative(buildS, lens.band, { selected: selected?.unit })); refreshColumn(); } }
      } else if (S?.growing === null && mode === "build" && fossilsAlive) { layoutFossils(S, t); }
      U.uSel.value = selected && !selected.fossil ? selected.unit : -1;
      // keep the stack centred vertically as it grows
      const want = viewFor(S).target.y;
      const dy = (want - engine.controls.target.y) * Math.min(1, realDt * 1.5);
      if (Math.abs(dy) > 1e-4 && !engine.busy && !engine.flight) { engine.controls.target.y += dy; engine.camera.position.y += dy; }
      // and back the camera off if the stack has grown out of view
      if (!engine.busy && !engine.flight) {
        const need = viewFor(S).distance, off = _p.subVectors(engine.camera.position, engine.controls.target), d = off.length();
        if (need > d * 1.01) engine.camera.position.copy(engine.controls.target).addScaledVector(off, Math.min(need, d * (1 + realDt * 0.8)) / d);
      }
      updateScene(dt, t);
      // hover (own ray: the tooltip names the layer under the pointer)
      const px = engine.pointer.x, py = engine.pointer.y;
      if (engine.pointer.inside && (px !== lastPX || py !== lastPY || dirty)) {
        lastPX = px; lastPY = py;
        hover = hitAt(px, py);
        tip.title = tipFor(hover);
        U.uHover.value = hover && !hover.fossil ? hover.unit : -1;
      } else if (!engine.pointer.inside) { hover = null; U.uHover.value = -1; }
      placeLabels();
      if ((missionT -= realDt) <= 0) { missionT = 0.3; missionsApi?.update(); }
    },
    dispose() { clearLabels(); },
  };
  let autoT = 0, uiT = 0, missionT = 0;
  const fossilsAlive = false;
  return level;
}
