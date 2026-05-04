import Phaser from 'phaser';
import { EntityFactory } from '../entities/EntityFactory';
import type { TiledObject } from '../entities/Block';
import { Roller } from '../entities/Roller';
import { SpikeBall } from '../entities/SpikeBall';
import { Checkpoint } from '../entities/Checkpoint';

const PLAYER_SPEED = 240; // px/sec — matches Player.cs speed≈4px/tick × 60
const JUMP_VELOCITY = -600; // px/sec — matches Player.cs jumpHeight=10px/tick × 60
const MAX_FALL_SPEED = 600; // px/sec — matches Player.cs maxFallSpeed=10px/tick × 60
const TILE_SIZE = 32;
const STARTING_LIVES = 5; // Player.cs: MAX_LIVES = 5

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private ground!: Phaser.Physics.Arcade.StaticGroup;
  private enemies!: Phaser.Physics.Arcade.Group;
  private hazards!: Phaser.Physics.Arcade.StaticGroup;
  private gates!: Phaser.Physics.Arcade.StaticGroup;
  private checkpoints!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private playerDead: boolean = false;
  private hurtFlashTimer: number = 0;
  private readonly HURT_FLASH_DURATION = 60; // ticks (~1 second at 60Hz)
  private invincible: boolean = false;
  private invincibleTimer: number = 0;
  private readonly INVINCIBLE_DURATION = 120; // 2 seconds
  private spawnX: number = 0;
  private spawnY: number = 0;
  private lives: number = STARTING_LIVES;
  private jumpKeyHeld: boolean = false;
  private gateTriggered: boolean = false;

  private livesText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;

  private accumulator: number = 0;
  private readonly FIXED_STEP_MS: number = 1000 / 60; // 16.667ms = 60 Hz
  private tickCount: number = 0; // equivalent of Level.count

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    // Tiled JSON map (exported from Level1-1.tmx — see web/README.md)
    this.load.tilemapTiledJSON('level1', 'assets/levels/Level1-1.json');

    // Tilesets referenced by the map
    this.load.image('background', 'assets/images/background.png');
    this.load.image('brick', 'assets/images/brick.png');

    // Player sprites
    this.load.image('player-stand', 'assets/images/PC/stand.png');
    this.load.spritesheet('player-walk', 'assets/images/PC/walk.png', {
      frameWidth: TILE_SIZE,
      frameHeight: TILE_SIZE,
    });
    this.load.spritesheet('player-jump', 'assets/images/PC/jump.png', {
      frameWidth: TILE_SIZE,
      frameHeight: TILE_SIZE,
    });

    // Entity sprites
    this.load.spritesheet('roller', 'assets/images/roller.png', {
      frameWidth: TILE_SIZE,
      frameHeight: TILE_SIZE,
    });
    this.load.image('geyser', 'assets/images/geyser.png');
    this.load.image('spikeball', 'assets/images/Enemies/spikeball.png');
    this.load.image('checkpoint', 'assets/images/checkpoint.png');
  }

  create(): void {
    const map = this.make.tilemap({ key: 'level1' });

    // Wire both tilesets used in the Background tile layer.
    // GIDs 1–280 → 'background' tileset; GID 281 → 'brick' tileset.
    const backgroundTileset = map.addTilesetImage('background', 'background');
    const brickTileset = map.addTilesetImage('brick', 'brick');

    // Render the Background tile layer using both tilesets.
    // Fall back gracefully if createLayer returns null (e.g. layer name mismatch).
    if (backgroundTileset && brickTileset) {
      const bgLayer = map.createLayer('Background', [backgroundTileset, brickTileset]);
      if (bgLayer) {
        bgLayer.setDepth(-1);
      }
    }

    // Read spawn position from map properties (startX / startY)
    const mapProps = (map.properties as Array<{ name: string; value: string }>) || [];
    const startX = parseInt(mapProps.find(p => p.name === 'startX')?.value ?? '96', 10);
    const startY = parseInt(mapProps.find(p => p.name === 'startY')?.value ?? '640', 10);

    // Build static collision group from Ground object layer via EntityFactory.
    // Objects with type "Puddle.Block" are dispatched to Block.fromTiledObject().
    this.ground = this.physics.add.staticGroup();
    const groundLayer = map.getObjectLayer('Ground');
    if (groundLayer) {
      for (const obj of groundLayer.objects as TiledObject[]) {
        EntityFactory.create(this, obj, { ground: this.ground });
      }
    }

    // Dynamic groups for enemies and hazards.
    this.enemies = this.physics.add.group();
    this.hazards = this.physics.add.staticGroup();
    this.gates = this.physics.add.staticGroup();
    this.checkpoints = this.physics.add.staticGroup();

    // Items layer contains Rollers, Geysers, and Checkpoints.
    const itemsLayer = map.getObjectLayer('Items');
    if (itemsLayer) {
      for (const obj of itemsLayer.objects as TiledObject[]) {
        EntityFactory.create(this, obj, {
          ground: this.ground,
          enemies: this.enemies,
          hazards: this.hazards,
          gates: this.gates,
          checkpoints: this.checkpoints,
        });
      }
    }

    // Gate layer contains NextLevel objects (empty in Level1-1, wired for future levels).
    const gateLayer = map.getObjectLayer('Gate');
    if (gateLayer) {
      for (const obj of gateLayer.objects as TiledObject[]) {
        EntityFactory.create(this, obj, {
          ground: this.ground,
          enemies: this.enemies,
          hazards: this.hazards,
          gates: this.gates,
          checkpoints: this.checkpoints,
        });
      }
    }

    // Enemies layer contains SpikeBall objects.
    const enemiesLayer = map.getObjectLayer('Enemies');
    if (enemiesLayer) {
      for (const obj of enemiesLayer.objects as TiledObject[]) {
        EntityFactory.create(this, obj, {
          ground: this.ground,
          enemies: this.enemies,
          hazards: this.hazards,
          gates: this.gates,
          checkpoints: this.checkpoints,
        });
      }
    }

    // Player — spawned at startX/startY from map properties.
    // startY in the TMX is the top of the bottom tile row (the floor).
    // Place the player center one tile above that floor line.
    this.player = this.physics.add.sprite(
      startX + TILE_SIZE / 2,
      startY - TILE_SIZE / 2,
      'player-stand'
    );
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(1);
    (this.player.body as Phaser.Physics.Arcade.Body).setMaxVelocityY(MAX_FALL_SPEED);

    this.spawnX = this.player.x;
    this.spawnY = this.player.y;

    // Idle — single frame from stand.png
    this.anims.create({
      key: 'idle',
      frames: [{ key: 'player-stand', frame: 0 }],
      frameRate: 1,
      repeat: -1,
    });

    // Walk — 4 frames at 8 fps, loops
    this.anims.create({
      key: 'walk',
      frames: this.anims.generateFrameNumbers('player-walk', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1,
    });

    // Jump — 3 frames, plays once and holds the last frame
    this.anims.create({
      key: 'jump',
      frames: this.anims.generateFrameNumbers('player-jump', { start: 0, end: 2 }),
      frameRate: 8,
      repeat: 0,
    });

    // Collide player with ground blocks
    this.physics.add.collider(this.player, this.ground);

    // Enemies stand on ground
    this.physics.add.collider(this.enemies, this.ground);

    // Enemy / hazard / gate / checkpoint overlaps
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerHitEnemy, undefined, this);
    this.physics.add.overlap(this.player, this.hazards, this.onPlayerHitHazard, undefined, this);
    this.physics.add.overlap(this.player, this.gates, this.onPlayerReachedGate, undefined, this);
    this.physics.add.overlap(this.player, this.checkpoints, this.onCheckpointReached, undefined, this);

    // Cursor keys
    this.cursors = this.input.keyboard!.createCursorKeys();

    // Camera follows player within map bounds
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // HUD — fixed to camera, depth 10 so it renders above everything
    const hudStyle = {
      fontSize: '20px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    };
    this.livesText = this.add
      .text(12, 12, `❤️ x${this.lives}`, hudStyle)
      .setScrollFactor(0)
      .setDepth(10);
    this.levelText = this.add
      .text(this.scale.width - 12, 12, 'Level 1-1', hudStyle)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(10);
  }

  update(_time: number, delta: number): void {
    // Fixed-step accumulator — runs simulation at exactly 60 Hz
    // regardless of browser frame rate (30fps, 60fps, 144fps monitors)
    this.accumulator += delta;

    while (this.accumulator >= this.FIXED_STEP_MS) {
      this.fixedUpdate();
      this.accumulator -= this.FIXED_STEP_MS;
      this.tickCount++;
    }

    // Interpolation factor for smooth rendering (optional, skip for now)
    // const alpha = this.accumulator / this.FIXED_STEP_MS;
  }

  /**
   * Fixed-step simulation tick (~60 Hz).
   * Decoupled from browser frame rate via accumulator pattern.
   * Equivalent to Game1.Update() in the original C# MonoGame code.
   * this.tickCount mirrors Level.count — use it for frame-based timers.
   */
  private fixedUpdate(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    // Pit death — player fell off the bottom of the world
    if (this.player.y > this.physics.world.bounds.height + 200) {
      if (!this.playerDead) {
        this.triggerDeath();
      }
    }

    // Death timer — flash red then respawn
    if (this.playerDead) {
      if (this.hurtFlashTimer > 0) {
        this.hurtFlashTimer--;
        // Alternate tint every 6 ticks for a flash effect
        if (this.hurtFlashTimer % 6 < 3) {
          this.player.setTint(0xff0000);
        } else {
          this.player.clearTint();
        }
      } else {
        this.respawn();
      }
      return; // Skip all movement/input during death
    }

    // Invincibility blink — alpha oscillates every 6 ticks
    if (this.invincible) {
      if (this.invincibleTimer > 0) {
        this.invincibleTimer--;
        this.player.setAlpha(this.invincibleTimer % 12 < 6 ? 0.3 : 1.0);
      } else {
        this.invincible = false;
        this.player.setAlpha(1);
      }
    }

    const onGround = body.blocked.down;

    // Horizontal movement (always applied, even while airborne)
    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-PLAYER_SPEED);
      this.player.setFlipX(true);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(PLAYER_SPEED);
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    // Animation state machine — airborne > walking > idle
    if (!onGround) {
      this.player.play('jump', true);
    } else if (this.cursors.left.isDown || this.cursors.right.isDown) {
      this.player.play('walk', true);
    } else {
      this.player.play('idle', true);
    }

    // Jump — up arrow or space, only when grounded
    if ((this.cursors.up.isDown || this.cursors.space.isDown) && onGround) {
      this.player.setVelocityY(JUMP_VELOCITY);
      this.jumpKeyHeld = true;
    }

    // Jump cut — release jump early while ascending for a shorter hop
    if (this.jumpKeyHeld && !(this.cursors.up.isDown || this.cursors.space.isDown)) {
      if (body.velocity.y < 0) {
        body.setVelocityY(body.velocity.y / 2);
      }
      this.jumpKeyHeld = false;
    }

    // Reset jump key tracking when landing
    if (onGround) {
      this.jumpKeyHeld = false;
    }

    // Tick each enemy that has per-tick logic
    this.enemies.getChildren().forEach(child => {
      if (child instanceof Roller || child instanceof SpikeBall) {
        child.update(this.tickCount);
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onCheckpointReached(_player: any, checkpoint: any): void {
    const cp = checkpoint as Checkpoint;
    if (cp.activated) return;
    // Update respawn position to this checkpoint's world coords
    this.spawnX = cp.x;
    this.spawnY = cp.y;
    cp.activate();
  }

  private onPlayerHitEnemy(): void {
    if (!this.invincible && !this.playerDead) {
      this.triggerDeath();
    }
  }

  private onPlayerHitHazard(): void {
    if (!this.invincible && !this.playerDead) {
      this.triggerDeath();
    }
  }

  private triggerDeath(): void {
    this.playerDead = true;
    this.hurtFlashTimer = this.HURT_FLASH_DURATION;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    // Partially cancel world gravity (1260) so the player floats briefly on death
    body.setGravityY(-1160);
    this.player.setTint(0xff0000);
    // Screen flash — red tint to signal death
    this.cameras.main.flash(300, 255, 0, 0);
  }

  private respawn(): void {
    this.playerDead = false;
    this.invincible = true;
    this.invincibleTimer = this.INVINCIBLE_DURATION;
    // Small upward Y offset to prevent spawning inside the floor on collision edge cases
    this.player.setPosition(this.spawnX, this.spawnY - 8);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setGravityY(0); // restore normal gravity
    this.player.clearTint();
    this.player.setAlpha(1);
    this.jumpKeyHeld = false;
    // Decrement lives and update HUD
    this.lives = Math.max(0, this.lives - 1);
    this.livesText.setText(`❤️ x${this.lives}`);
  }

  private onPlayerReachedGate(): void {
    if (this.gateTriggered) return;
    this.gateTriggered = true;

    console.log('Level complete!');

    // No Level 1-2 exists yet — show "You Win!" overlay and freeze the player
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setAllowGravity(false);
    this.player.anims.stop();

    this.add
      .text(this.cameras.main.centerX, this.cameras.main.centerY, '🎉 YOU WIN!', {
        fontSize: '48px',
        color: '#ffe066',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10);

    this.add
      .text(this.cameras.main.centerX, this.cameras.main.centerY + 56, 'Press R to replay', {
        fontSize: '24px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10);

    // R key restarts the scene
    this.input.keyboard!.once('keydown-R', () => {
      this.scene.restart();
    });
  }
}
