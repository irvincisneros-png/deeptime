// Lens-aware text for station 1, Rock layers (Y8 7.3.8: the law of superposition and relative age).
// The narrative is generated from the model (strataModel.js): what is being deposited, how the stack is arranged now,
// and whether the simple "lower = older" reading still works. Bands: "y8" (core) and "ext". Australian spelling.
import { ROCKS, ENV, FOSSILS, periodAt } from "./strataModel.js";

export const P = (v, band) => (v != null && typeof v === "object" && !Array.isArray(v) ? v[band] ?? v.y8 : v);
const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;
export { ord };
const list = (a) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a.at(-1)}`);
export const fmtMa = (ma) => (ma >= 10 ? `${Math.round(ma)}` : ma.toFixed(1)) + " million years ago";

export const LAW = {
  y8: "<b>Law of superposition:</b> in layers of sedimentary rock that have not been disturbed, each layer is younger than the one below it and older than the one above it. The bottom layer is the oldest.",
  ext: "<b>Law of superposition</b> (Nicolas Steno, 1669): in an undisturbed sequence of sedimentary strata, each layer is younger than the one beneath it. With the principles of original horizontality and cross-cutting relationships it lets geologists put rocks and events in order, which is relative dating.",
};

/** Name of a unit for the student: its letter on a challenge cliff, otherwise "layer n" (n = order laid down). */
export function unitName(S, id, challenge) {
  const u = S.units[id];
  if (id === 0) return "the basement rock";
  if (S.realPlace) return `${u.name} (${u.label})`;
  if (challenge) return u.kind === "dyke" ? `the dyke (${u.label})` : `layer ${u.label}`;
  return u.kind === "dyke" ? "the dyke" : `layer ${S.layers().indexOf(u) + 1}`;
}

/** "What's happening" for the build mode, from the model state. */
export function narrative(S, band, ctx = {}) {
  const ext = band === "ext";
  const out = [];
  const layers = S.layers();
  const g = S.growing;
  if (g) {
    const env = ENV[g.env];
    const pct = Math.round((g.t / g.full) * 100);
    out.push(`<b>Now:</b> ${env.how} Layer ${layers.length} is ${pct} % built, on top of ${layers.length > 1 ? `layer ${layers.length - 1}` : "the old basement rock"}.`);
    if (g.fossils.length) out.push(`${list(g.fossils.map((f) => FOSSILS[f.type].name.toLowerCase()))} living here ${g.fossils.length > 1 ? "are" : "is"} being buried. Buried quickly, hard parts can become fossils.`);
    if (ext) out.push(`Model clock: about ${fmtMa(g.ma)} (${periodAt(g.ma).name}). Real layers this thick take thousands to millions of years; here it takes seconds.`);
  } else if (!layers.length) {
    out.push("Nothing has been laid down yet: the block is old basement rock. Choose where the sediment comes from and press <b>Lay down a layer</b>.");
  } else {
    out.push(`The block has ${layers.length} layer${layers.length > 1 ? "s" : ""} on the basement rock. Layer 1 was laid down first, so it is the oldest; layer ${layers.length} is the youngest.`);
  }
  // orientation comes from all the tilts added together, layer by layer (two 45° tilts and a 90° one can overturn a stack)
  const tilted = layers.filter((u) => Math.abs(S.angleOf(u.id)) > 0.02);
  const over = layers.filter((u) => S.isOverturned(u.id));
  const upright = layers.filter((u) => !S.isOverturned(u.id));
  const later = over.length && upright.some((u) => u.event > Math.max(...over.map((o) => o.event)));
  if (over.length) out.push((ext
    ? `${over.length === layers.length ? "The stack has" : `${over.length} of the layers have`} been <b>overturned</b>, so in that part of the cliff the oldest layer is at the top. Superposition only works once you know which way was up: in normally graded beds the coarse grains mark the original base.`
    : `${over.length === layers.length ? "The stack has" : "Some layers have"} been <b>turned upside down</b>, so there the bottom layer is NOT the oldest. The law only works for undisturbed layers. In sand, gravel and ash beds the big grains settle first, at the original bottom, which shows which way was up.`)
    + (later ? " Layers laid down after the overturning are the right way up." : ""));
  else if (tilted.length) {
    const deg = Math.round(Math.abs(S.angleOf(tilted[0].id)) * 180 / Math.PI);
    const who = tilted.length === layers.length ? "The layers have" : "The older layers have";
    if (deg >= 80) out.push(`${who} been tilted until they stand on end (about ${deg}°) and the top was worn flat. Now the order runs sideways: the oldest layer is at the side that used to be the bottom. Without way-up clues you can't tell which side that is.`);
    else out.push(`${who} been <b>tilted</b> about ${deg}° and the top worn flat. Older layers are still underneath younger ones: read the order along the layers, following the slope, not straight up the cliff edge.`);
  }
  if (!over.length && !tilted.length && S.hasType("tilt") && layers.length) {
    out.push("The layers were tipped over and back again, so they are flat and the right way up once more: lower means older.");
  }
  if (S.hasType("dyke")) out.push(ext
    ? "A <b>dyke</b> of igneous rock cuts across some layers. By cross-cutting relationships it is younger than every layer it cuts. A layer laid across its worn-down top is younger than the dyke."
    : "A <b>dyke</b> (cooled magma) cuts across some layers. The layers had to be there before the magma could crack through them, so the dyke is younger than the layers it cuts.");
  if (S.hasType("erode") && layers.length) out.push("Erosion wore away some rock. Layers laid on top later sit on the worn surface: there is a gap in the record there.");
  if (ctx.selected != null && ctx.selected > 0 && !ctx.challenge) {
    const u = S.units[ctx.selected];
    if (u.kind === "layer") {
      const k = layers.indexOf(u) + 1, n = layers.length;
      const below = k - 1 === 1 ? "layer 1" : `layers 1 to ${k - 1}`, above = k + 1 === n ? `layer ${n}` : `layers ${k + 1} to ${n}`;
      const rel = n === 1 ? "It is the only layer so far." : k === 1 ? `It is the oldest layer: older than ${above}.` : k === n ? `It is the youngest layer: younger than ${below}.` : `It is younger than ${below} and older than ${above}.`;
      out.push(`Selected: <b>layer ${k}</b> (${u.name.toLowerCase()}). ${rel}`);
    }
  }
  return out.map((p) => `<p>${p}</p>`).join("");
}

