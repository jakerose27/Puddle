# parker history

## Project Context
Project: Puddle
Language/Stack: C# MonoGame (SDL2, TiledSharp, XNA pattern)
Goal: Port to browser, deploy to Vercel
Branch: squad/web-port-spike
Owner: Jake
Approach: Docs-first. No big rewrites until feasibility is documented in docs/web-port-feasibility.md.
Key files: Game1.cs (game loop), Program.cs (entry point), Level.cs, Controls.cs, Content/ (assets), SDL.dll, TiledSharp.dll

## Learnings

### Spike 2 — TypeScript + Phaser 3 scaffold (2026-05-03T18:23:24.325-07:00)

**What was built:**
- `web/` directory at repo root: TypeScript + Phaser 3 + Vite scaffold
- `web/src/main.ts` — Phaser game entry, 704×704 canvas (22×32px map), Arcade Physics with gravity
- `web/src/scenes/GameScene.ts` — loads Level1-1.json, spawns player at startX/startY, renders Ground blocks as rectangles, left/right arrow key movement with walk animation
- `web/scripts/tmx-to-json.js` — Node.js TMX→Tiled JSON converter (zero external deps, regex-based XML parsing)
- `web/public/assets/` — copied PNGs from Content/ (background.png, brick.png, PC/stand.png, PC/walk.png, Enemies/spikeball.png, etc.)
- `web/public/assets/levels/Level1-1.json` — converted Tiled JSON (committed)
- `web/README.md` — setup, conversion workflow, Vercel deploy instructions
- `vercel.json` — repo root, framework: null, buildCommand: `cd web && npm install && npm run build`, outputDirectory: `web/dist`

**Key decisions made:**
- Phaser 3 uses `this.load.tilemapTiledJSON()` only — NO `.tmx` direct load. This was the core doc correction required.
- Background tile layer (`Level1-1.tmx`) has `visible="0"`. The C# game renders background.png stretched. Web port matches: background.png stretched to 704×704. Tile rendering vestigial.
- TMX tile-object y-coordinate convention: `(x, y)` = bottom-left. Must subtract `height/2` to get center for Phaser placement.
- Object types in TMX: fully-qualified C# names, e.g. `Puddle.Block`, `Puddle.Roller`, `Puddle.Geyser`. Factory map must preserve these keys.
- startX=96, startY=640 (player spawn from map properties). Map is 22×22 tiles = 704×704px.
- Walk spritesheet: `PC/walk.png` is 128×32 (4 frames × 32px). Stand: `PC/stand.png` is 32×32.

**TMX conversion approach:**
- Tiled CLI not available on this machine. `tiled` command not found.
- Wrote `web/scripts/tmx-to-json.js` — pure Node.js, regex-based XML parsing.
- Key fix: self-closing `<objectgroup ... />` tags (empty Blocks and Gate layers) required a separate regex branch. Initial version had a bug where `[^>]*` matched the `/` in `/>`, causing the next objectgroup's body to be absorbed. Fixed using `(?:[^>\/]|\/(?!>))*` pattern.
- Script handles: tile layers (GID arrays), object layers (with properties), tilesets, map properties.
- All 7 layers parsed correctly: Background(tile), Blocks(empty), Items(25 objects), Ground(222 objects), Pipe(1 object), Enemies(17 objects), Gate(empty).

**Asset structure in Content/:**
- `Content/background.png` — 640×448 RGBA (full background stretched in game)
- `Content/brick.png` — 32×32 (single tile, firstgid=281 in TMX)
- `Content/PC/stand.png` — 32×32 player idle
- `Content/PC/walk.png` — 128×32 player walk (4 frames)
- `Content/Enemies/spikeball.png` — 32×32
- Tilesets: background (firstgid=1), brick (281), button (282), push_block (289), fireball (293), pipe (295), jetpack (311), SpikeBall (312), roller (313), checkpoint (317)

**Build status:**
- `npm run build` succeeds (TypeScript + Vite). Output: `web/dist/`.
- Bundle: ~1.48MB (Phaser is large). Acceptable for a spike.

**Feasibility doc corrections (Ash review):**
- Fixed all instances of "Phaser 3 reads .tmx directly" — Phaser only reads Tiled JSON
- Updated stack table Level format entry
- Added delta-time physics risk to Option 2 table
- Added Q8 (TMX→JSON workflow) and Q9 (delta-time scope) to Blockers
- Added Background tile layer hidden note as callout under spike criteria
- Updated Recommendation section to note TMX requires conversion

**Key file paths:**
- `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/index.html`
- `web/src/main.ts`, `web/src/scenes/GameScene.ts`
- `web/scripts/tmx-to-json.js`
- `web/public/assets/levels/Level1-1.json`
- `web/public/assets/images/` (copied from Content/)
- `vercel.json` (repo root)
- `docs/web-port-feasibility.md` (corrected)
- `docs/context.md` (updated)
- `.squad/decisions/inbox/parker-feasibility-fix.md`
- `.squad/decisions/inbox/parker-spike2-findings.md`
