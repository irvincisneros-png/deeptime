# DeepTime: handover prompt for a new session

Paste below the line into a new Claude Code session opened in `~/Documents/Local Projects/Science Simulator Website/`.

---

You're continuing **DeepTime**, a 3D simulator for NSW **Year 8 Geological change** (Change focus area, SC4-CHG-01, school codes Y8 7.3.1–7.3.9). Work in `deeptime/`, branch `main`, repo `irvincisneros-png/deeptime` (public, live on Pages at https://irvincisneros-png.github.io/deeptime/; every push to main goes to students). Station 1 (7.3.8 law of superposition, level `strata`) is done; the owner wants the whole topic eventually.

## Read first
1. `deeptime/docs/PLAN.md` (stations, status, follow-ups) and `deeptime/README.md`.
2. `mixlab/docs/LEVEL_BRIEF.md` and `cellscape/LEVEL_BRIEF.md` (the level contract; DeepTime uses bands `y8`/`ext`).
3. `deeptime/assets/js/world/levels/strata*.js` (reference station: model, shader, fossils, content).

## Key facts
- Static site, Three.js r169 vendored. Levels registered in `assets/js/world/shell.js` `LEVELS`; `?start=<id>`, `?year=8|ext`, `?code=Y8-7.3.8`.
- Dev server: `.claude/launch.json` config `deeptime` (port 8440).
- Tests: `for t in tests/*.mjs; do node $t; done`. Syntax: `node --input-type=module --check < file.js`.
- Hidden browser pane stalls rAF: take a screenshot to wake it, or shim `requestAnimationFrame` before load.
- Console handle: `window.deeptime.engine.current.model` is the live strata model; `.refresh()` redraws.

## How the owner likes to work
Decide, don't ask (but ask before outward-facing actions: public repo, Pages, hub links). Science accuracy first, cited data, honest simplifications on the page. Polished realistic 3D. Codex adversarial review max 2 rounds. Commit with the Co-Authored-By line from the system attribution reminder.
