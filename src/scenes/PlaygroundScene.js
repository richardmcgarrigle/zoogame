import Phaser from 'phaser';
import { generatePlaceholderTextures, TEXTURE_SIZES } from '../util/textures.js';
import Elephant from '../objects/Elephant.js';
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
const WORLD_HEIGHT = 1000;
const GROUND_HEIGHT = 90;
const GROUND_SURFACE_Y = WORLD_HEIGHT - GROUND_HEIGHT;
const GROUND_DEPTH = GROUND_HEIGHT + 60;
const TERRAIN_SEGMENT_WIDTH = 60;

const WIDTH_PER_SCORE = 300;
const AMPLITUDE_PER_SCORE = 12;
const MAX_TERRAIN_AMPLITUDE = 100;

const PLATFORM_BASE_COUNT = 3;
const PLATFORM_PER_SCORE = 0.5;
const PLATFORM_MAX_COUNT = 10;
const PLATFORM_MIN_SCALE = 0.6;
const PLATFORM_MAX_SCALE = 1.4;
const PLATFORM_ANGLE_PER_SCORE = 2;
const PLATFORM_MAX_ANGLE = 25;
const PLATFORM_MARGIN_X = 150;
const PLATFORM_MIN_Y = 250;
// Elephant sprite is ~90px tall at BODY_SCALE; leave enough headroom below a
// platform's lowest edge for it to walk underneath without colliding.
const ELEPHANT_CLEARANCE = 110;
const PLATFORM_MAX_Y = GROUND_SURFACE_Y - ELEPHANT_CLEARANCE - (TEXTURE_SIZES.platformLeaf.height * PLATFORM_MAX_SCALE) / 2;

// Keep consecutive platforms within the elephant's jump (with glide) reach.
const PLATFORM_GAP_X_MIN = 100;
const PLATFORM_GAP_X_MAX = 220;
const PLATFORM_GAP_Y_MAX = 140;
// Keep the first platform low enough that it's reachable with a jump straight
// from the ground (no prior platform to hop from).
const PLATFORM_GAP_Y_MIN_FROM_GROUND = 40;
// Probability that a platform starts a new cluster root (ground-anchored)
// rather than chaining from the previous platform.
const PLATFORM_NEW_ROOT_CHANCE = 0.3;
// Minimum gap left between a platform and the terrain/other platforms so
// none of them visually or physically intersect.
const PLATFORM_OVERLAP_BUFFER = 12;
const PLATFORM_PLACEMENT_ATTEMPTS = 20;

const OUTLINE = 0x1a1a1a;
const OUTLINE_WIDTH = 6;

const FRUIT_SPAWN_X = 620;
const FRUIT_SPAWN_Y = 850;
const FRUIT_RESPAWN_DELAY = 700;
const FRUIT_RESPAWN_X_MIN = 150;
const FRUIT_RESPAWN_X_MARGIN = 150;
const FRUIT_LAUNCH_SPEED_MIN = 4;
const FRUIT_LAUNCH_SPEED_MAX = 12;
const FRUIT_LAUNCH_SPIN = 0.6;
const WALL_BOUNCE_MIN_SPEED = 4;

// Fruit types available for random spawning. Melon is rarer and heavier.
const FRUIT_CONFIGS = {
  orange: { key: 'orange', density: 0.0006, arrowTint: 0xff8c3c },
  apple:  { key: 'apple',  density: 0.0006, arrowTint: 0xd42b22 },
  melon:  { key: 'melon',  density: 0.0010, arrowTint: 0x5cb82e },
};
const FRUIT_POOL = ['orange', 'orange', 'apple', 'apple', 'melon'];

