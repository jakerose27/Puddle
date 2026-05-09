import Phaser from 'phaser';
import type { TiledObject } from './Block';

// C# Fireball.speed = 2px/tick × 60 = 120 px/s
const CANNONBALL_SPEED = 120; // px/s
// C# Cannon default speed = 125 ticks ≈ 2.1 s at 60 Hz
const DEFAULT_FIRE_INTERVAL_TICKS = 125;
// Auto-destroy cannonballs after this many ms (safety net for off-screen balls)
const CANNONBALL_LIFETIME_MS = 5000;

/**
 * Cannon — static turret that fires cannonball projectiles at the player.
 * Ported from C# Puddle.Cannon (Cannon.cs).
 *
 * C# behaviour:
 *   - Reads `direction` property from Tiled (left/right/up/down)
 *   - Fires a Fireball every `speed` ticks (default 125 ≈ 2s)
 *   - Fireball travels at 2px/tick in the chosen direction
 *
 * Web port simplifications:
 *   - Cannon is a standalone static sprite (not added to ground/enemies group)
 *   - GameScene tracks cannons in a separate array and calls update(tickCount)
 *   - Cannonball is added to the enemies group so existing player→death overlap fires
 *   - Cannonball gravity is disabled so it travels in a straight line
 *   - Cannonball auto-destroys after CANNONBALL_LIFETIME_MS (no offScreen check)
 */
export class Cannon extends Phaser.Physics.Arcade.Sprite {
  private direction: string; // 'left' | 'right' | 'up' | 'down'
  private fireIntervalTicks: number;
  private enemiesGroup: Phaser.Physics.Arcade.Group;
  private ballTimers: Phaser.Time.TimerEvent[] = [];

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    direction: string,
    fireIntervalTicks: number,
    enemiesGroup: Phaser.Physics.Arcade.Group,
  ) {
    super(scene, x, y, 'cannon');
    this.direction = direction;
    this.fireIntervalTicks = fireIntervalTicks;
    this.enemiesGroup = enemiesGroup;

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body — cannon doesn't move

    // Flip sprite to hint at direction (cannon.png faces left by default)
    this.setFlipX(direction === 'right');
  }

  /**
   * Creates a Cannon from a Tiled tile-object.
   * Tile-object convention (gid present): (x, y) = bottom-left → center = (x + w/2, y - h/2).
   * Reads `direction` and optional `speed` from Tiled object properties.
   */
  static fromTiledObject(
    scene: Phaser.Scene,
    obj: TiledObject,
    enemiesGroup: Phaser.Physics.Arcade.Group,
  ): Cannon {
    const w = obj.width || 32;
    const h = obj.height || 32;
    const cx = obj.x + w / 2;
    const cy = obj.y - h / 2; // tile object: y = bottom edge

    const direction =
      (obj.properties?.find(p => p.name === 'direction')?.value as string) ?? 'left';
    const speedProp = obj.properties?.find(p => p.name === 'speed');
    const fireIntervalTicks = speedProp
      ? parseInt(String(speedProp.value), 10)
      : DEFAULT_FIRE_INTERVAL_TICKS;

    return new Cannon(scene, cx, cy, direction, fireIntervalTicks, enemiesGroup);
  }

  /**
   * Called each fixed tick from GameScene.fixedUpdate.
   * Fires a cannonball when tickCount is a multiple of fireIntervalTicks.
   */
  update(tickCount: number): void {
    if (tickCount > 0 && tickCount % this.fireIntervalTicks === 0) {
      this.fireCannonball();
    }
  }

  private fireCannonball(): void {
    let vx = 0;
    let vy = 0;
    let ox = 0; // spawn offset from cannon centre
    let oy = 0;

    switch (this.direction) {
      case 'left':
        vx = -CANNONBALL_SPEED;
        ox = -24;
        break;
      case 'right':
        vx = CANNONBALL_SPEED;
        ox = 24;
        break;
      case 'up':
        vy = -CANNONBALL_SPEED;
        oy = -24;
        break;
      case 'down':
        vy = CANNONBALL_SPEED;
        oy = 24;
        break;
    }

    // Spawn a fireball sprite with a dynamic physics body
    const ball = this.scene.physics.add.sprite(
      this.x + ox,
      this.y + oy,
      'fireball',
    );
    const body = ball.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false); // cannonballs travel in straight lines
    ball.setVelocity(vx, vy);

    // Register with enemies group so player overlap → death
    this.enemiesGroup.add(ball);

    // Auto-destroy after lifetime (mimics C# offScreen check)
    const timer = this.scene.time.delayedCall(CANNONBALL_LIFETIME_MS, () => {
          if (ball.active) ball.destroy();
    });
    this.ballTimers.push(timer);
  }

  override destroy(fromScene?: boolean): void {
    this.ballTimers.forEach(t => t.remove());
    this.ballTimers = [];
    super.destroy(fromScene);
  }
}
