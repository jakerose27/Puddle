import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

// Map dimensions: 22 tiles × 32px = 704px each axis
const MAP_PX = 22 * 32;

new Phaser.Game({
  type: Phaser.AUTO,
  width: MAP_PX,
  height: MAP_PX,
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 1260 }, // 0.35 px/tick² × 60² = 1260 px/s² (matches Player.cs)
      debug: false,
    },
  },
  scene: [GameScene],
});
