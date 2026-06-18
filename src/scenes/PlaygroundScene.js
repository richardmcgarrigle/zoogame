import Phaser from 'phaser';
import { generatePlaceholderTextures, TEXTURE_SIZES } from '../util/textures.js';
import Elephant from '../objects/Elephant.js';
import TouchControls from '../objects/TouchControls.js';
import SoundManager from '../util/sounds.js';
import TerrainManager from '../managers/TerrainManager.js';
import PlatformSpawner from '../managers/PlatformSpawner.js';
import FruitManager, { FRUIT_CONFIGS } from '../managers/FruitManager.js';
import CollisionHandler from '../managers/CollisionHandler.js';
import UIManager from '../managers/UIManager.js';
import {
  WORLD_HEIGHT,
  AMPLITUDE_PER_SCORE,
  MAX_TERRAIN_AMPLITUDE,
  TERRAIN_SLIDE_DURATION,
} from '../util/constants.js';
import elephantCelebUrl  from '../assets/elephant_celebrate.png';
import elephantIdleUrl    from '../assets/elephant_idle_1.png';
import elephantRun1Url   from '../assets/elephant_run_1.png';
import elephantRun2Url   from '../assets/elephant_run_2.png';
import elephantJumpUpUrl from '../assets/elephant_jump_up.png';
import elephantJumpDnUrl from '../assets/elephant_jump_down.png';
import palmTreeUrl from '../assets/palmtree.png';
import toucan1Url from '../assets/toucan_flying_1.png';
import toucan2Url from '../assets/toucan_flying_2.png';

const BASE_WORLD_WIDTH = () => window.innerWidth;

const WIDTH_PER_SCORE = 300;

const FRUIT_SPAWN_X = 620;
const FRUIT_SPAWN_Y = 850;
const FRUIT_RESPAWN_DELAY = 1700;
const WALL_BOUNCE_MIN_SPEED = 4;

// Palm tree placement
const PALM_SPACING = 560;     // px between palm tree slots
const PALM_JITTER = 90;       // px of random horizontal offset per slot
const PALM_TREE_SCALE = 0.30;
const PALM_TREE_MARGIN = 60;  // px clearance around platform bands
const PALM_MIN_GAP = 300;     // minimum x distance between any two trees

// Bird animation
const BIRD_FLAP_INTERVAL = 180; // ms per frame

export default class PlaygroundScene extends Phaser.Scene {
  constructor() {
    super('PlaygroundScene');
  }

  // ── Convenience accessors delegating to UIManager ─────────────────────────

  get scoreText()        { return this.ui?.scoreText; }
  get fruitIdleText()    { return this.ui?.fruitIdleText; }
  get goalArrow()        { return this.ui?.goalArrow; }
  get fruitArrow()       { return this.ui?.fruitArrow; }
  get selectedPadIndex() { return this.ui?.selectedPadIndex ?? -1; }

  get fruit() {
    return this.fruitManager ? this.fruitManager.fruit : null;
  }

  set fruit(value) {
    if (this.fruitManager) this.fruitManager.fruit = value;
  }

  preload() {
    this.load.image('elephant_celebrate', elephantCelebUrl);
    this.load.image('elephant_idle',     elephantIdleUrl);
    this.load.image('elephant_run_1',    elephantRun1Url);
    this.load.image('elephant_run_2',    elephantRun2Url);
    this.load.image('elephant_jump_up',  elephantJumpUpUrl);
    this.load.image('elephant_jump_dn',  elephantJumpDnUrl);
    this.load.image('palmtree', palmTreeUrl);
    this.load.image('toucan_1', toucan1Url);
    this.load.image('toucan_2', toucan2Url);
  }

