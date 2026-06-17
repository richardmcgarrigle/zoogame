import Phaser from 'phaser';
import PlaygroundScene from './scenes/PlaygroundScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#bfe3c8',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  input: {
    gamepad: true,
    activePointers: 4,
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { y: 1 },
      debug: false,
    },
  },
  scene: [PlaygroundScene],
});
