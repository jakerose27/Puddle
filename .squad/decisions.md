# Squad Decisions

## Active Decisions

### Project Guardrails: Puddle Web Port
**From:** Project  
**Date:** 2026-05-03T17:14:09-07:00  
**Status:** Established

#### Non-negotiables
- Do not do big rewrites until feasibility is documented in docs/web-port-feasibility.md
- Keep planning in repo files (docs/plan.md, docs/context.md)
- Prefer small, reviewable commits and checkpoint often

#### Sub agent discipline
- Use /fleet for sub agents when doing broad work
- Each sub agent writes a short summary to docs/subagent-notes/<name>.md
- Orchestrator reads those summaries before making decisions
- Do not spawn more than needed (sub-agent limit exists)

#### Slop prevention
- If unsure, write a question into docs/context.md instead of guessing
- Reviewer must be a different role/model than the implementer

#### Token cap fail-safe
If any agent hits a rate limit, quota, or token cap:
1) Immediately stop new work
2) Update docs/context.md with: where it stopped, what files changed, the exact next 3 tasks
3) Run ./scripts/pause.sh (or ask Jake to run it)
4) Inform Jake: "Token cap hit. Repo checkpointed. Ready to resume."

---

### Web Port Feasibility Options
**From:** Dallas (Lead / Architect)  
**Date:** 2026-05-03T17:14:09-07:00  
**Status:** Recommendation — pending spike validation  
**Ref:** docs/web-port-feasibility.md

#### Decision
**Recommended path: Option 2 — TypeScript + Phaser 3 partial rewrite.**

#### Rationale
Three options were evaluated for porting Puddle to browser + Vercel:

1. **MonoGame WASM** — Blocked by toolchain debt: MonoGame v3.0 → 3.8+ upgrade required, two removed namespaces (`Storage`, `GamerServices`) in every source file, compiled binary font (`Arial.xnb`), old vendored TiledSharp DLL. Clears none of this before touching the browser. Effort: Large.

2. **TypeScript + Phaser 3** *(recommended)* — All level data (TMX), PNG textures, and WAV audio transfer without conversion. Phaser 3 reads TMX natively. C# entity code is clean and translates mechanically to TypeScript. Vercel deploy is `vite build` → static folder. Effort: Medium (3–6 weeks).

3. **Full rewrite** — Warranted only if game design changes significantly. Not applicable here. Effort: Large+.

#### Required before committing
- Spike: Phaser 3 loads `Level1-1.tmx` object layers correctly
- Spike: Identify TMX `type` attribute format (qualified vs short name)
- Decision: Audio init strategy (click-to-start required for browser autoplay policy)

#### Files
- Full analysis: `docs/web-port-feasibility.md`
- Spike plan: `docs/spike-plan.md` (Spike 2 is the next gate)

---

### Ripley Findings: repo-map
**Date:** 2026-05-03T17:14:09-07:00  
**Source:** repo-map task  
**File produced:** `docs/repo-map.md`

#### Summary
Full technical map of the Puddle repo completed. Key findings for browser port feasibility:

