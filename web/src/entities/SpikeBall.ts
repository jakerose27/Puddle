import Phaser from 'phaser';
import type { TiledObject } from './Block';

/**
 * SpikeBall — static hazard enemy ported from C# Puddle.SpikeBall.
 *
 * C# SpikeBall.Update is empty — it never moves. Uses a 22×22 collision box
 * centred on the 32×32 sprite (spriteY -= 16 offset from base Enemy class).
 *
 * Phaser port: dynamic Arcade sprite but zero velocity — stands on ground
 * and kills the player on contact via the enemies group overlap.
 */
export class SpikeBall extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'spikeball');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);

    // C# used a 22×22 collision box centred on the 32×32 sprite
    body.setSize(22, 22);
  }

  /**
   * Creates a SpikeBall from a Tiled tile-object and adds it to the given group.
   *
   * Tiled tile-object convention: (x, y) is the bottom-left corner.
   * Center = (x + w/2, y - h/2).
   */
  static fromTiledObject(
    scene: Phaser.Scene,
    obj: TiledObject,
    group: Phaser.Physics.Arcade.Group,
  ): SpikeBall {
    const w = obj.width || 32;
    const h = obj.height || 32;
    const cx = obj.x + w / 2;
    const cy = obj.y - h / 2; // tile object: y = bottom edge

    const ball = new SpikeBall(scene, cx, cy);
    group.add(ball, true);
    return ball;
  }

  // Static enemy — C# SpikeBall.Update is empty; mirrors that here
  update(_tickCount: number): void {}
}
