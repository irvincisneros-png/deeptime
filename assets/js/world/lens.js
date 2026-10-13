// The year-level lens: one setting that adjusts vocabulary, depth, missions and quizzes.
// DeepTime is a Year 8 unit with two bands: "y8" (core) and "ext" (Extension: geology beyond the Year 8 syllabus, e.g. cross-cutting, way-up, absolute dating).
// Content can be written as { "y8": "...", "ext": "..." } —
// pick() returns the most detailed variant at or below the current band.

export const BANDS = [
  { id: "y8", label: "Year 8", short: "Y8" },
  { id: "ext", label: "Extension (beyond Year 8)", short: "Ext" },
];
const ORDER = BANDS.map((b) => b.id);
const KEY = "deeptime.lens";

let current = "y8";
try {
  const q = new URLSearchParams(location.search).get("year");
  // ?year=8 → core, ?year=ext (or 9, 10) → Extension
  const fromQ = q && (/^(ext|9|10|y9|y10)$/i.test(q) ? "ext" : /^y?8$/i.test(q) ? "y8" : null);
  current = fromQ || localStorage.getItem(KEY) || current;
  if (!ORDER.includes(current)) current = "y8";
} catch { /* storage blocked: keep default */ }

const subs = new Set();

export const lens = {
  get band() { return current; },
  get index() { return ORDER.indexOf(current); },
  set(band) {
    if (!ORDER.includes(band) || band === current) return;
    current = band;
    try { localStorage.setItem(KEY, band); } catch { /* ignore */ }
    for (const f of subs) f(band);
  },
  /** true if the current band is at least `band` */
  atLeast(band) { return ORDER.indexOf(current) >= ORDER.indexOf(band); },
  /** choose the most detailed variant available at or below the current band */
  pick(v) {
    if (v == null || typeof v !== "object" || Array.isArray(v)) return v;
    for (let i = ORDER.indexOf(current); i >= 0; i--) if (v[ORDER[i]] != null) return v[ORDER[i]];
    for (const b of ORDER) if (v[b] != null) return v[b];
    return "";
  },
  /** keep items whose `band` (minimum) is at or below current and `maxBand` (if any) at or above */
  filter(items) {
    const i = ORDER.indexOf(current);
    return items.filter((it) => (it.band ? ORDER.indexOf(it.band) <= i : true) && (it.maxBand ? ORDER.indexOf(it.maxBand) >= i : true));
  },
  on(f) { subs.add(f); return () => subs.delete(f); },
};