  create() {
    generatePlaceholderTextures(this);

    this.cameras.main.setBackgroundColor('#87ceeb');

    // Sky gradient: deep blue at top fading to warm sunny yellow-white at horizon.
    const skyGfx = this.add.graphics().setScrollFactor(0).setDepth(-2);
    const skyStops = [
      { y: 0,    color: 0x3a8fd4 },
      { y: 0.45, color: 0x6dbde8 },
      { y: 0.75, color: 0xaadcf5 },
      { y: 1.0,  color: 0xfff0b8 },
    ];
    const skyH = WORLD_HEIGHT;
    const skyW = 4096;
    for (let i = 0; i < skyStops.length - 1; i++) {
      const a = skyStops[i];
      const b = skyStops[i + 1];
      const y0 = Math.round(a.y * skyH);
      const y1 = Math.round(b.y * skyH);
      const steps = Math.max(1, y1 - y0);
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const r = Math.round(((a.color >> 16 & 0xff) * (1 - t) + (b.color >> 16 & 0xff) * t));
        const g = Math.round(((a.color >> 8  & 0xff) * (1 - t) + (b.color >> 8  & 0xff) * t));
        const bl = Math.round(((a.color       & 0xff) * (1 - t) + (b.color       & 0xff) * t));
        skyGfx.fillStyle((r << 16) | (g << 8) | bl, 1);
        skyGfx.fillRect(0, y0 + s, skyW, 1);
      }
    }

    this.score = 0;
    this.worldWidth = BASE_WORLD_WIDTH();

    this.terrain = new TerrainManager(this);
    this.platformSpawner = new PlatformSpawner(this, this.terrain);

    this.matter.world.setBounds(0, 0, this.worldWidth, WORLD_HEIGHT, 64, true, true, false, true);

    // Build ground first so getTerrainYAt is available for goal placement.
    this.terrain.buildGround();
    const goalX = this.worldWidth - 100;
    this.goal = this.addGoal(goalX, this.terrain.getTerrainYAt(goalX) - TEXTURE_SIZES.goal.height / 2);
    this.palmTrees = [];
    this.platformSpawner.buildPlatforms();
    this.buildPalms();

    this.fruitManager = new FruitManager(this);
    this.fruitManager.addFruit(FRUIT_SPAWN_X, FRUIT_SPAWN_Y);
    this.crates = [];
    const initialCrate = this.addCrate(950, 850);
    this.crates.push(initialCrate);
    this.props = [this.fruitManager.fruit, initialCrate];

    this.elephant = new Elephant(this, 180, 800);
    this.touchControls = new TouchControls(this);
    this.sounds = new SoundManager(this.sound.context);

    // Allow negative scrollY so the floor sits at the window bottom even
    // when the viewport is taller than WORLD_HEIGHT.
    this.cameras.main.setBounds(0, -5000, this.worldWidth, WORLD_HEIGHT + 5000);
    // lerpY=0 disables vertical follow — camera Y stays fixed.
    this.cameras.main.startFollow(this.elephant.sprite, true, 0.1, 0);
    this.cameras.main.scrollY = WORLD_HEIGHT - this.cameras.main.height;

    this.ui = new UIManager(this);
    this.createClouds();
    this.createBirds();

    this.scale.on('resize', (gameSize) => {
      this.cameras.main.setSize(gameSize.width, gameSize.height);
      this.cameras.main.scrollY = WORLD_HEIGHT - gameSize.height;
      this.ui.onResize(gameSize);
    });

    this.input.keyboard.on('keydown-R', () => this.restartLevel());

