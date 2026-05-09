import Phaser from 'phaser';
import type { TiledObject } from './Block';
import type { GameScene } from '../scenes/GameScene';

/**
 * PowerUp — ported from C# Puddle.PowerUp.
 *
 * A collectible item on the map. The `name` field in Tiled determines which
 * ability is granted:
 *   "puddle"   → player can press Down to flatten into a puddle
 *   "jetpack"  → player can use midair jetpack boost
 *   "charged"  → player can charge a power shot
 *
 * C# source: Objects/PowerUp.cs
 *   player.powerup[name] = true;
 *   level.message = <hint text>;
 *
 * Rendered as a blue pulsing circle (tile image not available; gid=311 maps to
 * a tileset not extracted for web). Destroys itself on collection.
 */
export class PowerUp extends Phaser.Physics.Arcade.Sprite {
  /** e.g. "puddle", "jetpack", "charged" — lowercase per C# convention */
  public readonly powerupName: string;

  constructor(scene: GameScene, x: number, y: number, powerupName: string) {
    // 'powerup-puddle' texture is created dynamically; fallback to __DEFAULT
    const textureKey = PowerUp.textureKey(powerupName);
    super(scene, x, y, textureKey);

    this.powerupName = powerupName;

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body

    // Gentle bob animation
    scene.tweens.add({
      targets: this,
      y: y - 6,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  static textureKey(name: string): string {
    return `powerup-${name}`;
  }

  /**
   * Pre-generate placeholder textures for known powerup types.
   * Called once from GameScene.preload() via PowerUp.preloadTextures(scene).
   */
  static preloadTextures(scene: Phaser.Scene): void {
    const types: Array<{ name: string; color: number; label: string }> = [
      { name: 'puddle', color: 0x00aaff, label: '~' },
      { name: 'jetpack', color: 0xff6600, label: '↑' },
      { name: 'charged', color: 0xffdd00, label: '⚡' },
    ];

    for (const t of types) {
      const key = PowerUp.textureKey(t.name);
      if (scene.textures.exists(key)) continue;

      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Outer ring
      gfx.fillStyle(t.color, 0.9);
      gfx.fillCircle(16, 16, 14);
      gfx.fillStyle(0xffffff, 0.5);
      gfx.fillCircle(16, 16, 9);
      gfx.generateTexture(key, 32, 32);
      gfx.destroy();
    }
  }

  /**
   * Creates a PowerUp from a Tiled tile-object and adds it to the given group.
   *
   * Tile-object convention: (x, y) = bottom-left corner.
   * Center = (x + w/2, y - h/2).
   *
   * The Tiled `name` field (e.g. "Puddle") is lowercased to match the C# dict key.
   */
  static fromTiledObject(
    scene: GameScene,
    obj: TiledObject,
    group: Phaser.Physics.Arcade.StaticGroup,
  ): PowerUp {
    const w = obj.width || 32;
    const h = obj.height || 32;
    const cx = obj.x + w / 2;
    const cy = obj.y - h / 2; // tile-object: y = bottom edge

    const powerupName = (obj.name ?? 'puddle').toLowerCase();
    const pu = new PowerUp(scene, cx, cy, powerupName);
    group.add(pu);
    return pu;
  }

  /**
   * Called when the player overlaps this item.
   * Grants the powerup to the scene, then removes itself.
   */
  collect(scene: GameScene): void {
    scene.grantPowerup(this.powerupName);

    // Stop the bob tween and flash white before destroying
    scene.tweens.killTweensOf(this);
    this.setTint(0xffffff);
    scene.time.delayedCall(120, () => this.destroy());
  }
}
