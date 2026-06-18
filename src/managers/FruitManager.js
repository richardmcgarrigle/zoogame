import Phaser from 'phaser';
import { WORLD_HEIGHT } from '../util/constants.js';

// Fruit types available for random spawning. Melon is rarer and heavier.
export const FRUIT_CONFIGS = {
  orange: { key: 'orange', density: 0.0006, arrowTint: 0xff8c3c },
  apple:  { key: 'apple',  density: 0.0006, arrowTint: 0xd42b22 },
  melon:  { key: 'melon',  density: 0.0010, arrowTint: 0x5cb82e },
};
export const FRUIT_POOL = ['orange', 'orange', 'apple', 'apple', 'melon'];

const FRUIT_RESPAWN_X_MIN = 150;
const FRUIT_RESPAWN_X_MARGIN = 150;
const FRUIT_LAUNCH_SPEED_MIN = 4;
const FRUIT_LAUNCH_SPEED_MAX = 12;
const FRUIT_LAUNCH_SPIN = 0.6;

const FRUIT_IDLE_SPEED_THRESHOLD = 0.8; // px/frame — below this counts as stuck
const FRUIT_IDLE_RESPAWN_DELAY = 10;    // seconds before auto-respawn

export default class FruitManager {
  constructor(scene) {
    this.scene = scene;
    this.fruit = null;
    this.fruitIdleTime = 0;
  }

  addFruit(x, y, type = 'orange') {
    const scene = this.scene;
    const cfg = FRUIT_CONFIGS[type];
    const radius = scene.textures.get(cfg.key).getSourceImage().width / 2 - 3;
    const fruit = scene.matter.add.image(x, y, cfg.key, null, {
      shape: { type: 'circle', radius },
      restitution: 0.75,
      friction: 0.05,
      frictionAir: 0.005,
      density: cfg.density,
    });
    fruit.body.label = 'fruit';
    fruit.fruitType = type;
    fruit.setDepth(5);
    this.fruit = fruit;
    return fruit;
  }

  respawnFruit() {
    const scene = this.scene;
    if (this.fruit) {
      scene.props = scene.props.filter(p => p !== this.fruit);
      this.fruit.destroy();
      this.fruit = null;
    }

    const spawnX = Phaser.Math.Between(FRUIT_RESPAWN_X_MIN, scene.worldWidth - FRUIT_RESPAWN_X_MARGIN);
    const type = Phaser.Utils.Array.GetRandom(FRUIT_POOL);
    this.addFruit(spawnX, -100, type);
    if (scene.fruitArrow) scene.fruitArrow.setTint(FRUIT_CONFIGS[type].arrowTint);

    const angle = Math.random() * Math.PI * 2;
    const speed = Phaser.Math.FloatBetween(FRUIT_LAUNCH_SPEED_MIN, FRUIT_LAUNCH_SPEED_MAX);
    scene.matter.body.setVelocity(this.fruit.body, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
    scene.matter.body.setAngularVelocity(this.fruit.body, (Math.random() - 0.5) * 2 * FRUIT_LAUNCH_SPIN);

    scene.props.push(this.fruit);
  }

  updateFruitIdleTimer(delta) {
    const scene = this.scene;
    if (!this.fruit?.body) {
      this.fruitIdleTime = 0;
      scene.fruitIdleText?.setVisible(false);
      return;
    }

    const { x: vx, y: vy } = this.fruit.body.velocity;
    const speed = Math.sqrt(vx * vx + vy * vy);

    if (speed < FRUIT_IDLE_SPEED_THRESHOLD) {
      this.fruitIdleTime += delta * 0.001;
    } else {
      this.fruitIdleTime = 0;
      scene.fruitIdleText.setVisible(false);
      return;
    }

    const remaining = Math.max(0, FRUIT_IDLE_RESPAWN_DELAY - this.fruitIdleTime);

    if (remaining <= 5) {
      scene.fruitIdleText
        .setText(`Ball stuck — respawning in ${Math.ceil(remaining)}s`)
        .setVisible(true);
    } else {
      scene.fruitIdleText.setVisible(false);
    }

    if (this.fruitIdleTime >= FRUIT_IDLE_RESPAWN_DELAY) {
      this.fruitIdleTime = 0;
      scene.fruitIdleText.setVisible(false);
      this.respawnFruit();
    }
  }

  enforceFruitBounds() {
    const scene = this.scene;
    if (!this.fruit?.body) return;
    const margin = 200;
    const x = this.fruit.x;
    const y = this.fruit.y;
    if (x < -margin || x > scene.worldWidth + margin || y > WORLD_HEIGHT + margin) {
      this.respawnFruit();
    }
  }
}