#### 🔴 Hard Blockers
1. **`.NET Framework 4.5` target** — must migrate to `.NET 6+` (SDK-style csproj) before any browser port is possible. No `dotnet` CLI support in current form.
2. **`#if WINDOWS || LINUX` entrypoint guard** — `Program.Main()` will not compile for a WASM/browser target. New entrypoint required.
3. **MonoGame 3.0 with local Windows DLLs** — references `$(MSBuildExtensionsPath)\..\MonoGame\v3.0\Assemblies\WindowsGL\`. No NuGet, no Mac support without .csproj surgery.
4. **`SDL.dll` embedded as Windows native binary** — irreplaceable in browser sandbox. Must swap for WebGL/Canvas renderer.
5. **`TiledSharp` uses synchronous `System.IO` file access** — `new TmxMap("Content/Levels/...")` will fail in browser. Must be replaced with async asset fetch + in-memory XML parse.
6. **OpenAL audio (`SoundEffect`)** — not available in browser. Must port to Web Audio API.

#### 🟡 Medium Complexity
1. **Reflection-based object instantiation** — `Type.GetType(obj.Type)` + `Activator.CreateInstance` for all TMX objects. AOT/IL-linker in Blazor WASM strips unreferenced types by default. Needs explicit `[DynamicDependency]` or registration table.
2. **Frame-rate coupled physics** — uses integer `count++` tick counter, not delta-time. Browser runs at variable `requestAnimationFrame` rate (not guaranteed 60Hz). Behavior will drift or break without delta-time refactor.
3. **`SpriteFont` from XNB** — `Arial.xnb` is MonoGame Content Pipeline binary. Not usable in browser; needs conversion to TTF + new font rendering.
4. **Window/canvas sizing** — backbuffer resized from TMX at level load (`graphics.PreferredBackBufferWidth`). Browser canvas must be resized via DOM API.

#### 🟢 Reusable / Portable Assets
- All game logic (physics, collision, state machines) is pure C# — zero platform deps
- PNG sprite assets are browser-ready
- WAV audio files are browser-compatible (Web Audio API)
- TMX level data is plain XML — parseable anywhere
- `Controls.cs` input abstraction is clean and easily re-implemented for browser keyboard events
- AABB collision in `Sprite.Intersects()` — pure math

#### Open Questions
1. **Tile layer rendering** — `Level.Draw()` only draws game objects (items, projectiles, enemies, player). The background is drawn as a stretched PNG. There is no visible tile-layer rendering loop. Are the TMX tile layers purely decorative/unused, or is there a rendering path not yet found?
2. **Mac build path** — project does not build on Mac in current state. A `.csproj` migration spike is needed before any code can be run and verified on Mac.
3. **`Microsoft.Xna.Framework.Storage` + `GamerServices`** — imported in multiple files but likely unused at runtime. Should be removed before port to avoid stub complexity.

#### Recommended Next Steps
1. **Spike: Migrate `.csproj` to SDK-style targeting `net6.0` with MonoGame 3.8.1 NuGet** — this unlocks Mac builds and is a prerequisite for any further platform work.
2. **Spike: Enumerate all `Type.GetType` call sites** — document every TMX object type string to ensure they can be preserved through AOT compilation.
3. **Spike: Replace `TiledSharp` file I/O with in-memory parse** — validate that TMX XML can be parsed from a `Stream` or `string` without filesystem access.
4. **Spike: Delta-time physics refactor assessment** — estimate scope of decoupling physics from `count++` ticks.

---

### 2026-05-03T21:28:40-07:00: Fixed-Step Accumulator Implementation
**Author:** Ripley (Engine Dev)  
**Status:** Implemented — build passing, pushed to `squad/web-port-spike`  
**Commit:** 225af46

#### Decision
Implement a fixed-step accumulator in `GameScene.update()` to decouple physics simulation from browser frame rate.

#### Rationale
The original C# engine drives all physics, AI, animation timers, and game state through `Level.count`, a bare integer incremented once per frame. The browser's `requestAnimationFrame` is not locked to 60 Hz — it runs at the monitor's refresh rate (30, 60, 120, 144 Hz). Without the accumulator, physics would run faster on high-refresh monitors and slower on 30 Hz devices.

The fixed-step accumulator pattern solves this with ~20 lines: it drains `delta` milliseconds from an accumulator at exactly 16.667 ms (60 Hz) per tick, calling `fixedUpdate()` once per consumed interval. `tickCount` increments with each tick and is the direct equivalent of `Level.count`.

#### Implementation details
- **`this.accumulator`** — carries fractional frame time between `update()` calls  
- **`this.FIXED_STEP_MS = 1000/60`** — the fixed interval (16.667ms)  
- **`this.tickCount`** — mirrors `Level.count`; use this for all frame-based timers when porting C# entity logic  
- **`fixedUpdate()`** — all simulation logic lives here, never in `update()`  
- **`update(time, delta)`** — accumulator loop only; no gameplay logic

#### Files changed
- `web/src/scenes/GameScene.ts` — accumulator state + `update()` + `fixedUpdate()`

---

### 2026-05-03T21:28:40-07:00: Entity Factory Architecture
**Author:** Parker (Web/Deploy)  
**Commit:** b93b5c0  
**Branch:** squad/web-port-spike

#### Decision
Use a static `REGISTRY: Record<string, EntityCreator>` dictionary in `EntityFactory.ts`.

#### Context
Tiled JSON object layers store entity types as fully-qualified C# class names (e.g. `"Puddle.Block"`, `"Puddle.Roller"`). The C# game uses `Type.GetType(obj.Type)` + `Activator.CreateInstance` reflection for instantiation. We need a TypeScript equivalent that is AOT-safe (no reflection), readable, and easy to extend for ~15 entity classes.

#### Registry specification
- **Keys**: fully-qualified C# type strings, preserved exactly as they appear in Tiled JSON (e.g. `"Puddle.Block"`). Do NOT shorten to `"Block"` — the JSON is the source of truth and keys must match verbatim.
- **Values**: arrow functions `(scene, obj, groups) => Entity` — each factory function is responsible for construction and self-registration into the appropriate group (e.g. `groups.ground`).
- **EntityGroups interface**: passed into every creator, carries shared Phaser physics groups (StaticGroup for ground, Group for enemies, etc.). Extend as new group types are needed.
- **Unknown types**: `console.warn`, return `null`. Never throw — one unknown object must not crash level load.

#### Rationale
- Avoids reflection (AOT-safe, Vite tree-shakes cleanly).
- Keys match C# TMX type strings, so future entity ports have zero naming friction.
- Groups pattern lets each entity self-register without GameScene needing to know entity internals.
- Single `EntityFactory.create(scene, obj, groups)` call site in GameScene is clean and consistent across all object layers.

#### Files
- `web/src/entities/Block.ts` — first entity implementation
- `web/src/entities/EntityFactory.ts` — registry + dispatch
- `web/src/scenes/GameScene.ts` — updated Ground loop

#### Known deferred work
- Block has 4 variants (metal/push/break/temp) driven by Tiled properties `left`, `right`, `gravity`, `canBreak`, `transparent`, `solid`. Only metal (static) is implemented. Push/break/temp deferred until physics loop is confirmed stable.
- EntityGroups interface will grow as more entity classes are added — keep it in EntityFactory.ts for now, extract to a shared types file if it exceeds ~5 groups.
- Sound effects (Slide.wav, BlockFall.wav for push blocks) — deferred to audio spike.

---

### 2026-05-03T21:28:40-07:00: Feasibility Doc Gate Review — Round 2 (APPROVED)
**Reviewer:** Ash  
**Artifact:** docs/web-port-feasibility.md (revised by Parker)  
**Verdict:** APPROVED

#### Prior issues resolved
- ✅ TMX claims corrected throughout — Phaser 3 now correctly documented as JSON-only (`tilemapTiledJSON`); explicit statement that it "does NOT read `.tmx` XML directly" (line 85); spike criterion updated to `Level1-1.json` (line 119); recommendation section says "Tiled JSON format" (line 167)
- ✅ Delta-time physics risk present in Option 2 risk table — listed as Medium severity with clear description of `count++` coupling and `requestAnimationFrame` variance (line 115)
- ✅ Q8 (TMX→JSON batch conversion workflow) added — asks about Tiled CLI availability, repo placement of export scripts, and re-export process for level edits (line 193)
- ✅ Q9 (delta-time physics refactor scope) added — asks for full scope assessment before trusting the 3–6 week estimate (line 195); now comprehensively answered by Ripley's `docs/physics-delta-time-scope.md` which enumerates all 16 entity subsystems, quantifies ~40 touch points, and recommends the fixed-step accumulator (Plan 3B) as a 2–3 file change
- ✅ Background tile layer `visible="0"` documented — note block after spike pass criteria explains the layer is hidden in Tiled and effectively vestigial; spike criterion clarified as optional (line 123)

#### Remaining issues (non-blocking)
- Minor: Open Question #2 (line 182) still contains residual TMX language: "Confirm Phaser 3's Tiled loader correctly parses object layers … from these specific TMX files" and "TMX XML support should be verified." This is inconsistent with the corrected body text that clearly states Phaser does NOT read TMX XML. Should say "from the JSON exports of these TMX files." Not blocking — the main body is unambiguous and this Q is already spike-scoped.
- Note: `decisions.md` lines 48 and 53 still carry the old "Phaser 3 reads TMX natively" / "loads `Level1-1.tmx`" language from Dallas's original summary. Recommend Dallas's replacement update `decisions.md` to match the corrected feasibility doc. Not blocking this gate.

#### Summary
All five rejection issues from Round 1 have been corrected. The revised doc is factually accurate on Phaser 3's Tiled JSON requirement, properly surfaces the delta-time risk, documents the Background layer quirk, and adds both missing open questions. Ripley's physics-delta-time-scope.md provides strong supporting evidence that the delta-time concern is manageable. The doc is approved as the basis for committing to Option 2.

---

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction

## Model policy (Puddle)
**By:** Jake  
**What:**  
- Leader/orchestrator uses **Opus 4.7 (1M context)**.  
- Code reviewer, designer, and dev designer use **Opus 4.7 (Extra High)**.  
- Implementers use **Sonnet**.  
**Why:** Max context for orchestration, extra-high reasoning for critique/design, lower-cost implementers for throughput.

## Cap and stop policy (Puddle)
**By:** Jake  
**What:** If any agent hits rate limit, quota, token cap, or "premium requests disabled":  
1) Stop creating new subagents immediately  
2) Update `docs/context.md` with: what was in progress, files touched, next 3 tasks  
3) Instruct Jake to run `./scripts/pause.sh`  
4) Default action is stop and resume later (only continue if Jake explicitly opts in)  
**Why:** Prevent partial work and preserve a clean resume point.
