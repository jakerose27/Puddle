import Phaser from 'phaser';

// Tiled JSON object shape (minimal — only the fields we use)
interface TiledObject {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  type: string;
  gid?: number;
  properties?: Array<{ name: string; value: string }>;
}

const PLAYER_SPEED = 200; // px/sec
const TILE_SIZE = 32;

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private ground!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

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
  }

  create(): void {
    const map = this.make.tilemap({ key: 'level1' });

    // Background is a stretched PNG in the original C# game.
    // The Background tile layer in Level1-1.tmx has visible="0" and is effectively vestigial.
    // We match the original rendering: stretch background.png to fill the canvas.
    const bgWidth = this.scale.width;
    const bgHeight = this.scale.height;
    const bg = this.add.image(bgWidth / 2, bgHeight / 2, 'background');
    bg.setDisplaySize(bgWidth, bgHeight);
    bg.setDepth(-1);

    // Read spawn position from map properties (startX / startY)
    const mapProps = (map.properties as Array<{ name: string; value: string }>) || [];
    const startX = parseInt(mapProps.find(p => p.name === 'startX')?.value ?? '96', 10);
    const startY = parseInt(mapProps.find(p => p.name === 'startY')?.value ?? '640', 10);

    // Build static collision group from Ground object layer (Puddle.Block objects)
    this.ground = this.physics.add.staticGroup();
    const groundLayer = map.getObjectLayer('Ground');
    if (groundLayer) {
      for (const obj of groundLayer.objects as TiledObject[]) {
        // Tiled tile-object convention: (x, y) is the bottom-left of the tile
        const w = obj.width || TILE_SIZE;
        const h = obj.height || TILE_SIZE;
        const cx = obj.x + w / 2;
        const cy = obj.y - h / 2; // bottom-left y → center y
        const rect = this.add.rectangle(cx, cy, w, h, 0x8b6f47) as Phaser.GameObjects.Rectangle;
        this.physics.add.existing(rect, true); // true = static
        this.ground.add(rect);
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

    // Walk animation
    this.anims.create({
      key: 'walk',
      frames: this.anims.generateFrameNumbers('player-walk', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1,
    });

    // Collide player with ground blocks
    this.physics.add.collider(this.player, this.ground);

    // Cursor keys
    this.cursors = this.input.keyboard!.createCursorKeys();

    // Camera follows player within map bounds
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
  }

  update(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down;

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
  }
}
