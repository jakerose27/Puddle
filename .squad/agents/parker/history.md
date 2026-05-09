# parker history

## Project Context
Project: Puddle
Language/Stack: C# MonoGame (SDL2, TiledSharp, XNA pattern)
Goal: Port to browser, deploy to Vercel
Branch: squad/web-port-spike
Owner: Jake

## Archive Note
Detailed spike history (Spikes 1-5) has been archived to **parker/history-archived.md** to keep this file focused on recent and active work. All learnings are preserved in docs/ and .squad/decisions/.

---

## Spike 6 — Checkpoint Entity (2026-05-03T22:19:09.587-07:00)

**Commit:** `2278910` — `feat(web): Checkpoint entity — activates on player touch, updates respawn position`

### What changed
- Created `web/src/entities/Checkpoint.ts` — extends `Phaser.Physics.Arcade.Sprite`. Static physics body. `fromTiledObject` uses tile-object convention (`cy = obj.y - h/2`). `activate()` guards on `this.activated` flag, then flashes white → gold tint via tween.
- Updated `EntityFactory.ts` — added `checkpoints?: Phaser.Physics.Arcade.StaticGroup` to `EntityGroups` interface. Registered `'Puddle.Checkpoint'` → `Checkpoint.fromTiledObject`.
- Updated `GameScene.ts` — preloads `checkpoint.png`, initializes `this.checkpoints` StaticGroup, passes `checkpoints` to EntityFactory calls, adds `physics.add.overlap(player, checkpoints, onCheckpointReached)`, implements callback.

### Key findings
- C# stores respawn on `player.checkpointXPos` / `player.checkpointYPos`. Web port stores on `GameScene.spawnX` / `spawnY`.
- `checkpoint.png` already present in `web/public/assets/images/` (tileset gid 324).
- Checkpoint is a tile object in Tiled (gid=324) → y is bottom edge → `cy = obj.y - h/2`.
- Level 1 has 1 checkpoint; future multi-checkpoint handling deferred.

### Architecture
- `checkpoints` is a `StaticGroup` wired with `physics.add.overlap` (not `collider`) — matches C# behavior where touching doesn't stop player movement.
- Respawn updates happen in GameScene, not in entity, keeping entity thin and scene as single source of truth.

---

## Spike 7 — Level 1 Polish Pass (2026-05-03T22:19:09.587-07:00)

**Commit:** `10ba581` — `feat(web): Level 1 polish — HUD, physics tuning, death flash, NextLevel guard`

