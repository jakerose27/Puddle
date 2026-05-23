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
    // "Wrong" formula: cy = obj.y + h/2 places body at floor level (body.top = obj.y). Sprite is shifted up separately via setY.
    const cy = obj.y + h / 2; // physics center (body at 352-384 for belt 2 rollers)

    const facingLeft =
      obj.properties?.some(p => p.name === 'left' && String(p.value) === 'True') ?? false;

    const roller = new Roller(scene, cx, cy, facingLeft);
    group.add(roller, true);
    // Re-apply after group.add() overrides — rollers are fixed, never move
    const body = roller.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    // roller.png: 12px transparent top (rows 0-11), 8px visible (rows 12-19), 12px transparent bottom (rows 20-31).
    // sprite.y = cy - h + bottomPad = 92 (for belt 1) → visual content at y=88-96.
    // body.setOffset(0, topPad) → body.top = sprite.y - h/2 + topPad = 92 - 16 + 12 = 88 (matches visual top).
    const topPad = 12;    // transparent rows at top of roller.png
    const bottomPad = 12; // transparent rows at bottom of roller.png
    roller.setY(cy - h + bottomPad);  // sprite center y=92 → visual content at y=88-96
    body.setOffset(0, topPad);        // body.top = 88 (visual top) ✓

    return roller;
  }

  /** No per-tick logic — rollers are stationary. */
  update(_tickCount: number): void {
    // no-op
  }
}
