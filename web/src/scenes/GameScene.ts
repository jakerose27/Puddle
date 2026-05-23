import Phaser from 'phaser';
import { EntityFactory } from '../entities/EntityFactory';
import { Block } from '../entities/Block';
import type { TiledObject } from '../entities/Block';
import { Roller, BELT_SPEED } from '../entities/Roller';
import { SpikeBall } from '../entities/SpikeBall';
import { Checkpoint } from '../entities/Checkpoint';
import { PowerUp } from '../entities/PowerUp';
import { Projectile } from '../entities/Projectile';
import { Bird } from '../entities/Bird';
import { Cannon } from '../entities/Cannon';
import { Button } from '../entities/Button';
import { Pipe } from '../entities/Pipe';
import { Rat } from '../entities/Rat';
import { Hand } from '../entities/Hand';
import { Face } from '../entities/Face';

const PLAYER_SPEED = 240; // px/sec — matches Player.cs speed≈4px/tick × 60
const JUMP_VELOCITY = -600; // px/sec — matches Player.cs jumpHeight=10px/tick × 60
const MAX_FALL_SPEED = 600; // px/sec — matches Player.cs maxFallSpeed=10px/tick × 60
const TILE_SIZE = 32;
const STARTING_LIVES = 5; // Player.cs: MAX_LIVES = 5