export default class PlaygroundScene extends Phaser.Scene {
  constructor() {
    super('PlaygroundScene');
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
    const skyGfx = this.add.graphics().setScrollFactor(0).setDepth(-1);
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
    this.terrainAmplitude = 0;

    this.matter.world.setBounds(0, 0, this.worldWidth, WORLD_HEIGHT, 64, true, true, false, true);

    // Build ground first so getTerrainYAt is available for goal placement.
    this.buildGround();
    const goalX = this.worldWidth - 100;
    this.goal = this.addGoal(goalX, this.getTerrainYAt(goalX) - TEXTURE_SIZES.goal.height / 2);
    this.buildPlatforms();
    this.buildPalms();

    this.fruit = this.addFruit(FRUIT_SPAWN_X, FRUIT_SPAWN_Y);
    this.crate = this.addCrate(950, 850);
    this.props = [this.fruit, this.crate];

    this.elephant = new Elephant(this, 180, 800);

    // Allow negative scrollY so the floor sits at the window bottom even
    // when the viewport is taller than WORLD_HEIGHT.
    this.cameras.main.setBounds(0, -5000, this.worldWidth, WORLD_HEIGHT + 5000);
    // lerpY=0 disables vertical follow — camera Y stays fixed.
    this.cameras.main.startFollow(this.elephant.sprite, true, 0.1, 0);
    this.cameras.main.scrollY = WORLD_HEIGHT - this.cameras.main.height;

    this.createIndicatorArrows();
    this.createClouds();
    this.createBirds();
    this.createControllerDropdown();

    this.scale.on('resize', (gameSize) => {
      this.cameras.main.setSize(gameSize.width, gameSize.height);
      this.cameras.main.scrollY = WORLD_HEIGHT - gameSize.height;
      this.scoreText.setX(gameSize.width - 12);
    });

    this.add
      .text(12, 12, 'Move: Arrows/AD  Jump: Up/W  Dash: Space/Square (hold)  Glide: Shift (hold in air)  Swat: X  Restart: R', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#1a1a1a',
        backgroundColor: '#ffffffaa',
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.scoreText = this.add
      .text(this.scale.width - 12, 12, 'Score: 0', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#1a1a1a',
        backgroundColor: '#ffffffaa',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.input.keyboard.on('keydown-R', () => this.restartLevel());

    this.matter.world.on('collisionstart', (event) => {
      const walls = this.matter.world.walls;
      for (const pair of event.pairs) {
        const { bodyA, bodyB } = pair;
        const labels = [bodyA.label, bodyB.label];
        if (labels.includes('fruit') && labels.includes('goal')) {
          this.onGoalScored();
        }

        if (labels.includes('fruit') && labels.includes('platform')) {
          const fruitBody = bodyA.label === 'fruit' ? bodyA : bodyB;
          this.bounceFruitOffPlatform(fruitBody);
        }

        if (bodyA.label === 'fruit' || bodyB.label === 'fruit') {
          const fruitBody = bodyA.label === 'fruit' ? bodyA : bodyB;
          const otherBody = fruitBody === bodyA ? bodyB : bodyA;
          if (otherBody === walls.left || otherBody === walls.right) {
            this.bounceFruitOffWall(fruitBody, otherBody === walls.left ? 1 : -1);
          }
        }
      }
    });
  }

  restartLevel() {
    this.buildGround();
    this.repositionGoal();
    this.buildPlatforms();
    this.buildPalms();

    // Respawn props above the new terrain.
    if (this.fruit) this.fruit.destroy();
    const restartType = this.fruit?.fruitType ?? 'orange';
    this.fruit = this.addFruit(FRUIT_SPAWN_X, FRUIT_SPAWN_Y, restartType);
    this.fruitArrow.setTint(FRUIT_CONFIGS[restartType].arrowTint);
    if (this.crate) this.crate.destroy();
    const crateX = 950;
    const crateY = Math.min(850, this.getTerrainYAt(crateX) - TEXTURE_SIZES.crate.height / 2 - 1);
    this.crate = this.addCrate(crateX, crateY);
    this.props = [this.fruit, this.crate];

    // Reset elephant position and physics state above the new terrain.
    const spawnX = 180;
    const spawnY = Math.min(800, this.getTerrainYAt(spawnX) - this.elephant.sprite.displayHeight / 2 - 1);
    this.elephant.sprite.setPosition(spawnX, spawnY);
    this.elephant.sprite.setVelocity(0, 0);
    this.matter.body.setAngularVelocity(this.elephant.sprite.body, 0);
    this.elephant.groundContacts = 0;
  }

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
    if (!this.fruit || !this.fruit.body) return;

    this.score += 1;
    this.scoreText.setText(`Score: ${this.score}`);

    // Flash the score text
    let flashes = 0;
    const flashTimer = this.time.addEvent({
      delay: 120,
      repeat: 9,
      callback: () => {
        flashes++;
        this.scoreText.setVisible(flashes % 2 === 0);
      },
      callbackScope: this,
    });
    this.time.delayedCall(1200, () => {
      flashTimer.remove();
      this.scoreText.setVisible(true);
    });

    // Show big GOAL! text in the centre of the screen
    const { width, height } = this.scale;
    const goalLabel = this.add
      .text(width / 2, height / 2, 'GOAL!', {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: '120px',
        color: '#ffffff',
        stroke: '#e63c00',
        strokeThickness: 10,
        shadow: { offsetX: 4, offsetY: 4, color: '#000', blur: 8, fill: true },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200)
      .setAlpha(0);

    this.tweens.add({
      targets: goalLabel,
      alpha: { from: 0, to: 1 },
      scaleX: { from: 0.5, to: 1 },
      scaleY: { from: 0.5, to: 1 },
      duration: 250,
      ease: 'Back.Out',
      yoyo: false,
      onComplete: () => {
        this.tweens.add({
          targets: goalLabel,
          alpha: 0,
          scaleX: 1.3,
          scaleY: 1.3,
          delay: 700,
          duration: 400,
          ease: 'Power2',
          onComplete: () => goalLabel.destroy(),
        });
      },
    });

    this.celebrateGoal(this.fruit.x, this.fruit.y);
    this.growWorld();
    this.buildGround();
    // Old ground bodies were all destroyed; existing collisions with them are
    // gone but Matter won't fire collisionend, so reset groundContacts manually.
    this.elephant.groundContacts = 0;
    this.clampAboveTerrain(this.elephant.sprite);
    if (this.crate && this.crate.body) this.clampAboveTerrain(this.crate);
    this.repositionGoal();
    this.buildPlatforms();
    this.buildPalms();

    this.props = this.props.filter((prop) => prop !== this.fruit);
    this.fruit.destroy();
    this.fruit = null;

    this.time.delayedCall(FRUIT_RESPAWN_DELAY, () => {
      const spawnX = Phaser.Math.Between(FRUIT_RESPAWN_X_MIN, this.worldWidth - FRUIT_RESPAWN_X_MARGIN);
      const type = Phaser.Utils.Array.GetRandom(FRUIT_POOL);
      this.fruit = this.addFruit(spawnX, -100, type);
      this.fruitArrow.setTint(FRUIT_CONFIGS[type].arrowTint);

      const angle = Math.random() * Math.PI * 2;
      const speed = Phaser.Math.FloatBetween(FRUIT_LAUNCH_SPEED_MIN, FRUIT_LAUNCH_SPEED_MAX);
      this.matter.body.setVelocity(this.fruit.body, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
      this.matter.body.setAngularVelocity(this.fruit.body, (Math.random() - 0.5) * 2 * FRUIT_LAUNCH_SPIN);

      this.props.push(this.fruit);
    });
  }

  // Widens the world and ramps up terrain extremes as the score grows; starts
  // flat and at base width at score 0.
  growWorld() {
    this.worldWidth = BASE_WORLD_WIDTH() + this.score * WIDTH_PER_SCORE;
    this.terrainAmplitude = Math.min(this.score * AMPLITUDE_PER_SCORE, MAX_TERRAIN_AMPLITUDE);

    this.matter.world.setBounds(0, 0, this.worldWidth, WORLD_HEIGHT, 64, true, true, false, true);
    this.cameras.main.setBounds(0, -5000, this.worldWidth, WORLD_HEIGHT + 5000);
    this.cameras.main.scrollY = WORLD_HEIGHT - this.cameras.main.height;
  }

  repositionGoal() {
    const goalX = this.worldWidth - 100;
    const terrainY = this.getTerrainYAt(goalX);
    this.goal.setPosition(goalX, terrainY - TEXTURE_SIZES.goal.height / 2);
  }

  // Random leaf platforms: count, size, angle and position all widen their
  // range as the score grows, so the level reads as more chaotic over time.
  buildPlatforms() {
    if (this.platforms) {
      for (const platform of this.platforms) {
        this.matter.world.remove(platform.body);
        platform.destroy();
      }
    }

    const count = Math.min(
      PLATFORM_BASE_COUNT + Math.floor(this.score * PLATFORM_PER_SCORE),
      PLATFORM_MAX_COUNT,
    );
    const maxAngle = Math.min(this.score * PLATFORM_ANGLE_PER_SCORE, PLATFORM_MAX_ANGLE);

    // Chain each platform off the previous one within a bounded gap, so
    // every platform is always within jumping/gliding reach of the last.
    this.platforms = [];
    // Seed placedBounds with the goal so platforms can never cover it.
    const goalHalfW = TEXTURE_SIZES.goal.width / 2;
    const goalHalfH = TEXTURE_SIZES.goal.height / 2;
    const placedBounds = [
      {
        minX: this.goal.x - goalHalfW,
        maxX: this.goal.x + goalHalfW,
        minY: this.goal.y - goalHalfH,
        maxY: this.goal.y + goalHalfH,
      },
    ];
    const firstX = Phaser.Math.Between(PLATFORM_MARGIN_X, PLATFORM_MARGIN_X + PLATFORM_GAP_X_MAX);
    let x = firstX;
    let y = GROUND_SURFACE_Y;
    // Tracks whether the next platform should anchor to a new cluster root
    // rather than chaining from the previous one.
    let newRoot = false;

    for (let i = 0; i < count; i++) {
      const prevX = x;
      const prevY = y;
      const isRoot = i === 0 || newRoot;
      newRoot = Math.random() < PLATFORM_NEW_ROOT_CHANCE;
      const scale = Phaser.Math.FloatBetween(PLATFORM_MIN_SCALE, PLATFORM_MAX_SCALE);
      const angle = Phaser.Math.Between(-maxAngle, maxAngle);

      // Compute the rotated half-height for this specific scale+angle so the
      // candidateY clamp accounts for how far the platform's bottom edge
      // actually reaches (angled platforms extend lower than their centre).
      const refBounds = this.getPlatformBounds(0, 0, scale, angle);
      const rotatedHalfH = (refBounds.maxY - refBounds.minY) / 2;
      const rotatedHalfW = (refBounds.maxX - refBounds.minX) / 2;
      const effectiveMaxY = GROUND_SURFACE_Y - ELEPHANT_CLEARANCE - rotatedHalfH;

      // Try a few candidate positions and keep the first one that doesn't
      // poke through the terrain or overlap an already-placed platform;
      // fall back to the least-overlapping candidate if none are clear.
      let bestX = null;
      let bestY = null;
      let bestBounds = null;
      let bestOverlap = Infinity;

      for (let attempt = 0; attempt < PLATFORM_PLACEMENT_ATTEMPTS; attempt++) {
        const candidateX = isRoot
          ? this.pickRootX(placedBounds, rotatedHalfW)
          : Phaser.Math.Clamp(
              prevX + Phaser.Math.Between(PLATFORM_GAP_X_MIN, PLATFORM_GAP_X_MAX),
              PLATFORM_MARGIN_X,
              this.worldWidth - PLATFORM_MARGIN_X,
            );
        const candidateY = isRoot
          ? Phaser.Math.Clamp(
              GROUND_SURFACE_Y - Phaser.Math.Between(PLATFORM_GAP_Y_MIN_FROM_GROUND, PLATFORM_GAP_Y_MAX),
              PLATFORM_MIN_Y,
              effectiveMaxY,
            )
          : Phaser.Math.Clamp(
              prevY + Phaser.Math.Between(-PLATFORM_GAP_Y_MAX, PLATFORM_GAP_Y_MAX),
              PLATFORM_MIN_Y,
              effectiveMaxY,
            );

        const bounds = this.getPlatformBounds(candidateX, candidateY, scale, angle);
        const overlap = this.platformOverlapAmount(bounds, placedBounds);

        if (overlap === 0) {
          bestX = candidateX;
          bestY = candidateY;
          bestBounds = bounds;
          break;
        }
        if (overlap < bestOverlap) {
          bestOverlap = overlap;
          bestX = candidateX;
          bestY = candidateY;
          bestBounds = bounds;
        }
      }

      // If random attempts left an overlap, resolve it deterministically by
      // nudging the platform away from the ground and/or the overlapping
      // platform, just enough to clear it.
      let candX = bestX;
      let candY = bestY;
      let candBounds = bestBounds;

      for (let iter = 0; iter < 30; iter++) {
        const groundY = this.minTerrainYInRange(candBounds.minX, candBounds.maxX);
        // Bottom edge must be ELEPHANT_CLEARANCE above the ground.
        const groundPenetration = candBounds.maxY + ELEPHANT_CLEARANCE - groundY;
        if (groundPenetration > 0) {
          const newY = Phaser.Math.Clamp(candY - groundPenetration, PLATFORM_MIN_Y, effectiveMaxY);
          if (newY === candY) break;
          candY = newY;
          candBounds = this.getPlatformBounds(candX, candY, scale, angle);
          continue;
        }

        // Pick the worst culprit (highest violation score) so resolution
        // converges instead of oscillating between partially-fixed pairs.
        let culprit = null;
        let culpritScore = 0;
        for (const other of placedBounds) {
          const xOverlap = Math.min(candBounds.maxX, other.maxX) - Math.max(candBounds.minX, other.minX) + PLATFORM_OVERLAP_BUFFER;
          const yOverlap = Math.min(candBounds.maxY, other.maxY) - Math.max(candBounds.minY, other.minY);
          if (xOverlap > 0 && yOverlap > -ELEPHANT_CLEARANCE) {
            const score = xOverlap * (yOverlap + ELEPHANT_CLEARANCE);
            if (score > culpritScore) {
              culprit = { other, xOverlap, yOverlap };
              culpritScore = score;
            }
          }
        }
        if (!culprit) break;

        // Compute exact escape targets along all 4 axes (±y, ±x) using actual
        // half-extents so one step fully resolves the culprit regardless of
        // clamping direction. Try all four, pick whichever lowers total overlap
        // most — this avoids oscillation when one direction is blocked by bounds.
        const candHalfH = (candBounds.maxY - candBounds.minY) / 2;
        const candHalfW = (candBounds.maxX - candBounds.minX) / 2;
        const otherHalfH = (culprit.other.maxY - culprit.other.minY) / 2;
        const otherHalfW = (culprit.other.maxX - culprit.other.minX) / 2;
        const otherCX = (culprit.other.minX + culprit.other.maxX) / 2;
        const otherCY = (culprit.other.minY + culprit.other.maxY) / 2;
        const sepY = otherHalfH + candHalfH + ELEPHANT_CLEARANCE;
        const sepX = otherHalfW + candHalfW + PLATFORM_OVERLAP_BUFFER;

        const escapes = [
          { x: candX, y: Phaser.Math.Clamp(otherCY + sepY, PLATFORM_MIN_Y, effectiveMaxY) },
          { x: candX, y: Phaser.Math.Clamp(otherCY - sepY, PLATFORM_MIN_Y, effectiveMaxY) },
          { x: Phaser.Math.Clamp(otherCX + sepX, PLATFORM_MARGIN_X, this.worldWidth - PLATFORM_MARGIN_X), y: candY },
          { x: Phaser.Math.Clamp(otherCX - sepX, PLATFORM_MARGIN_X, this.worldWidth - PLATFORM_MARGIN_X), y: candY },
        ];

        let bestEscape = null;
        let bestEscapeOverlap = Infinity;
        let bestEscapeBounds = null;
        for (const esc of escapes) {
          if (esc.x === candX && esc.y === candY) continue;
          const eb = this.getPlatformBounds(esc.x, esc.y, scale, angle);
          const eo = this.platformOverlapAmount(eb, placedBounds);
          if (eo < bestEscapeOverlap) {
            bestEscapeOverlap = eo;
            bestEscape = esc;
            bestEscapeBounds = eb;
          }
        }
        if (!bestEscape) break;
        candX = bestEscape.x;
        candY = bestEscape.y;
        candBounds = bestEscapeBounds;
      }

      x = candX;
      y = candY;
      placedBounds.push(candBounds);

      const platform = this.addStaticPlatform(x, y, 'platformLeaf');
      platform.setScale(scale);
      platform.setAngle(angle);
      this.platforms.push(platform);
    }
  }

  // Axis-aligned bounding box of a platform, accounting for its rotation.
  getPlatformBounds(x, y, scale, angleDeg) {
    const w = TEXTURE_SIZES.platformLeaf.width * scale;
    const h = TEXTURE_SIZES.platformLeaf.height * scale;
    const rad = Phaser.Math.DEG_TO_RAD * angleDeg;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const halfW = (w * cos + h * sin) / 2;
    const halfH = (w * sin + h * cos) / 2;
    return { minX: x - halfW, maxX: x + halfW, minY: y - halfH, maxY: y + halfH };
  }

  // Returns 0 if `bounds` clears the terrain and all `others` by at least
  // ELEPHANT_CLEARANCE; positive "how bad" score otherwise.
  platformOverlapAmount(bounds, others) {
    let overlap = 0;

    // Platform's bottom edge must be at least ELEPHANT_CLEARANCE above ground.
    // Sample the terrain densely across the full platform width to catch peaks.
    const groundY = this.minTerrainYInRange(bounds.minX, bounds.maxX);
    const groundPenetration = bounds.maxY + ELEPHANT_CLEARANCE - groundY;
    if (groundPenetration > 0) overlap += groundPenetration;

    for (const other of others) {
      const xOverlap = Math.min(bounds.maxX, other.maxX) - Math.max(bounds.minX, other.minX) + PLATFORM_OVERLAP_BUFFER;
      // yOverlap > 0 → physical intersection; yOverlap in (-ELEPHANT_CLEARANCE, 0] →
      // platforms clear each other but the gap is too tight for the elephant to fit.
      const yOverlap = Math.min(bounds.maxY, other.maxY) - Math.max(bounds.minY, other.minY);
      if (xOverlap > 0 && yOverlap > -ELEPHANT_CLEARANCE) {
        overlap += xOverlap * (yOverlap + ELEPHANT_CLEARANCE);
      }
    }

    return overlap;
  }

  // Picks a root-cluster x that avoids existing platform x-ranges where possible.
  pickRootX(placedBounds, halfW) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const cx = Phaser.Math.Between(PLATFORM_MARGIN_X, this.worldWidth - PLATFORM_MARGIN_X);
      const xLeft = cx - halfW;
      const xRight = cx + halfW;
      const blocked = placedBounds.some(
        (other) => xLeft < other.maxX + PLATFORM_OVERLAP_BUFFER && xRight > other.minX - PLATFORM_OVERLAP_BUFFER,
      );
      if (!blocked) return cx;
    }
    return Phaser.Math.Between(PLATFORM_MARGIN_X, this.worldWidth - PLATFORM_MARGIN_X);
  }

  // Samples terrain across [minX, maxX] and returns the minimum y (highest
  // ground point) — used to guarantee clearance over the whole platform width.
  minTerrainYInRange(minX, maxX) {
    let min = Infinity;
    const step = Math.max(1, (maxX - minX) / 8);
    for (let sx = minX; sx <= maxX + step; sx += step) {
      min = Math.min(min, this.getTerrainYAt(Math.min(sx, maxX)));
    }
    return min;
  }

  // Moves a sprite up so its bottom edge clears the terrain surface at its x.
  clampAboveTerrain(sprite) {
    const terrainY = this.getTerrainYAt(sprite.x);
    const halfH = sprite.displayHeight / 2;
    if (sprite.y + halfH > terrainY) {
      sprite.setPosition(sprite.x, terrainY - halfH - 1);
      if (sprite.body) this.matter.body.setVelocity(sprite.body, { x: 0, y: 0 });
    }
  }

  // Interpolates the terrain height profile to find the ground y at a given x.
  getTerrainYAt(x) {
    const points = this.terrainPoints;
    const clampedX = Phaser.Math.Clamp(x, points[0].x, points[points.length - 1].x);
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      if (clampedX >= p1.x && clampedX <= p2.x) {
        const t = (clampedX - p1.x) / (p2.x - p1.x);
        return p1.y + (p2.y - p1.y) * t;
      }
    }
    return GROUND_SURFACE_Y;
  }

