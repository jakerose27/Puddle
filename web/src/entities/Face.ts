import Phaser from 'phaser';
import type { TiledObject } from './Block';
import type { GameScene } from '../scenes/GameScene';

// C# Face speed = 2 px/tick → 120 px/s in Phaser world units.
const FACE_SPEED = 120;
// Fireball travels straight down at 300 px/s.
const FIREBALL_SPEED = 300;
// C# fires every 30 ticks.
const FIREBALL_INTERVAL = 30;
// Auto-destroy fireballs after 3 seconds.
const FIREBALL_LIFETIME_MS = 3000;

const FACE_MAX_HEALTH = 30;

/**
 * Face — boss enemy, ported from C# Puddle.Face.
 *
 * C# behaviour:
 *   - 96×96 sprite, no gravity (floats).
 *   - Moves horizontally at speed 2 px/tick; turns on wall.
 *   - Fires a fireball straight down every 30 ticks.
 *   - health = 30; reaching 0 triggers scene.onBossDefeated().
 *   - Boss health bar rendered at the bottom of the screen.
 *   - Animated: 4 frames × 96 px wide, steps every 8 ticks.
 */
export class Face extends Phaser.Physics.Arcade.Sprite {
  private direction: number = -1; // -1 = left, 1 = right
  public health: number = FACE_MAX_HEALTH;
  private readonly maxHealth: number = FACE_MAX_HEALTH;
  private enemiesGroup: Phaser.Physics.Arcade.Group;
  private healthBar: Phaser.GameObjects.Graphics;

  constructor(
    scene: GameScene,
    x: number,
    y: number,
    enemiesGroup: Phaser.Physics.Arcade.Group,
  ) {
    super(scene, x, y, 'face');
    this.enemiesGroup = enemiesGroup;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCollideWorldBounds(true);
    body.setSize(96, 96);

    // Float animation (4 frames, 8 fps)
    if (!scene.anims.exists('face-float')) {
      scene.anims.create({
        key: 'face-float',
        frames: scene.anims.generateFrameNumbers('face', { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1,
      });
    }
    this.play('face-float', true);

    this.setVelocityX(FACE_SPEED * this.direction);

    // Health bar — fixed to camera, always on top
    this.healthBar = scene.add.graphics();
    this.healthBar.setScrollFactor(0);
    this.healthBar.setDepth(10);
    this.renderHealthBar(scene);
  }

  /**
   * Creates a Face from a Tiled tile-object and adds it to the enemies group.
   * Tile-object convention: (x, y) = bottom-left → center = (x + w/2, y - h/2).
   */
  static fromTiledObject(
    scene: GameScene,
    obj: TiledObject,
    group: Phaser.Physics.Arcade.Group,
  ): Face {
    const w = obj.width || 96;
    const h = obj.height || 96;
    const cx = obj.x + w / 2;
    const cy = obj.y - h / 2;

    const face = new Face(scene, cx, cy, group);
    group.add(face, true);
    return face;
  }

  /**
   * Per fixed-tick logic. Reverses on wall contact and fires fireballs on interval.
   * Called from GameScene.fixedUpdate.
   */
  update(tickCount: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (body.blocked.left && this.direction === -1) {
      this.direction = 1;
      this.setVelocityX(FACE_SPEED);
      this.setFlipX(false);
    } else if (body.blocked.right && this.direction === 1) {
      this.direction = -1;
      this.setVelocityX(-FACE_SPEED);
      this.setFlipX(true);
    }

    if (tickCount > 0 && tickCount % FIREBALL_INTERVAL === 0) {
      this.fireFireball();
    }

    this.renderHealthBar(this.scene);
  }

  /** Reduces health by amount and triggers boss defeat if health reaches zero. */
  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    this.renderHealthBar(this.scene);

    if (this.health <= 0) {
      (this.scene as GameScene).onBossDefeated();
    }
  }

  override destroy(fromScene?: boolean): void {
    if (this.healthBar?.active) this.healthBar.destroy();
    super.destroy(fromScene);
  }

  private fireFireball(): void {
    const ball = this.scene.physics.add.sprite(this.x, this.y + 52, 'fireball');
    const bBody = ball.body as Phaser.Physics.Arcade.Body;
    bBody.setAllowGravity(false);
    ball.setVelocity(0, FIREBALL_SPEED);

    this.enemiesGroup.add(ball);

    // Auto-destroy after 3 s (C#: offScreen check equivalent)
    this.scene.time.delayedCall(FIREBALL_LIFETIME_MS, () => {
      if (ball.active) ball.destroy();
    });
  }

  private renderHealthBar(scene: Phaser.Scene): void {
    const barW = scene.scale.width - 40;
    const barH = 18;
    const barX = 20;
    const barY = scene.scale.height - 32;

    this.healthBar.clear();

    // Red background
    this.healthBar.fillStyle(0xff0000);
    this.healthBar.fillRect(barX, barY, barW, barH);

    // Firebrick fill proportional to remaining health
    const fillW = Math.max(0, (this.health / this.maxHealth) * barW);
    this.healthBar.fillStyle(0xb22222);
    this.healthBar.fillRect(barX, barY, fillW, barH);
  }
}
