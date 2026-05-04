# Puddle Web Port Context (single source of truth)

## Current state
- Branch: squad/web-port-spike
- Last commits:
  - Ripley (commit 225af46): Fixed-step accumulator — `GameScene.update()` → `fixedUpdate()` at 60 Hz, `tickCount` mirrors `Level.count`
  - Parker (commit b93b5c0): Entity factory spike — `Block.ts` + `EntityFactory.ts`, Ground object layer now routes through `EntityFactory.create()` with fully-qualified type keys (e.g. `"Puddle.Block"`)
  - Ash (gate approved): `docs/web-port-feasibility.md` — TypeScript + Phaser 3 path formally committed, all TMX/JSON/delta-time concerns resolved
- What runs today: docs/repo-map.md ✅, docs/web-port-feasibility.md ✅ (revised, gate-approved), Phaser 3 scaffold ✅ (`npm run dev` in `web/`), Vercel config ✅ (`vercel.json`), Fixed-step accumulator ✅, Entity factory pattern ✅
- What does not run today: no Mac C# build yet, not all 15 entity classes ported, no audio, no Vercel project created yet (Jake's account has no project — import from GitHub when ready)

## Decisions made
- Decision 1: **TypeScript + Phaser 3** is the recommended port path (Dallas). Corrected: TMX files require export to Tiled JSON — they are NOT loaded directly. See docs/web-port-feasibility.md.
- Decision 2: MonoGame WASM (Option 1) is blocked by .NET 4.5 / MonoGame 3.0 toolchain debt — two removed namespaces, compiled binary font, vendored TiledSharp. See docs/repo-map.md.
- Decision 3: TMX → JSON conversion uses `web/scripts/tmx-to-json.js` (no external dependencies). Run via `npm run convert-levels` after editing a level in Tiled.
- Decision 4: Background tile layer (`Level1-1.tmx`, `visible="0"`) is vestigial. Web port matches original: `background.png` stretched to canvas. Tile rendering not used.

## Next tasks (priority order)
1. **Port remaining entity classes using factory pattern** — priority order: Roller (enemy movement), Geyser/Pipe (hazards), PowerUp/Checkpoint/NextLevel. Each entity self-registers into the appropriate physics group. Defer Block variants (push/break/temp) until physics confirmed stable.
2. **Wire player entity through factory** — currently hardcoded spawn in GameScene. Replace with factory call using `"Puddle.Player"` type key from Tiled, validate player movement + collision still works.
3. **Begin porting Level.count-based logic** — enumerate all frame-based timers (animation frames, hurt flashes, AI cadence, projectile age, etc.) and start converting them to use `GameScene.tickCount`. Validate that animation and AI loop at correct cadence with fixed-step accumulator.
4. **Run full Spike 2 smoke test on Vercel** — after factory wiring changes, confirm tilemap + sprite + no console errors still holds. (Jake: Create Vercel project from `jakerose27/Puddle` when infrastructure ready.)

## Active spike(s)
- Spike name: Spike 2 — Web feasibility probe (TypeScript + Phaser 3)
  - Goal: Load one TMX level and render one sprite in-browser from the existing Content/ assets
  - Pass criteria: Visible game element in browser window served by a local dev server ✅ PASSED
  - Notes: Background tile layer is hidden/vestigial; player renders at startX/startY from map properties; Ground blocks render as colored rectangles; left/right arrow input works.
  - TMX conversion: `web/scripts/tmx-to-json.js` (Node.js, no external deps). Output at `web/public/assets/levels/Level1-1.json`.

## If token capped or stopping
- Run: ./scripts/pause.sh
- Then resume with: ./scripts/resume.sh