    this.collisionHandler = new CollisionHandler(this);
  }

  restartLevel() {
    this.terrain.buildGround();
    this.repositionGoal();
    this.platformSpawner.buildPlatforms();
    this.buildPalms();

    // Respawn props above the new terrain.
    const restartType = this.fruitManager.fruit?.fruitType ?? 'orange';
    if (this.fruitManager.fruit) this.fruitManager.fruit.destroy();
    this.fruitManager.fruit = null;
    this.fruitManager.addFruit(FRUIT_SPAWN_X, FRUIT_SPAWN_Y, restartType);
    this.ui.fruitArrow.setTint(FRUIT_CONFIGS[restartType].arrowTint);
    this.crates.forEach(c => c?.destroy());
    this.crates = [];
    const crateX = 950;
    const crateY = Math.min(850, this.terrain.getTerrainYAt(crateX) - TEXTURE_SIZES.crate.height / 2 - 1);
    const restartCrate = this.addCrate(crateX, crateY);
    this.crates.push(restartCrate);
    this.props = [this.fruitManager.fruit, restartCrate];

    // Reset elephant position and physics state above the new terrain.
    const spawnX = 180;
    const spawnY = Math.min(800, this.terrain.getTerrainYAt(spawnX) - this.elephant.sprite.displayHeight / 2 - 1);
    this.elephant.sprite.setPosition(spawnX, spawnY);
    this.elephant.sprite.setVelocity(0, 0);
    this.matter.body.setAngularVelocity(this.elephant.sprite.body, 0);
    this.elephant.groundContacts = 0;
  }

  /**
   * Amplifies the fruit's rebound velocity after a platform collision.
   *
   * By the time this is called Matter has already resolved the collision and the
   * fruit is moving away from the surface (vy < 0 for top-face hits, vy > 0 for
   * underside hits).  We scale that existing velocity up and enforce a floor so
   * even slow-moving fruit gets a satisfying spring effect.
   *
   * @param {MatterJS.Body} fruitBody  The fruit's physics body.
   */
  bounceFruitOffPlatform(fruitBody) {
    const vy = fruitBody.velocity.y;
    // After Matter resolves the collision the ball is already moving away from
    // the surface. Amplify that rebound so platforms feel springy.
    // vy < 0 = moving upward (bounced off top); vy > 0 = bounced off underside.
    if (Math.abs(vy) < 0.5) return;
    const BOOST = 1.5;
    const MIN_BOUNCE = 5;
    const boosted = Math.sign(vy) * Math.max(Math.abs(vy) * BOOST, MIN_BOUNCE);
    this.matter.body.setVelocity(fruitBody, { x: fruitBody.velocity.x, y: boosted });
  }

  bounceFruitOffWall(fruitBody, dir) {
    const vx = fruitBody.velocity.x;
    const pushedSpeed = Math.max(Math.abs(vx), WALL_BOUNCE_MIN_SPEED);
    this.matter.body.setVelocity(fruitBody, { x: dir * pushedSpeed, y: fruitBody.velocity.y });
    // Flip spin too, so rolling friction doesn't fight the new direction and
    // drag the ball back toward its old momentum after the bounce.
    this.matter.body.setAngularVelocity(fruitBody, -fruitBody.angularVelocity);
  }

  onGoalScored() {
    if (!this.fruitManager?.fruit || !this.fruitManager.fruit.body) return;

    this.score += 1;
    this.scoreText.setText(`Score: ${this.score}`);

    this.ui.flashScore();
    this.ui.showGoalAnimation();

    this.celebrateGoal(this.fruitManager.fruit.x, this.fruitManager.fruit.y);

    // Extend the world to the right; old terrain and platforms remain in place.
    this.extendWorld();

    this.props = this.props.filter((prop) => prop !== this.fruitManager.fruit);
    this.fruitManager.fruit.destroy();
    this.fruitManager.fruit = null;

    this.time.delayedCall(FRUIT_RESPAWN_DELAY, () => {
      this.fruitManager.respawnFruit();
    });

    // Drop score-many crates from the sky, staggered
    const crateCount = this.score;
    for (let i = 0; i < crateCount; i++) {
      this.time.delayedCall(FRUIT_RESPAWN_DELAY + i * 200, () => {
        const spawnX = Phaser.Math.Between(150, this.worldWidth - 150);
        const crate = this.addCrate(spawnX, -80);
        this.matter.body.setVelocity(crate.body, { x: (Math.random() - 0.5) * 4, y: 2 });
        this.matter.body.setAngularVelocity(crate.body, (Math.random() - 0.5) * 0.3);
        this.crates.push(crate);
        this.props.push(crate);
      });
    }
  }

  // Appends new terrain and content to the right. Old terrain is preserved.
  extendWorld() {
    const prevWidth = this.worldWidth;
    this.worldWidth = BASE_WORLD_WIDTH() + this.score * WIDTH_PER_SCORE;
    this.terrain.terrainAmplitude = Math.min(this.score * AMPLITUDE_PER_SCORE, MAX_TERRAIN_AMPLITUDE);

    this.matter.world.setBounds(0, 0, this.worldWidth, WORLD_HEIGHT, 64, true, true, false, true);
    this.cameras.main.setBounds(0, -5000, this.worldWidth, WORLD_HEIGHT + 5000);

    // Extend terrain first so getTerrainYAt works for the new chunk.
    const terrainTween = this.terrain.extendTerrain(prevWidth, this.worldWidth);

    // Slide the goal to its new position once the terrain reveal finishes.
    const newGoalX = this.worldWidth - 100;
    const newGoalY = this.terrain.getTerrainYAt(newGoalX) - TEXTURE_SIZES.goal.height / 2;
    terrainTween.on('complete', () => {
      this.tweens.add({
        targets: this.goal,
        x: newGoalX,
        y: newGoalY,
        duration: 900,
        ease: 'Power2.Out',
      });
    });

    // Seed placed bounds with the final goal position so platforms don't
    // land on top of where the goal is heading.
    const placedBounds = [{
      minX: newGoalX - TEXTURE_SIZES.goal.width / 2,
      maxX: newGoalX + TEXTURE_SIZES.goal.width / 2,
      minY: newGoalY - TEXTURE_SIZES.goal.height / 2,
      maxY: newGoalY + TEXTURE_SIZES.goal.height / 2,
    }];
    for (const p of this.platformSpawner.platforms) {
      placedBounds.push(this.platformSpawner.getPlatformBounds(p.x, p.y, p.scaleX, p.angle));
    }
    this.platformSpawner.buildPlatformsForChunk(prevWidth, this.worldWidth, placedBounds, true);
    this.buildPalmsForChunk(prevWidth, this.worldWidth, true);
  }

  repositionGoal() {
    const goalX = this.worldWidth - 100;
    const terrainY = this.terrain.getTerrainYAt(goalX);
    this.goal.setPosition(goalX, terrainY - TEXTURE_SIZES.goal.height / 2);
  }

  // Moves a sprite up so its bottom edge clears the terrain surface at its x.
  clampAboveTerrain(sprite) {
    const terrainY = this.terrain.getTerrainYAt(sprite.x);
    const halfH = sprite.displayHeight / 2;
    if (sprite.y + halfH > terrainY) {
      sprite.setPosition(sprite.x, terrainY - halfH - 1);
      if (sprite.body) this.matter.body.setVelocity(sprite.body, { x: 0, y: 0 });
    }
  }

  celebrateGoal(x, y) {
    const STAR_COUNT = 12;
    for (let i = 0; i < STAR_COUNT; i++) {
      const star = this.add.image(x, y, 'star').setDepth(20).setScale(0.4);
      const angle = (Math.PI * 2 * i) / STAR_COUNT + Math.random() * 0.4;
      const distance = 60 + Math.random() * 60;

      this.tweens.add({
        targets: star,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance - 20,
        scale: { from: 0.4, to: 1 },
        alpha: { from: 1, to: 0 },
        rotation: Math.random() * Math.PI * 2,
        duration: 500 + Math.random() * 200,
        ease: 'Cubic.easeOut',
        onComplete: () => star.destroy(),
      });
    }
  }

  addCrate(x, y) {
    const crate = this.matter.add.image(x, y, 'crate', null, {
      restitution: 0.35,
      friction: 0.2,
      frictionAir: 0.01,
      density: 0.0015,
    });
    crate.body.label = 'crate';
    crate.setDepth(5);
    return crate;
  }

  explodeCrate(crateObj) {
    if (!crateObj || !crateObj.active) return;
    const x = crateObj.x;
    const y = crateObj.y;

    // Spawn debris rectangles that fly outward and fade
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 200 + Math.random() * 300;
      const size = 8 + Math.random() * 14;
      const debris = this.add.rectangle(x, y, size, size, 0x8b5e3c).setDepth(8);
      this.tweens.add({
        targets: debris,
        x: x + Math.cos(angle) * speed * 0.5,
        y: y + Math.sin(angle) * speed * 0.5 - 60,
        angle: Math.random() * 360,
        alpha: 0,
        duration: 500 + Math.random() * 300,
        ease: 'Power2',
        onComplete: () => debris.destroy(),
      });
    }

    // Flash ring
    const flash = this.add.circle(x, y, 40, 0xffdd44, 0.8).setDepth(9);
    this.tweens.add({
      targets: flash,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 250,
      onComplete: () => flash.destroy(),
    });

    this.sounds?.playCrateBreak();
    crateObj.destroy();
    this.crates = this.crates.filter(c => c !== crateObj);
    this.props = this.props.filter(p => p !== crateObj);
  }

  addGoal(x, y) {
    const goal = this.matter.add.image(x, y, 'goal', null, { isStatic: true, isSensor: true });
    goal.body.label = 'goal';
    goal.setDepth(4);
    return goal;
  }

  // Full palm rebuild for restartLevel. Delegates to the chunk version.
  buildPalms() {
    if (this.palmTrees) {
      for (const t of this.palmTrees) t.destroy();
    }
    this.palmTrees = [];
    this.buildPalmsForChunk(0, this.worldWidth);
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
      const tree = this.add
        .image(x, animate ? finalY + 600 : finalY, 'palmtree')
        .setOrigin(0.5, 1)
        .setScale(PALM_TREE_SCALE)
        .setDepth(0);
      if (animate) {
        this.tweens.add({ targets: tree, y: finalY, duration: TERRAIN_SLIDE_DURATION, ease: 'Power2.Out' });
      }
      this.palmTrees.push(tree);
    }
  }

  createClouds() {
    this.clouds = [];
    const viewW = this.cameras.main.width;
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
      const cloud = this.add
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
      const cam = this.cameras.main;
      const startX = cam.scrollX + Math.random() * cam.width;
      const bird = this.add
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
    const cam = this.cameras.main;
    const viewLeft  = cam.scrollX - 100;
    const viewRight = cam.scrollX + cam.width + 100;
    const skyYMin = 60;
    const skyYMax = 280;
    const BOB_AMP = 8;
    const BOB_FREQ = 0.0025;
    const HIT_RADIUS = 44;
    const BIRD_FORCE_X = 9;
    const BIRD_FORCE_Y = -5;

    for (const bird of this.birds) {
      // Move horizontally.
      bird.x += bird._dir * bird._speed * delta * 0.001;
      // Gentle vertical bob.
      bird.y += Math.sin(this.time.now * BOB_FREQ + bird._bobOffset) * BOB_AMP * delta * 0.001;

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
      if (this.fruit?.body) {
        const dx = this.fruit.x - bird.x;
        const dy = this.fruit.y - bird.y;
        if (Math.sqrt(dx * dx + dy * dy) < HIT_RADIUS) {
          this.matter.body.setVelocity(this.fruit.body, {
            x: this.fruit.body.velocity.x + bird._dir * BIRD_FORCE_X,
            y: this.fruit.body.velocity.y + BIRD_FORCE_Y,
          });
          this.matter.body.setAngularVelocity(this.fruit.body, bird._dir * 0.3);
          bird._hitCooldown = 1200;
        }
      }
    }
  }

  updateClouds(delta) {
    const viewW = this.cameras.main.width;
    for (const cloud of this.clouds) {
      cloud.x += cloud._speed * delta * 0.001;
      const halfW = (TEXTURE_SIZES.cloud.width * cloud.scaleX) / 2;
      if (cloud.x - halfW > viewW) cloud.x = -halfW;
    }
  }

  update(time, delta) {
    this.elephant.update(time, delta, this.props);
    this.touchControls.postUpdate();
    this.ui.updateIndicatorArrows();
    this.updateClouds(delta);
    this.updateBirds(delta);
    this.fruitManager.updateFruitIdleTimer(delta);
    this.fruitManager.enforceFruitBounds();
  }
}