### Physics tuning to C# constants
- `JUMP_VELOCITY = -600` (was -400)
- `MAX_FALL_SPEED = 600`
- `PLAYER_SPEED = 240` (was 200)
- `GRAVITY = 1260` (was 980, match to C# `gravity = 0.35 × 60²`)

### Mechanical features
- **Jump cut:** `jumpKeyHeld` tracks key state; release while in air halves velocity (`body.setVelocityY(v/2)`)
- **HUD:** `livesText` (top-left "❤️ x5") and `levelText` (top-right "Level 1-1") with `setScrollFactor(0)` and `setDepth(10)`
- **Death feedback:** 
  - Camera flash: `this.cameras.main.flash(300, 255, 0, 0)` red tint
  - Invincibility blink: `invincibleTimer % 12 < 6` alternates alpha
  - Gravity compensation: `body.setGravityY(-1160)` (compensates for world gravity 1260, leaving ~100 px/s² net downward for float)
- **Respawn Y offset:** `-8px` applied to avoid floor collision on respawn
- **NextLevel overlay:**
  - Removed broken self-overlap pattern; uses `gateTriggered` boolean guard
  - Shows "🎉 YOU WIN!" + "Press R to replay" overlay (semi-transparent black)
  - Freezes player (`setAllowGravity(false)`), wires R key to `scene.restart()`

### Key findings
- C# physics constants all expressed as `px/tick` at 60 fps; Phaser equivalents multiply by 60 for velocity, 3600 for acceleration
- `body.setGravityY(n)` is additive (adds to world gravity, not override)
- Gate layer is empty in Level1-1.json; gate code wired and ready for future levels
- `MAX_LIVES = 5` (confirmed from Player.cs)

### Architecture
- Physics tuning centralized in GameScene constants and main.ts config
- Jump cut requires tracking key-held state across ticks — fixed-step accumulator makes this safe
- HUD managed by GameScene (future refactor candidate if complexity grows)

---

## 2026-05-04 — Level 1 Polish Milestone

**Status:** Level 1 fully polished and playable end-to-end.

### What shipped
- Checkpoint entity saves respawn position ✅
- Physics tuned to C# prototype match ✅
- Jump cut for skill-based control ✅
- HUD (lives + level label) ✅
- Death feedback (camera flash + invincibility blink) ✅
- Goal overlay with R-key guard ✅

### Integration Points
- Checkpoint wired to Ripley's respawn infrastructure
- Physics constants match C# prototype (gravity, jump, speed)
- All systems tested end-to-end
- Ready for Level 2 expansion

### Testing & Validation
✅ Player movement matches C# feel
✅ Hazards trigger death, grace period prevents re-death
✅ Checkpoint save/load works
✅ HUD updates reflect state
✅ Goal overlay + R-guard functional
✅ Edge cases pass (near-ground respawn, double-tap goal)

---

## Recent commits
- 07b86d2 — Visual entity bugs fix (Parker)
- 10ba581 — Level 1 polish pass (Parker)
- 2278910 — Checkpoint entity (Parker)
- 4758128 — Player animations (Ripley)
- 06aada3 — SpikeBall entity, camera follow, roller hitbox

---

## Next Tasks
1. **Level 2 design** — Extend systems for new content
2. **Audio integration** — Background music, SFX
3. **Additional entities** — Based on Level 2 requirements

---

## Learnings

### 2026-05-09T09:44:52.564-07:00 — Visual Entity Bug Fix

**Commit:** `07b86d2`

#### Tiled y-coordinate convention — CRITICAL, both formats coexist in the same layer

Level1-1 Ground object layer mixes two Tiled object types in a single layer:
- **Tile-objects** (`gid` present, e.g. gid=281 brick platform blocks): Tiled stores `y` as the **bottom-left** corner → `cy = obj.y - h/2`
- **Rectangle-objects** (`gid=None`, e.g. outer walls at x=0/x=672, bottom floor row at y=672): Tiled stores `y` as the **top-left** corner → `cy = obj.y + h/2`

Block.ts was using only the tile-object formula for both, placing 77 gid=None rectangle blocks 32px too high. Root effect: outer walls misaligned, floor physics off by one tile, SpikeBalls landing in wrong positions. **Fix: check `obj.gid` to select formula. Added `gid?: number` to the TiledObject interface.**

All other entity types are homogeneous:
- Roller, SpikeBall, Checkpoint → always tile-objects → `cy = obj.y - h/2` ✓
- Geyser, NextLevel → always rectangle-objects → `cy = obj.y + h/2` ✓

#### Block.ts should be physics-only (invisible)

Block entities create physics bodies for collision. Visuals come from the Background tile layer (rendered at depth=-1). Block.ts was using `BLOCK_COLOR = 0x8b6f47` (visible brownish rectangle) which covered the tileset art. **Fix: use `scene.add.rectangle(cx, cy, w, h, 0x000000, 0)` — alpha=0 makes it a transparent physics-only body.**

#### Geyser must use the 'geyser' texture, not a rectangle

Geyser was using `scene.add.rectangle(..., 0x00aaff, 0.6)` — a visible cyan-blue box. The `geyser.png` sprite exists and is preloaded. **Fix: switch to `scene.add.image(cx, cy, 'geyser')` + `setDisplaySize(w, h)` + `physics.add.existing(..., true)` + `body.setSize(w, h)` + `body.reset(cx, cy)`.**

#### EntityFactory unknown-type handling is correct

`Puddle.Pipe` (Pipe layer, not processed by GameScene) and `Puddle.PowerUp` (Ground layer, gid=311) are not in the registry. EntityFactory already does `console.warn` + `return null` for unknown types. No black rectangle fallback — the warning is the correct behavior.

#### Key debugging patterns
- Colored rectangle in game → entity using `scene.add.rectangle()` instead of sprite
- Physics body 32px off from visual → check Tiled object type (gid vs no-gid) for correct y-formula
- Unknown type console.warn is the signal to check Tiled JSON for unregistered `type` strings

---

## 2026-05-09 — Visual Entity Bug Fixes (parker-7)

**Session:** 2026-05-09T09:50:04.207-07:00  
**Status:** Complete

### Patterns Identified

#### Block transparency pattern
Block physics bodies must be invisible (alpha=0) to allow Background tileset layer to render. Collision surfaces are physics-only; visual art comes from a separate tile layer at depth=-1. Future entities with similar architecture should follow this pattern.

#### Tiled y-formula discrimination pattern
When processing mixed Tiled object types in a single layer, check `obj.gid` to determine y-coordinate semantics:
- `obj.gid` present → tile-object → `cy = obj.y - h/2`
- `obj.gid` absent → rectangle-object → `cy = obj.y + h/2`

This pattern applies across all Puddle entities. New entity types should document which formula applies (or if they're homogeneous, document that fact).

### Build Status
✅ All fixes committed and pushed  
✅ Build clean  
✅ 77 rectangle blocks now at correct positions  

### Next Work
- PowerUp items (Ground layer, type `Puddle.PowerUp`) — in progress per spawn manifest
- Continue Level 1 polish iteration
