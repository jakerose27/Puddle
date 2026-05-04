import Phaser from 'phaser';
import { EntityFactory } from '../entities/EntityFactory';
import type { TiledObject } from '../entities/Block';
import { Roller } from '../entities/Roller';

const PLAYER_SPEED = 200; // px/sec
const TILE_SIZE = 32;

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private ground!: Phaser.Physics.Arcade.StaticGroup;
  private rollers!: Phaser.GameObjects.Group;
  private hazards!: Phaser.Physics.Arcade.StaticGroup;
  private gates!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private playerDead: boolean = false;
  private hurtFlashTimer: number = 0;
  private readonly HURT_FLASH_DURATION = 60; // ticks (~1 second at 60Hz)
  private invincible: boolean = false;
  private invincibleTimer: number = 0;
  private readonly INVINCIBLE_DURATION = 120; // 2 seconds
  private spawnX: number = 0;
  private spawnY: number = 0;

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

    // Entity sprites
    this.load.spritesheet('roller', 'assets/images/roller.png', {
      frameWidth: TILE_SIZE,
      frameHeight: TILE_SIZE,
    });
    this.load.image('geyser', 'assets/images/geyser.png');
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
    this.rollers = this.physics.add.group();
    this.hazards = this.physics.add.staticGroup();
    this.gates = this.physics.add.staticGroup();

    // Items layer contains Rollers, Geysers, and Checkpoints.
    const itemsLayer = map.getObjectLayer('Items');
    if (itemsLayer) {
      for (const obj of itemsLayer.objects as TiledObject[]) {
        EntityFactory.create(this, obj, {
          ground: this.ground,
          rollers: this.rollers,
          hazards: this.hazards,
          gates: this.gates,
        });
      }
    }

    // Gate layer contains NextLevel objects (empty in Level1-1, wired for future levels).
    const gateLayer = map.getObjectLayer('Gate');
    if (gateLayer) {
      for (const obj of gateLayer.objects as TiledObject[]) {
        EntityFactory.create(this, obj, {
          ground: this.ground,
          rollers: this.rollers,
          hazards: this.hazards,
          gates: this.gates,
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

    this.spawnX = this.player.x;
    this.spawnY = this.player.y;

    // Walk animation
    this.anims.create({
      key: 'walk',
      frames: this.anims.generateFrameNumbers('player-walk', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1,
    });

    // Collide player with ground blocks
    this.physics.add.collider(this.player, this.ground);

    // Rollers stand on ground
    this.physics.add.collider(this.rollers, this.ground);

    // Enemy / hazard / gate overlaps
    this.physics.add.overlap(this.player, this.rollers, this.onPlayerHitEnemy, undefined, this);
    this.physics.add.overlap(this.player, this.hazards, this.onPlayerHitHazard, undefined, this);
    this.physics.add.overlap(this.player, this.gates, this.onPlayerReachedGate, undefined, this);

    // Cursor keys
    this.cursors = this.input.keyboard!.createCursorKeys();

    // Camera follows player within map bounds
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
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

    // Horizontal movement
    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-PLAYER_SPEED);
      this.player.setFlipX(true);
      if (onGround) this.player.play('walk', true);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(PLAYER_SPEED);
      this.player.setFlipX(false);
      if (onGround) this.player.play('walk', true);
    } else {
      this.player.setVelocityX(0);
      this.player.setTexture('player-stand');
      this.player.anims.stop();
    }

    // Jump — up arrow or space, only when grounded
    if ((this.cursors.up.isDown || this.cursors.space.isDown) && onGround) {
      this.player.setVelocityY(-400);
    }

    // Tick each roller
    this.rollers.getChildren().forEach(child => {
      if (child instanceof Roller) {
        child.update(this.tickCount);
      }
    });
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
    // Partially cancel world gravity (600) so the player floats briefly
    body.setGravityY(-500);
    this.player.setTint(0xff0000);
  }

  private respawn(): void {
    this.playerDead = false;
    this.invincible = true;
    this.invincibleTimer = this.INVINCIBLE_DURATION;
    this.player.setPosition(this.spawnX, this.spawnY);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setGravityY(0); // restore normal gravity
    this.player.clearTint();
    this.player.setAlpha(1);
  }

  private onPlayerReachedGate(): void {
    console.log('Level complete!');
    // Remove this overlap so the overlay only fires once
    this.physics.world.removeCollider(
      this.physics.add.overlap(this.player, this.gates, this.onPlayerReachedGate, undefined, this)
    );
    this.add
      .text(this.cameras.main.centerX, this.cameras.main.centerY, 'LEVEL COMPLETE', {
        fontSize: '48px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10);
  }
}
