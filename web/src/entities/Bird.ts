import Phaser from 'phaser';
import type { TiledObject } from './Block';

// No Bird.cs in original — implemented as a horizontal-patrol enemy similar to Roller.
// Speed ~80 px/s; turns on wall collision; gravity-enabled so it lands on platforms.
const BIRD_SPEED = 80; // px/s

/**
 * Bird — horizontal-patrol enemy (tile-object, gid=330).
 *
 * Original C# has no Bird.cs; this is a port based on the entity's appearance in
 * Level1-2 Tiled data and its role as a walking hazard enemy.
 * Patrol behavior mirrors Roller: reverses direction on blocked.left / blocked.right.
 */
export class Bird extends Phaser.Physics.Arcade.Sprite {
  private direction: number; // 1 = right, -1 = left

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'Bird');
    this.direction = -1; // default: face left

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setSize(24, 24);

    this.setFlipX(true); // facing left initially
    this.setVelocityX(BIRD_SPEED * this.direction);
  }

  /**
   * Creates a Bird from a Tiled tile-object and adds it to the given enemies group.
   * Tile-object convention: (x, y) = bottom-left → center = (x + w/2, y - h/2).
   */
  static fromTiledObject(
    scene: Phaser.Scene,
    obj: TiledObject,
    group: Phaser.Physics.Arcade.Group,
  ): Bird {
    const w = obj.width || 32;
    const h = obj.height || 32;
    const cx = obj.x + w / 2;
    const cy = obj.y - h / 2; // tile object: y = bottom edge

    const bird = new Bird(scene, cx, cy);
    group.add(bird, true);
    return bird;
  }

  /**
   * Per fixed-tick patrol logic. Reverses on wall contact.
   * Called from GameScene.fixedUpdate.
   */
  update(_tickCount: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (body.blocked.left && this.direction === -1) {
      this.direction = 1;
      this.setVelocityX(BIRD_SPEED);
      this.setFlipX(false);
    } else if (body.blocked.right && this.direction === 1) {
      this.direction = -1;
      this.setVelocityX(-BIRD_SPEED);
      this.setFlipX(true);
    }
  }
}
