# Decisions Log

## 2026-05-03 — Ash Gate Review

**Reviewer:** Ash (Code Reviewer)  
**Artifact reviewed:** `docs/web-port-feasibility.md` (Option 2 gate review)  
**Verdict:** REJECTED (fixed by Parker)

### Blocking Issue (Now Fixed)

**Phaser 3 does not natively load `.tmx` XML files.**

The feasibility doc incorrectly stated that Phaser 3's tilemap system supports `.tmx` directly. Phaser 3 only supports Tiled JSON export (`this.load.tilemapTiledJSON()`). No built-in `.tmx` XML parser exists in Phaser 3.

**Resolution:** Parker corrected the doc to state that TMX files require export to JSON before Phaser 3 can consume them.

### Additional Findings (Non-Blocking, All Addressed)

- **Delta-time physics refactor** added to Option 2 risk table (Medium complexity)
- **WAV music file memory loading** flagged as potential concern
- **Object Type Names** confirmed critical — fully-qualified class names like `Puddle.Geyser` preserved in JSON export
- **TMX Background Tile Layer** has `visible="0"` in Tiled; not rendered in original C# game
- **Open Questions Q8 & Q9** added: TMX conversion workflow and delta-time refactor scope

---

## 2026-05-03 — Parker: Feasibility Doc Corrections

**Author:** Parker (Web/Deploy)  
**Date:** 2026-05-03T18:23:24.325-07:00  
**Status:** Complete

### Corrections Applied

1. **Phaser 3 TMX support (Critical)**
   - Updated all references: Phaser 3 only supports Tiled JSON format
   - Stack table revised: "Tiled JSON (exported from .tmx via Tiled CLI or Tiled app)"
   - Spike pass criterion 1 now references `Level1-1.json` (Tiled JSON) not `.tmx`
   - Recommendation section notes TMX→JSON as minor pre-processing step

2. **Delta-time physics risk (Medium)**
   - Added to Option 2 risk table with explicit frame-rate coupling concern
   - Describes need for delta-time refactor before physics behavior is stable

3. **Open Questions expanded**
   - Q8: TMX → JSON batch conversion workflow
   - Q9: Delta-time physics refactor scope

4. **Background tile layer callout**
   - Noted `Level1-1.tmx` Background layer has `visible="0"`
   - Original C# game renders background as stretched PNG, not via tile layer
   - Phaser tile rendering for background layer is vestigial unless rendering approach changes

**Confirmation:** `docs/web-port-feasibility.md` is now accurate and ready for progression.

---

## 2026-05-03 — Spike 2: Background Tile Layer Rendering

**Author:** Parker (Web/Deploy)  
**Branch:** squad/web-port-spike  
**Commit:** a71908b  
**Date:** 2026-05-03T21:19:07.428-07:00

### Decision

Replace stretched PNG background approach with actual Phaser tilemap layer rendering using `map.createLayer('Background', [backgroundTileset, brickTileset])`.

### Rationale

- Background layer in Level1-1.json is a real tilelayer with 484 tile GIDs (1–281)
- Rendering via Phaser's tilemap API is the correct abstraction
- Passing both tilesets to `createLayer()` ensures all GIDs resolve correctly
- Null-guarding `createLayer()` prevents runtime crashes if layer name drifts

### Impact

- No changes to Vercel config, output path, or build toolchain
- Bundle size unchanged (~1.48MB)
- Player sprite, ground collision, and arrow-key movement unchanged
- Build: `npm run build` passes clean

### Out of Scope

- Physics-accurate ground collision using tile layer (still uses object-layer rectangles)
- Object layers (Items, Enemies, Pipe, Gate) — deferred to future spikes
- Camera bounds still use `map.widthInPixels / heightInPixels` (correct, unchanged)

---

## 2026-05-03 — Spike 2: Technical Findings

**Author:** Parker (Web/Deploy)  
**Date:** 2026-05-03T18:23:24.325-07:00  
**Status:** Complete

### TMX Conversion Method

**Tiled CLI:** Not available on this machine.  
**Method chosen:** Custom Node.js script `web/scripts/tmx-to-json.js` — zero external dependencies, regex-based XML parsing.

#### Conversion Script Gotchas

1. **Self-closing objectgroup tags:** Empty layers like `<objectgroup name="Blocks" ... />` use self-closing XML syntax. Initial regex was buggy, causing layers to absorb following layer data. Fixed using `(?:[^>\/]|\/(?!>))*` pattern.

2. **Tile-object y-coordinate:** Tiled tile objects report `(x, y)` as bottom-left corner. `GameScene.ts` compensates: `cy = obj.y - obj.height / 2` to center for Phaser placement.

3. **Tileset image source paths:** TMX uses relative paths like `../background.png`. Converter strips to basename only since Phaser loads images by key name, not path from JSON.

