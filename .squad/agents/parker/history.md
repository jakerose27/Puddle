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

### 2026-05-09T09:50:04.207-07:00 — PowerUp Pickup + Puddle/Shoot Abilities

**Commit:** `8559e1f`

#### C# does NOT have PuddleItem.cs or GunItem.cs

The task brief mentioned "PuddleItem" and "GunItem" but C# has a single `PowerUp.cs` class. The Tiled type string is `"Puddle.PowerUp"`. The `name` field of the Tiled object determines which ability is granted ("puddle", "jetpack", "charged"). Level 1 has exactly one PowerUp at (640, 352) with name="Puddle".

#### Shoot is not gated by a powerup in C#

C# allows shooting (D key) without any powerup — it's gated only by `hydration`. Web port omits the hydration system and allows unlimited shots, which matches the feel without the resource system.

#### PowerUp.ts: tile-object convention, gid present

The PowerUp object has gid=311 → tile-object convention: `cy = obj.y - h/2`. This matches Roller, SpikeBall, Checkpoint.

#### Puddle state: hitbox must shrink, not just scale

When puddled, the C# collisionHeight shrinks progressively with the animation frame. Web port: `body.setSize(18, 8)` for the flat hitbox, `setScale(1, 0.27)` for the visual. Restored with `body.setSize(18, 30)` + `setScale(1, 1)` on release. Remember to also clear puddle state on respawn.

#### make.graphics() does not accept `add` option in this Phaser version

`scene.make.graphics({ x, y, add: false })` throws TS2353 — `add` is not in the Options type. Use `scene.make.graphics({ x, y })` and call `gfx.destroy()` manually after `generateTexture`.

#### setScaleY does not exist on Phaser.Physics.Arcade.Sprite

Use `setScale(x, y)` with both axes. `setScaleY` is not a method on the Sprite type.

#### bubble.png was in Content/ but not in web assets

`/Users/jakerosenberg/Puddle/Content/bubble.png` — copied to `web/public/assets/images/bubble.png` for use as projectile sprite.

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

---

## Spike 8 — PowerUp System Port (2026-05-09T09:50:04.207-07:00)

**Commit:** `TBD` — `feat(web): PowerUp system — single class pattern, Projectile.ts, puddle mechanic`

### What changed
- Created `web/src/entities/PowerUp.ts` — single class with `name` field (e.g., "Shield", "HealthUp"), not separate item classes. Extends `Phaser.Physics.Arcade.Sprite`. `fromTiledObject` factory for Ground layer `Puddle.PowerUp` type. Static physics body; overlap activation.
- Created `web/src/entities/Projectile.ts` — extends `Phaser.Physics.Arcade.Sprite`. Velocity-based movement. Uses bubble.png texture. D key spawns projectiles.
- Updated `GameScene.ts` — preloaded bubble.png. Initialized `this.items` StaticGroup. Wired `physics.add.overlap(player, items, onItemReached)` for activation. Added D key listener for shoot, Down key listener for puddle flatten (hitbox reduction + dampening).
- Updated `EntityFactory.ts` — registered `'Puddle.PowerUp'` → `PowerUp.fromTiledObject`.
- Updated `EntityGroups` interface — added `items?: Phaser.Physics.Arcade.StaticGroup`.

### Key findings
- **Pattern decision:** Single PowerUp class (not separate Shield, HealthUp classes). Uses `name` field to determine type. Reduces code duplication, centralizes item logic. Matches C# philosophy of table-driven items.
- C# PowerUp system uses item types; web port simplifies via name-based dispatch.
- Projectile is separate class to keep lifecycle distinct (items are static; projectiles move and expire).
- Puddle mechanic: Down key reduces player.body.height temporarily + applies velocity dampening (similar to squeeze effect in C#).

### Architecture
- **Single class pattern:** Centralizes item logic, easy to add new types (new `name` string + activation handler).
- **StaticGroup for items:** Lighter than DynamicGroup; items don't move on their own.
- **Projectile class:** Reuses bubble.png asset. Velocity-based trajectory. Collision handling deferred to gameplay layer.
- **Input in GameScene:** D key for shoot, Down key for puddle flatten. Scene owns input state.

### Build Status
✅ Build clean  
✅ Committed and pushed  

### Next Work
- PowerUp activation effects (animation, sound, player state change)
- Projectile collision with enemies/obstacles  
- Paddle/melee attack mechanics
- Continue Level 1 feature completion