  // Builds a random rolling-hills terrain: a smooth height profile rendered
  // with a spline, backed by a chain of angled static rectangle bodies so
  // the ball rolls naturally across slopes instead of catching on edges.
  buildGround() {
    if (this.groundBodies) {
      for (const body of this.groundBodies) this.matter.world.remove(body);
    }
    if (this.groundGraphics) this.groundGraphics.destroy();

    const points = this.generateTerrainHeights();
    this.terrainPoints = points;
    this.groundBodies = [];

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const segLength = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const offset = GROUND_DEPTH / 2;
      const cx = midX - Math.sin(angle) * offset;
      const cy = midY + Math.cos(angle) * offset;

      const body = this.matter.add.rectangle(cx, cy, segLength, GROUND_DEPTH, { isStatic: true });
      this.matter.body.setAngle(body, angle);
      body.label = 'ground';
      this.groundBodies.push(body);
    }

    this.drawGroundGraphics(points);
  }

  generateTerrainHeights() {
    const segments = Math.max(1, Math.round(this.worldWidth / TERRAIN_SEGMENT_WIDTH));
    const amplitude = this.terrainAmplitude;

    const freq1 = 1 + Math.random() * 1.5;
    const freq2 = 2.5 + Math.random() * 2;
    const phase1 = Math.random() * Math.PI * 2;
    const phase2 = Math.random() * Math.PI * 2;
    const amp1 = amplitude * (0.5 + Math.random() * 0.5);
    const amp2 = amplitude * 0.35 * Math.random();

    const points = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = Math.min(
        GROUND_SURFACE_Y +
          amp1 * Math.sin(t * Math.PI * 2 * freq1 + phase1) +
          amp2 * Math.sin(t * Math.PI * 2 * freq2 + phase2),
        WORLD_HEIGHT - 10
      );
      points.push({ x: (this.worldWidth * i) / segments, y });
    }
    return points;
  }

  drawGroundGraphics(points) {
    this.groundGraphics = this.add.graphics().setDepth(1);

    const splinePoints = points.map((p) => new Phaser.Math.Vector2(p.x, p.y));
    const curve = new Phaser.Curves.Spline(splinePoints);
    const smooth = curve.getPoints(points.length * 8);

    this.groundGraphics.fillStyle(0x4f7a3a, 1);
    this.groundGraphics.beginPath();
    this.groundGraphics.moveTo(0, WORLD_HEIGHT);
    for (const p of smooth) this.groundGraphics.lineTo(p.x, p.y);
    this.groundGraphics.lineTo(this.worldWidth, WORLD_HEIGHT);
    this.groundGraphics.closePath();
    this.groundGraphics.fillPath();

    this.groundGraphics.fillStyle(0x6fae4f, 1);
    this.groundGraphics.beginPath();
    this.groundGraphics.moveTo(smooth[0].x, smooth[0].y);
    for (const p of smooth) this.groundGraphics.lineTo(p.x, p.y);
    for (let i = smooth.length - 1; i >= 0; i--) this.groundGraphics.lineTo(smooth[i].x, smooth[i].y + 18);
    this.groundGraphics.closePath();
    this.groundGraphics.fillPath();

    this.groundGraphics.lineStyle(OUTLINE_WIDTH, OUTLINE, 1);
    this.groundGraphics.beginPath();
    this.groundGraphics.moveTo(smooth[0].x, smooth[0].y);
    for (const p of smooth) this.groundGraphics.lineTo(p.x, p.y);
    this.groundGraphics.strokePath();
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

  addStaticPlatform(x, y, textureKey) {
    const platform = this.matter.add.image(x, y, textureKey, null, { isStatic: true });
    platform.body.label = 'platform';
    platform.setDepth(3);
    return platform;
  }

  addFruit(x, y, type = 'orange') {
    const cfg = FRUIT_CONFIGS[type];
    const radius = this.textures.get(cfg.key).getSourceImage().width / 2 - 3;
    const fruit = this.matter.add.image(x, y, cfg.key, null, {
      shape: { type: 'circle', radius },
      restitution: 0.75,
      friction: 0.05,
      frictionAir: 0.005,
      density: cfg.density,
    });
    fruit.body.label = 'fruit';
    fruit.fruitType = type;
    fruit.setDepth(5);
    return fruit;
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

  addGoal(x, y) {
    const goal = this.matter.add.image(x, y, 'goal', null, { isStatic: true, isSensor: true });
    goal.body.label = 'goal';
    goal.setDepth(4);
    return goal;
  }

  buildPalms() {
    if (this.palmTrees) {
      for (const t of this.palmTrees) t.destroy();
    }
    this.palmTrees = [];

    // Compute X bands occupied by platforms so trees avoid them.
    const TREE_SCALE = 0.30;
    const TREE_MARGIN = 60; // extra horizontal clearance around each platform
    const platformBands = (this.platforms || []).map((p) => {
      const b = this.getPlatformBounds(p.x, p.y, p.scaleX, p.angle);
      return { minX: b.minX - TREE_MARGIN, maxX: b.maxX + TREE_MARGIN };
    });

    const spacing = 320;
    const count = Math.floor(this.worldWidth / spacing) + 1;
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Clamp(
        60 + i * spacing + Phaser.Math.Between(-90, 90),
        0,
        this.worldWidth,
      );

      // Skip if this x falls inside a platform's horizontal band.
      const blocked = platformBands.some((b) => x >= b.minX && x <= b.maxX);
      if (blocked) continue;

      const terrainY = this.getTerrainYAt(x);
      // Sink the base 28px below the terrain surface so the trunk looks planted.
      const tree = this.add
        .image(x, terrainY + 80, 'palmtree')
        .setOrigin(0.5, 1)
        .setScale(TREE_SCALE)
        .setDepth(0);
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
        .setDepth(0);
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
    const FLAP_INTERVAL = 180; // ms per frame

    for (const bird of this.birds) {
      // Move horizontally.
      bird.x += bird._dir * bird._speed * delta * 0.001;
      // Gentle vertical bob.
      bird.y += Math.sin(this.time.now * BOB_FREQ + bird._bobOffset) * BOB_AMP * delta * 0.001;

      // Flap animation: alternate between the two toucan frames.
      bird._flapTimer += delta;
      if (bird._flapTimer >= FLAP_INTERVAL) {
        bird._flapTimer -= FLAP_INTERVAL;
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

  createControllerDropdown() {
    this.selectedPadIndex = -1; // -1 = use all pads

    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'position:fixed', 'top:8px', 'left:50%', 'transform:translateX(-50%)',
      'z-index:1000', 'font-family:monospace', 'font-size:13px',
      'background:rgba(255,255,255,0.75)', 'padding:4px 10px', 'border-radius:4px',
      'display:flex', 'align-items:center', 'gap:6px',
    ].join(';');

    const label = document.createElement('span');
    label.textContent = 'Controller:';

    const sel = document.createElement('select');
    sel.style.cssText = 'font-family:monospace;font-size:13px;max-width:220px';

    const refresh = () => {
      const prev = sel.value;
      sel.innerHTML = '';
      const opt0 = document.createElement('option');
      opt0.value = '-1';
      opt0.textContent = 'Auto (all)';
      sel.appendChild(opt0);

      const raw = navigator.getGamepads();
      for (let i = 0; i < raw.length; i++) {
        if (!raw[i]) continue;
        const opt = document.createElement('option');
        opt.value = String(i);
        // Trim long vendor strings — keep the readable part before the parenthesis
        opt.textContent = raw[i].id.replace(/\s*\(.*\)/, '').trim() || `Pad ${i}`;
        sel.appendChild(opt);
        // Auto-select first standard gamepad on first load
        if (this.selectedPadIndex === -1 && raw[i].id.includes('STANDARD GAMEPAD')) {
          this.selectedPadIndex = i;
        }
      }
      sel.value = prev !== '' && [...sel.options].some(o => o.value === prev)
        ? prev
        : String(this.selectedPadIndex);
    };

    sel.addEventListener('change', () => {
      this.selectedPadIndex = parseInt(sel.value);
    });

    window.addEventListener('gamepadconnected', refresh);
    window.addEventListener('gamepaddisconnected', refresh);

    wrap.appendChild(label);
    wrap.appendChild(sel);
    document.body.appendChild(wrap);
    this._controllerDropdown = wrap;

    // Clean up DOM when scene shuts down
    this.events.once('shutdown', () => wrap.remove());

    refresh();
  }

  createIndicatorArrows() {
    // Goal arrow: white; fruit arrow: orange. Both use same texture, tinted.
    this.goalArrow = this.add
      .image(0, 0, 'arrowIndicator')
      .setScrollFactor(0)
      .setDepth(200)
      .setVisible(false)
      .setTint(0xffffff);

    this.fruitArrow = this.add
      .image(0, 0, 'arrowIndicator')
      .setScrollFactor(0)
      .setDepth(200)
      .setVisible(false)
      .setTint(0xff8c3c);

  }

  updateIndicatorArrows() {
    const cam = this.cameras.main;
    const cw = cam.width;
    const ch = cam.height;
    const cx = cw / 2;
    const cy = ch / 2;
    // Inset from screen edge so the arrow sits fully inside the viewport.
    const MARGIN = 52;

    const targets = [
      { sprite: this.goal, arrow: this.goalArrow },
      { sprite: this.fruit, arrow: this.fruitArrow },
    ];

    for (const { sprite, arrow } of targets) {
      if (!sprite || !arrow) continue;

      // World → screen position.
      const sx = sprite.x - cam.scrollX;
      const sy = sprite.y - cam.scrollY;

      // Target is visible — hide the indicator.
      if (sx >= 0 && sx <= cw && sy >= 0 && sy <= ch) {
        arrow.setVisible(false);
        continue;
      }

      arrow.setVisible(true);

      // Direction from screen centre to target.
      const dx = sx - cx;
      const dy = sy - cy;
      const angle = Math.atan2(dy, dx);

      // Find the point on the MARGIN-inset rectangle in that direction.
      const hw = cx - MARGIN;
      const hh = cy - MARGIN;
      let ex, ey;
      if (Math.abs(dx) * hh > Math.abs(dy) * hw) {
        // Hits left or right edge.
        const scale = hw / Math.abs(dx);
        ex = cx + Math.sign(dx) * hw;
        ey = cy + dy * scale;
      } else {
        // Hits top or bottom edge.
        const scale = hh / Math.abs(dy);
        ex = cx + dx * scale;
        ey = cy + Math.sign(dy) * hh;
      }

      arrow.setPosition(ex, ey);
      arrow.setRotation(angle);
    }

    // Flash the highest-priority visible arrow; reset the other to full alpha.
    const fruitVisible = this.fruitArrow?.visible;
    const goalVisible  = this.goalArrow?.visible;
    const flashAlpha = (this.time.now % 600) < 450 ? 1 : 0.1;

    if (fruitVisible) {
      this.fruitArrow.setAlpha(flashAlpha);
      if (goalVisible) this.goalArrow.setAlpha(1);
    } else if (goalVisible) {
      this.goalArrow.setAlpha(flashAlpha);
    }
  }

  update(time, delta) {
    this.elephant.update(time, delta, this.props);
    this.updateIndicatorArrows();
    this.updateClouds(delta);
    this.updateBirds(delta);
  }
}
