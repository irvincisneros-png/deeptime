# DeepTime: Geological change

A 3D simulator for NSW **Year 8 Science, Change focus area, Geological change** (Science 7–10 (2023), Stage 4, outcome SC4-CHG-01; school codes Y8 7.3.1–7.3.9). Built one station per dot point; the first is **7.3.8, the law of superposition**.

Static site, no build step. Three.js r169 vendored in `assets/vendor/three`, loaded through an import map.

## Run locally
```bash
python3 -m http.server 8440
```
Then open http://localhost:8440/. Tests: `for t in tests/*.mjs; do node $t; done`.

## Station 1: Rock layers (7.3.8)
- **Build layers:** choose where the sediment comes from (shallow sea → limestone, deep-sea mud → shale, river sand → sandstone, flood gravel → conglomerate, swamp forest → coal, volcanic ash → tuff). Each layer settles on the last, burying living things as fossils that fit the habitat and period. Then tilt the block, wear the top away, and (Extension) intrude a dyke or overturn it.
- **Date the cliff:** tap layers from oldest to youngest on generated cliffs (flat, tilted), the real **Illawarra escarpment** sequence, and (Extension) cliffs with a dyke or overturned beds (graded bedding as the way-up clue). Wrong taps get a reason; finished cliffs get a fossil "which lived first?" question.
- Model: `assets/js/world/levels/strataModel.js` (pure, tested in `tests/strataModel.test.mjs`). The rock shader (`strataShader.js`) runs the same history-reversal loop per pixel, so what you see is what a click reports.

## Engine provenance
Engine layer copied from **MixLab** (`irvincisneros-png/mixlab`) at commit `5ac5292`, which itself is CellScape's engine at `c803344`. Changes: DeepTime branding, bands `y8`/`ext`, `deeptime.*` storage keys, no clay look (the rock shader is custom), level registry `strata`.

## Docs
- `docs/PLAN.md`: stations, status, follow-ups.
- `docs/HANDOVER.md`: how to continue in a new session.
