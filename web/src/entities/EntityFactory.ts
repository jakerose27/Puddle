import Phaser from 'phaser';
import { Block, TiledObject } from './Block';

export interface EntityGroups {
  ground: Phaser.Physics.Arcade.StaticGroup;
}

type EntityCreator = (
  scene: Phaser.Scene,
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
};

export const EntityFactory = {
  /**
   * Dispatch an entity creation call based on the Tiled object's `type` field.
   * Returns the created entity, or null if the type is unknown.
   * Unknown types are logged (not thrown) so one bad object doesn't crash the level.
   */
  create(scene: Phaser.Scene, obj: TiledObject, groups: EntityGroups): unknown {
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
