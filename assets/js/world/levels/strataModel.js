// Rock-layers model for station 1 (Y8 7.3.8, law of superposition). Pure module: no three.js, no DOM, so it is node-testable.
//
// A block of ground, W wide (x) and D deep (z), in metres. Its history is a list of events, oldest first:
//   deposit  sediment settles on the flat surface and builds a layer of thickness t on top of everything before it
//   tilt     the whole block rotates by θ about the middle of the stack (in the x–y plane), then erosion planes the top flat
//            (|θ| ≤ 60°; θ = 180° is "overturn": the stack is flipped upside down, as in the overturned limb of a fold)
//   dyke     magma forces its way up a crack and cools to a sheet of igneous rock that cuts every layer already there
//   erode    the top of the block is worn away (the surface drops)
// Later layers are laid on the flat eroded surface, so a gap in time (an unconformity) can sit between two layers.
//
// classify(x, y, z) runs the history backwards, undoing each tilt, to find which rock unit a present-day point is in and
// where that point was when the rock formed (q). The GLSL shader in strata.js runs the same loop per pixel, so the picture
// and the clicks always agree. Units: index 0 = the old basement rock beneath everything; then one unit per deposit or dyke.

export const W = 14, D = 7, BOTTOM = -2;   // block size (m); the basement shows from BOTTOM up to y = 0
export const MAX_EVENTS = 16, MAX_UNITS = 20;

// Rock types. glsl = the id the shader switches on. relief: harder rocks stand out of a weathered cliff, soft ones recess.
export const ROCKS = {
  basement:     { glsl: 0, name: "Granite (older basement rock)", kind: "igneous", color: "#b8a7a0", relief: 0.6 },
  sandstone:    { glsl: 1, name: "Sandstone", kind: "sedimentary", color: "#d8b98a", relief: 0.8 },
  shale:        { glsl: 2, name: "Shale", kind: "sedimentary", color: "#6f747a", relief: 0.15 },
  limestone:    { glsl: 3, name: "Limestone", kind: "sedimentary", color: "#d9d4c4", relief: 0.9 },
  conglomerate: { glsl: 4, name: "Conglomerate", kind: "sedimentary", color: "#9c8468", relief: 0.7 },
  coal:         { glsl: 5, name: "Coal", kind: "sedimentary", color: "#222224", relief: 0.3 },
  tuff:         { glsl: 6, name: "Tuff (volcanic ash rock)", kind: "igneous (volcanic) layer", color: "#b9b1a8", relief: 0.5 },
  dolerite:     { glsl: 7, name: "Dolerite (a dyke)", kind: "igneous (intrusive)", color: "#3d4541", relief: 1.0 },
  claystone:    { glsl: 8, name: "Claystone", kind: "sedimentary", color: "#8a5a48", relief: 0.2 },
  coalMeasures: { glsl: 9, name: "Coal measures (shale, sandstone and coal seams)", kind: "sedimentary", color: "#4a4844", relief: 0.3 },
};

// Where the sediment settles. habitat picks which fossils can be buried (sea creatures or land and river life).
export const ENVS = [
  { id: "shallowSea", label: "Shallow sea", rock: "limestone", habitat: "sea", water: "sea", sediment: "#efe8d6", grain: 0.5,
    how: "Shells and lime mud collect on the floor of a warm, shallow sea and harden into limestone." },
  { id: "deepSea", label: "Deep sea mud", rock: "shale", habitat: "sea", water: "deep", sediment: "#7d8288", grain: 0.15,
    how: "Fine mud slowly settles in deep, calm water. Squashed and hardened, mud becomes shale." },
  { id: "river", label: "River sand", rock: "sandstone", habitat: "land", water: "river", sediment: "#e2c48f", grain: 0.45,
    how: "A river drops sand where it slows down. Buried and cemented, the sand becomes sandstone." },
  { id: "flood", label: "Flood gravel", rock: "conglomerate", habitat: "land", water: "river", sediment: "#a58e72", grain: 1,
    how: "A fast flood dumps rounded pebbles and gravel. Cemented together they make conglomerate." },
  { id: "swamp", label: "Swamp forest", rock: "coal", habitat: "land", water: "swamp", sediment: "#3b3226", grain: 0.2,
    how: "Dead plants pile up in a swamp faster than they rot. Buried deep and squeezed for millions of years, they become coal." },
  { id: "volcano", label: "Volcanic ash", rock: "tuff", habitat: "ash", water: null, sediment: "#c9c3bb", grain: 0.6,
    how: "A nearby volcano erupts and ash rains down, blanketing the land. The ash hardens into a rock called tuff." },
];
export const ENV = Object.fromEntries(ENVS.map((e) => [e.id, e]));

