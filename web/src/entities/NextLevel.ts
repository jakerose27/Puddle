import Phaser from 'phaser';
import type { TiledObject } from './Block';

const GATE_COLOR = 0x00ff44; // bright green

/**
 * NextLevel — win-condition gate ported from C# Puddle.NextLevel.
 *
 * C# NextLevel stores a `levelDestination` name from the Tiled object's Name
 * field, then triggers a level transition on player contact.
 *
 * Web port: static overlap zone. Player contact → GameScene shows "LEVEL COMPLETE".
 *
 * Note: NextLevel objects in Tiled are regular rectangles (no gid), so Tiled y
 * is the top-left corner. Center = (x + w/2, y + h/2).
 * The Gate layer is empty in Level1-1.json; this class is wired and ready for
 * levels that include a gate object.
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
    this.gameObject = scene.add.rectangle(cx, cy, w, h, GATE_COLOR, 0.5);
    scene.physics.add.existing(this.gameObject, true /* static */);
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
