# Physics & Delta-Time Scope Report

**Author:** Ripley (Engine Dev)  
**Date:** 2026-05-03T21:19:07.428-07:00  
**Status:** Draft — pending Jake review  
**Context:** Pre-port analysis for TypeScript + Phaser 3 rewrite (see `docs/web-port-feasibility.md`)

---

## Section 1 — Entity / System Enumeration

The root of every frame-rate coupling in Puddle is `Level.count`, an integer that is
incremented by 1 on every call to `Level.Update()`. Roughly 80% of all timing in the
game is driven by this single counter.

### 1.1 Level (Level.cs)

| Pattern | Code | Notes |
|---|---|---|
| Global tick counter | `count++` each frame | Root of all coupling below |
| Message display timer | `(count - message_point) >= 400` | 400-frame display window ≈ 6.7 s at 60 fps |

### 1.2 Player (Objects/Player.cs)

| Pattern | Code | Notes |
|---|---|---|
| Gravity accumulation | `yVel += level.gravity` (gravity = 0.35) | Per frame, not per second |
| Fall clamping | `if (yVel > level.maxFallSpeed)` (max = 10) | 10 px/frame = 600 px/s at 60 fps |
| Horizontal friction | `xVel = xVel * (1 - playerFriction)` (friction = 0.075) | Exponential decay per frame |
| Horizontal accel | `xAccel += speed` (speed = 3) | 3 px/frame, not px/s |
| Jump animation | `level.count % 6 == 0 → frameIndexX += 32` | Frame-gated advance |
| Walk animation | `gameTime.TotalGameTime.TotalMilliseconds / 128 % 4` | ✅ WALL CLOCK — already correct |
| Puddle animation | `frameIndexX += 32` or `-= 32` per Update call | Immediate frame advance |
| Shoot/jump cooldowns | `gameTime.TotalGameTime.TotalMilliseconds` | ✅ WALL CLOCK — already correct |
| Roller carry-over | `rollerVel = ((Roller)s).speed` (speed = 2) | Applied as px/frame offset |

### 1.3 Enemy base class (Enemies/Enemy.cs)

| Pattern | Code | Notes |
|---|---|---|
| Gravity accumulation | `yVel += level.gravity` | Per frame |
| Horizontal movement | `spriteX += Convert.ToInt32(xVel)` (speed = 2) | 2 px/frame |
| Vertical movement | `spriteY += Convert.ToInt32(yVel)` | Per frame |
| Hurt flash | `(level.count - hurtPoint) > 2` | 2-frame flash window |

### 1.4 Rat (Enemies/Rat.cs)

| Pattern | Code | Notes |
|---|---|---|
| Walk animation | `((level.count + seed) / 8 % 4) * 32` | 8 ticks per frame, 4-frame cycle |
| Random jump | `if (rnd.NextDouble() > .99)` | Called once per frame; probability calibrated at 60 fps |

### 1.5 Bird (Enemies/Bird.cs)

| Pattern | Code | Notes |
|---|---|---|
| Wing animation gate | `if (level.count % 6 != 0) return` | Advances 1 wing frame every 6 ticks |
| Shoot cadence | `(level.count + seed) % 200 == 0` | Fires ~every 3.3 s at 60 fps; period depends on FPS |

### 1.6 Face / Boss (Enemies/Face.cs)

| Pattern | Code | Notes |
|---|---|---|
| Shoot cadence | `level.count % 30 == 0` | Fires every 30 frames ≈ 0.5 s at 60 fps |
| Idle animation | `((level.count + seed) / 8 % 4) * frameWidth` | Same as Rat |

### 1.7 Hand (Enemies/Hand.cs)

| Pattern | Code | Notes |
|---|---|---|
| Direction change | `level.count % 80 == 0` | Pivots every 80 frames ≈ 1.33 s at 60 fps |
| Movement | `spriteX += xVel; spriteY += yVel` (speed = 1) | Per frame |

### 1.8 Dying (Enemies/Dying.cs)

| Pattern | Code | Notes |
|---|---|---|
| Rotation | `rotationAngle += 0.05f` | Per frame — tumble speed depends on FPS |
| Gravity | `yVel += level.gravity; spriteY += yVel` | Per frame |

### 1.9 Cannon (Objects/Cannon.cs)

