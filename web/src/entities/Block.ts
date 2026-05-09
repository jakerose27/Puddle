import Phaser from 'phaser';

// Minimal Tiled object shape — only the fields Block uses.
export interface TiledObject {
  x: number;
  y: number;
  width: number;
  height: number;
  gid?: number; // present for tile-objects (y = bottom edge), absent for rectangle-objects (y = top-left)
  name?: string;
  type?: string;
  properties?: Array<{ name: string; value: unknown }>;
}

const TILE_SIZE = 32;

/**
 * Block — static collision tile ported from C# Puddle.Block.
 *
 * C# Block supports four blockType variants: "metal" (static), "push" (gravity +
 * pushable by player), "break" (destructible), "temp" (gate / invisible). It also
 * reads Tiled properties: left, right, gravity, canBreak, transparent, solid.
 *
 * TODO: Implement push (gravity), break, and temp variants when those entity
 *       classes are ported. For now, Block is always a static solid body.
 */
export class Block {
  readonly gameObject: Phaser.GameObjects.Rectangle;
  public name: string = '';
  private blockType: string = 'solid';

  constructor(scene: Phaser.Scene, cx: number, cy: number, w: number, h: number) {
    // Alpha=0: visuals come from the Background tile layer; this rect is physics-only.
    this.gameObject = scene.add.rectangle(cx, cy, w, h, 0x000000, 0);
    scene.physics.add.existing(this.gameObject, true /* static */);
  }

  /**
   * Changes the collision/visibility state of this block.
   * Mirrors C# Block.changeType() — used by Button gate-toggle logic.
   *
   * "transparent" → disable physics body (player passes through)
   * "push" / "metal" / "temp" / default → enable physics body (solid)
   */
  changeType(type: string): void {
    this.blockType = type;
    const body = this.gameObject.body as Phaser.Physics.Arcade.StaticBody;
    if (type === 'transparent') {
      body.enable = false;
      this.gameObject.setAlpha(0);
    } else {
      body.enable = true;
      this.gameObject.setFillStyle(0x8b6f47).setAlpha(1);
    }
  }

  /**
   * Factory method — creates a Block from a Tiled object and adds it to the
   * given static group so Phaser's Arcade Physics picks it up for collisions.
   *
   * Tiled y-coordinate convention:
   *   Tile-objects (gid present):      y = bottom-left corner → center = y - h/2
   *   Rectangle-objects (no gid):      y = top-left corner   → center = y + h/2
   *
   * Level1-1 Ground layer is mixed: outer walls/floor are gid=None rectangles
   * while interior platform blocks carry gid=281 (brick tile). Both cases must
   * be handled or physics bodies land 32px off from the visual tile layer.
   */
  static fromTiledObject(
    scene: Phaser.Scene,
    obj: TiledObject,
    group: Phaser.Physics.Arcade.StaticGroup,
  ): Block {
    const w = obj.width || TILE_SIZE;
    const h = obj.height || TILE_SIZE;
    const cx = obj.x + w / 2;
    const cy = obj.gid ? obj.y - h / 2 : obj.y + h / 2;

    const block = new Block(scene, cx, cy, w, h);
    block.name = obj.name ?? '';

    // Ground/solid blocks render as brown rectangles (restores Spike 2 visual).
    // Gate, transparent, and push blocks stay invisible (physics-only).
    const name = (obj.name ?? '').toLowerCase();
    const isGate = name.includes('gate') || name.includes('transparent') || name.includes('invis');
    const isPush = name.includes('push') || name.includes('metal') || name.includes('temp');
    if (!isGate && !isPush) {
      block.gameObject.setFillStyle(0x8b6f47).setAlpha(1);
    }

    group.add(block.gameObject);
    return block;
  }
}
