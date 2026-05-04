import Phaser from 'phaser';
import type { TiledObject } from './Block';

const GEYSER_COLOR = 0x00aaff; // cyan-blue fallback tint if image not loaded

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
 */
export class Geyser {
  readonly isHazard: boolean = true;
  readonly gameObject: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    cx: number,
    cy: number,
    w: number,
    h: number,
  ) {
    this.gameObject = scene.add.rectangle(cx, cy, w, h, GEYSER_COLOR, 0.6);
    scene.physics.add.existing(this.gameObject, true /* static */);
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