// Fossil types (meshes are built in strata.js). Small fossils are drawn 10 to 20 times larger than life so they can be seen on a 14 m cliff.
export const FOSSILS = {
  trilobite:   { name: "Trilobite", what: "a sea animal with a hard, segmented shell (related to crabs and insects); extinct" },
  brachiopod:  { name: "Brachiopod shell", what: "a shelled sea animal that looks like a clam but is not related" },
  fish:        { name: "Fish", what: "a fish skeleton, pressed flat in fine mud" },
  fern:        { name: "Fern frond", what: "the leaf of a fern, pressed flat" },
  glossopteris:{ name: "Glossopteris leaf", what: "the tongue-shaped leaf of an extinct seed plant that grew across Gondwana" },
  ammonite:    { name: "Ammonite", what: "the coiled shell of a squid-like sea animal; extinct" },
  dinoBone:    { name: "Dinosaur bone", what: "a leg bone, turned to stone as minerals filled its pores" },
  sharkTooth:  { name: "Shark tooth", what: "a tooth: sharks shed thousands, and teeth fossilise well" },
  leaf:        { name: "Leaf (flowering plant)", what: "the leaf of a flowering plant" },
  mammalBone:  { name: "Mammal bone", what: "a bone from a mammal" },
  shell:       { name: "Clam shell", what: "the shell of a bivalve (clam)" },
};

// Earliest (first) and latest (last) ages in Ma at which each fossil type is allowed, so a pool never offers an organism
// outside its known range (e.g. flowering-plant leaves only after ~125 Ma; dinosaurs from ~233 Ma; trilobites gone by 252 Ma).
export const RANGES = {
  trilobite: [521, 252], ammonite: [410, 66], glossopteris: [299, 201], dinoBone: [233, 66], leaf: [125, 0],
  mammalBone: [66, 0], sharkTooth: [400, 0], fern: [385, 0], fish: [420, 0], brachiopod: [530, 0], shell: [500, 0],
};
export const fossilAllowed = (type, ma) => { const r = RANGES[type]; return !r || (ma <= r[0] && ma >= r[1]); };

// Simplified time periods with real boundary ages (International Chronostratigraphic Chart v2023/09) and the fossils
// that fit each habitat then. Lists are representative, not complete.
export const PERIODS = [
  { name: "Cambrian", from: 539, to: 485, sea: ["trilobite", "brachiopod"], land: [] },
  { name: "Ordovician and Silurian", from: 485, to: 419, sea: ["trilobite", "brachiopod"], land: [] },
  { name: "Devonian", from: 419, to: 359, sea: ["brachiopod", "fish", "trilobite"], land: ["fish", "fern"] },
  { name: "Carboniferous", from: 359, to: 299, sea: ["brachiopod", "fish", "trilobite"], land: ["fern"] },
  { name: "Permian", from: 299, to: 252, sea: ["brachiopod", "trilobite"], land: ["glossopteris", "fern"] },
  { name: "Triassic", from: 252, to: 201, sea: ["ammonite", "fish"], land: ["fern", "fish"] },
  { name: "Jurassic", from: 201, to: 145, sea: ["ammonite", "fish"], land: ["dinoBone", "fern"] },
  { name: "Cretaceous", from: 145, to: 66, sea: ["ammonite", "sharkTooth"], land: ["dinoBone", "leaf"] },
  { name: "Cenozoic", from: 66, to: 0, sea: ["sharkTooth", "shell"], land: ["mammalBone", "leaf"] },
];
export const periodAt = (ma) => PERIODS.find((p) => ma <= p.from && ma > p.to) || (ma > PERIODS[0].from ? PERIODS[0] : PERIODS.at(-1));

