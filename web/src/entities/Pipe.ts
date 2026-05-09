import Phaser from 'phaser';
import type { TiledObject } from './Block';

/** Cooldown in ticks before the same pipe pair can teleport again (~2 s at 60 Hz). */
const TELEPORT_COOLDOWN = 120;

/**
 * Pipe — teleporter pair ported from C# Puddle.Pipe.
 *
 * Pipes are named with a "1" or "2" suffix (e.g. "pipe1" / "pipe2").
 * When the player touches a pipe, they are teleported to its partner.
 * A per-pair cooldown prevents instant re-teleport on arrival.
 *
 * C# notes:
 *   - Pipe is a solid static body (player can stand on it).
 *   - `direction` property: "up" | "down" | "left" | "right" (cosmetic rotation only).
 *   - Gold tint when name contains "endPipe", white otherwise.
 */
export class Pipe extends Phaser.Physics.Arcade.Sprite {
  /** Full Tiled name, e.g. "pipe1", "endPipe2". */
  public readonly pipeName: string;

  /** Tick at which this pipe last participated in a teleport. */
  private lastTeleportTick: number = -999;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    pipeName: string,
    direction: string,
    isEndPipe: boolean,
  ) {
    super(scene, x, y, 'pipe');
    this.pipeName = pipeName;

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static — player can stand on it

    // Cosmetic rotation based on direction property
    switch (direction) {
      case 'down':  this.setAngle(180);  break;
      case 'left':  this.setAngle(270);  break;
      case 'right': this.setAngle(90);   break;
      default: break; // 'up' = no rotation
    }

    // Gold tint for end-pipes, plain white otherwise
    if (isEndPipe) {
      this.setTint(0xffd700);
    }

    // Pipe is a physics/logic entity only — the Background tile layer renders the
    // pipe graphic. Hiding the sprite prevents a gold-tinted artifact appearing at
    // the top of the screen during the camera's initial lerp from (0,0).
    this.setAlpha(0);
  }

  /**
   * Creates a Pipe from a Tiled tile-object and registers it with the ground group
   * (solid collision). The caller is responsible for storing the returned pipe in
   * a lookup array so that partner pipes can be resolved at teleport time.
   *
   * Tile-object convention: (x, y) = bottom-left → center = (x + w/2, y - h/2).
   */
  static fromTiledObject(
    scene: Phaser.Scene,
    obj: TiledObject,
    groundGroup: Phaser.Physics.Arcade.StaticGroup,
  ): Pipe {
    const w = obj.width || 32;
    const h = obj.height || 32;
    const cx = obj.x + w / 2;
    const cy = obj.y - h / 2;

    const pipeName  = obj.name ?? '';
    const direction = (obj.properties?.find(p => p.name === 'direction')?.value as string) ?? 'up';
    const isEndPipe = pipeName.includes('endPipe');

    const pipe = new Pipe(scene, cx, cy, pipeName, direction, isEndPipe);
    groundGroup.add(pipe);
    return pipe;
  }

  /**
   * Attempts to teleport the player to the partner pipe.
   * Guarded by a cooldown so the player is not immediately re-teleported on arrival.
   *
   * @param player     The player sprite to teleport.
   * @param pipes      All pipes in the scene (for partner lookup).
   * @param currentTick The scene's current fixed tick count.
   */
  tryTeleport(
    player: Phaser.Physics.Arcade.Sprite,
    pipes: Pipe[],
    currentTick: number,
  ): void {
    if (currentTick - this.lastTeleportTick < TELEPORT_COOLDOWN) return;

    // Determine partner suffix: "1" ↔ "2"
    const name = this.pipeName;
    let partnerName: string;

    if (name.endsWith('1')) {
      partnerName = name.slice(0, -1) + '2';
    } else if (name.endsWith('2')) {
      partnerName = name.slice(0, -1) + '1';
    } else {
      return; // no pairing suffix
    }

    const partner = pipes.find(p => p !== this && p.pipeName === partnerName && p.active);
    if (!partner) return;

    // C# transport: player.x = partner.x; player.y = partner.y - playerHeight
    const playerHeight = (player.body as Phaser.Physics.Arcade.Body).height;
    player.setPosition(partner.x, partner.y - playerHeight);
    // Zero vertical velocity to prevent bouncing on arrival
    player.setVelocityY(0);

    // Stamp cooldown on both ends to prevent instant re-teleport
    this.lastTeleportTick   = currentTick;
    partner.lastTeleportTick = currentTick;
  }
}
