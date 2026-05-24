import Phaser from 'phaser';
import type { TiledObject } from './Block';

const CHECKER_CELL = 16; // px — size of each checker square

/**
 * NextLevel — win-condition gate ported from C# Puddle.NextLevel.
 *
 * C# NextLevel stores a `levelDestination` name from the Tiled object's Name
 * field, then triggers a level transition on player contact.
 *
 * Web port: static overlap zone. Player contact → GameScene shows "LEVEL COMPLETE".
 *
 * Visual: white/black checkerboard strip covering the gate zone itself (x=gateLeft, width=w),
 * same height as the gate zone. Physics trigger stays at the gate zone.
 *
 * Note: NextLevel objects in Tiled are regular rectangles (no gid), so Tiled y
 * is the top-left corner. Center = (x + w/2, y + h/2).
 */
export class NextLevel {
  readonly gameObject: Phaser.GameObjects.Rectangle;
  readonly destination: string;

  constructor(
    scene: Phaser.Scene,
    cx: number,
    cy: number,
    w: number,
    h: number,
    destination: string,
  ) {
    this.destination = destination;
    // Physics trigger — invisible rectangle at the gate zone position
    this.gameObject = scene.add.rectangle(cx, cy, w, h, 0x000000, 0);
    scene.physics.add.existing(this.gameObject, true /* static */);

    // Visual: checkerboard covering the gate zone only (x=gateLeft, width=w)
    const gateLeft = cx - w / 2;
    const gateTop = cy - h / 2;
    const cols = Math.ceil(w / CHECKER_CELL);
    const rows = Math.ceil(h / CHECKER_CELL);
    const gfx = scene.add.graphics();
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const color = (row + col) % 2 === 0 ? 0xffffff : 0x000000;
        gfx.fillStyle(color, 1);
        gfx.fillRect(gateLeft + col * CHECKER_CELL, gateTop + row * CHECKER_CELL, CHECKER_CELL, CHECKER_CELL);
      }
    }
  }

  /**
   * Creates a NextLevel gate from a Tiled rectangle-object and adds it to the
   * given static group for overlap detection.
   *
   * Tiled rectangle-object convention: (x, y) is the top-left corner.
   */
  static fromTiledObject(
    scene: Phaser.Scene,
    obj: TiledObject,
    group: Phaser.Physics.Arcade.StaticGroup,
  ): NextLevel {
    const w = obj.width || 32;
    const h = obj.height || 32;
    const cx = obj.x + w / 2;
    const cy = obj.y + h / 2; // rectangle object: y = top-left corner
    const destination = obj.name ?? 'unknown';

    const gate = new NextLevel(scene, cx, cy, w, h, destination);
    group.add(gate.gameObject);
    return gate;
  }
}