/** Small seeded random generator (mulberry32) so challenge cliffs can be reproduced from a seed. */
export function rng(seed = 1) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * createStrata({ seed, startMa }) → model.
 *   units[i] = { id, kind: "basement" | "layer" | "dyke", rock, env?, name, base?, t?, event, ma?, fossils[], tint[3], seed, label? }
 *   events[j] = { type, ... , unit? }
 */
export function createStrata({ seed = 1, startMa = 340 } = {}) {
  const R = rng(seed);
  const S = {
    seed, R,
    top: 0,                  // present surface height (m)
    clock: startMa,          // model clock, millions of years ago, for the next layer
    units: [{ id: 0, kind: "basement", rock: "basement", name: ROCKS.basement.name, event: -1, fossils: [], tint: [1, 1, 1], seed: 0.37 }],
    events: [],
    growing: null,           // the layer being deposited (its t grows from 0)
  };

  // ---- events ----
  /** Start a new layer on the present surface. grow = false lays it down instantly (challenge cliffs). */
  S.deposit = (envId, o = {}) => {
    const env = ENV[envId] || ENV[o.env] || ENVS[0];
    if (S.events.length >= MAX_EVENTS || S.units.length >= MAX_UNITS) return null;
    const full = o.thickness ?? 0.9 + R() * 0.9;
    const dur = o.duration ?? 18 + R() * 30;               // millions of years this layer and the gap after it represent
    const ma = o.ma ?? Math.max(1, S.clock);
    S.clock = Math.max(0.5, ma - dur);
    const u = {
      id: S.units.length, kind: "layer", rock: o.rock || env.rock, env: env.id, name: o.name || ROCKS[o.rock || env.rock].name,
      base: S.top, full, t: o.grow === false ? full : 0, event: S.events.length, ma, fossils: [],
      tint: o.tint || [0.94 + R() * 0.12, 0.94 + R() * 0.12, 0.94 + R() * 0.12], seed: R(), info: o.info || null,
    };
    S.units.push(u);
    S.events.push({ type: "deposit", unit: u.id });
    // fossils: organisms of this period that lived in this habitat, at random heights inside the layer, along the front face
    const per = periodAt(ma);
    const pool = (o.fossilPool || (env.habitat === "sea" ? per.sea : env.habitat === "land" ? per.land : [])).filter((t) => o.fossilPool || fossilAllowed(t, ma));
    const n = o.fossilCount ?? (pool.length ? (env.id === "flood" ? (R() < 0.5 ? 1 : 0) : 1 + Math.floor(R() * 2.2)) : 0);
    for (let k = 0; k < n && pool.length; k++) {
      u.fossils.push({ type: pool[Math.floor(R() * pool.length)], x: -W / 2 + 1.2 + R() * (W - 2.4), f: 0.25 + R() * 0.5, rot: R() * Math.PI * 2, id: `${u.id}-${k}` });
    }
    if (o.grow === false) S.top = u.base + u.full;
    else S.growing = u;
    return u;
  };

  /** Advance the growing layer. rate in m per second of animation. Returns true while still growing. */
  S.grow = (dt, rate = 0.45) => {
    const u = S.growing;
    if (!u) return false;
    u.t = Math.min(u.full, u.t + dt * rate);
    S.top = u.base + u.t;
    if (u.t >= u.full) { S.growing = null; return false; }
    return true;
  };
  S.finishGrowing = () => { if (S.growing) { S.growing.t = S.growing.full; S.top = S.growing.base + S.growing.full; S.growing = null; } };

  /** Tilt by deg (−60…60) about the middle of the present stack, then plane the top flat. deg = 180 overturns it. */
  S.tilt = (deg) => {
    S.finishGrowing();
    if (S.events.length >= MAX_EVENTS) return null;
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const cy = S.top / 2;
    let top;
    if (Math.abs(deg) >= 179) top = S.top;            // flipped about mid-height: the stack still spans 0…top
    else {
      // the old top surface after rotation is a sloping line; erosion cuts the block down to its lowest point inside the block
      const hAt = (x) => cy + (S.top - cy) / c + Math.tan(a) * x;
      top = Math.min(hAt(-W / 2), hAt(W / 2));
    }
    const ev = { type: "tilt", deg, c, s, cx: 0, cy, topBefore: S.top };
    S.events.push(ev);
    S.top = Math.max(0.6, top);
    ev.topAfter = S.top;
    return ev;
  };

  /** Intrude a dyke: centre x0 at y = 0, leaning `lean` degrees from vertical, `width` m wide. Cuts everything up to the surface. */
  S.intrude = (x0 = 0, lean = 12, width = 0.9, o = {}) => {
    S.finishGrowing();
    if (S.events.length >= MAX_EVENTS || S.units.length >= MAX_UNITS) return null;
    const a = (lean * Math.PI) / 180;
    const u = { id: S.units.length, kind: "dyke", rock: "dolerite", name: ROCKS.dolerite.name, event: S.events.length, ma: S.clock, fossils: [], tint: [1, 1, 1], seed: R(), info: o.info || null };
    S.clock = Math.max(0.5, S.clock - (o.duration ?? 5 + R() * 10));
    S.units.push(u);
    S.events.push({ type: "dyke", unit: u.id, x0, dx: Math.sin(a), dy: Math.cos(a), half: width / 2, topAt: S.top });
    return u;
  };

  /** Wear away `amount` m of the top. */
  S.erode = (amount = 1.2) => {
    S.finishGrowing();
    if (S.events.length >= MAX_EVENTS) return null;
    const ev = { type: "erode", amount: Math.min(amount, S.top - 0.4), topBefore: S.top };
    S.events.push(ev);
    S.top = Math.max(0.4, S.top - amount);
    S.clock = Math.max(0.5, S.clock - (5 + R() * 15));
    return ev;
  };

  // ---- geometry ----
  /**
   * Which unit is the present-day point (x, y) in (z does not matter: events act in the x–y plane)?
   * Returns { unit, qx, qy, frac } where (qx, qy) is where the point was when its rock formed and frac is the height
   * through the layer (0 = base, 1 = top) for layers. Points above the surface return unit -1.
   */
  S.classify = (x, y, out = {}) => {
    if (y > S.top + 1e-6) { out.unit = -1; return out; }
    let qx = x, qy = y;
    let ceil = S.top;                       // the land surface just after the event being undone, in that time's coordinates
    for (let i = S.events.length - 1; i >= 0; i--) {
      const e = S.events[i];
      // above the surface at that time: the rock here was worn away (or never existed), so whatever fills this spot now is
      // not part of the sequence. It only happens when later folding brings such a spot into the block: show it as unit 0.
      if (qy > ceil + 1e-6) break;
      if (e.type === "deposit") {
        const u = S.units[e.unit];
        if (qy >= u.base && qy <= u.base + u.t && u.t > 0) { out.unit = u.id; out.qx = qx; out.qy = qy; out.frac = (qy - u.base) / u.full; return out; }
        ceil = u.base;
      } else if (e.type === "tilt") {
        // undo the rotation: q = R(−θ)(q − c) + c
        const px = qx - e.cx, py = qy - e.cy;
        qx = e.c * px + e.s * py + e.cx;
        qy = -e.s * px + e.c * py + e.cy;
        ceil = e.topBefore;
      } else if (e.type === "dyke") {
        const px = qx - e.x0, py = qy;
        const dist = Math.abs(px * e.dy - py * e.dx);
        if (dist < e.half && qy <= e.topAt) { out.unit = e.unit; out.qx = qx; out.qy = qy; out.frac = dist / e.half; return out; }
      } else if (e.type === "erode") ceil = e.topBefore;
    }
    out.unit = 0; out.qx = qx; out.qy = qy; out.frac = 0;
    return out;
  };

  /** Move a point from where it formed (during unit u's deposit) to where it is now, applying every later tilt. */
  S.forward = (u, x, y) => {
    let px = x, py = y;
    for (let i = S.units[u].event + 1; i < S.events.length; i++) {
      const e = S.events[i];
      if (e.type !== "tilt") continue;
      const dx = px - e.cx, dy = py - e.cy;
      px = e.c * dx - e.s * dy + e.cx;
      py = e.s * dx + e.c * dy + e.cy;
    }
    return { x: px, y: py };
  };

  /**
   * Fossils still visible today: their present position on the front face, if that spot still belongs to their layer
   * (not eroded away, not swallowed by a later dyke, still inside the block).
   */
  S.visibleFossils = () => {
    const out = [], tmp = {};
    for (const u of S.units) for (const f of u.fossils) {
      if (u.kind !== "layer") continue;
      const y0 = u.base + f.f * u.full;
      if (u.t < f.f * u.full - 1e-6) continue;   // not yet reached by the growing layer
      const p = S.forward(u.id, f.x, y0);
      if (Math.abs(p.x) > W / 2 - 0.25 || p.y < BOTTOM + 0.2 || p.y > S.top - 0.15) continue;
      S.classify(p.x, p.y, tmp);
      if (tmp.unit !== u.id) continue;
      out.push({ ...f, unit: u.id, px: p.x, py: p.y, angle: S.angleOf(u.id) });
    }
    return out;
  };

  /** Present-day rotation of unit u's bedding (radians), from all later tilts. */
  S.angleOf = (u) => {
    let a = 0;
    for (let i = S.units[u].event + 1; i < S.events.length; i++) if (S.events[i].type === "tilt") a += (S.events[i].deg * Math.PI) / 180;
    return a;
  };
  S.isOverturned = (u) => Math.abs(Math.cos(S.angleOf(u))) > 1e-3 && Math.cos(S.angleOf(u)) < 0;

  /** Units that can be seen on the front face today (sampled on a grid), with a label point near each one's middle. */
  S.visibleUnits = (nx = 56, ny = 48) => {
    const cells = new Map(), tmp = {};
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = -W / 2 + ((i + 0.5) / nx) * W, y = BOTTOM + ((j + 0.5) / ny) * (S.top - BOTTOM);
      S.classify(x, y, tmp);
      if (tmp.unit < 0) continue;
      let c = cells.get(tmp.unit);
      if (!c) cells.set(tmp.unit, (c = { unit: tmp.unit, pts: [] }));
      c.pts.push([x, y]);
    }
    const out = [];
    for (const c of cells.values()) {
      const n = c.pts.length;
      const mx = c.pts.reduce((s, p) => s + p[0], 0) / n, my = c.pts.reduce((s, p) => s + p[1], 0) / n;
      // label at the cell nearest the centroid that is inside the unit, kept away from the side edges
      let best = c.pts[0], bd = Infinity;
      for (const p of c.pts) { const d = (p[0] - mx) ** 2 + (p[1] - my) ** 2 * 4 + (Math.abs(p[0]) > W / 2 - 1.2 ? 50 : 0); if (d < bd) { bd = d; best = p; } }
      out.push({ unit: c.unit, x: best[0], y: best[1], area: n / (nx * ny) });
    }
    return out;
  };

  /** Vertical sequence today along x (bottom to top): [{ unit, y0, y1 }]. */
  S.column = (x = 0, steps = 240) => {
    const runs = [], tmp = {};
    for (let k = 0; k < steps; k++) {
      const y = BOTTOM + ((k + 0.5) / steps) * (S.top - BOTTOM);
      S.classify(x, y, tmp);
      const y0 = BOTTOM + (k / steps) * (S.top - BOTTOM), y1 = BOTTOM + ((k + 1) / steps) * (S.top - BOTTOM);
      if (runs.length && runs.at(-1).unit === tmp.unit) runs.at(-1).y1 = y1;
      else runs.push({ unit: tmp.unit, y0, y1 });
    }
    return runs;
  };

  /** Units in true order of formation, oldest first (basement first). */
  S.ageOrder = () => S.units.slice().sort((a, b) => a.event - b.event);
  S.isOlder = (a, b) => S.units[a].event < S.units[b].event;
  S.disturbed = () => S.events.some((e) => e.type === "tilt" || e.type === "dyke");
  S.hasType = (t) => S.events.some((e) => e.type === t);
  S.layers = () => S.units.filter((u) => u.kind === "layer");
  S.letter = (u) => S.units[u].label || (u === 0 ? "basement" : `layer ${u}`);
  return S;
}

