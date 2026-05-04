# Puddle Web Port Context (single source of truth)

## Current state
- Branch: squad/web-port-spike
- Last checkpoint commit: Spike 2 TypeScript+Phaser3 scaffold + Vercel config
- What runs today: docs/repo-map.md ✅, docs/web-port-feasibility.md ✅ (revised by Parker), Phaser 3 scaffold ✅ (`npm run dev` in `web/`), Vercel config ✅ (`vercel.json`)
- What does not run today: no Mac C# build yet, no full entity port (only player placeholder), no audio, no enemies or game logic, no Vercel project created yet (Jake's account has no project — import from GitHub when ready)

## Decisions made
- Decision 1: **TypeScript + Phaser 3** is the recommended port path (Dallas). Corrected: TMX files require export to Tiled JSON — they are NOT loaded directly. See docs/web-port-feasibility.md.
- Decision 2: MonoGame WASM (Option 1) is blocked by .NET 4.5 / MonoGame 3.0 toolchain debt — two removed namespaces, compiled binary font, vendored TiledSharp. See docs/repo-map.md.
- Decision 3: TMX → JSON conversion uses `web/scripts/tmx-to-json.js` (no external dependencies). Run via `npm run convert-levels` after editing a level in Tiled.
- Decision 4: Background tile layer (`Level1-1.tmx`, `visible="0"`) is vestigial. Web port matches original: `background.png` stretched to canvas. Tile rendering not used.

## Next 3 tasks (keep small)
1. **Jake: Create Vercel project** — import `jakerose27/Puddle` from GitHub at vercel.com; build command and output dir are set in `vercel.json`. Verify deploy succeeds.
2. **Delta-time physics scoping** — Enumerate all entity classes that use `count++` tick counters. Produce a scope estimate before the 3–6 week port estimate can be trusted (Q9 from feasibility doc).
3. **Entity factory spike** — Port one entity class (e.g., `Block`) end-to-end in TypeScript, wire it from the Ground object layer using the `Puddle.Block` type key. Validates the factory pattern before porting all ~15 classes.

## Active spike(s)
- Spike name: Spike 2 — Web feasibility probe (TypeScript + Phaser 3)
  - Goal: Load one TMX level and render one sprite in-browser from the existing Content/ assets
  - Pass criteria: Visible game element in browser window served by a local dev server ✅ PASSED
  - Notes: Background tile layer is hidden/vestigial; player renders at startX/startY from map properties; Ground blocks render as colored rectangles; left/right arrow input works.
  - TMX conversion: `web/scripts/tmx-to-json.js` (Node.js, no external deps). Output at `web/public/assets/levels/Level1-1.json`.

## If token capped or stopping
- Run: ./scripts/pause.sh
- Then resume with: ./scripts/resume.sh