/** Text for a selected unit (build mode or after the challenge is finished). reveal = show the true order. */
export function unitCard(S, id, band, { challenge = false, reveal = true } = {}) {
  const u = S.units[id];
  const rock = ROCKS[u.rock];
  const ext = band === "ext";
  const bits = [];
  bits.push(`<p class="hint">${rock.kind[0].toUpperCase() + rock.kind.slice(1)} rock</p>`);
  if (u.info) bits.push(`<p>${u.info}</p>`);
  else if (u.kind === "layer") bits.push(`<p>${ENV[u.env].how}</p>`);
  else if (u.kind === "dyke") bits.push("<p>Magma squeezed up through a crack and cooled underground into a sheet of hard igneous rock. It cuts across layers that were already there.</p>");
  else bits.push("<p>Old igneous rock that was already here before any of these layers were laid down on it.</p>");
  if (u.fossils.length && u.kind === "layer") {
    const vis = new Set(S.visibleFossils().filter((f) => f.unit === id).map((f) => f.type));
    if (vis.size) bits.push(`<p><b>Fossils:</b> ${list([...vis].map((t) => FOSSILS[t].name.toLowerCase()))}.</p>`);
  }
  if (reveal && u.kind !== "basement") {
    const order = S.ageOrder().filter((x) => x.id !== 0);
    const k = order.indexOf(u) + 1;
    bits.push(`<p><b>Formed ${ord(k)}</b> of ${order.length} rocks.${ext && u.ma ? ` Model age: about ${fmtMa(u.ma)} (${periodAt(u.ma).name}).` : ""}</p>`);
  }
  return bits.join("");
}

export function fossilCard(S, f, band, { challenge = false } = {}) {
  const F = FOSSILS[f.type];
  const u = S.units[f.unit];
  const ext = band === "ext";
  const where = challenge || S.realPlace ? unitName(S, f.unit, true) : `layer ${S.layers().indexOf(u) + 1}`;
  return `<p>${F.what[0].toUpperCase() + F.what.slice(1)}.</p><p>Found in <b>${where}</b> (${u.name.toLowerCase()}). It lived while that sediment was being laid down, so it is older than fossils in layers above it and younger than fossils below it${S.disturbed() ? " (once you have worked out the true order)" : ""}.</p>${ext && u.ma ? `<p class="hint">Model age: about ${fmtMa(u.ma)} (${periodAt(u.ma).name}). Drawn much larger than life so you can see it on the cliff.</p>` : `<p class="hint">Drawn much larger than life so you can see it on the cliff.</p>`}`;
}