/**
 * A challenge cliff. kind: "flat" | "tilted" | "dyke" | "overturned" | "illawarra".
 * Every unit except the basement gets a random letter; the student puts them in order oldest → youngest.
 */
export function makeCliff(kind = "flat", seed = 1) {
  if (kind === "illawarra") return illawarra();
  const R = rng(seed * 7919 + 13);
  const S = createStrata({ seed: seed * 31 + 7, startMa: 300 + Math.floor(R() * 40) });
  const n = kind === "flat" ? 4 + (R() < 0.5 ? 1 : 0) : 5;
  const used = new Set();
  // overturned cliffs use only beds that are normally graded (coarse at the base, fining upward), the way-up clue students read
  const GRADED = ["river", "flood", "volcano"];
  let prev = null;
  for (let i = 0; i < n; i++) {
    let env;
    if (kind === "overturned") { do env = ENV[GRADED[Math.floor(R() * GRADED.length)]]; while (env.id === prev); prev = env.id; }
    else { do env = ENVS[Math.floor(R() * ENVS.length)]; while (used.has(env.id) || (i === 0 && env.id === "volcano")); }   // every layer a different rock, so they are easy to tell apart
    used.add(env.id);
    S.deposit(env.id, { grow: false, thickness: 1.1 + R() * 0.9, fossilCount: env.habitat === "ash" ? 0 : 1 + (R() < 0.4 ? 1 : 0) });
  }
  if (kind === "tilted") S.tilt((R() < 0.5 ? -1 : 1) * (22 + R() * 16));
  if (kind === "overturned") {
    S.tilt(180);
    S.units[0].name = "Rock below a fault (not part of this sequence)";
    S.units[0].info = "Earth movements that fold layers right over usually also break them along faults. The rock under this one is on the other side of a fault, so it tells you nothing about this stack's age order.";
  }
  if (kind === "dyke") {
    S.intrude(-3 + R() * 6, (R() - 0.5) * 30, 0.8);
    S.erode(0.3);                                                  // the land is worn flat, cutting off the top of the dyke
    S.deposit(ENVS[Math.floor(R() * 3)].id, { grow: false, thickness: 1.2, fossilCount: 1 });   // a layer laid over the dyke: younger than it
  }
  // random letters (not in order)
  const ids = S.units.filter((u) => u.id !== 0).map((u) => u.id);
  const letters = LETTERS.slice(0, ids.length).split("");
  for (let i = letters.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [letters[i], letters[j]] = [letters[j], letters[i]]; }
  ids.forEach((id, i) => (S.units[id].label = letters[i]));
  S.kind = kind;
  return S;
}