| Pattern | Code | Notes |
|---|---|---|
| Fire cadence | `level.count % speed == 0` (speed default 125) | Every 125 frames ≈ 2.1 s at 60 fps |

### 1.10 Fireball (Objects/Fireball.cs)

| Pattern | Code | Notes |
|---|---|---|
| Movement | `spriteY += speed` / `spriteX += speed` (speed = 2) | 2 px/frame, no deltaTime |
| Animation | `((level.count + seed) / 12) % 2 * 32` | 12 ticks per frame |

### 1.11 Geyser (Objects/Geyser.cs)

| Pattern | Code | Notes |
|---|---|---|
| Movement | `spriteY -= speed` / `spriteY += speed` (speed = 2) | Per frame |
| Animation | `((level.count + seed) / 4) % 6 * frameWidth` | 4 ticks per frame, 6-frame cycle |
| Launch impulse | `level.player.yVel = speed` (speed = -5) | Sets player yVel in px/frame |

### 1.12 Egg (Objects/Egg.cs)

| Pattern | Code | Notes |
|---|---|---|
| Fall speed | `spriteY += speed` (speed = 4) | 4 px/frame |
| Hurt flash | `level.count - hurt_point > 2` | 2-frame flash |
| Animation | `((level.count + seed) / 4) % 6 * frameWidth` | Inherits Geyser-style |

### 1.13 Shot / PowerShot (Objects/Shot.cs, PowerShot.cs)

| Pattern | Code | Notes |
|---|---|---|
| Movement | `spriteX += xVel` (derived from player xVel + fixed speed) | Per frame |
| Vertical drift | `spriteY += speed / 2` or `spriteY -= speed` | Per frame |

### 1.14 Roller (Objects/Roller.cs)

| Pattern | Code | Notes |
|---|---|---|
| Animation | `((level.count) / 4 % 8) * 32` | 4 ticks per frame |
| Player carry | `rollerVel = speed` (speed = 2) | Applied to player xVel per frame |

### 1.15 Block (Objects/Block.cs)

| Pattern | Code | Notes |
|---|---|---|
| Gravity-variant fall | `y_vel += level.gravity; spriteY += y_vel` | Per frame; used for falling platforms |

### 1.16 Checkpoint (Objects/Checkpoint.cs)

| Pattern | Code | Notes |
|---|---|---|
| Activation animation | `level.count % 2 == 0` | Advances 1 frame every 2 ticks |

---

## Section 2 — Top 5 Browser-Runtime Refactor Risks

### Risk 1 — `requestAnimationFrame` is not locked to 60 fps ⚠️ CRITICAL

Browsers fire `requestAnimationFrame` at the display refresh rate (60 Hz, 90 Hz, 120 Hz, 144 Hz).
At 120 Hz, `Level.count` increments twice as fast: everything — physics, AI fire cadences,
animation — runs at double speed. At 30 fps (mobile throttle, background tab), the game
crawls. This is the single most impactful issue.

**Affects:** every system in Section 1.

### Risk 2 — Physics constants are calibrated for 60 fps ⚠️ HIGH

`gravity = 0.35`, `maxFallSpeed = 10`, `playerSpeed = 3`, `enemySpeed = 2` are all in
**pixels per frame at 60 fps**. They are baked into gameplay feel. Changing FPS without a
conversion multiplier will change jump arcs, enemy movement, and projectile travel distances
in ways that break designed level geometry and hitbox timing.

**Affects:** Player, Enemy, Fireball, Geyser, Egg, Block, Dying.

### Risk 3 — AI event timers are level-count–based ⚠️ HIGH

Bird fires every 200 frames. Face fires every 30 frames. Hand turns every 80 frames.
Cannon fires every 125 frames. These intervals are tied to designed difficulty curves.
If `Level.count` runs at a different rate, difficulty spikes or collapses unpredictably.
A 120 Hz display makes the Face boss shoot twice as often as intended.

**Affects:** Bird, Face, Hand, Cannon.

### Risk 4 — Collision detection assumes single-pixel per-frame movement ⚠️ MEDIUM

The collision resolution loops step entities by `Convert.ToInt32(xVel)` / `Convert.ToInt32(yVel)`
each frame without sub-step subdivision. At 60 fps this is safe (max 10 px/frame fall, 3 px/frame
horizontal). If deltaTime compensation inflates velocities at low FPS (e.g., 30 fps → 2× velocity
× 2× delta = 4× displacement), fast-moving entities can tunnel through thin solid blocks (32 px wide).

