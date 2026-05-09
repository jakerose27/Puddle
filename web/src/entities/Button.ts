import Phaser from 'phaser';
import type { TiledObject } from './Block';
import type { GameScene } from '../scenes/GameScene';

/**
 * Button — pressure-plate entity ported from C# Puddle.Button (Button.cs).
 *
 * C# behaviour:
 *   - When the player (or a push block) overlaps the button it calls Action(level)
 *   - Action() opens Gate blocks and activates Invis blocks with matching number
 *   - `holdButton` variant re-closes gates when the player steps off
 *
 * Button number is parsed from buttonName (e.g. "Button 1" → 1).
 * Named blocks are looked up via GameScene.namedBlocks:
 *   "Gate N"  → changeType("transparent") on press, changeType("push") on release
 *   "Block N" → changeType("push") on press, changeType("transparent") on release
 *   "Invis N" → changeType("temp") on press, changeType("transparent") on release
 */
export class Button extends Phaser.Physics.Arcade.Sprite {
  /** True once the button has been pressed (prevents re-activation for non-hold buttons) */
  public activated: boolean = false;
  /** Whether the button is currently held down by the player */
  public isDown: boolean = false;
  /** Tiled name — used to match Gate / Block numbers */
  public readonly buttonName: string;
  /** If true, gates re-close when the player steps off the button */
  public readonly holdButton: boolean;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    buttonName: string,
    direction: string,
    holdButton: boolean,
  ) {
    super(scene, x, y, 'button');
    this.buttonName = buttonName;
    this.holdButton = holdButton;

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

    const props = obj.properties ?? [];
    const direction = (props.find(p => p.name === 'direction')?.value as string) ?? 'left';
    const holdButton = (props.find(p => p.name === 'holdButton')?.value as boolean) ?? false;

    const btn = new Button(scene, cx, cy, obj.name ?? '', direction, holdButton);
    group.add(btn, true);
    return btn;
  }

  /** Parse trailing number from buttonName, e.g. "Button 1" → 1. */
  private getButtonNumber(): number | null {
    const match = this.buttonName.match(/(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Applies or reverses gate state for all named blocks matching this button's number.
   * opening=true: press action (open gates, activate blocks)
   * opening=false: release action (re-close gates) — only used when holdButton=true
   */
  private applyGates(scene: GameScene, opening: boolean): void {
    const num = this.getButtonNumber();
    if (num === null) return;

    for (const [name, block] of scene.namedBlocks) {
      const blockMatch = name.match(/(\d+)$/);
      if (!blockMatch || parseInt(blockMatch[1], 10) !== num) continue;

      if (name.startsWith('Gate ')) {
        block.changeType(opening ? 'transparent' : 'push');
      } else if (name.startsWith('Block ')) {
        block.changeType(opening ? 'push' : 'transparent');
      } else if (name.startsWith('Invis ')) {
        block.changeType(opening ? 'temp' : 'transparent');
      }
    }

    // Refresh static group so Phaser's physics picks up body enable/disable changes.
    scene.ground.refresh();
  }

  /**
   * Called when player steps onto the button.
   * For non-holdButton buttons this fires only once; for holdButton it re-fires each overlap.
   */
  press(scene: GameScene): void {
    if (!this.holdButton && this.activated) return;
    if (this.isDown) return; // already held this frame

    this.isDown = true;
    this.activated = true;
    this.setTint(0xff8800);
    this.applyGates(scene, true);

    console.log(`[Button] Pressed: "${this.buttonName}" (hold=${this.holdButton})`);
  }

  /**
   * Called when player steps OFF a holdButton.
   * Re-closes gates to their default (closed) state.
   */
  release(scene: GameScene): void {
    if (!this.isDown) return;
    this.isDown = false;
    this.clearTint();
    this.applyGates(scene, false);

    console.log(`[Button] Released: "${this.buttonName}"`);
  }
}
