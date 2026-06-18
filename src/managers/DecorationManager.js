import Phaser from 'phaser';
import { TERRAIN_SLIDE_DURATION } from '../util/constants.js';

// Palm tree placement
const PALM_SPACING = 560;     // px between palm tree slots
const PALM_JITTER = 90;       // px of random horizontal offset per slot
const PALM_TREE_SCALE = 0.30;
const PALM_TREE_MARGIN = 60;  // px clearance around platform bands
const PALM_MIN_GAP = 300;     // minimum x distance between any two trees

// Bird animation
const BIRD_FLAP_INTERVAL = 180; // ms per frame

export default class DecorationManager {
  constructor(scene, terrain, platformSpawner) {
    this.scene = scene;
    this.terrain = terrain;
    this.platformSpawner = platformSpawner;
    this.palmTrees = [];
    this.clouds = [];
    this.birds = [];
  }

  // Full palm rebuild for restartLevel. Delegates to the chunk version.
  buildPalms() {
    if (this.palmTrees) {
      for (const t of this.palmTrees) t.destroy();
    }
    this.palmTrees = [];
    this.buildPalmsForChunk(0, this.scene.worldWidth);
  }

  // Adds palm trees for the [startX, endX] range, avoiding platform bands
  // and keeping a minimum gap from every already-placed tree.
  buildPalmsForChunk(startX, endX, animate = false) {
    const platformBands = (this.platformSpawner.platforms || []).map((p) => {
      const b = this.platformSpawner.getPlatformBounds(p.x, p.y, p.scaleX, p.angle);
      return { minX: b.minX - PALM_TREE_MARGIN, maxX: b.maxX + PALM_TREE_MARGIN };
    });

    const firstI = Math.floor(startX / PALM_SPACING);
    const lastI = Math.ceil(endX / PALM_SPACING) + 1;

    for (let i = firstI; i <= lastI; i++) {
      const x = Phaser.Math.Clamp(
        60 + i * PALM_SPACING + Phaser.Math.Between(-PALM_JITTER, PALM_JITTER),
        startX + 20,
        endX - 20,
      );

      const blocked = platformBands.some((b) => x >= b.minX && x <= b.maxX);
      if (blocked) continue;

      const tooClose = (this.palmTrees || []).some((t) => Math.abs(t.x - x) < PALM_MIN_GAP);
      if (tooClose) continue;

      const terrainY = this.terrain.getTerrainYAt(x);
      const finalY = terrainY + 80;
      const tree = this.scene.add
        .image(x, animate ? finalY + 600 : finalY, 'palmtree')
        .setOrigin(0.5, 1)
        .setScale(PALM_TREE_SCALE)
        .setDepth(0);
      if (animate) {
        this.scene.tweens.add({ targets: tree, y: finalY, duration: TERRAIN_SLIDE_DURATION, ease: 'Power2.Out' });
      }
      this.palmTrees.push(tree);
    }
  }

  createClouds() {
    this.clouds = [];
    const viewW = this.scene.cameras.main.width;
    // Six clouds with varied positions, scales, and drift speeds (px/sec).
    const specs = [
      { xFrac: 0.05, y: 70,  scale: 1.1, speed: 16 },
      { xFrac: 0.22, y: 110, scale: 1.4, speed: 11 },
      { xFrac: 0.40, y: 55,  scale: 0.9, speed: 20 },
      { xFrac: 0.57, y: 90,  scale: 1.2, speed: 14 },
      { xFrac: 0.73, y: 45,  scale: 1.0, speed: 18 },
      { xFrac: 0.90, y: 125, scale: 1.3, speed: 12 },
    ];
    for (const sp of specs) {
      const cloud = this.scene.add
        .image(sp.xFrac * viewW, sp.y, 'cloud')
        .setScrollFactor(0)
        .setScale(sp.scale)
        .setAlpha(0.82)
        .setDepth(-1);
      cloud._speed = sp.speed;
      this.clouds.push(cloud);
    }
  }