**Affects:** Player collision, Enemy collision.

### Risk 5 — Timing logic in `Draw()` not `Update()` ⚠️ MEDIUM

`Game1.Draw()` decrements `introScreenTimer` using `gameTime.ElapsedGameTime`. In a standard
game loop this is fine, but browsers can skip render frames (background tabs, frame budget
exceeded) while still firing update ticks. Slide advancement will stall during skipped renders.
The same concern applies to `newMapTimer`, which IS correctly in `Update()`, but the inconsistency
is a maintenance footgun.

**Affects:** Intro slide sequencing, menu presentation.

---

## Section 3 — Delta-Time Refactor Plans

### 3A — Minimal Shim (Keep Logic Mostly Intact)

**Concept:** Introduce a `scale` multiplier in `Level.Update()` computed from deltaTime.
All existing frame-count arithmetic continues to work; `Level.count` becomes a fractional
accumulator.

```
// In Level.Update(float deltaSeconds):
const float TARGET_FPS = 60f;
float frameScale = deltaSeconds * TARGET_FPS;  // ≈ 1.0 at 60 fps
count += frameScale;                           // becomes float

// Physics sites (example):
yVel += level.gravity * frameScale;
spriteX += (int)(xVel * frameScale);

// Animation sites (example):
frameIndexX = ((int)(level.count + seed) / 8 % 4) * 32;
// ↑ no change — count now accumulates in fractional frames
```

**Pros:**
- Minimal code surface changed; same game feel at 60 fps
- Animation and AI timing expressions unchanged
- Low risk of introducing new bugs

**Cons:**
- `Level.count` must become `float` (or `double`) — every `int` cast site (`level.count % N`)
  needs `(int)level.count % N`; modulo on floats has edge cases
- Does not produce deterministic simulation: floating-point drift accumulates

**Estimated files changed:** Level.cs, Player.cs, Enemy.cs, Dying.cs, Block.cs, Fireball.cs, Geyser.cs, Egg.cs, Shot.cs — roughly 9 files, ~40 touch points.

---

### 3B — Fixed-Step Accumulator (Recommended for Determinism)

**Concept:** Game loop accumulates real elapsed time and steps the simulation in fixed
16.67 ms (60 fps) increments. `Level.count` stays an integer incremented by 1 per fixed
step. All physics, AI, and animation code is unchanged. Rendering interpolates between
the last two fixed steps.

```
// In Game1.Update(GameTime gameTime):
const double FIXED_STEP = 1.0 / 60.0;        // seconds per physics tick
accumulator += gameTime.ElapsedGameTime.TotalSeconds;

while (accumulator >= FIXED_STEP)
{
    level.Update();                            // count++, physics, AI — UNCHANGED
    player1.Update(controls, level, pseudoGameTime);
    accumulator -= FIXED_STEP;
}
// alphaForInterpolation = accumulator / FIXED_STEP  (optional smooth render)
```

**What changes:**
- `Game1` gains an `accumulator` double field and the while-loop above
- `Level.count` and all downstream code: **zero changes**
- Physics constants: **zero changes**
- Animation expressions: **zero changes**
- AI fire cadences: **zero changes**
- `introScreenTimer` should be moved to `Update()` to use the fixed-step clock

**What doesn't change:** Everything in Section 1.

**Pros:**
- Deterministic replay, consistent physics regardless of display refresh rate
- Minimal code changes — the fix is localized to Game1's loop
- Preserves all existing AI timing and feel exactly
- Safe for 120 Hz monitors; always runs at exactly 60 ticks/s

**Cons:**
- At very low frame rates (<30 fps), the while-loop may run multiple ticks per render
  (spiral of death risk). Cap at e.g. 5 ticks max.
- Visual judder without render interpolation (acceptable for a 2D platformer at ≥60 Hz)

**Estimated files changed:** Game1.cs (main loop), optionally Game1.cs (move intro timer). 2–4 files.

**Recommendation:** Implement 3B first. It gives correct timing with the smallest diff.
If TypeScript/Phaser 3 rewrite proceeds, the fixed-step accumulator pattern translates
directly to a `requestAnimationFrame` loop with an `accumulator` variable.

---

## Section 4 — Effort Estimates by Subsystem

