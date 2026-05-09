import Phaser from 'phaser';
import type { TiledObject } from './Block';

/**
 * Geyser — hazard zone ported from C# Puddle.Geyser.
 *
 * C# Geyser behavior: on player contact, apply upward yVel (-5 px/tick) and
 * refill player hydration. It's a boost mechanic, not a lethal hit.
 *
 * Web port simplification (per task spec): treated as a static kill zone.
 * Player overlap → playerDead = true (full death system wired by Ripley).
 * Future: could restore the boost + hydration behavior.
 *
 * Note: Geyser objects in Tiled are regular rectangles (no gid), so Tiled y
 * is the top-left corner. Center = (x + w/2, y + h/2).
 *
 * Renders using the preloaded 'geyser' texture (geyser.png) so it appears as
 * the correct game sprite instead of a colored placeholder rectangle.
 */
export class Geyser {
  readonly isHazard: boolean = true;
  readonly gameObject: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    cx: number,
    cy: number,
    w: number,
    h: number,
  ) {
    this.gameObject = scene.add.image(cx, cy, 'geyser');
    this.gameObject.setDisplaySize(w, h);
    scene.physics.add.existing(this.gameObject, true /* static */);
    // Explicitly size and centre the static body to match the Tiled rectangle.
    const body = this.gameObject.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(w, h);
    body.reset(cx, cy);
  }

  /**
   * Creates a Geyser from a Tiled rectangle-object and adds it to the given
   * static group so Phaser's Arcade Physics picks it up for overlap detection.
   *
   * Tiled rectangle-object convention: (x, y) is the top-left corner.
   * Center = (x + w/2, y + h/2).
   */
  static fromTiledObject(
    scene: Phaser.Scene,
    obj: TiledObject,
    group: Phaser.Physics.Arcade.StaticGroup,
  ): Geyser {
    const w = obj.width || 32;
    const h = obj.height || 32;
    const cx = obj.x + w / 2;
    const cy = obj.y + h / 2; // rectangle object: y = top-left corner

    const geyser = new Geyser(scene, cx, cy, w, h);
    group.add(geyser.gameObject);
    return geyser;
  }
}
