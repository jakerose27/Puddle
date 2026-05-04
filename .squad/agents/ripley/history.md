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

- Player animation states (walk, jump, idle cycle)
- SpikeBall entity (pending Parker port)
- Checkpoint system to save respawn position

**Status:** Death/respawn system shipped and tested. Level 1 playable milestone achieved. Ready for animation and checkpoint work.
