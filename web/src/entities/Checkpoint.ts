import Phaser from 'phaser';
import type { TiledObject } from './Block';
import type { GameScene } from '../scenes/GameScene';

/**
 * Checkpoint — ported from C# Puddle.Checkpoint.
 *
 * When touched by the player, saves the player's respawn position to the scene.
 * Only fires once per checkpoint (activated flag). Plays a tint flash for feedback.
 *
 * C# original: player.checkpointXPos / checkpointYPos set to spriteX/spriteY.
 * Web port: calls scene.setRespawnPosition(x, y) which updates spawnX/spawnY.
 */
export class Checkpoint extends Phaser.Physics.Arcade.Sprite {
  public activated: boolean = false;

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, x, y, 'checkpoint');

    scene.add.existing(this);
    // Static body — checkpoints never move
    scene.physics.add.existing(this, true);
  }

  /**
   * Creates a Checkpoint from a Tiled tile-object and adds it to the given group.
   *
   * Tile-object convention: (x, y) = bottom-left corner.
   * Center = (x + w/2, y - h/2).
   */
  static fromTiledObject(
    scene: GameScene,
    obj: TiledObject,
    group: Phaser.Physics.Arcade.StaticGroup,
  ): Checkpoint {
    const w = obj.width || 32;
    const h = obj.height || 32;
    const cx = obj.x + w / 2;
    const cy = obj.y - h / 2; // tile object: y = bottom edge

    const cp = new Checkpoint(scene, cx, cy);
    cp.setFrame(0); // show first (inactive) frame
    group.add(cp);
    return cp;
  }

  /**
   * Called when the player touches this checkpoint.
   * Guards against re-triggering. Shows a tint flash then locks to gold.
   * Respawn position update is handled by GameScene.onCheckpointReached.
   */
  activate(): void {
    if (this.activated) return;
    this.activated = true;

    // Play flag animation (frames 0→7), then lock to gold tint on complete
    this.play('checkpoint-activate');
    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.setTint(0xffd700); // gold — stays permanently
    });
  }
}
