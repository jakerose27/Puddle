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
- 10ba581 — Level 1 polish pass (Parker)
- 2278910 — Checkpoint entity (Parker)
- 4758128 — Player animations (Ripley)
- 06aada3 — SpikeBall entity, camera follow, roller hitbox

---

## Next Tasks
1. **Level 2 design** — Extend systems for new content
2. **Audio integration** — Background music, SFX
3. **Additional entities** — Based on Level 2 requirements
