import Phaser from 'phaser';
import type { TiledObject } from './Block';

// C# Roller used speed=2px/tick at 60Hz ≈ 120 px/s in Phaser world units.
const ROLLER_SPEED = 120;

/**
 * Roller — horizontal-patrol enemy ported from C# Puddle.Roller.
 *
 * C# Roller sets `speed = faceLeft ? -2 : 2` and animates 8 frames at 4-tick
 * intervals. Movement itself is driven by xVel via the C# Sprite base class.
 *
 * Phaser port: dynamic Arcade sprite; wall reversal via body.blocked flags.
 * Animation uses the 4-frame roller.png spritesheet (128×32).
 */
export class Roller extends Phaser.Physics.Arcade.Sprite {
  readonly isEnemy: boolean = true;
  private direction: number; // 1 = right, -1 = left

  constructor(scene: Phaser.Scene, x: number, y: number, facingLeft: boolean) {
    super(scene, x, y, 'roller');
    this.direction = facingLeft ? -1 : 1;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);

    // Flip sprite to match initial direction
    this.setFlipX(facingLeft);

    // Ensure animation exists (safe to call multiple times — Phaser guards duplicates)
    if (!scene.anims.exists('roller-roll')) {
      scene.anims.create({
        key: 'roller-roll',
        frames: scene.anims.generateFrameNumbers('roller', { start: 0, end: 3 }),
        frameRate: 15,
        repeat: -1,
      });
    }
    this.play('roller-roll', true);

    this.setVelocityX(ROLLER_SPEED * this.direction);
  }

  /**
   * Creates a Roller from a Tiled tile-object and adds it to the given group.
   *
   * Tiled tile-object convention: (x, y) is the bottom-left corner.
   * Center = (x + w/2, y - h/2).
   *
   * Direction is driven by the Tiled `left` property (string "True" / absent).
   */
  static fromTiledObject(
    scene: Phaser.Scene,
    obj: TiledObject,
    group: Phaser.GameObjects.Group,
  ): Roller {
    const w = obj.width || 32;
    const h = obj.height || 32;
    const cx = obj.x + w / 2;
    const cy = obj.y - h / 2; // tile object: y = bottom edge

    const facingLeft =
      obj.properties?.some(p => p.name === 'left' && String(p.value) === 'True') ?? false;

    const roller = new Roller(scene, cx, cy, facingLeft);
    group.add(roller);
    return roller;
  }

  /**
   * Per fixed-tick logic (called from GameScene.fixedUpdate).
   * Reverses direction when the physics body hits a wall.
   */
  update(_tickCount: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (body.blocked.left && this.direction === -1) {
      this.direction = 1;
      this.setVelocityX(ROLLER_SPEED);
      this.setFlipX(false);
    } else if (body.blocked.right && this.direction === 1) {
      this.direction = -1;
      this.setVelocityX(-ROLLER_SPEED);
      this.setFlipX(true);
    }
  }
}
