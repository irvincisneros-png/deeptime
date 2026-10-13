// node tests/strataModel.test.mjs
import assert from "node:assert/strict";
import { createStrata, makeCliff, illawarra, W, BOTTOM, periodAt } from "../assets/js/world/levels/strataModel.js";

let n = 0; const t = (name, fn) => { fn(); n++; };

t("flat stack: lower layers classify as older", () => {
  const S = createStrata({ seed: 3 });
  const a = S.deposit("river", { grow: false, thickness: 1 }), b = S.deposit("deepSea", { grow: false, thickness: 1 }), c = S.deposit("shallowSea", { grow: false, thickness: 1 });
  assert.equal(S.top, 3);
  assert.equal(S.classify(0, 0.5).unit, a.id);
  assert.equal(S.classify(2, 1.5).unit, b.id);
  assert.equal(S.classify(-5, 2.9).unit, c.id);
  assert.equal(S.classify(0, -1).unit, 0);
  assert.equal(S.classify(0, 3.5).unit, -1);
  assert.ok(S.isOlder(a.id, b.id) && S.isOlder(b.id, c.id));
  assert.deepEqual(S.column(0).map((r) => r.unit), [0, a.id, b.id, c.id]);
});

t("growing layer: thickness rises and model clock goes back in time order", () => {
  const S = createStrata({ seed: 1 });
  const a = S.deposit("river");
  assert.equal(S.top, 0);
  while (S.grow(0.1)) {}
  assert.ok(Math.abs(S.top - a.full) < 1e-9);
  const b = S.deposit("swamp", { grow: false });
  assert.ok(b.ma < a.ma, "younger layer has a smaller age in Ma");
});

t("tilt: forward and classify are inverses; top planed flat and lower", () => {
  const S = createStrata({ seed: 5 });
  for (let i = 0; i < 4; i++) S.deposit("river", { grow: false, thickness: 1.5 });
  const before = S.top;
  S.tilt(30);
  assert.ok(S.top < before);
  for (const u of S.layers()) {
    const p = S.forward(u.id, 1.3, u.base + 0.4 * u.full);
    const c = S.classify(p.x, p.y);
    if (p.y <= S.top && Math.abs(p.x) < W / 2) { assert.equal(c.unit, u.id); assert.ok(Math.abs(c.frac - 0.4) < 1e-6); }
  }
  // along a tilted face, the oldest layer outcrops at the bottom of the up-tilted side
  const layers = S.layers();
  const seq = S.column(0).map((r) => r.unit).filter((u) => u > 0);
  for (let i = 1; i < seq.length; i++) assert.ok(S.isOlder(seq[i - 1], seq[i]), "still oldest at the bottom along a vertical line when tilted < 90°");
  assert.ok(layers.length === 4);
});

t("overturn: top-to-bottom order is reversed", () => {
  const S = createStrata({ seed: 9 });
  const ids = [];
  for (let i = 0; i < 4; i++) ids.push(S.deposit("river", { grow: false, thickness: 1 }).id);
  S.tilt(180);
  const seq = S.column(0).map((r) => r.unit).filter((u) => u > 0);
  assert.deepEqual(seq, ids.slice().reverse());
  assert.ok(S.isOverturned(ids[0]));
});

t("dyke cuts layers below it but not a layer laid over it", () => {
  const S = createStrata({ seed: 2 });
  S.deposit("river", { grow: false, thickness: 1 }); S.deposit("deepSea", { grow: false, thickness: 1 });
  const d = S.intrude(0, 0, 1);
  const cap = S.deposit("shallowSea", { grow: false, thickness: 1 });
  assert.equal(S.classify(0, 0.5).unit, d.id);
  assert.equal(S.classify(0, 1.5).unit, d.id);
  assert.equal(S.classify(0, 2.5).unit, cap.id);
  assert.equal(S.classify(3, 0.5).unit, 1);
  assert.ok(S.isOlder(1, d.id) && S.isOlder(d.id, cap.id));
});