#### Script Re-export Workflow

```bash
cd web
npm run convert-levels
```

Runs: `node scripts/tmx-to-json.js ../Content/Levels/Level1-1.tmx public/assets/levels/Level1-1.json`

Must be re-run whenever a `.tmx` file is edited in Tiled.

### Asset Structure

| File | Size | Notes |
|---|---|---|
| `Content/background.png` | 640×448, RGBA | Full-level background; stretched to canvas |
| `Content/brick.png` | 32×32 | Single tile, firstgid=281 |
| `Content/PC/stand.png` | 32×32 | Player idle, single frame |
| `Content/PC/walk.png` | 128×32 | Player walk, 4×32px frames |
| `Content/PC/jump.png` | 32×32 | Player jump (not used in spike) |
| `Content/Enemies/spikeball.png` | 32×32 | SpikeBall enemy |
| `Content/roller.png` | 128×32 | Roller enemy (4 frames) |
| `Content/checkpoint.png` | 256×32 | Checkpoint tileset |
| `Content/button.png` | 224×32 | Button tileset (7 tiles) |
| `Content/push_block.png` | 128×32 | Push block (4 tiles) |

All tilesets are strip spritesheets (single row), 32px tile height.

### Object Type Naming

Object types use **fully-qualified C# class names** with `Puddle.` namespace prefix:

| TMX Type | Layer | Notes |
|---|---|---|
| `Puddle.Block` | Ground | Standard collision block (gid=281, brick tileset) |
| `Puddle.Geyser` | Items | Has width/height (32×32) |
| `Puddle.Roller` | Items | Has `direction` property (e.g., `left`) |
| `Puddle.Checkpoint` | Items | gid=324 (from checkpoint tileset) |
| `Puddle.SpikeBall` | Enemies | gid=312 (SpikeBall tileset) |
| `Puddle.Pipe` | Pipe | Has `destination`, `direction`, `end` properties |

**Factory map must use the full `Puddle.*` prefix.**

### Surprises and Blockers

1. **Tiled CLI unavailable:** Fallback to custom Node.js converter required. Script works but must be maintained for edge cases.
2. **Items layer initially missing:** Self-closing XML tag bug in script caused data loss. Fixed — all 7 layers now parse (Ground: 222 objects, Items: 25, Enemies: 17).
3. **Phaser bundle size:** ~1.48MB minified (340KB gzip). Acceptable for a game.
4. **No blocker:** Spike 2 passes. Level data is correct; team can proceed to delta-time scoping and entity porting.

---

## 2026-05-03 — Delta-Time Physics Scope Recommendation

**From:** Ripley (Engine Dev)  
**Date:** 2026-05-03T21:19:07.428-07:00  
**Status:** Recommendation — for Dallas / Jake review

### Summary

Full static scan of all .cs files confirms 100% frame-rate coupling via `Level.count`.

### Recommended Decision

**Adopt the fixed-step accumulator pattern (Option 3B) before or during TypeScript port.**

### Rationale

- Zero changes to entity logic, physics constants, or animation timing expressions
- Fixes all 5 top browser risks (rAF not locked to 60 Hz, physics calibration, AI cadence, collision, Draw/Update timing split)
- Translates directly to `requestAnimationFrame + accumulator` loop in TypeScript
- Estimated effort: **S** (2–3 files, ~20 lines of Game1.cs equivalent)

### Implementation Gate

Before porting any entity: confirm the fixed-step loop works in the C# prototype (or TypeScript equivalent). All downstream entity work is unblocked once this passes smoke test.

### Reference

Full analysis: `docs/physics-delta-time-scope.md`

---

# Architectural Decisions — Roller, Geyser, NextLevel Entity Port

**Author:** Parker (Web/Deploy)  
**Date:** 2026-05-03T21:46:12.172-07:00  
**Commit:** `0d669f5`  
**Branch:** `squad/web-port-spike`

---

## Decision 1: Tiled layer placement for Rollers and Geysers

**Finding:** Rollers (`Puddle.Roller`) and Geysers (`Puddle.Geyser`) both live in the **Items** object layer, not in a dedicated Enemies layer. The `Enemies` layer contains only `Puddle.SpikeBall` objects. The `Gate` layer is empty in Level1-1.json.

**Implication:** Any future entity creation that reads Tiled layers must consult the actual JSON rather than assuming layer-name conventions match C# class names. When porting new entity types, always inspect the JSON first.

---

## Decision 2: Two y-coordinate conventions coexist in the same level JSON

Tiled JSON has two object placement conventions, both present in Level1-1.json:

| Object type | Has `gid`? | Tiled y semantics | Center y formula |
|---|---|---|---|
| Tile object (Roller, Block) | Yes | Bottom edge of tile | `obj.y - height/2` |
| Rectangle object (Geyser, NextLevel) | No | Top-left corner | `obj.y + height/2` |

**Decision:** Each entity's `fromTiledObject` is responsible for applying the correct formula. This is documented in the source comment of each entity class. GameScene does not apply any y correction — it delegates entirely to the factory method.

---

## Decision 3: Geyser behavioral simplification

**C# behavior:** Geyser applies an upward velocity boost (`yVel = -5 px/tick`) and refills player hydration on contact. It is a neutral/positive hazard, not lethal.

**Web port:** Implemented as a static kill zone (`playerDead = true`) per task spec. This is a deliberate simplification for the Level 1 playable milestone.

**Future:** If Ripley's death/hydration system is ported, Geyser should be revisited to restore the boost-and-hydrate behavior. The current implementation is noted with a TODO comment in `Geyser.ts`.

---

## Decision 4: EntityGroups interface extension strategy

New group types were added to `EntityGroups` as **optional fields** (`rollers?`, `hazards?`, `gates?`). This preserves backward compatibility with the Ground layer loop which only passes `{ ground }`. Creators check for the relevant group and return `null` if it isn't provided, consistent with the "unknown type → warn, don't throw" contract.

**If EntityGroups exceeds ~8 fields:** extract to a shared `types.ts` in `web/src/entities/`.

---

## Decision 5: Roller animation self-registration

Roller's constructor calls `scene.anims.create({ key: 'roller-roll', ... })` guarded by `!scene.anims.exists('roller-roll')`. This means the animation is registered once on first Roller construction and is a no-op for subsequent Rollers. This avoids requiring GameScene to know about entity-internal animation keys while staying safe against duplicate registration errors.

**Tradeoff:** Slight coupling between entity class and asset key name. Acceptable for this codebase scale.

---

## Open question for Dallas/team

The `Puddle.SpikeBall` type (17 objects in the Enemies layer, gid=312) and `Puddle.Checkpoint` (1 object in Items) are the next blocking entity types for Level 1 playability. SpikeBall likely kills the player on contact (same as Roller); Checkpoint saves spawn position. Should these be ported in the same pattern (dynamic group + overlap kill), or does Ripley's upcoming death system gate that work?

---

## 2026-05-22 — Roller Patrol + SpikeBall Gravity Fix

**Date:** 2026-05-22  
**Author:** Ripley (Engine Dev)  
**Commit:** 810fa7a  

### Problem

Two runtime bugs observed in Level1-1:

1. **Rollers drift out of their belt area** — conveyor belts don't stay on their platform and eventually leave the screen.
2. **SpikeBalls fall through the floor on level load** — some spike hazards appear to drop when the level first renders.

### Root Cause

Both bugs share the same underlying mechanism: **`Phaser.Physics.Arcade.Group.add(child)` calls `createCallbackHandler(child)` for every child added, including sprites with pre-existing physics bodies.** The handler iterates `this.defaults` and applies each default by calling `body[key](value)`. Default values include:

- `setAllowGravity: true`
- `setCollideWorldBounds: false`

Any body settings applied in an entity constructor before `group.add()` are silently overridden.

**SpikeBall:** Constructor called `body.setAllowGravity(false)`, then `fromTiledObject` called `group.add(ball, true)`, which reset `allowGravity` to `true` → spikeballs fell under gravity y=1260.

**Roller:** Constructor called `body.setCollideWorldBounds(true)` → group reset it to `false` → world-bounds reversal was never active. Additionally, Level1-1 has no right-side wall blocks at belt edges, so `body.blocked.right` never fired → rollers drifted indefinitely to the right.

### Decision

#### SpikeBalls
Re-apply `setAllowGravity(false)` + `setImmovable(true)` in `SpikeBall.fromTiledObject` **after** `group.add()`. This pattern must be used for any future static/gravity-exempt entity added to a dynamic `Phaser.Physics.Arcade.Group`.

#### Rollers
1. Remove `setCollideWorldBounds(true)` — it was being silently overridden.
2. Add `xMin`/`xMax` patrol bounds to each Roller, set by GameScene after all belt members load.
3. `update()` uses position-based reversal (not `body.blocked` flags) and re-asserts velocity every tick to resist player nudges.

#### Rejected: `setImmovable(true)` for Rollers
`StaticBody.immovable = true` by default. `SeparateY` skips separation when both bodies are immovable. If rollers were marked immovable, the `collider(movers, ground)` would fail to keep them on the platform → rollers fall through. Use always-re-assert velocity pattern instead.

### Impact

Applies to all levels. Any entity using a `Phaser.Physics.Arcade.Group` (enemies, movers) that sets gravity-off or other non-default body properties **must re-apply those settings after `group.add()`**.