/** Feedback when a student taps the wrong layer in a challenge. want = the unit that should come next. */
export function wrongTap(S, tapped, want, band) {
  const ext = band === "ext";
  const t = S.units[tapped], w = S.units[want];
  const L = (u) => (S.realPlace ? u.name : u.kind === "dyke" ? `the dyke (${u.label})` : `layer ${u.label}`);
  if (tapped === 0) return "Leave out the unlettered rock at the bottom: order only the lettered rocks.";
  if (t.kind === "dyke" || w.kind === "dyke") {
    if (t.kind === "dyke") return `Not yet. The dyke cuts through ${L(w)}, so ${L(w)} must already have been there: it is older than the dyke.`;
    return `Not yet. ${L(t)} was laid down across the worn-down top of the dyke and is not cut by it, so it formed after the dyke. Which rock comes before it?`;
  }
  if (S.isOverturned(tapped)) return ext
    ? `Not yet. These beds are overturned: look at the graded bedding (pebbles and coarse grains collect at the original base of each bed). ${L(w)} is older than ${L(t)}.`
    : `Not yet. This stack has been flipped upside down. Look closely: in each layer the big grains settled at the bottom first, and here they are at the top. So which way was up? ${L(w)} is older than ${L(t)}.`;
  if (S.hasType("tilt")) return `Not yet. Follow the layers along the slope: ${L(w)} sits underneath ${L(t)} in the tilted pile, so ${L(w)} is older.`;
  return `Not yet. ${L(w)} lies below ${L(t)}, so ${L(w)} formed first and is older.`;
}

export const CHALLENGES = [
  { id: "flat", label: "Flat layers", band: "y8", intro: "These layers have not been disturbed. Tap them from <b>oldest</b> to <b>youngest</b>." },
  { id: "tilted", label: "Tilted", band: "y8", intro: "These layers were tilted after they formed, then the top was worn flat. Tap them from <b>oldest</b> to <b>youngest</b>." },
  { id: "illawarra", label: "Illawarra escarpment", band: "y8", intro: "The real rock layers of the escarpment behind Woonona and Wollongong, simplified. Tap them from <b>oldest</b> to <b>youngest</b>." },
  { id: "dyke", label: "Dyke", band: "ext", intro: "Magma cut through some of these layers; then the land was worn flat and a new layer was laid on top. Put every rock, including the dyke, in order from <b>oldest</b> to <b>youngest</b>." },
  { id: "overturned", label: "Overturned", band: "ext", intro: "These layers may not be the right way up. Zoom in: coarse grains and pebbles settle first, at the <b>original bottom</b> of each layer. Then tap from <b>oldest</b> to <b>youngest</b>." },
];

/** Follow-up question after a cliff is ordered: which of two fossils lived first? Returns null if there are not two. */
export function fossilQuestion(S, R = Math.random) {
  const vis = S.visibleFossils();
  const byUnit = new Map();
  for (const f of vis) if (!byUnit.has(f.unit)) byUnit.set(f.unit, f);
  const fs = [...byUnit.values()].filter((f, i, a) => a.findIndex((g) => g.type === f.type) === i);
  if (fs.length < 2) return null;
  const a = fs[Math.floor(R() * fs.length)];
  let b; do b = fs[Math.floor(R() * fs.length)]; while (b === a);
  const older = S.isOlder(a.unit, b.unit) ? a : b;
  const nm = (f) => `the ${FOSSILS[f.type].name.toLowerCase()} in ${S.realPlace ? S.units[f.unit].name : `layer ${S.units[f.unit].label}`}`;
  return {
    q: `Which lived first: ${nm(a)} or ${nm(b)}?`,
    options: [nm(a), nm(b), "We can't tell without knowing their ages in years"].map((s) => s[0].toUpperCase() + s.slice(1)),
    answer: older === a ? 0 : 1,
    why: `${nm(older)[0].toUpperCase() + nm(older).slice(1)} is in an older layer, so it lived first. Relative dating gives the order without needing ages in years.`,
  };
}

