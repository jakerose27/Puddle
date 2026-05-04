# Puddle Web Port Context (single source of truth)

## Current state
- Branch: squad/web-port-spike
- **Level 1 playable end-to-end** ✅ (Milestone achieved 2026-05-04)
- Last commits:
  - Parker (commit 0d669f5): Roller, Geyser, NextLevel entities ported — 3 + 2 + 1 objects from Items/Gate layers, colliders wired, overlaps trigger player death
  - Ripley (commit c98f4bc): Player death/respawn system — triggerDeath(), respawn(), invincibility blink, pit death detection
  - Ripley (commit 225af46): Fixed-step accumulator — `GameScene.update()` → `fixedUpdate()` at 60 Hz, `tickCount` mirrors `Level.count`
  - Parker (commit b93b5c0): Entity factory spike — `Block.ts` + `EntityFactory.ts`, Ground object layer now routes through `EntityFactory.create()`
  - Ash (gate approved): `docs/web-port-feasibility.md` — TypeScript + Phaser 3 path formally committed, all TMX/JSON/delta-time concerns resolved
- What runs today: docs/repo-map.md ✅, docs/web-port-feasibility.md ✅ (revised, gate-approved), Phaser 3 scaffold ✅, Vercel config ✅, Fixed-step accumulator ✅, Entity factory pattern ✅, Level 1 playable ✅
- What does not run today: no Mac C# build yet, not all 15 entity classes ported, no audio, no Vercel project created yet

## Decisions made
- Decision 1: **TypeScript + Phaser 3** is the recommended port path (Dallas). Corrected: TMX files require export to Tiled JSON — they are NOT loaded directly. See docs/web-port-feasibility.md.
- Decision 2: MonoGame WASM (Option 1) is blocked by .NET 4.5 / MonoGame 3.0 toolchain debt — two removed namespaces, compiled binary font, vendored TiledSharp. See docs/repo-map.md.
- Decision 3: TMX → JSON conversion uses `web/scripts/tmx-to-json.js` (no external dependencies). Run via `npm run convert-levels` after editing a level in Tiled.
- Decision 4: Background tile layer (`Level1-1.tmx`, `visible="0"`) is vestigial. Web port matches original: `background.png` stretched to canvas. Tile rendering not used.
- Decision 5: Tiled layer conventions are entity-specific. Roller/Geyser in Items layer (not Enemies). SpikeBall in Enemies. Each entity implements correct y-coordinate formula in `fromTiledObject()`.
- Decision 6: Geyser simplified to static kill zone for Level 1 milestone. Restore full boost-and-hydrate behavior when Ripley's hydration system is ported.

## Next tasks (priority order)
1. **SpikeBall entity** — 17 objects in Enemies layer (gid=312). Likely kill zone like Roller/Geyser. Blocks: None. Effort: S.
2. **Checkpoint system** — 1 object in Items layer. Saves respawn position. Integrates with Ripley's respawn system. Effort: S.
3. **Player animation states** — Walk, jump, idle cycles. Replace placeholder sprite with multi-frame animations. Effort: M. Unblocks next: camera follow.
4. **Camera follow system** — Follow player, constrain to map bounds. Effort: S. Unblocks polish pass.
5. **Polish pass** — Timing tweaks, visual feedback, sound integration (future). Unblocks Level 1 → Level 2 progression.

## Active spike(s)
- Spike name: Spike 4+ — Entity porting and Level 1 playable (current)
  - Goal: Port Roller, Geyser, NextLevel entities; wire player death/respawn; achieve playable Level 1
  - Pass criteria: Player can move, jump, collide with ground, hit hazards, die, respawn at start ✅ ACHIEVED (2026-05-04)
  - Status: Complete. Level 1 playable end-to-end.
- Next spike: Spike 5 — SpikeBall + Checkpoint + Animation (planned)
  - Goal: Port remaining Level 1 entity types, add player animation, prepare Level 1 for final polish

## If token capped or stopping
- Run: ./scripts/pause.sh
- Then resume with: ./scripts/resume.sh