/** Ordered campaign level sequence. Extend this array as more levels are converted. */
const LEVEL_SEQUENCE = ['Level1-1', 'Level1-2', 'Level1-3', 'Level2-1', 'Level2-2', 'Level2-3', 'Level2-4', 'Level3-1', 'Level3-2', 'Level3-3', 'LevelBoss'];

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  public ground!: Phaser.Physics.Arcade.StaticGroup;
  private enemies!: Phaser.Physics.Arcade.Group;
  /** Conveyor-belt rollers — player collides (doesn't die) and is pushed horizontally. */
  private movers!: Phaser.Physics.Arcade.Group;
  private hazards!: Phaser.Physics.Arcade.StaticGroup;
  private geysers!: Phaser.Physics.Arcade.StaticGroup;
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

  /** Cannon instances — tracked separately so we can call update(tickCount) each tick */
  private cannons: Cannon[] = [];

  /** All Pipe instances in the level — used for partner lookup during teleport. */
  public pipes: Pipe[] = [];

  /** Named blocks (e.g. "Gate 1", "Block 2") — keyed by Tiled name for Button gate-toggle. */
  public namedBlocks: Map<string, Block> = new Map();

  /** All Button instances — tracked to poll holdButton release each tick. */
  private buttons: Button[] = [];

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
    this.cannons = [];
    this.pipes = [];
    this.namedBlocks = new Map();
    this.buttons = [];
    // Lives carry across levels; only reset when starting fresh (no level in data)
    if (!data.level) {
      this.lives = STARTING_LIVES;
    }
  }

  preload(): void {
    // Tiled JSON maps for all implemented levels
    this.load.tilemapTiledJSON('Level1-1', 'assets/levels/Level1-1.json');
    this.load.tilemapTiledJSON('Level1-2', 'assets/levels/Level1-2.json');
    this.load.tilemapTiledJSON('Level1-3', 'assets/levels/Level1-3.json');
    this.load.tilemapTiledJSON('Level2-1', 'assets/levels/Level2-1.json');
    this.load.tilemapTiledJSON('Level2-2', 'assets/levels/Level2-2.json');
    this.load.tilemapTiledJSON('Level2-3', 'assets/levels/Level2-3.json');
    this.load.tilemapTiledJSON('Level2-4', 'assets/levels/Level2-4.json');
    this.load.tilemapTiledJSON('Level3-1', 'assets/levels/Level3-1.json');
    this.load.tilemapTiledJSON('Level3-2', 'assets/levels/Level3-2.json');
    this.load.tilemapTiledJSON('Level3-3', 'assets/levels/Level3-3.json');
    this.load.tilemapTiledJSON('LevelBoss', 'assets/levels/LevelBoss.json');

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
    // Level1-3 tilesets
    this.load.spritesheet('rat', 'assets/images/Enemies/rat.png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.image('hand', 'assets/images/Enemies/hand.png');
    this.load.spritesheet('face', 'assets/images/Enemies/face.png', {
      frameWidth: 96,
      frameHeight: 96,
    });

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
    this.load.spritesheet('checkpoint', 'assets/images/checkpoint.png', { frameWidth: 32, frameHeight: 32 });
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

    // Restore original Spike 2 rendering: background.png stretched as scene backdrop.
    const bgImg = this.add.image(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'background'
    );
    bgImg.setDisplaySize(this.scale.width, this.scale.height);
    bgImg.setScrollFactor(0); // fixed to camera — it's a backdrop
    bgImg.setDepth(-2);       // behind tile layer and everything else

    // Wire both tilesets used in the Background tile layer.
    // GIDs 1–280 → 'background' tileset; GID 281 → 'brick' tileset.
    const backgroundTileset = map.addTilesetImage('background', 'background');
    const brickTileset = map.addTilesetImage('brick', 'brick');

    // Collect whichever tilesets loaded (graceful degradation if one returns null).
    const tilesetsLoaded = [backgroundTileset, brickTileset].filter(Boolean) as Phaser.Tilemaps.Tileset[];

    // bgLayer kept hidden — the sky tileset provides no useful platform art.
    // Block objects are the authoritative collision + visual source for platforms.
    let bgLayer: Phaser.Tilemaps.TilemapLayer | null = null;
    if (tilesetsLoaded.length > 0) {
      bgLayer = map.createLayer('Background', tilesetsLoaded);
      if (bgLayer) {
        bgLayer.setVisible(false); // Keep hidden — sky tileset provides no useful art
        bgLayer.setDepth(-1);
        // Do NOT setCollisionByExclusion here — Block objects handle all collision
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
    this.movers = this.physics.add.group();
    this.hazards = this.physics.add.staticGroup();
    this.geysers = this.physics.add.staticGroup();
    this.gates = this.physics.add.staticGroup();
    this.checkpoints = this.physics.add.staticGroup();
    this.items = this.physics.add.staticGroup();
    this.projectiles = this.physics.add.group();

    // Process ALL object layers generically — works across any level regardless of layer names.
    // EntityFactory dispatches by entity type, not layer name.
    for (const layer of map.objects) {
      for (const obj of layer.objects as TiledObject[]) {
        const entity = EntityFactory.create(this, obj, {
          ground: this.ground,
          enemies: this.enemies,
          movers: this.movers,
          hazards: this.hazards,
          geysers: this.geysers,
          gates: this.gates,
          checkpoints: this.checkpoints,
          items: this.items,
        });
        // Track entities that need per-tick updates outside the standard groups
        if (entity instanceof Block && entity.name) {
          this.namedBlocks.set(entity.name, entity);
        }
        if (entity instanceof Cannon) {
          this.cannons.push(entity);
        }
        if (entity instanceof Pipe) {
          this.pipes.push(entity);
        }
        if (entity instanceof Button) {
          this.buttons.push(entity);
        }
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

    // Checkpoint flag animation — plays through all 8 frames on activation
    this.anims.create({
      key: 'checkpoint-activate',
      frames: this.anims.generateFrameNumbers('checkpoint', { start: 0, end: 7 }),
      frameRate: 8,
      repeat: 0,
    });

    // Collide player with ground blocks (Block objects are the authoritative collision source)
    this.physics.add.collider(this.player, this.ground);

    // Enemies stand on ground
    this.physics.add.collider(this.enemies, this.ground);

    // Rollers have no gravity — no floor collider needed. Player can land on them from above.
    this.physics.add.collider(
      this.player,
      this.movers,
      undefined,
      (_player, _roller) => {
        const pb = (this.player.body as Phaser.Physics.Arcade.Body);
        const rb = (_roller as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
        return pb.bottom <= rb.top + 8;
      },
      this
    );

    // Enemy / hazard / gate / checkpoint / item overlaps
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerHitEnemy, undefined, this);
    this.physics.add.overlap(this.player, this.hazards, this.onPlayerHitHazard, undefined, this);
    this.physics.add.overlap(this.player, this.geysers, this.onPlayerHitGeyser, undefined, this);
    this.physics.add.overlap(this.player, this.gates, this.onPlayerReachedGate, undefined, this);
    this.physics.add.overlap(this.player, this.checkpoints, this.onCheckpointReached, undefined, this);
    this.physics.add.overlap(this.player, this.items, this.onPlayerCollectItem, undefined, this);

    // Projectiles hit ground blocks → destroy projectile
    this.physics.add.collider(
      this.projectiles,
      this.ground,
      (proj) => { (proj as Projectile).destroy(); },
    );

    // Projectiles hit enemies → destroy projectile + damage enemy
    this.physics.add.overlap(
      this.projectiles,
      this.enemies,
      (proj, enemy) => {
        (proj as Projectile).destroy();
        const e = enemy as Phaser.Physics.Arcade.Sprite & { takeDamage?: (amount: number) => void };
        if (typeof e.takeDamage === 'function') e.takeDamage(1);
      },
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
        // Scale FIRST — setSize uses displayHeight to auto-center, so the scale
        // must be applied before setSize/setOffset or the offset calc is wrong.
        this.player.setScale(1, 0.27); // visual squish (displayHeight = 32*0.27 ≈ 8.6px)
        body.setSize(18, 8);
        // Keep body bottom anchored at the same floor contact point:
        //   body.bottom = sprite.y - displayOriginY + offsetY + bodyH = sprite.y + 15
        //   displayOriginY = 32 * 0.5 * 0.27 = 4.32  →  offsetY ≈ 11
        body.setOffset(7, 11);
        body.setVelocityY(0); // cancel any residual gravity before physics resolves
        this.player.setVelocityX(0); // frozen (C#: frozen = puddled → no xAccel applied)
      } else if (!this.cursors.down.isDown && this.puddled) {
        // Exit puddle state — save the floor contact Y BEFORE resizing so we can
        // snap sprite.y back to exactly the right position afterwards.
        // Without this, tiny drift in body.bottom during puddle state causes the
        // expanded 30px body to sit slightly inside the platform and tunnel through.
        const floorContactY = body.bottom;
        this.puddled = false;
        this.player.setScale(1, 1); // restore scale FIRST (displayHeight back to 32px)
        body.setSize(18, 30);
        body.setOffset(7, 1); // restore normal offset for unscaled 32px sprite
        // Pin sprite.y so body.bottom == floorContactY.
        // With normal body: body.bottom = player.y - 16 + 1 + 30 = player.y + 15
        // → player.y = floorContactY - 15
        this.player.y = floorContactY - 15;
        body.setVelocityY(0); // cancel accumulated gravity from puddle frames
      }

      if (this.puddled) {
        // While puddled: no movement allowed (C# frozen property blocks xAccel)
        this.player.setVelocityX(0);
      }
    }

    // --- Belt push: carry player left/right when standing on a roller ---
    // Runs AFTER puddle section so it overrides the puddle's setVelocityX(0).
    // Works even when puddled — belt carries puddled player under spikes.
    if (body.blocked.down) {
      for (const child of this.movers.getChildren()) {
        const roller = child as Roller;
        const rb = roller.body as Phaser.Physics.Arcade.Body;
        if (!rb) continue;
        const onRoller =
          !body.blocked.left && !body.blocked.right &&
          body.bottom >= rb.top - 2 &&
          body.bottom <= rb.top + 6 &&
          body.right > rb.left + 4 &&
          body.left < rb.right - 4;
        if (onRoller) {
          this.player.setVelocityX(roller.facingLeft ? -BELT_SPEED : BELT_SPEED);
          break;
        }
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
      if (
        child instanceof SpikeBall ||
        child instanceof Bird ||
        child instanceof Rat ||
        child instanceof Hand ||
        child instanceof Face
      ) {
        child.update(this.tickCount);
      }
    });

    // Tick movers (Rollers).
    this.movers.getChildren().forEach(child => {
      if (child instanceof Roller) {
        child.update(this.tickCount);
      }
    });

    // Tick each cannon (fires projectiles on interval)
    for (const cannon of this.cannons) {
      if (cannon.active) cannon.update(this.tickCount);
    }

    // Check pipe teleportation (proximity-based, cooldown-guarded)
    this.checkPipeTeleport();

    // holdButton release — re-close gates when player steps off
    this.checkButtonRelease();
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
    // Button — press on first contact (no powerup sound)
    if (item instanceof Button) {
      item.press(this);
      return;
    }
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

  /** Geyser contact: boost player upward and restore puddle powerup (mirrors C# Geyser.checkCollisions). */
  private onPlayerHitGeyser(): void {
    if (this.playerDead) return;
    this.player.setVelocityY(-800);
    // Restore puddle powerup if the player has earned it
    if (this.playerPowerups.puddle !== undefined) {
      this.playerPowerups.puddle = true;
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

  /**
   * Checks holdButton buttons each tick — if the player is no longer overlapping
   * a held button, call release() to re-close gates.
   */
  private checkButtonRelease(): void {
    if (this.buttons.length === 0 || this.playerDead) return;
    const pb = this.player.body as Phaser.Physics.Arcade.Body;

    for (const btn of this.buttons) {
      if (!btn.holdButton || !btn.isDown) continue;
      const bb = btn.body as Phaser.Physics.Arcade.StaticBody;
      const overlapping =
        pb.x < bb.x + bb.width &&
        pb.x + pb.width > bb.x &&
        pb.y < bb.y + bb.height &&
        pb.y + pb.height > bb.y;
      if (!overlapping) {
        btn.release(this);
      }
    }
  }

  /**
   * Proximity-based pipe teleport check. Called each fixed tick.
   * Expands the player's physics body bounds by 2 px to detect touching (not just overlap)
   * since the pipe is solid and the bodies will be separated by the collider.
   */
  private checkPipeTeleport(): void {
    if (this.pipes.length === 0 || this.playerDead) return;
    const pb = this.player.body as Phaser.Physics.Arcade.Body;
    const prx = pb.x - 2;
    const pry = pb.y - 2;
    const prw = pb.width + 4;
    const prh = pb.height + 4;

    for (const pipe of this.pipes) {
      if (!pipe.active) continue;
      const body = pipe.body as Phaser.Physics.Arcade.StaticBody;
      // AABB overlap with 2 px buffer
      if (
        prx < body.x + body.width &&
        prx + prw > body.x &&
        pry < body.y + body.height &&
        pry + prh > body.y
      ) {
        pipe.tryTeleport(this.player, this.pipes, this.tickCount);
        break; // only one teleport per tick
      }
    }
  }

  /**
   * Called by Face when its health reaches zero.
   * Destroys all enemies and shows a "YOU WIN!" overlay with restart option.
   */
  public onBossDefeated(): void {
    this.enemies.getChildren().slice().forEach(e => (e as Phaser.GameObjects.GameObject).destroy());

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

    this.input.keyboard!.once('keydown-R', () => {
      this.scene.restart();
    });
  }

  private onPlayerReachedGate(): void {
    if (this.gateTriggered) return;
    this.gateTriggered = true;

    console.log(`Level complete: ${this.currentLevel}`);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setAllowGravity(false);
    this.player.anims.stop();

    const currentIndex = LEVEL_SEQUENCE.indexOf(this.currentLevel);
    const nextLevel = LEVEL_SEQUENCE[currentIndex + 1];

    if (nextLevel) {
      const nextLabel = nextLevel.replace(/^Level(\d+)-(\d+)$/, 'Level $1-$2');
      this.add
        .text(this.cameras.main.centerX, this.cameras.main.centerY, `➡️ ${nextLabel}`, {
          fontSize: '40px',
          color: '#ffe066',
          stroke: '#000000',
          strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(10);

      this.time.delayedCall(1500, () => {
        this.scene.restart({ level: nextLevel });
      });
    } else {
      // End of campaign — show win screen
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
