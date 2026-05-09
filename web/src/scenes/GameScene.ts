import Phaser from 'phaser';
import { EntityFactory } from '../entities/EntityFactory';
import type { TiledObject } from '../entities/Block';
import { Roller } from '../entities/Roller';
import { SpikeBall } from '../entities/SpikeBall';
import { Checkpoint } from '../entities/Checkpoint';
import { PowerUp } from '../entities/PowerUp';
import { Projectile } from '../entities/Projectile';

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
  private items!: Phaser.Physics.Arcade.StaticGroup;
  private projectiles!: Phaser.Physics.Arcade.Group;
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

  /** Player ability flags — granted when powerup items are collected */
  private playerPowerups: Record<string, boolean> = {
    puddle: false,
    jetpack: false,
    charged: false,
  };
  /** True while the player is actively holding Down to stay puddled */
  private puddled: boolean = false;

  /** Shoot state — mirrors C# shooting flag + shotDelay (160ms = ~10 ticks) */
  private shootKey!: Phaser.Input.Keyboard.Key;
  private lastShotTick: number = -999;
  private static readonly SHOT_DELAY_TICKS = 10; // C# shotDelay=160ms ≈ 10 ticks @ 60Hz

  private livesText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;

  /** Sound effects — keyed by name, optional chained everywhere so missing files are silent */
  public sounds: { [key: string]: Phaser.Sound.BaseSound } = {};
  private music?: Phaser.Sound.BaseSound;

  private accumulator: number = 0;
  private readonly FIXED_STEP_MS: number = 1000 / 60; // 16.667ms = 60 Hz
  private tickCount: number = 0; // equivalent of Level.count

  /** Current level key — matches tilemapTiledJSON key and level filename */
  private currentLevel: string = 'Level1-1';

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { level?: string } = {}): void {
    this.currentLevel = data.level ?? 'Level1-1';
    // Reset per-level state (persists across scene.restart if not cleared here)
    this.gateTriggered = false;
    this.playerDead = false;
    this.invincible = false;
    this.invincibleTimer = 0;
    this.puddled = false;
    this.jumpKeyHeld = false;
    this.accumulator = 0;
    this.tickCount = 0;
    this.lastShotTick = -999;
    // Lives carry across levels; only reset when starting fresh (no level in data)
    if (!data.level) {
      this.lives = STARTING_LIVES;
    }
  }

  preload(): void {
    // Tiled JSON maps for all implemented levels
    this.load.tilemapTiledJSON('Level1-1', 'assets/levels/Level1-1.json');
    this.load.tilemapTiledJSON('Level1-2', 'assets/levels/Level1-2.json');

    // Tilesets referenced by the maps
    this.load.image('background', 'assets/images/background.png');
    this.load.image('brick', 'assets/images/brick.png');
    // Level1-2 tilesets (harmless to preload even when on Level1-1)
    this.load.image('button', 'assets/images/button.png');
    this.load.image('push_block', 'assets/images/push_block.png');
    this.load.image('fireball', 'assets/images/fireball.png');
    this.load.image('pipe', 'assets/images/pipe.png');
    this.load.image('jetpack', 'assets/images/jetpack.png');
    this.load.image('cannon', 'assets/images/cannon.png');
    this.load.image('Bird', 'assets/images/Enemies/bird.png');

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
    this.load.image('bubble', 'assets/images/bubble.png');

    // Generate placeholder textures for powerup items
    PowerUp.preloadTextures(this);

    // Sound effects (WAV — browser-compatible)
    this.load.audio('jump', 'assets/sounds/Jump.wav');
    this.load.audio('death', 'assets/sounds/Death.wav');
    this.load.audio('checkpoint', 'assets/sounds/Checkpoint.wav');
    this.load.audio('powerup', 'assets/sounds/Powerup.wav');
    this.load.audio('shoot', 'assets/sounds/Shot1.wav');
    this.load.audio('music', 'assets/sounds/InGame.wav');
  }

  create(): void {
    const map = this.make.tilemap({ key: this.currentLevel });

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

    // Dynamic groups for enemies and hazards.
    this.enemies = this.physics.add.group();
    this.hazards = this.physics.add.staticGroup();
    this.gates = this.physics.add.staticGroup();
    this.checkpoints = this.physics.add.staticGroup();
    this.items = this.physics.add.staticGroup();
    this.projectiles = this.physics.add.group();

    // Process ALL object layers generically — works across any level regardless of layer names.
    // EntityFactory dispatches by entity type, not layer name.
    for (const layer of map.objects) {
      for (const obj of layer.objects as TiledObject[]) {
        EntityFactory.create(this, obj, {
          ground: this.ground,
          enemies: this.enemies,
          hazards: this.hazards,
          gates: this.gates,
          checkpoints: this.checkpoints,
          items: this.items,
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

    // Enemy / hazard / gate / checkpoint / item overlaps
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerHitEnemy, undefined, this);
    this.physics.add.overlap(this.player, this.hazards, this.onPlayerHitHazard, undefined, this);
    this.physics.add.overlap(this.player, this.gates, this.onPlayerReachedGate, undefined, this);
    this.physics.add.overlap(this.player, this.checkpoints, this.onCheckpointReached, undefined, this);
    this.physics.add.overlap(this.player, this.items, this.onPlayerCollectItem, undefined, this);

    // Projectiles hit ground blocks → destroy projectile
    this.physics.add.collider(
      this.projectiles,
      this.ground,
      (proj) => { (proj as Projectile).destroy(); },
    );

    // Cursor keys + shoot key (D — mirrors C# Keys.D / RightShoulder)
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.shootKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    // Camera follows player within map bounds
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Sound effects — add each loaded sound with default volumes
    const sfxKeys: Array<[string, number]> = [
      ['jump', 0.5],
      ['death', 0.6],
      ['checkpoint', 0.7],
      ['powerup', 0.8],
      ['shoot', 0.4],
    ];
    for (const [key, volume] of sfxKeys) {
      if (this.cache.audio.exists(key)) {
        this.sounds[key] = this.sound.add(key, { volume });
      }
    }

    // Background music — play after first user interaction (browser autoplay policy)
    if (this.cache.audio.exists('music')) {
      this.music = this.sound.add('music', { loop: true, volume: 0.3 });
      // Phaser fires 'unlocked' once the AudioContext is resumed on first interaction
      if (this.sound.locked) {
        this.sound.once('unlocked', () => { this.music?.play(); });
      } else {
        this.music.play();
      }
    }

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
    const levelLabel = this.currentLevel.replace(/^Level(\d+)-(\d+)$/, 'Level $1-$2');
    this.levelText = this.add
      .text(this.scale.width - 12, 12, levelLabel, hudStyle)
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
      this.sounds['jump']?.play();
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

    // --- Puddle ability (C#: Puddle key = Down, requires powerup["puddle"] and grounded) ---
    // While puddled: player is flattened, cannot move horizontally, is invulnerable.
    // Entering puddle: Down held + grounded + has puddle powerup.
    // Exiting puddle: Down released.
    if (this.playerPowerups.puddle) {
      if (this.cursors.down.isDown && onGround && !this.puddled) {
        // Enter puddle state
        this.puddled = true;
        body.setSize(18, 8); // flatten hitbox — C# collisionHeight shrinks to ~8px
        this.player.setScale(1, 0.27); // visual squish
        this.player.setVelocityX(0); // frozen (C#: frozen = puddled → no xAccel applied)
      } else if (!this.cursors.down.isDown && this.puddled) {
        // Exit puddle state
        this.puddled = false;
        body.setSize(18, 30); // restore hitbox — C# collisionHeight=30
        this.player.setScale(1, 1);
      }

      if (this.puddled) {
        // While puddled: no movement allowed (C# frozen property blocks xAccel)
        this.player.setVelocityX(0);
      }
    }

    // --- Shoot ability (C#: D key, no powerup required — gated by hydration in C#) ---
    // Web port: fires once per press with a cooldown. Projectile travels in facing direction.
    if (
      Phaser.Input.Keyboard.JustDown(this.shootKey) &&
      !this.puddled &&
      this.tickCount - this.lastShotTick >= GameScene.SHOT_DELAY_TICKS
    ) {
      this.fireProjectile();
      this.lastShotTick = this.tickCount;
    }

    // Tick each projectile (lifetime / expiry)
    this.projectiles.getChildren().forEach(child => {
      if (child instanceof Projectile && child.active) {
        child.tick();
      }
    });

    // Tick each enemy that has per-tick logic
    this.enemies.getChildren().forEach(child => {
      if (child instanceof Roller || child instanceof SpikeBall) {
        child.update(this.tickCount);
      }
    });
  }

  /**
   * Spawns a Projectile (bubble shot) in the direction the player is facing.
   * C# equivalent: new Shot(this, dir) → level.projectiles.Add(s).
   */
  private fireProjectile(): void {
    const facingLeft = this.player.flipX;
    // Spawn offset: slightly in front of and vertically centered on player
    const offsetX = facingLeft ? -18 : 18;
    const proj = new Projectile(
      this,
      this.player.x + offsetX,
      this.player.y,
      facingLeft,
    );
    this.projectiles.add(proj);
    this.sounds['shoot']?.play();
  }

  /**
   * Grants a powerup ability to the player.
   * Called by PowerUp.collect().
   * C# equivalent: player.powerup[name] = true.
   */
  public grantPowerup(name: string): void {
    if (name in this.playerPowerups) {
      this.playerPowerups[name] = true;
    }
    // Show brief HUD hint
    const hints: Record<string, string> = {
      puddle: '💧 Puddle: hold Down to flatten!',
      jetpack: '🚀 Jetpack unlocked!',
      charged: '⚡ Charged shot unlocked!',
    };
    if (hints[name]) {
      const hintText = this.add
        .text(this.cameras.main.centerX, this.scale.height - 60, hints[name], {
          fontSize: '18px',
          color: '#00ccff',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(10);
      this.time.delayedCall(3000, () => hintText.destroy());
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onCheckpointReached(_player: any, checkpoint: any): void {
    const cp = checkpoint as Checkpoint;
    if (cp.activated) return;
    // Update respawn position to this checkpoint's world coords
    this.spawnX = cp.x;
    this.spawnY = cp.y;
    cp.activate();
    this.sounds['checkpoint']?.play();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onPlayerCollectItem(_player: any, item: any): void {
    const pu = item as PowerUp;
    if (!pu.active) return;
    pu.collect(this);
    this.sounds['powerup']?.play();
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
    this.sounds['death']?.play();
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
    // Exit puddle state on respawn
    if (this.puddled) {
      this.puddled = false;
      body.setSize(18, 30);
      this.player.setScale(1, 1);
    }
    // Decrement lives and update HUD
    this.lives = Math.max(0, this.lives - 1);
    this.livesText.setText(`❤️ x${this.lives}`);
  }

  private onPlayerReachedGate(): void {
    if (this.gateTriggered) return;
    this.gateTriggered = true;

    console.log(`Level complete: ${this.currentLevel}`);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setAllowGravity(false);
    this.player.anims.stop();

    if (this.currentLevel === 'Level1-1') {
      // Transition to Level1-2
      this.add
        .text(this.cameras.main.centerX, this.cameras.main.centerY, '➡️ Level 1-2', {
          fontSize: '40px',
          color: '#ffe066',
          stroke: '#000000',
          strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(10);

      this.time.delayedCall(1500, () => {
        this.scene.restart({ level: 'Level1-2' });
      });
    } else {
      // No further levels yet — show win screen
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

      // R key restarts from Level1-1
      this.input.keyboard!.once('keydown-R', () => {
        this.scene.restart();
      });
    }
  }
}
