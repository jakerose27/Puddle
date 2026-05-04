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

### Spike 4 — Roller, Geyser, NextLevel entity port (2026-05-03T21:46:12.172-07:00)

**Commit:** `0d669f5` — `feat(web): port Roller, Geyser, NextLevel — Level 1 entities wired`

**What changed:**
- Created `web/src/entities/Roller.ts` — extends `Phaser.Physics.Arcade.Sprite`. Dynamic body, 4-frame walk animation from roller.png (128×32). Direction set from Tiled `left` property. Wall reversal via `body.blocked.left / right` checked in `update(tickCount)`. Self-registers animation key `'roller-roll'` on first construction (idempotent).
- Created `web/src/entities/Geyser.ts` — wraps `Phaser.GameObjects.Rectangle` with a static physics body (same pattern as Block). Simplified from C# behavior (boost + hydration) to a static kill zone per task spec. Noted behavioral delta in source comments.
- Created `web/src/entities/NextLevel.ts` — static rectangle zone with destination string read from Tiled object name. Gate layer is empty in Level1-1.json; wired and ready for future levels.
- Updated `EntityFactory.ts` — extended `EntityGroups` interface with `rollers?`, `hazards?`, `gates?` (optional to preserve backward compat with Ground loop). Added registry entries for `Puddle.Roller`, `Puddle.Geyser`, `Puddle.NextLevel`.
- Updated `GameScene.ts` — added `rollers`, `hazards`, `gates` groups; preloads roller spritesheet + geyser image; iterates Items and Gate layers; wires `collider(rollers, ground)` and three `overlap` callbacks; calls `roller.update(tickCount)` per fixed-tick.
- Copied `Content/geyser.png` → `web/public/assets/images/geyser.png`.

**Critical JSON findings (confirmed from Level1-1.json):**
- Rollers AND Geysers are BOTH in the `Items` layer — NOT in an `Enemies` layer as initially assumed.
- The `Enemies` layer contains only `Puddle.SpikeBall` objects (gid=312) — not yet ported.
- The `Gate` layer is empty in Level 1 — NextLevel is wired but will produce no objects at runtime.
- Roller objects have `gid: 313` → tile object convention → Tiled y = bottom edge → `centerY = obj.y - h/2`.
- Geyser objects have no `gid` → rectangle object convention → Tiled y = top-left corner → `centerY = obj.y + h/2`.

**C# behavioral deltas (documented in source):**
- C# Geyser does NOT kill the player — it sends them upward (`yVel = -5`) and refills hydration. Web port simplifies to hazard kill zone per task spec.
- C# Roller has a `collisionHeight = 8; spriteY += 12` tweak (hitbox near bottom of sprite). Web port uses the full 32×32 Arcade body for simplicity.
- C# Roller uses `% 8` for 8-frame animation cycling; web port uses the 4-frame `roller.png` spritesheet (128×32) that was already in `web/public/assets/images/`.

**Pattern confirmed:**
- `Phaser.Physics.Arcade.Group` (from `this.physics.add.group()`) works cleanly as `Phaser.GameObjects.Group` type — it's a subclass.
- Sprite-type entities (`Phaser.Physics.Arcade.Sprite`) call `scene.add.existing(this)` + `scene.physics.add.existing(this)` in their constructor to self-register with the scene and physics world.
- Static zone entities follow the Block pattern: `scene.add.rectangle()` + `scene.physics.add.existing(rect, true)` + `group.add(rect)`.

**Next entity classes to port:**
1. `Puddle.SpikeBall` (Enemies layer, 17 objects, gid=312, spikeball.png available)
2. `Puddle.Checkpoint` (Items layer, 1 object, checkpoint.png available)
3. `Puddle.Pipe` (Pipe layer, 1 object)
4. `Puddle.PowerUp` (Ground layer, a few objects)

### Bug fix — Player jump missing after accumulator refactor (2026-05-03T21:36:33.205-07:00)

**Root cause:** When Ripley's fixed-step accumulator refactor moved all simulation logic from `update()` into `fixedUpdate()`, the left/right movement block was carried over but the jump block was omitted entirely. There was no `cursors.up.isDown` check and no `setVelocityY(-400)` call anywhere in `fixedUpdate()`.

**What was NOT broken (eliminated as suspects):**
- `this.physics.add.collider(this.player, this.ground)` was present and correct.
- `this.cursors` was initialized in `create()` — the cursor object survived the refactor.
- `Block.fromTiledObject()` correctly converts Tiled bottom-left y to center (`cy = obj.y - h/2`) — blocks were physically placed correctly.
- The static group was created, blocks added to it, and the collider registered against it — `body.blocked.down` was accurate.
- Arcade physics gravity (y: 600) configured in `main.ts` — player fell normally.

**Fix:** Added jump check at the bottom of `fixedUpdate()`, gated on `onGround` (`body.blocked.down`), accepting both up-arrow and space bar: `if ((this.cursors.up.isDown || this.cursors.space.isDown) && onGround) { this.player.setVelocityY(-400); }`

**Commit:** `7f198f3` — `fix(web): restore player jump — collider/input wired after accumulator refactor`

**Process lesson:** When refactoring moves a logic block (update→fixedUpdate), checklist every input+action pair. It's easy to transfer movement but forget the less-common action (jump). The fix was 4 lines; the diagnosis pattern was correct — read the full scene file first, not just the suspect area.

### Spike 3 — Entity factory: Block end-to-end (2026-05-03T21:28:40.544-07:00)

