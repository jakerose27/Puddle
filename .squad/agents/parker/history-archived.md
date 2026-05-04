# parker history (archived — details moved to docs and decision logs)

## Project Context
Project: Puddle
Language/Stack: C# MonoGame (SDL2, TiledSharp, XNA pattern)
Goal: Port to browser, deploy to Vercel
Branch: squad/web-port-spike
Owner: Jake
Approach: Docs-first. No big rewrites until feasibility is documented in docs/web-port-feasibility.md.
Key files: Game1.cs (game loop), Program.cs (entry point), Level.cs, Controls.cs, Content/ (assets), SDL.dll, TiledSharp.dll

## Learnings Archive — Spikes 1-5

**Spike 1: Repo Map & Feasibility Decision**
- Confirmed Option 2 (TypeScript + Phaser 3) is recommended path
- Phaser 3 reads Tiled JSON only (NOT .tmx XML directly)
- All 5 browser blockers identified; fixed-step accumulator recommended
- Source: docs/web-port-feasibility.md, docs/physics-delta-time-scope.md

**Spike 2: TypeScript + Phaser 3 Scaffold & TMX→JSON Converter**
- Built web/src/main.ts (Phaser game entry), web/src/scenes/GameScene.ts
- Created web/scripts/tmx-to-json.js (Node.js converter, regex-based, no external deps)
- Scaffolded web/ directory with Vite + TypeScript + Phaser 3
- Level1-1.json converted and committed; all 7 layer types parse correctly
- Background layer rendering: replaced PNG stretch with tilemap layer (later refined in Spike 5)
- Bundle: ~1.48MB (acceptable for spike)

**Spike 3: Entity Factory Pattern (Block.ts, EntityFactory.ts)**
- Ported Block entity; created registry-based factory dispatch
- Pattern: `EntityFactory.create(scene, obj, { ground, enemies, ... })` 
- Each entity implements `fromTiledObject()` static factory method
- Unknown types console.warn, don't throw; backward compatible via optional EntityGroups fields
- Commits: b93b5c0 (entity factory), 7f198f3 (jump fix after accumulator refactor)

**Spike 4: Roller, Geyser, NextLevel Ports**
- Roller: 4-frame animation, wall reversal, dynamic body, direction property
- Geyser: simplified to static kill zone per task spec (NOT boost-and-hydrate as per C#)
- NextLevel: static rect zone, wired and ready for future gate objects
- EntityGroups extended with rollers, hazards, gates optional fields
- Commit: 0d669f5 — "feat(web): port Roller, Geyser, NextLevel — Level 1 entities wired"

**Spike 5: SpikeBall Entity, Camera Follow, Roller Hitbox Refinement**
- Created SpikeBall.ts (static enemy, 17 objects in Enemies layer, gid=312)
- Renamed EntityGroups.rollers → EntityGroups.enemies (unified dynamic enemy group)
- Camera follow already wired; confirmed setBounds + startFollow(player)
- Fixed group.add() call signature for physics groups
- Commit: 06aada3 — "fix(web): roller hitbox, camera follow, SpikeBall entity"

---

## Current Work — Level 1 Polish Milestone

### Spike 6 — Checkpoint Entity (commit 2278910)

**What changed:**
- Created web/src/entities/Checkpoint.ts — tile-object sprite (gid=324), saves respawn position on overlap
- Updated EntityFactory.ts — added Puddle.Checkpoint registry entry
- Updated GameScene.ts — wired checkpoint physics group overlap callback

**Key findings:**
- C# stores respawn on player.checkpointXPos/Y; web port stores on GameScene.spawnX/Y (Ripley's respawn infrastructure)
- checkpoint.png already in web/public/assets/
- Tile object convention: y = bottom edge → `cy = obj.y - h/2`
- Level 1 has 1 checkpoint; future multi-checkpoint handling is a stub

**Architecture:** Checkpoint is StaticGroup with overlap (not collider) — allows player to pass through while triggering callback

---

### Spike 7 — Level 1 Polish Pass (commit 10ba581)

**Physics Tuning to C# Constants:**
- Gravity: 1260 px/s² (C# 0.35 px/tick² × 60² fps)
- Jump velocity: -600 px/s (C# 10 px/tick × 60)
- Player speed: 240 px/s (C# 3 px/tick × 60)
- Max fall speed: 600 px/s

**Mechanical Polish:**
- Jump cut: release space early to cut jump short (`body.setVelocity(x, 0)`)
- HUD: lives counter (top-left, "❤️ x5"), level label (top-right "Level 1-1")
- Death feedback: camera red flash (300ms), invincibility blink (120 ticks)
- Respawn Y offset: -8px to avoid floor-embed edge cases

**Goal System:**
- NextLevel overlay: semi-transparent black + "🎉 YOU WIN!" + "Press R to replay"
- R-key guard prevents accidental restarts
- Gate layer is empty in Level1-1.json; system ready for future levels

**Testing Validation:**
✅ Physics match C# prototype feel
✅ Hazards trigger death with proper grace period
✅ Checkpoint save/respawn works
✅ HUD reflects current state
✅ Goal overlay + R-guard functional
✅ All edge cases pass (near-ground respawn, double-tap goal, etc.)

---

## 2026-05-04 — Level 1 Polish Milestone (Parker contributions)

**Checkpoint Entity (commit 2278910)**
✅ Ported from C# prototype
✅ Reads gid=324 from Tiled Items layer (1 object in Level 1)
✅ Saves player respawn position on overlap
✅ Integrates with respawn grace period system

**Level 1 Polish Pass (commit 10ba581)**
✅ Physics tuned to C# constants
✅ Jump cut, HUD (lives + level label), death camera flash
✅ Respawn Y offset, NextLevel "You Win!" overlay with R-key guard
✅ All mechanical and visual feedback complete

**Status:** Level 1 fully polished and end-to-end playable. Ready for Level 2 expansion and additional entity porting.

---

## Next Tasks (Priority Order)

1. **Level 2 design** — Extend camera system, add new entity types
2. **Audio integration** — Background music, SFX (future spike)
3. **Additional entities** — Refine based on Level 2 requirements
