import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';

/**
 * Projectile — ported from C# Puddle.Shot.
 *
 * Fired by the player when D is pressed. Travels horizontally in the
 * direction the player is facing. Destroys on wall/ground collision or
 * after a timeout.
 *
 * C# source: Objects/Shot.cs
 *   speed = 6 px/tick → 360 px/sec at 60 Hz
 *   Uses bubble.png sprite (12×12 collision box)
 *   Destroyed when offScreen or intersects solid block/enemy
 */
export class Projectile extends Phaser.Physics.Arcade.Sprite {
  private liveTicks: number = 0;
  /** Maximum lifetime in fixed ticks (~120 = 2 seconds at 60 Hz) */
  private static readonly MAX_LIVE_TICKS = 120;
  /** px/sec horizontal speed — C# speed=6 px/tick × 60 */
  static readonly SPEED = 360;

  constructor(scene: GameScene, x: number, y: number, facingLeft: boolean) {
    super(scene, x, y, 'bubble');
    scene.add.existing(this);
    scene.physics.add.existing(this, false); // dynamic body

    this.setDisplaySize(12, 12);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(12, 12);
    body.setAllowGravity(false); // shots travel horizontally, no arc

    const vx = facingLeft ? -Projectile.SPEED : Projectile.SPEED;
    body.setVelocityX(vx);
    this.setDepth(2);
  }

  /** Per-tick update — call from the projectile group's tick loop */
  tick(): void {
    this.liveTicks++;
    if (this.liveTicks >= Projectile.MAX_LIVE_TICKS) {
      this.destroy();
    }
  }
}
