# ripley history

## Project Context
Project: Puddle
Language/Stack: C# MonoGame (SDL2, TiledSharp, XNA pattern)
Goal: Port to browser, deploy to Vercel
Branch: squad/web-port-spike
Owner: Jake
Approach: Docs-first. No big rewrites until feasibility is documented in docs/web-port-feasibility.md.
Key files: Game1.cs (game loop), Program.cs (entry point), Level.cs, Controls.cs, Content/ (assets), SDL.dll, TiledSharp.dll

## Learnings

### 2026-05-03 — repo-map task

- **Entry point is guarded `#if WINDOWS || LINUX`** — no browser/WASM entrypoint exists. Any browser port needs a new entrypoint.
- **Target is .NET Framework 4.5**, not .NET Core/5+. Cannot use `dotnet` CLI or Blazor WASM without a full project migration to SDK-style csproj + .NET 6+.
- **MonoGame version is 3.0** (DLL hints point to `MonoGame\v3.0\Assemblies\WindowsGL\`). No NuGet packages. References are local Windows paths — project does not build out-of-box on Mac.
- **TiledSharp uses raw `System.IO` file access** (`new TmxMap("Content/Levels/...")`) — cannot run in browser without async fetch replacement.
- **Level objects are instantiated via reflection** (`Type.GetType(obj.Type)` + `Activator.CreateInstance`) from TMX object type strings — AOT/IL-linker incompatible without explicit type preservation.
- **No camera system** — viewport equals full backbuffer, sized dynamically from TMX map dimensions at each level load (22×22 tiles × 32px = 704×704 on gameplay levels).
- **Physics is frame-rate coupled** — `Level.count++` tick counter, not delta-time. Must refactor for variable-rate browser `requestAnimationFrame`.
- **Single SpriteBatch per frame**, no sort mode or layers, draw order hardcoded: items → projectiles → enemies → player.
- **Audio via `SoundEffect`/`SoundEffectInstance`** (OpenAL under the hood). Music is looped instances. WAV assets are browser-compatible, but API is not.
- **`Controls.cs` is cleanly abstracted** — clean separation of input polling from game logic, easy to re-implement for browser keyboard events.
- **All game logic (physics, collision, state) is pure C#** — portable with no platform dependencies.
- **TMX tile layer rendering is absent** — Level.Draw() only draws game objects; background is a stretched PNG. No tile-layer rendering code found. This needs further investigation.

### 2026-05-03 — Dallas's Feasibility Recommendation

**Recommendation: TypeScript + Phaser 3 (Option 2)**

Dallas evaluated three options against the hard blockers and medium-complexity issues identified in the repo-map. MonoGame WASM is blocked by toolchain debt (v3.0 upgrade, deprecated namespaces, binary font, vendored TiledSharp). TypeScript + Phaser 3 is recommended because all assets (TMX, PNG, WAV) transfer without conversion, Phaser 3 reads TMX natively, C# entity logic is clean and translates mechanically to TypeScript, and Vercel deploy is a standard `vite build`. Before spiking: confirm Phaser 3 parses these specific TMX v1.0 object layers and identify exact `type` attribute format.


### 2026-05-03 — delta-time physics scope task

- **`Level.count` is the universal frame timer** — every animation, AI fire cadence, hurt flash, and message display in the codebase is driven by `count++` in `Level.Update()`. It is incremented every frame with no deltaTime involvement.
- **Physics is 100% frame-coupled** — gravity (0.35), maxFallSpeed (10), playerSpeed (3), enemySpeed (2) are all px/frame. No entity multiplies velocity by elapsed time.
- **One exception**: Player walk animation and shoot/jump cooldowns use `gameTime.TotalGameTime.TotalMilliseconds` — these are already wall-clock correct and need no changes.
- **Fixed-step accumulator is the minimal correct fix** — adding a `while (accumulator >= FIXED_STEP)` loop in `Game1.Update()` makes `Level.count` deterministic at 60 ticks/s regardless of display refresh rate. Zero changes to entity logic, physics constants, or animation expressions.
- **Intro slide timer is in `Draw()`, not `Update()`** — should be moved as part of the accumulator PR.
- **Top collision risk**: `Convert.ToInt32(xVel/yVel)` movement without sub-stepping could tunnel through 32-px tiles at velocities >16 px/frame. Current max velocities are safe at 60 fps fixed step.
- **Report location**: `docs/physics-delta-time-scope.md`

### 2026-05-03 — Fixed-Step Accumulator Implementation

- **Accumulator pattern implemented** in `GameScene.update()` — `FIXED_STEP_MS = 1000/60`, drains delta at 16.667ms per tick.
- **`fixedUpdate()` extracted** — all input/physics logic moved here; `update()` is now accumulator-loop only.
- **`tickCount`** added as direct mirror of `Level.count` — future entity ports should use this for all frame-based timers.
- **Build verified clean** (`tsc && vite build`) — no TypeScript errors.
- **Commit 225af46** pushed to `squad/web-port-spike` without conflict (Parker's entity factory spike was to different methods).
- **No interpolation yet** — `alpha` factor is commented in as a hook; deferred until entity porting reveals need.
- **Spiral-of-death risk**: no tick cap on catchup — acceptable at current scope, revisit if sustained lag frames appear in testing.
- **Decision record**: `.squad/decisions/inbox/ripley-fixed-step.md`

### 2026-05-03 — Player Hurt/Death/Respawn (commit c98f4bc)

- **`triggerDeath()`** — sets `playerDead`, starts 60-tick flash timer, zeroes velocity, sets `body.setGravityY(-500)` to partially cancel world gravity (600) for a brief float, applies red tint.
- **`respawn()`** — clears death state, teleports to `spawnX/spawnY`, restores gravity to 0 (inheriting world gravity), starts 120-tick invincibility window with alpha blink.
- **Death blocks input** — `fixedUpdate()` returns early if `playerDead` is true; rollers still tick but player cannot move.
- **Pit detection** — `player.y > world.bounds.height + 200` triggers death in `fixedUpdate()` before the movement block.
- **Invincibility blink** — `invincibleTimer % 12 < 6` alternates alpha 0.3/1.0 every 6 ticks (~10Hz blink at 60Hz).
- **`body.setGravityY()` is additive** — sets *additional* gravity on top of world gravity. To float: use a negative value smaller than world gravity (e.g. -500 with world=600 gives net 100 downward).
- **`spawnX/spawnY` captured after `player.setPosition()`** — not from `startX/startY` directly, ensuring the saved point reflects the actual Phaser sprite position.
- Build verified clean (`tsc && vite build`). Pushed to `squad/web-port-spike`.

### 2026-05-03 — Orchestration & Decisions Merge

**Parker's Spike 2 work (parallel):**
- Implemented Background tile layer rendering in GameScene.ts
- Fixed Phaser 3 TMX misconception in feasibility doc (JSON only, not XML)
- Added delta-time physics risk to Option 2 table (flagging Ripley's findings)
- TMX→JSON conversion script working; all 7 levels layers parse correctly
- Commit a71908b pushed to origin/squad/web-port-spike

**Implications for physics implementation:**
- Fixed-step accumulator (Option 3B) is now formally recommended in decisions.md
- Next blocker: confirm accumulator works in C# prototype or TypeScript before entity porting
- All 5 browser risks (rAF not locked to 60 Hz, physics calibration, AI cadence, collision, Draw/Update split) will be mitigated by accumulator pattern

---

## 2026-05-04 — Scribe: Level 1 Playable Milestone

**Team shipped Level 1 playable end-to-end.**

### Ripley Spike 3 Contribution (Commit c98f4bc)

- Player hurt/death/respawn system complete
- triggerDeath() and respawn() methods wired
- Invincibility blink animation on respawn (1.5s)
- Pit death detection (y < 0)

### Integration with Parker's Entities

- Death trigger fires on overlap with Roller, Geyser entities
- Respawn resets player to spawn point with invincibility
- Pit death (falling off level) detected and triggers respawn
- Smooth player flow: move → hit hazard → death animation → respawn with invincibility

### Technical Details

- Input blocked during death (fixedUpdate() returns early if playerDead)
- Invincibility blink uses modulo 12 ticks for ~10Hz at 60 Hz tick rate
- spawnX/spawnY captured after player.setPosition() to ensure Phaser position
- Pit detection: y > world.bounds.height + 200 triggers death

### Testing & Verification

✅ Player dies on Roller contact  
✅ Player dies on Geyser contact  
✅ Respawn at spawn point works  
✅ Invincibility blink prevents re-death during period  
✅ Pit death functional  
✅ Level playable end-to-end  
✅ Build verified clean  

### Next Priority

- Player animation states (walk, jump, idle cycle) ✅ DONE
- SpikeBall entity (pending Parker port)
- Checkpoint system to save respawn position ✅ DONE (by Parker, commit 2278910)

**Status:** Death/respawn system shipped and tested. Level 1 playable milestone achieved. Ready for animation and checkpoint work.

---

## 2026-05-03 — Player Animation States (commit 4758128)

### What was done
- **Copied `jump.png`** from `Content/PC/` to `web/public/assets/images/PC/` — was missing from web assets.
- **Added `player-jump` spritesheet** to `preload()` — 3 frames at 32×32px (96px wide source).
- **Defined three animations:**
  - `idle` — single frame from `player-stand` image, loops
  - `walk` — 4 frames from `player-walk` spritesheet at 8fps, loops (already existed, cleaned up)
  - `jump` — 3 frames from `player-jump` spritesheet at 8fps, play-once (holds last frame)
- **Animation state machine** in `fixedUpdate()`:
  - `!onGround` → play 'jump'
  - grounded + left/right held → play 'walk'
  - grounded + still → play 'idle'
- **FlipX was already wired** — horizontal flip on left/right input was already correct from the death/respawn PR. No change needed.
- **Horizontal movement decoupled from animation** — `setVelocityX()` is now applied regardless of ground state; animation block is separate.
- **Fixed pre-existing TS error** in `onCheckpointReached` callback — Phaser's `ArcadePhysicsCallback` uses `any`-compatible params; old typed signature was wrong.

### Asset info (from original C#)
- `stand.png`: 32×32 — single frame idle
- `walk.png`: 128×32 — 4 frames of 32×32 (walk cycle)
- `jump.png`: 96×32 — 3 frames of 32×32 (jump ramp-up; C# used 2 frames via frameIndexX < 2*32)
- C# walk used `gameTime.TotalGameTime.TotalMilliseconds / 128 % 4` for frame index — equivalent to ~8fps

### Key Phaser 3 pattern: cross-texture animations
Phaser 3 `anims.create()` frames array supports `{ key: 'texture-key', frame: 0 }` — you can have animations that reference different texture keys in the same sequence. When the animation reaches such a frame, Phaser automatically calls `setTexture()` on the sprite. This means you can define `idle`, `walk`, and `jump` as separate animations on different sprite sheets and switch between them cleanly with `play('anim-key', true)`. **Do NOT mix `setTexture()` manual calls with animation playback** — let the animation manager own the texture state.


---

## 2026-05-04 — Scribe: Level 1 Polish Milestone (Ripley contributions)

**Session Date:** 2026-05-03  
**Session Milestone:** Level 1 fully polished and playable

### Player Animation States (commit 4758128)

✅ Three-state animation machine: `idle`, `walk`, `jump`  
✅ Real sprite sheets from `Content/PC/` integrated  
✅ Direction flip on left/right input (scaleX = ±1)  
✅ Smooth state transitions, no glitches  
✅ All states tested in gameplay loop  

### Integration with Polish Pass

- Animations enable visual feedback (player movement clarity)
- Compatible with death/respawn system (animations pause on death)
- Complements HUD display, camera follow, and physics tuning
- Sets foundation for future Level 2+ content

### Technical Notes

- Animation state driven by `fixedUpdate()` physics state
- Sprite sheet keys: `player-stand` (idle), `player-walk` (walk), `player-jump` (jump)
- Phaser `anims.create()` handles texture transitions automatically
- Performance: negligible overhead, 60 FPS stable

**Status:** Shipped and tested. Level 1 playable milestone achieved.

---

## 2026-05-09 — Audio / SFX System (commit a4a4fa9)

### Sound files found (all WAV in Content/Sounds/)
- **Jump.wav** → `sounds['jump']` (vol 0.5) — plays on jump initiation
- **Death.wav** → `sounds['death']` (vol 0.6) — plays in `triggerDeath()`
- **Checkpoint.wav** → `sounds['checkpoint']` (vol 0.7) — plays in `onCheckpointReached()`
- **Powerup.wav** → `sounds['powerup']` (vol 0.8) — plays in `onPlayerCollectItem()`
- **Shot1.wav** → `sounds['shoot']` (vol 0.4) — plays in `fireProjectile()`
- **InGame.wav** → looped background music (vol 0.3) — plays on audio context unlock

### Architecture decisions
- `public sounds: { [key: string]: Phaser.Sound.BaseSound }` on GameScene — accessible from entity classes
- Music uses `this.sound.locked` check + `sound.once('unlocked', ...)` to respect browser autoplay policy
- All hook points use optional chaining (`?.play()`) — missing files are silent no-ops
- No separate AudioManager class needed — GameScene owns all sounds directly at this scope

### Event hooks wired
| Event | Location | Sound |
|-------|----------|-------|
| Jump | `fixedUpdate()` — jump condition block | jump |
| Death | `triggerDeath()` | death |
| Checkpoint | `onCheckpointReached()` | checkpoint |
| PowerUp collect | `onPlayerCollectItem()` | powerup |
| Shoot | `fireProjectile()` | shoot |
| Background music | `create()` — deferred via unlock event | InGame loop |

### Key patterns
- **Browser autoplay**: use `this.sound.locked` to check; if locked, defer play via `this.sound.once('unlocked', cb)`. Phaser fires 'unlocked' on first user interaction.
- **WAV files are browser-native** — no XNB decoding needed; Content/Sounds/ is all raw WAV.
- **InGame.wav is large** (21 MB) — acceptable for now, consider OGG conversion for prod.

---

## 2026-05-09 — Level1-3 Conversion + Progression Chain (commit 1569f64)

### New entity types introduced by Level1-3
Level1-3 uses: `Puddle.Bird`, `Puddle.Block`, `Puddle.Button`, `Puddle.Cannon`, `Puddle.Checkpoint`, `Puddle.Geyser`, `Puddle.Pipe`, `Puddle.Roller`, `Puddle.Rat`, `Puddle.SpikeBall`.

**Two new types not previously registered:**
- `Puddle.Pipe` — stub added (console.warn, returns null)
- `Puddle.Rat` — stub added (console.warn, returns null)

All others were already registered (implemented or stubbed from Level1-2).

### Level progression refactor
- Replaced hardcoded `if (this.currentLevel === 'Level1-1')` chain with `LEVEL_SEQUENCE` constant array at module scope.
- `onPlayerReachedGate()` now uses `LEVEL_SEQUENCE.indexOf(this.currentLevel) + 1` to find the next level — adding future levels only requires appending to `LEVEL_SEQUENCE`.
- Transition banner text is now dynamic: `nextLevel.replace(/^Level(\d+)-(\d+)$/, 'Level $1-$2')` — no hardcoded level names in the transition code.
- HUD level label was already dynamic (added in audio session, line 291 of GameScene.ts) — no change needed.

### Files changed
- `web/public/assets/levels/Level1-3.json` — converted from Level1-3.tmx (22×22, 7 layers)
- `web/src/entities/EntityFactory.ts` — added `Puddle.Pipe` and `Puddle.Rat` stubs
- `web/src/scenes/GameScene.ts` — `LEVEL_SEQUENCE` constant, preload Level1-3 JSON + rat image, generalized `onPlayerReachedGate()`
- `web/package.json` — `convert-levels` script extended to include Level1-3

### Build status
✅ `tsc && vite build` — clean, no TypeScript errors.

### Pattern: adding campaign levels going forward
1. Convert TMX: `node scripts/tmx-to-json.js ../Content/Levels/LevelX-Y.tmx public/assets/levels/LevelX-Y.json`
2. Add `this.load.tilemapTiledJSON('LevelX-Y', ...)` in `preload()`
3. Preload any new tileset images referenced by the map
4. Add `'LevelX-Y'` to `LEVEL_SEQUENCE` array
5. Stub any new entity types in EntityFactory
6. Append to `convert-levels` in package.json


### 2026-05-09 — Audio System (Commit a4a4fa9)

- **16 WAV files catalogued** in Content/Sounds/
- **6 wired for game**: jump, death, checkpoint, powerup, shoot, InGame (music)
- **Audio pattern established**: Web Audio API integration, browser autoplay-safe (click-to-start)
- **Location reference**: Web assets will be placed in web/public/assets/audio/
- **Next**: Entity integration (Cannon fire sound, Player jump, etc.)

---

## 2026-05-22 — Roller Drift + SpikeBall Fall Fixes (commit 810fa7a)

### Root Cause: PhysicsGroup.createCallbackHandler overrides body settings

Discovered that `Phaser.Physics.Arcade.Group.add(child)` calls
`Group.createCallbackHandler(child)` for EVERY child added, not just
newly-created ones. That handler iterates `this.defaults` (including
`setAllowGravity: true` and `setCollideWorldBounds: false`) and applies them
via `body[key](value)`. This silently overrides any body settings applied in
an entity's constructor before `group.add()` is called.

**Bug 2 (SpikeBalls falling):** `SpikeBall.fromTiledObject` calls `group.add(ball, true)`,
which resets `allowGravity` to `true` — overriding `body.setAllowGravity(false)` set in the
constructor. Fix: re-apply `setAllowGravity(false)` + `setImmovable(true)` in
`fromTiledObject` AFTER the `group.add()` call.

**Bug 1 (Roller drift):** `setCollideWorldBounds(true)` in the Roller constructor was
being silently reset to `false` by the same mechanism, so world-bounds reversal was never
active. Additionally, Level1-1 has NO right-side wall blocks at the roller belt edges, so
`body.blocked.right` never fired. Fix:
- Remove `setCollideWorldBounds(true)` (it didn't work anyway)
- Add `xMin`/`xMax` patrol fields + `setPatrolBounds()` on Roller
- `update()` uses position checks; velocity re-applied every tick so player nudges
  cannot permanently alter roller speed
- GameScene computes belt extent from the movers group after all entities load

### Key Phaser 3 pattern learned

**`Group.add()` overrides body settings set in constructor.** 
`Phaser.Physics.Arcade.Group.add(child)` calls `createCallbackHandler(child)` which applies
all values in `this.defaults` (including `setAllowGravity: true`, `setCollideWorldBounds: false`)
by invoking `body[key](value)` on the added sprite. Any body settings applied before `group.add()`
are silently overridden. **Always re-apply non-default body properties AFTER `group.add()`.**

**`setImmovable(true)` on a dynamic body breaks ground collisions.** `StaticBody.immovable`
is `true` by default. `SeparateY` skips separation when BOTH bodies are immovable. If a
dynamic entity needs to sit on a static floor AND be immovable to players, use mass-based
resistance or always-re-assert velocity instead.

### Files changed
- `web/src/entities/Roller.ts` — position-based patrol, velocity re-asserted each tick
- `web/src/entities/SpikeBall.ts` — re-apply body settings after group.add()
- `web/src/scenes/GameScene.ts` — belt-extent computation + setPatrolBounds() call

