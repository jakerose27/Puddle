# Parker History Summary

## Spikes Completed

### Spike 1-5 (Archived)
See `parker/history-archived.md`. Covered feasibility evaluation, architecture, entity factory pattern.

### Spike 6: Checkpoint Entity (2026-05-03)
- Checkpoint.ts: Static sprite, activates on player touch, updates respawn
- GameScene integration: overlap detection, respawn state tracking
- Pattern: Tile objects use `cy = obj.y - h/2` (bottom-edge convention)

### Spike 7: Level 1 Polish (2026-05-03)
- Physics tuning to C# constants (JUMP_VELOCITY, GRAVITY, etc.)
- HUD: Lives + level text with scroll-factor lock
- Death feedback: camera flash, respawn to checkpoint

### Spike 8: Level 1 Enemy Loop (2026-05-03)
- Enemy entity system: Ring, Roller, Cannon
- Collision handling: hurt on touch, knockback, death timeout

### Spike 9: Item System (2026-05-03)
- Item entity: Apple (food), Heart (1-up), Gem (collectible)
- Pickups: health restore, score increment, UI update

### Spike 10: Level Complete + Transition (2026-05-03)
- Exit detection: player touches level exit
- Scene.stop() → Scene.start() pattern
- Level sequence: 1-1 → 1-2 → 1-3 → game over / next chapter

## Current Focus (2026-05-09)

**Level1-2 release:** 22 PNGs copied, TMX→JSON converted, stubs created (Bird, Button, Cannon).

## Patterns Established

1. **Asset copy:** Bulk PNG copy, then Tiled export to JSON
2. **Entity stubs:** Create skeleton implementation, integrate into level, flesh out behavior
3. **Scene transitions:** Use Phaser scene lifecycle (stop→start)
4. **Physics:** Fixed-step accumulator at 60 ticks/s, tickCount replaces Level.count

## Next

- Level1-3 parallel asset work
- Bird/Button/Cannon full implementation
- Audio integration