export const QUIZ = [
  { q: "In undisturbed rock layers, which layer is the oldest?", options: ["The top layer", "The thickest layer", "The bottom layer", "The layer with the most fossils"], answer: 2,
    why: "Each layer is laid down on top of the ones already there, so the bottom layer formed first." },
  { q: "What does relative dating tell you?", options: ["The exact age of a rock in years", "Which rocks are older or younger than others", "How thick each layer is", "What the rock is made of"], answer: 1,
    why: "Relative dating puts rocks and events in order (older or younger) without giving an age in years." },
  { q: "A fossil fish is in layer 2 and a fossil fern is in layer 5 (counting up from the bottom of undisturbed layers). Which is true?", options: ["The fern is older", "The fish is older", "They are the same age", "You can't tell anything"], answer: 1,
    why: "Layer 2 is lower, so it is older. The fish lived before the fern." },
  { q: "Why does the law of superposition say the layers must be undisturbed?", options: ["Disturbed layers have no fossils", "Earth movements can tilt or flip layers, so the oldest might not be at the bottom any more", "Disturbed rocks are not sedimentary", "It is easier to measure flat layers"], answer: 1,
    why: "Folding can turn a stack upside down. Then the oldest layer can end up on top." },
  { q: "One layer is three times thicker than the others. What does that tell you about its age?", options: ["It is the oldest", "It is the youngest", "Nothing: thickness does not tell you age", "It is three times older"], answer: 2,
    why: "A thick layer just had more sediment (or more time). Its position in the stack tells you its relative age, not its thickness." },
  { q: "Which kind of rock is the law of superposition mainly used for?", options: ["Sedimentary rock laid down in layers", "Granite that cooled underground", "Marble", "Lava inside a volcano"], answer: 0,
    why: "Sedimentary rocks (and layers of volcanic ash) build up layer on layer, so their order shows their relative age." },
  { band: "ext", q: "A dyke cuts through layers A, B and C. Later the land was worn flat and layer D was laid down across the top of the dyke. What is the order?", options: ["Dyke, A, B, C, D", "A, B, C, dyke, D", "D, C, B, A, dyke", "A, dyke, B, C, D"], answer: 1,
    why: "Cross-cutting: the dyke is younger than the layers it cuts (A to C). D was deposited on the worn surface across the dyke, so it is younger still." },
  { band: "ext", q: "How can geologists find the actual age of a layer in years?", options: ["Count the layers", "Measure its thickness", "Radiometric dating of minerals in it, such as zircon in volcanic ash", "Superposition alone"], answer: 2,
    why: "Absolute (radiometric) dating uses the steady decay of radioactive atoms. Superposition alone only gives the order." },
];

export const MIXUPS = [
  { wrong: "The thickest layer is the oldest.", right: "Thickness shows how much sediment piled up, not when. Position in the stack shows relative age." },
  { wrong: "Each layer took one year to form.", right: "A layer can take anything from days (a flood, an ash fall) to millions of years. Layers are not like tree rings." },
  { wrong: "Relative dating tells you how old a rock is in years.", right: "It only tells you older or younger. Ages in years need absolute (radiometric) dating." },
  { wrong: "The bottom layer is always the oldest, no matter what.", right: "Only in undisturbed layers. Folding can turn a stack upside down, and a dyke can cut in later. (Extension: try the dyke and overturned cliffs.)" },
];

export const SIMPLIFICATIONS = [
  "A layer that takes thousands to millions of years to form is laid down in a few seconds here.",
  "Layer thicknesses (about 1 to 2 m) and the 14 m block are a model; real formations can be tens to hundreds of metres thick.",
  "Small fossils are drawn 10 to 20 times larger than life (real trilobites were mostly 3 to 10 cm long), all facing you on the cliff face. Real fossils are rare: most dead organisms rot away before they are buried.",
  "Tilting happens in one step here; real tilting and folding happen slowly as plates move. Erosion planes the top flat each time.",
  "The model clock (Extension) starts in the Carboniferous (about 340 million years ago) and gives each layer a made-up duration. Period boundaries and fossil age ranges are real.",
  "Sand, gravel and ash beds are drawn normally graded (coarse at the base); mud, lime and coal beds are drawn ungraded. Real beds vary, so geologists use several way-up clues together.",
  "The Illawarra cliff is squashed to fit (about 30 m of real rock per metre here) and the thin Garie and Newport formations are left out.",
];

export const SOURCES = [
  "NSW Science 7–10 Syllabus (2023), Stage 4 Change, Geological change: law of superposition and its glossary entry.",
  "N. Steno (1669) De solido intra solidum naturaliter contento dissertationis prodromus (first statement of superposition).",
  "Period boundaries: International Commission on Stratigraphy, International Chronostratigraphic Chart v2023/09.",
  "Illawarra sequence: Geological Survey of NSW, Wollongong–Port Hacking 1:100 000 geological sheet and notes; Narrabeen Group units (Coal Cliff Sandstone, Wombarra Claystone, Scarborough Sandstone, Stanwell Park Claystone, Bulgo Sandstone, Bald Hill Claystone).",
  "Fossil habitats by period: Geoscience Australia, Geologic time and Australian fossils.",
];
