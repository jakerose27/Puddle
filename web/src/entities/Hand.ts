import Phaser from 'phaser';
import type { TiledObject } from './Block';

// C# Hand speed = 1 px/tick → 60 px/s in Phaser world units.
const HAND_SPEED = 60;
// C# switches axis every 80 ticks.
const SWITCH_INTERVAL = 80;

/**
 * Hand — L-path floating patrol enemy, ported from C# Puddle.Hand.
 *
 * C# behaviour:
 *   - 64×64 sprite, no gravity (floats).
 *   - `left` Tiled property: if true, starts moving vertically (yVel = speed);
 *     otherwise starts moving horizontally (xVel = speed).
 *   - Every 80 ticks, switches between horizontal and vertical movement axes.
 *   - Reverses direction on world bounds / wall collision within each axis.
 *   - health = 15 (treated as unkillable in this port).
 */
export class Hand extends Phaser.Physics.Arcade.Sprite {
  private movingVertically: boolean;
  /** Current horizontal velocity direction sign (±1). */
  private horizDir: number = 1;
  /** Current vertical velocity direction sign (±1). */
  private vertDir: number = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, startVertical: boolean) {
    super(scene, x, y, 'hand');
    this.movingVertically = startVertical;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCollideWorldBounds(true);
    body.setSize(64, 64);

    this.setInitialVelocity();
  }

  /**
   * Creates a Hand from a Tiled tile-object and adds it to the enemies group.
   *
   * Reads the `left` boolean property from Tiled:
   *   - true  → starts moving vertically
   *   - false → starts moving horizontally
   */
  static fromTiledObject(
    scene: Phaser.Scene,
    obj: TiledObject,
    group: Phaser.Physics.Arcade.Group,
  ): Hand {
    const w = obj.width || 64;
    const h = obj.height || 64;
    const cx = obj.x + w / 2;
    const cy = obj.y - h / 2;

    const startVertical =
      obj.properties?.some(
        p => p.name === 'left' && (p.value === true || String(p.value) === 'True'),
      ) ?? false;

    const hand = new Hand(scene, cx, cy, startVertical);
    group.add(hand, true);
    return hand;
  }

  /**
   * Per fixed-tick logic. Switches axes every SWITCH_INTERVAL ticks and
   * reverses direction when blocked by world bounds or walls.
   * Called from GameScene.fixedUpdate.
   */
  update(tickCount: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    // Reverse directions on world-bounds/wall contact
    if (body.blocked.left)  { this.horizDir =  1; }
    if (body.blocked.right) { this.horizDir = -1; }
    if (body.blocked.up)    { this.vertDir  =  1; }
    if (body.blocked.down)  { this.vertDir  = -1; }

    // Switch movement axis every SWITCH_INTERVAL ticks
    if (tickCount > 0 && tickCount % SWITCH_INTERVAL === 0) {
      this.movingVertically = !this.movingVertically;
      this.setInitialVelocity();
    }
  }

  private setInitialVelocity(): void {
    if (this.movingVertically) {
      this.setVelocity(0, HAND_SPEED * this.vertDir);
    } else {
      this.setVelocity(HAND_SPEED * this.horizDir, 0);
    }
  }
}