/**
 * The Illawarra escarpment behind Woonona, simplified: the main rock units from the Permian coal measures up to the
 * Hawkesbury Sandstone. Thicknesses are squashed to fit (about 30 m of real rock per metre here) and the thin Garie and
 * Newport formations near the top are left out. Sources: Geological Survey of NSW; Wollongong–Port Hacking 1:100 000 sheet.
 */
export function illawarra() {
  const S = createStrata({ seed: 2515 });
  // the real rocks beneath the coal measures are older Permian sediments, then (kilometres down) Lachlan Fold Belt basement
  S.units[0].name = "Older rocks beneath (Shoalhaven Group and deeper basement)";
  S.units[0].rock = "shale";
  S.units[0].tint = [0.95, 0.93, 0.9];
  S.units[0].info = "Below the coal measures lie older Permian sea-floor rocks, and kilometres further down the folded basement of the Lachlan Fold Belt. Drawn here as a simple grey-pink base.";
  const L = [
    { name: "Illawarra Coal Measures", rock: "coalMeasures", t: 1.8, ma: 259, pool: ["glossopteris", "fern"], n: 3, tint: [1, 1, 1],
      info: "Shale, sandstone and coal seams from swamps and rivers in the Permian. The Bulli Seam at the top was mined along the escarpment for over a century. Glossopteris leaves are common fossils." },
    { name: "Coal Cliff Sandstone", rock: "sandstone", t: 0.9, ma: 251, pool: [], n: 0, tint: [0.92, 0.92, 0.95],
      info: "Grey-white sandstone laid down by rivers just after the coal swamps." },
    { name: "Wombarra Claystone", rock: "shale", t: 1.1, ma: 250, pool: [], n: 0, tint: [1, 1, 1],
      info: "Grey shale and claystone from mud that settled in lakes and on floodplains." },
    { name: "Scarborough Sandstone", rock: "sandstone", t: 1.1, ma: 249, pool: [], n: 0, tint: [0.98, 0.96, 0.92],
      info: "Sandstone and pebbly sandstone from rivers flowing off highlands." },
    { name: "Stanwell Park Claystone", rock: "claystone", t: 1.4, ma: 248, pool: [], n: 0, tint: [0.94, 0.98, 0.95],
      info: "Green-grey and red-brown claystone from floodplain mud. Soft, so it weathers back and causes landslips." },
    { name: "Bulgo Sandstone", rock: "sandstone", t: 2.2, ma: 247, pool: [], n: 0, tint: [1.02, 0.98, 0.9],
      info: "The thickest unit: a thick pile of river sandstone that forms the big cliffs." },
    { name: "Bald Hill Claystone", rock: "claystone", t: 0.8, ma: 246, pool: [], n: 0, tint: [1.12, 0.9, 0.85],
      info: "Chocolate-red claystone from weathered soil and floodplain mud. It shows as a red band below the top cliff." },
    { name: "Hawkesbury Sandstone", rock: "sandstone", t: 2.1, ma: 243, pool: ["fish"], n: 1, tint: [1.06, 0.98, 0.86],
      info: "The cap rock along the escarpment top and around Sydney: river sandstone with sloping cross-beds and iron staining. Fossil fish are found in shale lenses within it." },
  ];
  for (const l of L) S.deposit("river", { grow: false, rock: l.rock, name: l.name, thickness: l.t, ma: l.ma, fossilPool: l.pool, fossilCount: l.n, tint: l.tint, info: l.info, duration: 0.5 });
  const ids = S.units.filter((u) => u.id !== 0).map((u) => u.id);
  const letters = ["F", "C", "H", "A", "E", "B", "G", "D"];   // fixed and shuffled, so a class all sees the same letters
  ids.forEach((id, i) => (S.units[id].label = letters[i]));
  S.kind = "illawarra";
  S.realPlace = true;
  return S;
}