  createBirds() {
    const BIRD_COUNT = 5;
    const skyYMin = 60;
    const skyYMax = 280;
    this.birds = [];
    for (let i = 0; i < BIRD_COUNT; i++) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const cam = this.scene.cameras.main;
      const startX = cam.scrollX + Math.random() * cam.width;
      const bird = this.scene.add
        .image(startX, skyYMin + Math.random() * (skyYMax - skyYMin), 'toucan_1')
        .setDepth(2)
        .setScale(0.18)
        .setFlipX(dir < 0);
      bird._speed = 60 + Math.random() * 80;
      bird._dir = dir;
      bird._bobOffset = Math.random() * Math.PI * 2;
      bird._hitCooldown = 0;
      bird._flapTimer = Math.random() * 300; // stagger flap phase
      bird._flapFrame = 0;
      this.birds.push(bird);
    }
  }

  /**
   * Advances all bird sprites by one frame.
   *
   * Each bird:
   * - Moves horizontally at its own speed and gently bobs vertically.
   * - Alternates between toucan_1 and toucan_2 textures at BIRD_FLAP_INTERVAL ms
   *   per frame to simulate wing flapping.
   * - Wraps to the opposite edge of the camera view when it flies off-screen.
   * - After a cooldown, applies a small impulse to the fruit when the bird flies
   *   within HIT_RADIUS of it, making the fruit feel like a live environment
   *   rather than a static prop.
   *
   * @param {number} delta  Frame delta in milliseconds.
   */
  updateBirds(delta) {
    const cam = this.scene.cameras.main;
    const viewLeft  = cam.scrollX - 100;
    const viewRight = cam.scrollX + cam.width + 100;
    const skyYMin = 60;
    const skyYMax = 280;
    const BOB_AMP = 8;
    const BOB_FREQ = 0.0025;
    const HIT_RADIUS = 44;
    const BIRD_FORCE_X = 9;
    const BIRD_FORCE_Y = -5;

    const fruit = this.scene.fruit;

    for (const bird of this.birds) {
      // Move horizontally.
      bird.x += bird._dir * bird._speed * delta * 0.001;
      // Gentle vertical bob.
      bird.y += Math.sin(this.scene.time.now * BOB_FREQ + bird._bobOffset) * BOB_AMP * delta * 0.001;

      // Flap animation: alternate between the two toucan frames.
      bird._flapTimer += delta;
      if (bird._flapTimer >= BIRD_FLAP_INTERVAL) {
        bird._flapTimer -= BIRD_FLAP_INTERVAL;
        bird._flapFrame = 1 - bird._flapFrame;
        bird.setTexture(bird._flapFrame === 0 ? 'toucan_1' : 'toucan_2');
      }

      // Wrap to opposite side of the camera view when off-screen.
      if (bird._dir > 0 && bird.x > viewRight) {
        bird.x = viewLeft;
        bird.y = skyYMin + Math.random() * (skyYMax - skyYMin);
      } else if (bird._dir < 0 && bird.x < viewLeft) {
        bird.x = viewRight;
        bird.y = skyYMin + Math.random() * (skyYMax - skyYMin);
      }

      if (bird._hitCooldown > 0) {
        bird._hitCooldown -= delta;
        continue;
      }

      // Check proximity to fruit and apply an impulse if close enough.
      if (fruit?.body) {
        const dx = fruit.x - bird.x;
        const dy = fruit.y - bird.y;
        if (Math.sqrt(dx * dx + dy * dy) < HIT_RADIUS) {
          this.scene.matter.body.setVelocity(fruit.body, {
            x: fruit.body.velocity.x + bird._dir * BIRD_FORCE_X,
            y: fruit.body.velocity.y + BIRD_FORCE_Y,
          });
          this.scene.matter.body.setAngularVelocity(fruit.body, bird._dir * 0.3);
          bird._hitCooldown = 1200;
        }
      }
    }
  }

  updateClouds(delta) {
    const viewW = this.scene.cameras.main.width;
    for (const cloud of this.clouds) {
      cloud.x += cloud._speed * delta * 0.001;
      const halfW = (cloud.texture?.width ?? 64) * cloud.scaleX / 2;
      if (cloud.x - halfW > viewW) cloud.x = -halfW;
    }
  }
}
