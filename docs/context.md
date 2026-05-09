# Puddle Web Port Context (single source of truth)

## Current state
- Branch: squad/web-port-spike
- **Level 1 fully polished and playable end-to-end** ✅ (Milestone achieved 2026-05-03)
- **Audio system catalogued** ✅ (ripley-4, commit a4a4fa9, 2026-05-09): 16 WAV files, 6 wired (jump, death, checkpoint, powerup, shoot, InGame music)
- **Level 1-2 assets + scene transition** ✅ (parker-9, commit d0fe5cc, 2026-05-09): 22 PNGs copied, TMX→JSON converted, transition Level1-1 → Level1-2 → You Win
- **All 11 levels fully implemented and wired** ✅ (squad/web-port-spike sprint complete)
- Last commits (in order):
  - Ripley (commit a4a4fa9): Audio system — 16 WAV files in Content/Sounds/, 6 wired for game, browser autoplay-safe
  - Parker (commit d0fe5cc): Level1-2 assets — 22 PNGs copied, TMX converted, scene transition wired, Bird/Button/Cannon stubs
  - Parker (commit 07b86d2): Visual entity bug fixes — Geyser sprite (cyan rect → geyser.png), Block physics bodies transparent (alpha=0), Block y-formula fix for rectangle objects (77 affected), TiledObject interface updated with `gid?: number` field
  - Parker (commit 10ba581): Level 1 polish pass — physics tuned to C# constants, jump cut, HUD (lives + level label), death camera flash, respawn Y offset, NextLevel "You Win!" overlay with R-key guard
  - Ripley (commit 4758128): Player animations — idle/walk/jump states, real sprite sheets from Content/PC/, direction flip
  - Parker (commit 2278910): Checkpoint entity — Checkpoint.ts, EntityFactory wired, GameScene checkpoint overlap callback
  - Parker (commit 06aada3): SpikeBall entity, camera follow, roller hitbox fix
  - Ripley (commit c98f4bc): Player death/respawn system — triggerDeath(), respawn(), invincibility blink, pit death detection
  - Ash (gate approved): `docs/web-port-feasibility.md` — TypeScript + Phaser 3 path formally committed, all TMX/JSON/delta-time concerns resolved
  - **1569f64** — Level1-3 converted, LEVEL_SEQUENCE driven by array, Pipe + Rat stubbed
  - **bd9a36c** — Bird (patrol), Button (stub), Cannon (timed fireball) entities for Level1-2
  - **a6cfe1f** — Level2-1 through Level2-4 converted and wired into LEVEL_SEQUENCE
  - **dad0a3f** — Pipe (teleporter), Rat (patrol+jump), Hand (L-path), Face (boss) entities implemented; onBossDefeated() in GameScene
  - **ec64a35** — Level3-1, Level3-2, Level3-3, LevelBoss converted; LEVEL_SEQUENCE complete (all 11 levels)
  - **82e69cf** — Projectile→enemy overlap: player shots now call takeDamage() on enemies (enables boss fight)
  - **543bec7** — Button gate system: Block.changeType(), namedBlocks Map, holdButton release, gate/Gate/Invis toggling
- What runs today: docs/repo-map.md ✅, docs/web-port-feasibility.md ✅ (gate-approved), Phaser 3 scaffold ✅, Vercel config ✅, Fixed-step accumulator ✅, Entity factory pattern ✅, All 11 levels fully playable ✅, Checkpoint system ✅, Player animations ✅, Physics tuning ✅, HUD ✅, Death/respawn feedback ✅, Goal overlay ✅, Audio catalogued ✅, Pipe (teleporter) ✅, Rat (patrol+jump) ✅, Hand (L-path) ✅, Face (boss) ✅, Button gates ✅, Projectile→enemy damage ✅
- What does not run today: full Geyser boost/hydration (simplified kill zone in Level3-1), Vercel prod deployment (not created yet)

## Decisions made
- Decision 1: **TypeScript + Phaser 3** is the recommended port path (Dallas). Corrected: TMX files require export to Tiled JSON — they are NOT loaded directly. See docs/web-port-feasibility.md.
- Decision 2: MonoGame WASM (Option 1) is blocked by .NET 4.5 / MonoGame 3.0 toolchain debt — two removed namespaces, compiled binary font, vendored TiledSharp. See docs/repo-map.md.
- Decision 3: TMX → JSON conversion uses `web/scripts/tmx-to-json.js` (no external dependencies). Run via `npm run convert-levels` after editing a level in Tiled.
- Decision 4: Background tile layer (`Level1-1.tmx`, `visible="0"`) is vestigial. Web port matches original: `background.png` stretched to canvas. Tile rendering not used.
- Decision 5: Tiled layer conventions are entity-specific. Roller/Geyser in Items layer (not Enemies). SpikeBall in Enemies. Each entity implements correct y-coordinate formula in `fromTiledObject()`.
- Decision 6: Geyser simplified to static kill zone for Level 1 milestone. Restore full boost-and-hydrate behavior when Ripley's hydration system is ported.

## Next tasks (priority order)
1. **Geyser boost fix + gameplay polish** — Geyser currently simplified; restore full boost-and-hydrate behavior. Cannon direction tuning, Rat update loop, HUD lives tracking, Face damage verification. Effort: M. In progress (ripley-8).
2. **Audio integration** — Hook 6 wired audio files (jump, death, checkpoint, powerup, shoot, InGame music) to game events. Effort: M. Unblocks final polish.
3. **Bug fixes & edge case handling** — Player/entity edge cases, physics edge conditions, level transition edge cases. Effort: S. Unblocks public playtesting.
4. **Vercel deployment** — Deploy web/ to Vercel prod. Effort: S. Unblocks public playtesting.

## Active spike(s)
- Spike name: Spike 4+ — Entity porting and Level 1 playable (COMPLETE ✅)
  - Goal: Port Roller, Geyser, NextLevel, Checkpoint, SpikeBall entities; wire player death/respawn/animations; achieve polished Level 1
  - Pass criteria: Player can move, jump, collide with ground, hit hazards, die, respawn at checkpoint, reach goal with animations ✅ ACHIEVED (2026-05-03)
  - Status: Complete. Level 1 fully polished and end-to-end playable.
- Spike name: Spike 11 — Audio + Level1-2 (COMPLETE ✅)
  - Goal: Catalog audio system (ripley-4), expand to Level1-2 (parker-9), wire scene transitions
  - Status: ripley-4 (audio 16 WAV, 6 wired) ✅ COMPLETE. parker-9 (Level1-2 assets, stubs) ✅ COMPLETE. Bird/Button/Cannon/Level entities ✅ COMPLETE. All 11 levels wired ✅ COMPLETE.
- Spike name: Spike 12 — Gameplay polish and Geyser (IN PROGRESS 🔄)
  - Goal: Geyser boost fix, cannon direction tuning, Rat update loop, HUD lives tracking, Face damage verification
  - Status: ripley-8 in progress

## If token capped or stopping
- Run: ./scripts/pause.sh
- Then resume with: ./scripts/resume.sh