t("erosion lowers the top, truncating the youngest layer", () => {
  const S = createStrata({ seed: 4 });
  S.deposit("river", { grow: false, thickness: 1 }); const b = S.deposit("deepSea", { grow: false, thickness: 1 });
  S.erode(0.6);
  assert.ok(Math.abs(S.top - 1.4) < 1e-9);
  assert.equal(S.classify(0, 1.3).unit, b.id);
  assert.equal(S.classify(0, 1.6).unit, -1);
});

t("visible fossils sit inside their own layer", () => {
  for (const kind of ["flat", "tilted", "dyke", "overturned"]) for (let s = 1; s < 25; s++) {
    const S = makeCliff(kind, s);
    for (const f of S.visibleFossils()) assert.equal(S.classify(f.px, f.py).unit, f.unit);
    const labels = S.units.filter((u) => u.id).map((u) => u.label);
    assert.equal(new Set(labels).size, labels.length);
    assert.ok(S.visibleUnits().filter((v) => v.unit > 0).length >= S.units.length - 2, `${kind} ${s}: most units visible`);
  }
});

t("illawarra: eight units, Hawkesbury on top, coal measures at the bottom", () => {
  const S = illawarra();
  const seq = S.column(0).map((r) => S.units[r.unit].name);
  assert.equal(seq.at(-1), "Hawkesbury Sandstone");
  assert.equal(seq[1], "Illawarra Coal Measures");
  assert.ok(seq.indexOf("Bulgo Sandstone") > seq.indexOf("Stanwell Park Claystone"));
  assert.equal(S.units.length, 9);
});

t("periods", () => {
  assert.equal(periodAt(500).name, "Cambrian");
  assert.equal(periodAt(260).name, "Permian");
  assert.equal(periodAt(10).name, "Cenozoic");
});

t("eroded rock does not reappear after a later overturn", () => {
  const S = createStrata({ seed: 11 });
  S.deposit("river", { grow: false, thickness: 2 }); const b = S.deposit("deepSea", { grow: false, thickness: 2 });
  S.erode(2); S.tilt(180);
  for (let y = BOTTOM + 0.05; y < S.top; y += 0.1) assert.notEqual(S.classify(0, y).unit, b.id);
});

t("repeated tilts add up: three 60° tilts overturn the stack", () => {
  const S = createStrata({ seed: 12 });
  for (let i = 0; i < 4; i++) S.deposit("river", { grow: false, thickness: 2 });
  S.tilt(45); S.tilt(45); S.tilt(45);
  assert.ok(S.layers().filter((u) => S.column(0).some((r) => r.unit === u.id)).every((u) => S.isOverturned(u.id)));
});

t("fossils respect their age ranges", async () => {
  const { RANGES } = await import("../assets/js/world/levels/strataModel.js");
  for (let s = 1; s < 60; s++) {
    const S = createStrata({ seed: s });
    for (let i = 0; i < 8; i++) S.deposit(["shallowSea", "river", "swamp", "deepSea"][i % 4], { grow: false });
    for (const u of S.layers()) for (const f of u.fossils) { const r = RANGES[f.type]; if (r) assert.ok(u.ma <= r[0] && u.ma >= r[1], `${f.type} at ${u.ma}`); }
  }
});

t("dyke frac is distance from the centre over half-width (matches the shader)", () => {
  const S = createStrata({ seed: 13 });
  S.deposit("river", { grow: false, thickness: 2 });
  S.intrude(0, 0, 1);
  assert.ok(Math.abs(S.classify(0.25, 0.5).frac - 0.5) < 1e-9);
});

t("overturned challenge cliffs use only graded beds", () => {
  for (let s = 1; s < 20; s++) for (const u of makeCliff("overturned", s).layers()) assert.ok(["sandstone", "conglomerate", "tuff"].includes(u.rock));
});

console.log(`strataModel: ${n} tests passed`);
