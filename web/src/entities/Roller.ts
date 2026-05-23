import Phaser from 'phaser';
import type { TiledObject } from './Block';

/** Belt carry speed (px/s) — used by GameScene to push the player. */
export const BELT_SPEED = 80;

/**
 * Roller — stationary belt surface in Level 1-1.
 *
 * Rollers do NOT patrol. They sit on the floor (gravity enabled) and serve as
 * the physical surface of the conveyor belt. GameScene reads `facingLeft` to
 * determine which direction to push the player while they stand on a roller.
 *
 * Animation uses the 4-frame roller.png spritesheet (128×32).
 */
export class Roller extends Phaser.Physics.Arcade.Sprite {
  readonly isEnemy: boolean = true;
  public readonly facingLeft: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, facingLeft: boolean) {
    super(scene, x, y, 'roller');
    this.facingLeft = facingLeft;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Flip sprite to match belt direction (visual only)
    this.setFlipX(facingLeft);
    this.setDepth(1);

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
    group: Phaser.Physics.Arcade.Group,
  ): Roller {
    const w = obj.width || 32;
    const h = obj.height || 32;
    const cx = obj.x + w / 2;
    // cy places sprite center at floor level; body.top = cy - h/2, body.bottom = cy + h/2
    const cy = obj.y + h / 2; // physics center (body at 352-384 for belt 2 rollers)

    const facingLeft =
      obj.properties?.some(p => p.name === 'left' && String(p.value) === 'True') ?? false;

    const roller = new Roller(scene, cx, cy, facingLeft);
    group.add(roller, true);
    // Re-apply after group.add() overrides — rollers are fixed, never move
    const body = roller.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);

    return roller;
  }

  /** No per-tick logic — rollers are stationary. */
  update(_tickCount: number): void {
    // no-op
  }
}