All estimates assume TypeScript/Phaser 3 rewrite context (see `docs/web-port-feasibility.md`).
Sizes: **S** = <0.5 day, **M** = 0.5–1 day, **L** = 1–3 days.

| Subsystem | Coupling Type | Shim (3A) | Accumulator (3B) | Dependencies |
|---|---|---|---|---|
| Game1 loop + accumulator | Architecture | S | **S** | None — do this first |
| `Level.count` (root timer) | Frame counter | M (float cast) | **None** | Game1 loop |
| Player physics (gravity, friction, velocity) | Per-frame math | M | **None** | Level.count fixed |
| Enemy physics (gravity, move) | Per-frame math | M | **None** | Level.count fixed |
| Projectile physics (Fireball, Shot, Egg) | Per-frame math | S | **None** | Level.count fixed |
| Block gravity | Per-frame math | S | **None** | Level.count fixed |
| Dying rotation + gravity | Per-frame math | S | **None** | Level.count fixed |
| Animation (all entities) | count % N | M | **None** | Level.count fixed |
| AI timers (Bird, Face, Hand, Cannon) | count % N | S | **None** | Level.count fixed |
| Message display timer | count - point >= N | S | **None** | Level.count fixed |
| Hurt flash timers (enemy, egg, shot) | count - point > N | S | **None** | Level.count fixed |
| Intro slide timer (move Draw→Update) | Elapsed in Draw | S | **S** | Both approaches |
| Geyser launch impulse (yVel = -5) | Velocity constant | S | **None** | Level.count fixed |
| Roller carry (rollerVel per frame) | Per-frame offset | S | **None** | Level.count fixed |
| Collision tunneling audit | Safety | M | **M** | After physics |

**Totals:**
- Shim (3A): ~**L** (many touch points, float-casting risk)
- Accumulator (3B): ~**S** (2–3 files, then validate nothing broke)

---

## Section 5 — Prioritized Checklist

> Change these in order. Each step can be verified independently.

### Phase 1 — Loop surgery (do this first, blocks everything else)

- [ ] **P1-1** Add `accumulator` field to `Game1`
- [ ] **P1-2** Replace single `level.Update()` + `player1.Update()` calls with
      fixed-step while-loop (cap at 5 iterations to avoid spiral of death)
- [ ] **P1-3** Move `introScreenTimer -= elapsed` from `Draw()` into `Update()`
- [ ] **P1-4** Smoke test: confirm game plays at correct speed on 60 Hz and 120 Hz

### Phase 2 — Validate no regressions in AI timing

- [ ] **P2-1** Verify Bird fires every ~3.3 s real time
- [ ] **P2-2** Verify Face fires every ~0.5 s real time
- [ ] **P2-3** Verify Hand changes direction every ~1.33 s real time
- [ ] **P2-4** Verify Cannon (default speed 125) fires every ~2.1 s real time

### Phase 3 — Validate physics feel

- [ ] **P3-1** Jump arc matches original (height ≈ 160 px, duration ≈ 24 frames)
- [ ] **P3-2** Player walk speed feels unchanged (~3 px/frame × 60 = 180 px/s)
- [ ] **P3-3** Geyser launch does not cause tunneling (yVel = -5, max 5 tiles up)
- [ ] **P3-4** Falling block (gravity Block) lands at expected rate

### Phase 4 — Collision safety (medium risk)

- [ ] **P4-1** Audit `checkXCollisions` and `checkYCollisions` for tunneling at
      velocities >16 px/frame (tile width = 32 px); add sub-step if needed
- [ ] **P4-2** Confirm Fireball (2 px/frame) and Egg (4 px/frame) do not skip hitboxes

### Phase 5 — TypeScript/Phaser 3 port translation

- [ ] **P5-1** Replicate fixed-step loop in `requestAnimationFrame` with `accumulator`
- [ ] **P5-2** Port `level.count` as a plain integer incremented inside the fixed step
- [ ] **P5-3** Translate all `level.count % N` AI/animation expressions verbatim
- [ ] **P5-4** Replace `TotalGameTime.TotalMilliseconds` (used for shoot/jump cooldowns
      and walk animation) with `performance.now()` — semantically equivalent

---

*Report generated from full static scan of all .cs files in the Puddle repository.*  
*No runtime profiling performed. All timing estimates assume stable 60 fps target.*
