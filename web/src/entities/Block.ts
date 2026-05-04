import Phaser from 'phaser';

// Minimal Tiled object shape — only the fields Block uses.
export interface TiledObject {
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
  type?: string;
  properties?: Array<{ name: string; value: unknown }>;
}

const TILE_SIZE = 32;
const BLOCK_COLOR = 0x8b6f47;

/**
 * Block — static collision tile ported from C# Puddle.Block.
 *
 * C# Block supports four blockType variants: "metal" (static), "push" (gravity +
 * pushable by player), "break" (destructible), "temp" (gate / invisible). It also
 * reads Tiled properties: left, right, gravity, canBreak, transparent, solid.
 *
 * TODO: Implement push (gravity), break, and temp variants when those entity
 *       classes are ported. For now, Block is always a static solid body.
 */
export class Block {
  readonly gameObject: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, cx: number, cy: number, w: number, h: number) {
    this.gameObject = scene.add.rectangle(cx, cy, w, h, BLOCK_COLOR);
    scene.physics.add.existing(this.gameObject, true /* static */);
  }

  /**
   * Factory method — creates a Block from a Tiled object and adds it to the
   * given static group so Phaser's Arcade Physics picks it up for collisions.
   *
   * Tiled tile-object convention: (x, y) is the bottom-left corner of the tile.
   * Center = (x + w/2, y - h/2).
   */
  static fromTiledObject(
    scene: Phaser.Scene,
    obj: TiledObject,
    group: Phaser.Physics.Arcade.StaticGroup,
  ): Block {
    const w = obj.width || TILE_SIZE;
    const h = obj.height || TILE_SIZE;
    const cx = obj.x + w / 2;
    const cy = obj.y - h / 2;

    const block = new Block(scene, cx, cy, w, h);
    group.add(block.gameObject);
    return block;
  }
}
