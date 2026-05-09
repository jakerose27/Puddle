import Phaser from 'phaser';
import type { TiledObject } from './Block';

// C# Rat speed = 2 px/tick → 2 × 60 = 120 px/s in Phaser world units.
const RAT_SPEED = 120;
// Jump velocity matching a roughly one-tile hop (~10 px/tick in C# = 600 px/s, capped).
const RAT_JUMP_VELOCITY = -420;
// C# rnd.NextDouble() > .99 per tick ≈ 1 % chance.
const RAT_JUMP_CHANCE = 0.01;

/**
 * Rat — patrol enemy with occasional random jump, ported from C# Puddle.Rat.
 *
 * C# behaviour:
 *   - Walks horizontally at speed 2 px/tick; turns on wall collision.
 *   - Falls under gravity (not flying).
 *   - Randomly jumps ~1 % of ticks when grounded.
 *   - health = 3 (treated as unkillable in this port, like Bird).
 *   - Animated: 4 frames × 32 px wide, advances every 8 ticks.
 */
export class Rat extends Phaser.Physics.Arcade.Sprite {
  private direction: number = -1; // -1 = left, 1 = right

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'rat');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setSize(28, 28);

    // Create walk animation once (Phaser guards against duplicate keys)
    if (!scene.anims.exists('rat-walk')) {
      scene.anims.create({
        key: 'rat-walk',
        frames: scene.anims.generateFrameNumbers('rat', { start: 0, end: 3 }),
        frameRate: 8, // advances every 8 ticks ≈ 7.5 fps at 60 Hz
        repeat: -1,
      });
    }
    this.play('rat-walk', true);

    this.setFlipX(true); // default: face left
    this.setVelocityX(RAT_SPEED * this.direction);
  }

  /**
   * Creates a Rat from a Tiled tile-object and adds it to the enemies group.
   * Tile-object convention: (x, y) = bottom-left → center = (x + w/2, y - h/2).
   */
  static fromTiledObject(
    scene: Phaser.Scene,
    obj: TiledObject,
    group: Phaser.Physics.Arcade.Group,
  ): Rat {
    const w = obj.width || 32;
    const h = obj.height || 32;
    const cx = obj.x + w / 2;
    const cy = obj.y - h / 2;

    const rat = new Rat(scene, cx, cy);
    group.add(rat, true);
    return rat;
  }

  /**
   * Per fixed-tick logic. Reverses on wall contact; randomly jumps when grounded.
   * Called from GameScene.fixedUpdate.
   */
  update(_tickCount: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down;

    // Wall reversal
    if (body.blocked.left && this.direction === -1) {
      this.direction = 1;
      this.setVelocityX(RAT_SPEED);
      this.setFlipX(false);
    } else if (body.blocked.right && this.direction === 1) {
      this.direction = -1;
      this.setVelocityX(-RAT_SPEED);
      this.setFlipX(true);
    }

    // Random jump (~1 % chance per tick when grounded)
    if (onGround && Math.random() < RAT_JUMP_CHANCE) {
      this.setVelocityY(RAT_JUMP_VELOCITY);
    }
  }
}
