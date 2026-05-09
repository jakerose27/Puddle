import Phaser from 'phaser';
import type { TiledObject } from './Block';

/**
 * Button — pressure-plate entity ported from C# Puddle.Button (Button.cs).
 *
 * C# behaviour:
 *   - When the player (or a push block) overlaps the button it calls Action(level)
 *   - Action() opens Gate blocks and activates Invis blocks with matching number
 *   - `holdButton` variant re-closes gates when the player steps off
 *   - Also handles special names "Credits" and "Controls" for slide overlays
 *
 * Web port — minimal implementation (no crash):
 *   - Button renders with button.png, registers in the items group
 *   - Activates once on player overlap (press animation tint + log)
 *   - Gate-toggling is deferred (no Block.changeType system yet)
 *   - direction property is stored but only used for a visual flip
 */
export class Button extends Phaser.Physics.Arcade.Sprite {
  /** True once the button has been pressed (prevents re-activation) */
  public activated: boolean = false;
  /** Tiled name — used to match Gate / Block numbers in C# */
  public readonly buttonName: string;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    buttonName: string,
    direction: string,
  ) {
    super(scene, x, y, 'button');
    this.buttonName = buttonName;

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body

    // Visual hint: flip for right-facing buttons (button.png faces left by default)
    if (direction === 'right') {
      this.setFlipX(true);
    } else if (direction === 'up') {
      this.setAngle(-90);
    } else if (direction === 'down') {
      this.setAngle(90);
    }
  }

  /**
   * Creates a Button from a Tiled tile-object and adds it to the given items group.
   * Tile-object convention (gid present): (x, y) = bottom-left → center = (x + w/2, y - h/2).
   */
  static fromTiledObject(
    scene: Phaser.Scene,
    obj: TiledObject,
    group: Phaser.Physics.Arcade.StaticGroup,
  ): Button {
    const w = obj.width || 32;
    const h = obj.height || 32;
    const cx = obj.x + w / 2;
    const cy = obj.y - h / 2; // tile object: y = bottom edge

    const direction =
      (obj.properties?.find(p => p.name === 'direction')?.value as string) ?? 'left';
    const btn = new Button(scene, cx, cy, obj.name ?? '', direction);
    group.add(btn, true);
    return btn;
  }

  /**
   * Activates the button on first player contact.
   * C# equivalent: Action(level) — opens matching Gate/Block objects.
   * Gate-toggling deferred in the web port.
   */
  press(): void {
    if (this.activated) return;
    this.activated = true;

    console.log(`[Button] Pressed: "${this.buttonName}"`);

    // Visual feedback: tint orange (pressed state)
    this.setTint(0xff8800);
  }
}
