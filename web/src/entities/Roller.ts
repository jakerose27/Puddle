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
 * Phaser port: dynamic Arcade sprite; position-based patrol reversal.
 * Patrol bounds (xMin/xMax) are assigned after spawn via setPatrolBounds(),
 * computed from the full belt extent in GameScene. This avoids relying on
 * wall-block colliders (which may not exist at belt edges) or world bounds
 * (which would let rollers drift across the entire level).
 *
 * Animation uses the 4-frame roller.png spritesheet (128×32).
 */
export class Roller extends Phaser.Physics.Arcade.Sprite {
  readonly isEnemy: boolean = true;
  private direction: number; // 1 = right, -1 = left

  /** Patrol X bounds (body-center pixels). Set by GameScene after all rollers load. */
  private xMin: number = 0;
  private xMax: number = 9999;

  constructor(scene: Phaser.Scene, x: number, y: number, facingLeft: boolean) {
    super(scene, x, y, 'roller');
    this.direction = facingLeft ? -1 : 1;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Do NOT call setCollideWorldBounds here — PhysicsGroup.createCallbackHandler
    // overrides it to false anyway, and we use position-based patrol instead.

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
   * Assigns the horizontal patrol range for this roller (body-center coords).
   * Called by GameScene after all belt rollers are spawned and their extent is known.
   */
  setPatrolBounds(xMin: number, xMax: number): void {
    this.xMin = xMin;
    this.xMax = xMax;
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
    const cy = obj.y - h / 2; // tile object: y = bottom edge

    const facingLeft =
      obj.properties?.some(p => p.name === 'left' && String(p.value) === 'True') ?? false;

    const roller = new Roller(scene, cx, cy, facingLeft);
    group.add(roller, true);
    // NOTE: Do NOT call setImmovable(true) here. Rollers are dynamic bodies that
    // rely on collider(movers, ground) to stay on the platform. Two immovable bodies
    // (roller + static ground) cause Phaser to skip collision resolution, making
    // rollers fall through. Velocity re-assertion in update() prevents player nudges.
    return roller;
  }

  /**
   * Per fixed-tick logic (called from GameScene.fixedUpdate).
   *
   * Uses position-based patrol bounds rather than body.blocked flags for
   * reversal. body.blocked.right never fires when there is no wall block at the
   * right edge of the belt (which is common in Level1-1). Position checks are
   * reliable regardless of tile geometry.
   *
   * Velocity is re-applied every tick so that any momentary nudge from the
   * player cannot permanently alter the roller's speed.
   */
  update(_tickCount: number): void {
    if (this.x <= this.xMin && this.direction === -1) {
      this.direction = 1;
      this.setFlipX(false);
    } else if (this.x >= this.xMax && this.direction === 1) {
      this.direction = -1;
      this.setFlipX(true);
    }
    // Always re-assert velocity so player nudges don't permanently alter speed.
    this.setVelocityX(ROLLER_SPEED * this.direction);
  }
}