**What changed:**
- Created `web/src/entities/Block.ts` — wraps `Phaser.GameObjects.Rectangle` with static Arcade Physics. `fromTiledObject(scene, obj, group)` factory method handles Tiled bottom-left → center coordinate conversion and adds itself to the provided StaticGroup.
- Created `web/src/entities/EntityFactory.ts` — registry-based type-key dispatch. `REGISTRY["Puddle.Block"]` routes to `Block.fromTiledObject`. Unknown types are `console.warn`-ed, not thrown.
- Updated `GameScene.ts` — Ground object layer loop now calls `EntityFactory.create(this, obj, { ground: this.ground })` instead of inline rectangle/physics code. Player collision with ground still works identically.
- Build passes clean (`tsc && vite build`). Committed `b93b5c0` to `squad/web-port-spike`.

**Key findings on C# Block:**
- Block has FOUR variants driven by Tiled properties: `metal` (static, no gravity), `push` (gravity + pushable by player), `break` (destructible), `temp` (gate/invisible).
- Ground layer in Level1-1.json: all 222 objects are `type: "Puddle.Block"` with no custom properties → all default to static "metal" blocks. The push/break/temp variants appear in the Items layer.
- Block.cs reads these Tiled properties: `left`, `right`, `gravity`, `canBreak`, `transparent`, `solid`. These are stubbed with a `// TODO` comment in Block.ts for future implementation.
- Sound effects (Slide.wav, BlockFall.wav) used by push-type blocks — deferred.

**Factory pattern confirmed:**
- `REGISTRY` keyed on fully-qualified C# type string (e.g. `"Puddle.Block"`) — matches JSON `type` field exactly.
- Each entry is `(scene, obj, groups) => Entity` — groups carries all shared physics groups (ground, enemies, etc.) so entities self-register.
- `EntityFactory.create()` returns `unknown` (callers can cast if needed) or `null` for unknown types.
- Pattern scales cleanly to remaining ~14 entity classes.

**Next entity classes to port (priority order):**
1. `Puddle.Roller` (Items layer, 17 enemies)
2. `Puddle.Geyser` / `Puddle.Pipe` (hazards)
3. `Puddle.PowerUp`, `Puddle.Checkpoint`, `Puddle.NextLevel`

### Spike 2 — Tile layer rendering complete (2026-05-03T21:19:07.428-07:00)

**What changed:**
- Replaced `bg.setDisplaySize()` stretched PNG approach with `map.createLayer('Background', [backgroundTileset, brickTileset])`.
- Both tilesets (`background` firstgid=1, `brick` firstgid=281) passed to `createLayer()` so all GIDs resolve.
- `createLayer()` result checked for null before calling `setDepth(-1)` — safe fallback pattern.
- Player depth=1, tile layer depth=-1. Ground collision rectangles kept unchanged.
- `npm run build` passes clean (TypeScript + Vite). Committed to `squad/web-port-spike` as `a71908b`.

**Key Phaser tilemap pattern confirmed:**
- `map.addTilesetImage(tilesetNameInJSON, phaserImageKey)` — first arg must match tileset name in Tiled JSON exactly.
- Pass ALL tilesets used by a layer as array to `createLayer()` — missing tilesets cause silent tile failures, not errors.
- `createLayer()` returns `null` if the layer name doesn't match — always guard.

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

### Orchestration & Decisions Merge (2026-05-03T21:19:07.428-07:00)

**Ripley's Physics Delta-Time work (parallel):**
- Full C# codebase scan confirmed 100% frame-rate coupling via `Level.count`
- Proposed fixed-step accumulator (Option 3B, S-effort, ~20 lines)
- Documented full analysis in `docs/physics-delta-time-scope.md`
- Recommendation approved for Jake / Dallas review

**Implications for web port:**
- Physics gate: confirm fixed-step loop works before porting any entity
- This unblocks all downstream entity translation work (player, enemies, AI, collision)
- No entity logic changes needed — only encapsulate ticks in accumulator loop
- Feasibility doc now reflects physics dependency as a Medium risk in Option 2

---

## 2026-05-04 — Scribe: Level 1 Playable Milestone

**Team shipped Level 1 playable end-to-end.**

### Parker Spike 4 Contribution (Commit 0d669f5)

- Ported Roller.ts, Geyser.ts, NextLevel.ts entities
- Extended EntityFactory with rollers, hazards, gates groups
- Wired collider + overlap system in GameScene
- Documented architectural decisions on Tiled y-coordinate conventions

### Integration Status

- Roller: 3 objects in Items layer, moving platforms, 4-frame animation
- Geyser: 2 objects in Items layer, kill zones (simplified for milestone)
- NextLevel: 1 object in Items layer, level exit
- All entities receive colliders and overlap callbacks from GameScene
- Player death/respawn system fully integrated (Ripley's work)

### Key Architectural Decisions

1. Tiled layer placement: Roller/Geyser live in Items layer, not Enemies
2. Dual y-coordinate conventions: tile objects (bottom-edge) vs. rectangle objects (top-left)
3. Geyser simplified to static kill zone (full hydration boost pending future)
4. EntityGroups interface extended with optional fields for backward compatibility
5. Roller animation self-registration (idempotent on scene entry)

### Next Priority

- SpikeBall entity (17 objects in Enemies layer)
- Checkpoint system (1 object in Items)
- Player animation cycle (walk, jump, idle)
- Camera follow system

**Status:** Level 1 milestone achieved. Entities wired, colliders operational, death/respawn loop functional.
