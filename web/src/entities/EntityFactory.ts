import Phaser from 'phaser';
import { Block, TiledObject } from './Block';
import { Roller } from './Roller';
import { Geyser } from './Geyser';
import { NextLevel } from './NextLevel';
import { SpikeBall } from './SpikeBall';
import { Checkpoint } from './Checkpoint';
import { PowerUp } from './PowerUp';
import type { GameScene } from '../scenes/GameScene';

export interface EntityGroups {
  ground: Phaser.Physics.Arcade.StaticGroup;
  enemies?: Phaser.Physics.Arcade.Group;
  hazards?: Phaser.Physics.Arcade.StaticGroup;
  gates?: Phaser.Physics.Arcade.StaticGroup;
  checkpoints?: Phaser.Physics.Arcade.StaticGroup;
  items?: Phaser.Physics.Arcade.StaticGroup;
}

type EntityCreator = (
  scene: GameScene,
  obj: TiledObject,
  groups: EntityGroups,
) => unknown;

/**
 * Registry maps fully-qualified C# type keys (as stored in Tiled JSON) to
 * creator functions. Extend this as entity classes are ported.
 *
 * Key format must match the `type` field in Level JSON exactly —
 * e.g. "Puddle.Block", "Puddle.Roller", "Puddle.Geyser".
 */
const REGISTRY: Record<string, EntityCreator> = {
  'Puddle.Block': (scene, obj, groups) => Block.fromTiledObject(scene, obj, groups.ground),
  'Puddle.Roller': (scene, obj, groups) => {
    if (!groups.enemies) return null;
    return Roller.fromTiledObject(scene, obj, groups.enemies);
  },
  'Puddle.Geyser': (scene, obj, groups) => {
    if (!groups.hazards) return null;
    return Geyser.fromTiledObject(scene, obj, groups.hazards);
  },
  'Puddle.NextLevel': (scene, obj, groups) => {
    if (!groups.gates) return null;
    return NextLevel.fromTiledObject(scene, obj, groups.gates);
  },
  'Puddle.SpikeBall': (scene, obj, groups) => {
    if (!groups.enemies) return null;
    return SpikeBall.fromTiledObject(scene, obj, groups.enemies);
  },
  'Puddle.Checkpoint': (scene, obj, groups) => {
    if (!groups.checkpoints) return null;
    return Checkpoint.fromTiledObject(scene, obj, groups.checkpoints);
  },
  'Puddle.PowerUp': (scene, obj, groups) => {
    if (!groups.items) return null;
    return PowerUp.fromTiledObject(scene, obj, groups.items);
  },

  // Level1-2 entities — stubs until fully implemented
  'Puddle.Bird': (_scene, obj, _groups) => {
    console.warn(`[EntityFactory] Puddle.Bird not yet implemented (name="${obj.name ?? ''}") — skipping`);
    return null;
  },
  'Puddle.Button': (_scene, obj, _groups) => {
    console.warn(`[EntityFactory] Puddle.Button not yet implemented (name="${obj.name ?? ''}") — skipping`);
    return null;
  },
  'Puddle.Cannon': (_scene, obj, _groups) => {
    console.warn(`[EntityFactory] Puddle.Cannon not yet implemented (name="${obj.name ?? ''}") — skipping`);
    return null;
  },

  // Level1-3 entities — stubs until fully implemented
  'Puddle.Pipe': (_scene, obj, _groups) => {
    console.warn(`[EntityFactory] Puddle.Pipe not yet implemented (name="${obj.name ?? ''}") — skipping`);
    return null;
  },
  'Puddle.Rat': (_scene, obj, _groups) => {
    console.warn(`[EntityFactory] Puddle.Rat not yet implemented (name="${obj.name ?? ''}") — skipping`);
    return null;
  },
};

export const EntityFactory = {
  /**
   * Dispatch an entity creation call based on the Tiled object's `type` field.
   * Returns the created entity, or null if the type is unknown.
   * Unknown types are logged (not thrown) so one bad object doesn't crash the level.
   */
  create(scene: GameScene, obj: TiledObject, groups: EntityGroups): unknown {
    const creator = REGISTRY[obj.type ?? ''];
    if (!creator) {
      if (obj.type) {
        console.warn(
          `[EntityFactory] Unknown type: "${obj.type}" (name="${obj.name ?? ''}")  — skipping`,
        );
      }
      return null;
    }
    return creator(scene, obj, groups);
  },
};
