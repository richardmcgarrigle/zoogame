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

const WIDTH_PER_SCORE = 600;
const AMPLITUDE_PER_SCORE = 12;
const MAX_TERRAIN_AMPLITUDE = 100;

const PLATFORM_MIN_SCALE = 0.6;
const PLATFORM_MAX_SCALE = 1.4;
const PLATFORM_ANGLE_PER_SCORE = 2;
const PLATFORM_MIN_ANGLE = 8;
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
// Minimum gap left between a platform and the terrain/other platforms so
// none of them visually or physically intersect.
const PLATFORM_OVERLAP_BUFFER = 12;
const PLATFORM_PLACEMENT_ATTEMPTS = 20;

// Cluster-based platform spawning: mini-chunks decide whether to spawn a
// cluster root, then recursively dress the cluster with children.
const CLUSTER_MINI_CHUNK_WIDTH = 250;
const CHUNK_CLUSTER_CHANCE_BASE = 0.35;
const CHUNK_CLUSTER_CHANCE_PER_SCORE = 0.025;
const CHUNK_CLUSTER_CHANCE_MAX = 0.65;
const CLUSTER_SPREAD_BASE = 0.22;
const CLUSTER_SPREAD_PER_SCORE = 0.03;
const CLUSTER_SPREAD_MAX = 0.70;
const CLUSTER_SPREAD_DECAY = 0.30; // factor per recursion depth
const CLUSTER_MAX_DEPTH = 4;

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
    this.platforms = [];
    this.palmTrees = [];
    this.buildPlatforms();
    this.buildPalms();

    this.fruit = this.addFruit(FRUIT_SPAWN_X, FRUIT_SPAWN_Y);
    this.crates = [];
    const initialCrate = this.addCrate(950, 850);
    this.crates.push(initialCrate);
    this.props = [this.fruit, initialCrate];

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
    this.crates.forEach(c => c?.destroy());
    this.crates = [];
    const crateX = 950;
    const crateY = Math.min(850, this.getTerrainYAt(crateX) - TEXTURE_SIZES.crate.height / 2 - 1);
    const restartCrate = this.addCrate(crateX, crateY);
    this.crates.push(restartCrate);
    this.props = [this.fruit, restartCrate];

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

    // Extend the world to the right; old terrain and platforms remain in place.
    this.extendWorld();

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
    this.terrainAmplitude = Math.min(this.score * AMPLITUDE_PER_SCORE, MAX_TERRAIN_AMPLITUDE);

    this.matter.world.setBounds(0, 0, this.worldWidth, WORLD_HEIGHT, 64, true, true, false, true);
    this.cameras.main.setBounds(0, -5000, this.worldWidth, WORLD_HEIGHT + 5000);

    // Extend terrain first so getTerrainYAt works for the new chunk.
    this.extendTerrain(prevWidth, this.worldWidth);

    // Compute the goal's new position and slide it there.
    const newGoalX = this.worldWidth - 100;
    const newGoalY = this.getTerrainYAt(newGoalX) - TEXTURE_SIZES.goal.height / 2;
    this.tweens.add({
      targets: this.goal,
      x: newGoalX,
      y: newGoalY,
      delay: 700,  // wait for terrain slide to finish
      duration: 900,
      ease: 'Power2.Out',
    });

    // Seed placed bounds with the final goal position so platforms don't
    // land on top of where the goal is heading.
    const placedBounds = [{
      minX: newGoalX - TEXTURE_SIZES.goal.width / 2,
      maxX: newGoalX + TEXTURE_SIZES.goal.width / 2,
      minY: newGoalY - TEXTURE_SIZES.goal.height / 2,
      maxY: newGoalY + TEXTURE_SIZES.goal.height / 2,
    }];
    for (const p of this.platforms) {
      placedBounds.push(this.getPlatformBounds(p.x, p.y, p.scaleX, p.angle));
    }
    this.buildPlatformsForChunk(prevWidth, this.worldWidth, placedBounds, true);
    this.buildPalmsForChunk(prevWidth, this.worldWidth, true);
  }

  // Appends new terrain points and physics bodies from prevWidth to newWidth,
  // connecting smoothly from the last existing terrain point.
  extendTerrain(prevWidth, newWidth) {
    const lastPt = this.terrainPoints[this.terrainPoints.length - 1];
    const startY = lastPt ? lastPt.y : GROUND_SURFACE_Y;

    const newPoints = this.generateChunkTerrainHeights(prevWidth, newWidth, startY);
    // newPoints[0] duplicates the existing last point; skip it when appending.
    const toAdd = newPoints.slice(1);
    for (const p of toAdd) this.terrainPoints.push(p);

    // Add physics bodies for the new terrain segments.
    const segPoints = [lastPt, ...toAdd];
    for (let i = 0; i < segPoints.length - 1; i++) {
      const p1 = segPoints[i];
      const p2 = segPoints[i + 1];
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

    // Draw only the new chunk; old chunk graphics stay in place.
    // Slide the new section up from below for a smooth reveal.
    const chunkGfx = this.drawGroundGraphicsSegment(segPoints);
    chunkGfx.setPosition(0, 600);
    this.tweens.add({
      targets: chunkGfx,
      y: 0,
      duration: 700,
      ease: 'Power2.Out',
    });
    (this.groundGraphicsObjects ??= []).push(chunkGfx);
  }

  // Generates terrain heights for a single chunk [startX, endX], blending
  // smoothly from startY at the left edge into the chunk's wave profile.
  generateChunkTerrainHeights(startX, endX, startY) {
    const chunkWidth = endX - startX;
    const segments = Math.max(1, Math.round(chunkWidth / TERRAIN_SEGMENT_WIDTH));
    const amplitude = this.terrainAmplitude;

    // First chunk: initialise wave state from scratch.
    // Subsequent chunks: slowly drift wavelengths toward new random targets so
    // each chunk inherits the character of the previous one rather than picking
    // completely new parameters. Phases stay fixed — because we evaluate the
    // wave at absolute x coordinates the sinusoid is automatically continuous
    // across chunk boundaries.
    if (!this.terrainWaveState) {
      this.terrainWaveState = {
        wavelength1: 2200 + Math.random() * 1400,
        wavelength2: 1000 + Math.random() * 500,
        phase1: Math.random() * Math.PI * 2,
        phase2: Math.random() * Math.PI * 2,
        amp1Factor: 0.75 + Math.random() * 0.25,
        amp2Factor: 0.15 * Math.random(),
      };
    } else {
      const ws = this.terrainWaveState;
      // 25% blend toward a new random target each chunk — gradual evolution.
      ws.wavelength1 = ws.wavelength1 * 0.75 + (1800 + Math.random() * 1800) * 0.25;
      ws.wavelength2 = ws.wavelength2 * 0.75 + (900  + Math.random() * 600)  * 0.25;
      ws.amp1Factor  = ws.amp1Factor  * 0.80 + (0.75 + Math.random() * 0.25) * 0.20;
      ws.amp2Factor  = ws.amp2Factor  * 0.80 + (0.15 * Math.random())        * 0.20;
      // Phases are intentionally left unchanged — see note above.
    }

    const { wavelength1, wavelength2, phase1, phase2, amp1Factor, amp2Factor } = this.terrainWaveState;
    const amp1 = amplitude * amp1Factor;
    const amp2 = amplitude * amp2Factor;

    const BLEND_SEGS = 5; // smooth y-value join over first N segments

    const points = [];
    for (let i = 0; i <= segments; i++) {
      const x = startX + chunkWidth * (i / segments);
      const wave = amp1 * Math.sin(x / wavelength1 * Math.PI * 2 + phase1) +
                   amp2 * Math.sin(x / wavelength2 * Math.PI * 2 + phase2);
      const targetY = Math.min(GROUND_SURFACE_Y + wave, WORLD_HEIGHT - 10);

      let y;
      if (i === 0) {
        y = startY;
      } else if (i < BLEND_SEGS) {
        y = startY + (targetY - startY) * (i / BLEND_SEGS);
      } else {
        y = targetY;
      }

      points.push({ x, y });
    }
    return points;
  }

  repositionGoal() {
    const goalX = this.worldWidth - 100;
    const terrainY = this.getTerrainYAt(goalX);
    this.goal.setPosition(goalX, terrainY - TEXTURE_SIZES.goal.height / 2);
  }

  // Returns the AABB of the goal object, used to seed placedBounds.
  getGoalBounds() {
    const halfW = TEXTURE_SIZES.goal.width / 2;
    const halfH = TEXTURE_SIZES.goal.height / 2;
    return {
      minX: this.goal.x - halfW,
      maxX: this.goal.x + halfW,
      minY: this.goal.y - halfH,
      maxY: this.goal.y + halfH,
    };
  }

  // Full platform rebuild for restartLevel. Destroys all existing platforms
  // and regenerates across the whole world using the cluster approach.
  buildPlatforms() {
    if (this.platforms) {
      for (const platform of this.platforms) {
        this.matter.world.remove(platform.body);
        platform.destroy();
      }
    }
    this.platforms = [];
    const placedBounds = [this.getGoalBounds()];
    this.buildPlatformsForChunk(0, this.worldWidth, placedBounds);
  }

  // Spawns platform clusters within [startX, endX]. placedBounds is shared
  // across all clusters so they avoid each other and the goal.
  buildPlatformsForChunk(startX, endX, placedBounds, animate = false) {
    const maxAngle = Math.min(this.score * PLATFORM_ANGLE_PER_SCORE, PLATFORM_MAX_ANGLE);
    const miniChunkCount = Math.ceil((endX - startX) / CLUSTER_MINI_CHUNK_WIDTH);

    for (let i = 0; i < miniChunkCount; i++) {
      const miniStart = startX + i * CLUSTER_MINI_CHUNK_WIDTH;
      const miniEnd = Math.min(miniStart + CLUSTER_MINI_CHUNK_WIDTH, endX);
      const miniCenter = (miniStart + miniEnd) / 2;

      // Scale cluster probability by x-position so the left side (near spawn)
      // stays relatively clear and density builds toward the right.
      const xFrac = Math.min(miniCenter / Math.max(this.worldWidth, 1), 1);
      const clusterChance = Math.min(
        (CHUNK_CLUSTER_CHANCE_BASE + this.score * CHUNK_CLUSTER_CHANCE_PER_SCORE) * (0.2 + 0.8 * xFrac),
        CHUNK_CLUSTER_CHANCE_MAX,
      );

      if (Math.random() < clusterChance) {
        const groundY = this.getTerrainYAt(miniCenter);
        this.spawnPlatformCluster(miniCenter, groundY, miniStart, miniEnd, maxAngle, placedBounds, 0, animate);
      }
    }
  }

  // Recursively places a platform near (anchorX, anchorY) then dresses it
  // with child platforms at decreasing probability per depth level.
  spawnPlatformCluster(anchorX, anchorY, chunkStartX, chunkEndX, maxAngle, placedBounds, depth, animate = false) {
    if (depth > CLUSTER_MAX_DEPTH) return;

    const scale = Phaser.Math.FloatBetween(PLATFORM_MIN_SCALE, PLATFORM_MAX_SCALE);
    const effectiveMax = Math.max(maxAngle, PLATFORM_MIN_ANGLE);
    const sign = Math.random() < 0.5 ? 1 : -1;
    const angle = sign * Phaser.Math.Between(PLATFORM_MIN_ANGLE, effectiveMax);

    const refBounds = this.getPlatformBounds(0, 0, scale, angle);
    const rotatedHalfH = (refBounds.maxY - refBounds.minY) / 2;
    const effectiveMaxY = GROUND_SURFACE_Y - ELEPHANT_CLEARANCE - rotatedHalfH;

    // Constrain to world edges only; mini-chunk boundaries are just anchor hints.
    const minX = PLATFORM_MARGIN_X;
    const maxX = this.worldWidth - PLATFORM_MARGIN_X;
    if (minX >= maxX) return;

    // Root platforms sit above ground; children float near their parent.
    let targetY;
    if (depth === 0) {
      const groundAtAnchor = this.getTerrainYAt(anchorX);
      targetY = groundAtAnchor - Phaser.Math.Between(PLATFORM_GAP_Y_MIN_FROM_GROUND, PLATFORM_GAP_Y_MAX);
    } else {
      targetY = anchorY + Phaser.Math.Between(-PLATFORM_GAP_Y_MAX, PLATFORM_GAP_Y_MAX);
    }
    targetY = Phaser.Math.Clamp(targetY, PLATFORM_MIN_Y, effectiveMaxY);

    // Find best candidate position near (anchorX, targetY).
    let bestX = null, bestY = null, bestBounds = null, bestOverlap = Infinity;
    const xSpread = PLATFORM_GAP_X_MAX * 0.4;
    for (let attempt = 0; attempt < PLATFORM_PLACEMENT_ATTEMPTS; attempt++) {
      const cx = Phaser.Math.Clamp(
        anchorX + Phaser.Math.Between(-xSpread, xSpread),
        minX, maxX,
      );
      const cy = Phaser.Math.Clamp(
        targetY + Phaser.Math.Between(-20, 20),
        PLATFORM_MIN_Y, effectiveMaxY,
      );
      const bounds = this.getPlatformBounds(cx, cy, scale, angle);
      const overlap = this.platformOverlapAmount(bounds, placedBounds);
      if (overlap === 0) { bestX = cx; bestY = cy; bestBounds = bounds; break; }
      if (overlap < bestOverlap) { bestOverlap = overlap; bestX = cx; bestY = cy; bestBounds = bounds; }
    }
    if (bestX === null) return;

    const resolved = this.resolveOverlap(bestX, bestY, scale, angle, placedBounds, minX, maxX, effectiveMaxY);
    if (this.platformOverlapAmount(resolved.bounds, placedBounds) > 500) return;

    placedBounds.push(resolved.bounds);
    const platform = this.addStaticPlatform(resolved.x, resolved.y, 'platformLeaf');
    platform.setScale(scale);
    platform.setAngle(angle);
    this.platforms.push(platform);

    if (animate) {
      platform.setAlpha(0);
      this.tweens.add({ targets: platform, alpha: 1, duration: 600, ease: 'Power2.Out' });
    }

    // Spread to neighbouring platforms with probability decaying by depth.
    const spreadChance = Math.min(
      CLUSTER_SPREAD_BASE + this.score * CLUSTER_SPREAD_PER_SCORE,
      CLUSTER_SPREAD_MAX,
    ) * Math.pow(1 - CLUSTER_SPREAD_DECAY, depth);

    if (spreadChance < 0.02) return;

    const px = resolved.x;
    const py = resolved.y;

    // Right neighbour
    if (Math.random() < spreadChance) {
      const nx = px + Phaser.Math.Between(PLATFORM_GAP_X_MIN, PLATFORM_GAP_X_MAX);
      const ny = py + Phaser.Math.Between(-PLATFORM_GAP_Y_MAX / 2, PLATFORM_GAP_Y_MAX / 2);
      if (nx < maxX) {
        this.spawnPlatformCluster(nx, ny, chunkStartX, chunkEndX, maxAngle, placedBounds, depth + 1, animate);
      }
    }
    // Left neighbour
    if (Math.random() < spreadChance * 0.7) {
      const nx = px - Phaser.Math.Between(PLATFORM_GAP_X_MIN, PLATFORM_GAP_X_MAX);
      const ny = py + Phaser.Math.Between(-PLATFORM_GAP_Y_MAX / 2, PLATFORM_GAP_Y_MAX / 2);
      if (nx > minX) {
        this.spawnPlatformCluster(nx, ny, chunkStartX, chunkEndX, maxAngle, placedBounds, depth + 1, animate);
      }
    }
    // Stack above (only shallow depths to prevent infinitely tall towers)
    if (depth < 2 && Math.random() < spreadChance * 0.5) {
      const ny = py - Phaser.Math.Between(PLATFORM_GAP_Y_MIN_FROM_GROUND, PLATFORM_GAP_Y_MAX);
      if (ny > PLATFORM_MIN_Y) {
        this.spawnPlatformCluster(px, ny, chunkStartX, chunkEndX, maxAngle, placedBounds, depth + 1, animate);
      }
    }
  }

  // Pushes a candidate platform position out of terrain and other platforms.
  // Mirrors the resolution loop from the old buildPlatforms chain.
  resolveOverlap(candX, candY, scale, angle, placedBounds, minX, maxX, effectiveMaxY) {
    let cx = candX, cy = candY;
    let bounds = this.getPlatformBounds(cx, cy, scale, angle);

    for (let iter = 0; iter < 30; iter++) {
      const groundY = this.minTerrainYInRange(bounds.minX, bounds.maxX);
      const groundPenetration = bounds.maxY + ELEPHANT_CLEARANCE - groundY;
      if (groundPenetration > 0) {
        const newY = Phaser.Math.Clamp(cy - groundPenetration, PLATFORM_MIN_Y, effectiveMaxY);
        if (newY === cy) break;
        cy = newY;
        bounds = this.getPlatformBounds(cx, cy, scale, angle);
        continue;
      }

      let culprit = null, culpritScore = 0;
      for (const other of placedBounds) {
        const xOverlap = Math.min(bounds.maxX, other.maxX) - Math.max(bounds.minX, other.minX) + PLATFORM_OVERLAP_BUFFER;
        const yOverlap = Math.min(bounds.maxY, other.maxY) - Math.max(bounds.minY, other.minY);
        if (xOverlap > 0 && yOverlap > -ELEPHANT_CLEARANCE) {
          const s = xOverlap * (yOverlap + ELEPHANT_CLEARANCE);
          if (s > culpritScore) { culprit = { other, xOverlap, yOverlap }; culpritScore = s; }
        }
      }
      if (!culprit) break;

      const candHalfH = (bounds.maxY - bounds.minY) / 2;
      const candHalfW = (bounds.maxX - bounds.minX) / 2;
      const otherHalfH = (culprit.other.maxY - culprit.other.minY) / 2;
      const otherHalfW = (culprit.other.maxX - culprit.other.minX) / 2;
      const otherCX = (culprit.other.minX + culprit.other.maxX) / 2;
      const otherCY = (culprit.other.minY + culprit.other.maxY) / 2;
      const sepY = otherHalfH + candHalfH + ELEPHANT_CLEARANCE;
      const sepX = otherHalfW + candHalfW + PLATFORM_OVERLAP_BUFFER;

      const escapes = [
        { x: cx, y: Phaser.Math.Clamp(otherCY + sepY, PLATFORM_MIN_Y, effectiveMaxY) },
        { x: cx, y: Phaser.Math.Clamp(otherCY - sepY, PLATFORM_MIN_Y, effectiveMaxY) },
        { x: Phaser.Math.Clamp(otherCX + sepX, minX, maxX), y: cy },
        { x: Phaser.Math.Clamp(otherCX - sepX, minX, maxX), y: cy },
      ];

      let bestEscape = null, bestEscapeOverlap = Infinity, bestEscapeBounds = null;
      for (const esc of escapes) {
        if (esc.x === cx && esc.y === cy) continue;
        const eb = this.getPlatformBounds(esc.x, esc.y, scale, angle);
        const eo = this.platformOverlapAmount(eb, placedBounds);
        if (eo < bestEscapeOverlap) { bestEscapeOverlap = eo; bestEscape = esc; bestEscapeBounds = eb; }
      }
      if (!bestEscape) break;
      cx = bestEscape.x; cy = bestEscape.y; bounds = bestEscapeBounds;
    }

    return { x: cx, y: cy, bounds };
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
    for (const g of this.groundGraphicsObjects ?? []) g.destroy();
    this.groundGraphicsObjects = [];
    this.terrainWaveState = null; // reset so full rebuild picks fresh wave params

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

    this.groundGraphicsObjects.push(this.drawGroundGraphicsSegment(points));
  }

  // Generates terrain heights for the full world. Amplitude ramps from near-zero
  // at the left edge to full terrainAmplitude at the right, so the level reads
  // as flat near the start and increasingly volatile further right.
  generateTerrainHeights() {
    const segments = Math.max(1, Math.round(this.worldWidth / TERRAIN_SEGMENT_WIDTH));
    const maxAmplitude = this.terrainAmplitude;

    // World-unit wavelengths so hill frequency is independent of world width.
    const wavelength1 = 1800 + Math.random() * 1800; // 1800–3600 px per cycle
    const wavelength2 = 900  + Math.random() * 600;  // 900–1500 px per cycle
    const phase1 = Math.random() * Math.PI * 2;
    const phase2 = Math.random() * Math.PI * 2;
    const amp1Factor = 0.75 + Math.random() * 0.25;
    const amp2Factor = 0.2 * Math.random();

    const points = [];
    for (let i = 0; i <= segments; i++) {
      const x = (this.worldWidth * i) / segments;
      const t = i / segments;
      // Power curve: amplitude ramps from near-zero at left to full at right.
      const xFraction = Math.pow(t, 1.3);
      const amp1 = maxAmplitude * amp1Factor * xFraction;
      const amp2 = maxAmplitude * amp2Factor * xFraction;
      const y = Math.min(
        GROUND_SURFACE_Y +
          amp1 * Math.sin(x / wavelength1 * Math.PI * 2 + phase1) +
          amp2 * Math.sin(x / wavelength2 * Math.PI * 2 + phase2),
        WORLD_HEIGHT - 10,
      );
      points.push({ x, y });
    }
    return points;
  }

  // Draws terrain for the given points array and returns the Graphics object.
  // The caller is responsible for positioning, animating, and tracking it.
  drawGroundGraphicsSegment(points) {
    const gfx = this.add.graphics().setDepth(1);

    const splinePoints = points.map((p) => new Phaser.Math.Vector2(p.x, p.y));
    const curve = new Phaser.Curves.Spline(splinePoints);
    const smooth = curve.getPoints(Math.max(points.length * 8, 16));

    const x0 = smooth[0].x;
    const xEnd = smooth[smooth.length - 1].x;

    gfx.fillStyle(0x4f7a3a, 1);
    gfx.beginPath();
    gfx.moveTo(x0, WORLD_HEIGHT);
    for (const p of smooth) gfx.lineTo(p.x, p.y);
    gfx.lineTo(xEnd, WORLD_HEIGHT);
    gfx.closePath();
    gfx.fillPath();

    gfx.fillStyle(0x6fae4f, 1);
    gfx.beginPath();
    gfx.moveTo(smooth[0].x, smooth[0].y);
    for (const p of smooth) gfx.lineTo(p.x, p.y);
    for (let i = smooth.length - 1; i >= 0; i--) gfx.lineTo(smooth[i].x, smooth[i].y + 18);
    gfx.closePath();
    gfx.fillPath();

    gfx.lineStyle(OUTLINE_WIDTH, OUTLINE, 1);
    gfx.beginPath();
    gfx.moveTo(smooth[0].x, smooth[0].y);
    for (const p of smooth) gfx.lineTo(p.x, p.y);
    gfx.strokePath();

    return gfx;
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
    const TREE_SCALE = 0.30;
    const TREE_MARGIN = 60;
    const TREE_MIN_GAP = 300; // minimum x distance between any two trees
    const platformBands = (this.platforms || []).map((p) => {
      const b = this.getPlatformBounds(p.x, p.y, p.scaleX, p.angle);
      return { minX: b.minX - TREE_MARGIN, maxX: b.maxX + TREE_MARGIN };
    });

    const spacing = 560;
    const firstI = Math.floor(startX / spacing);
    const lastI = Math.ceil(endX / spacing) + 1;

    for (let i = firstI; i <= lastI; i++) {
      const x = Phaser.Math.Clamp(
        60 + i * spacing + Phaser.Math.Between(-90, 90),
        startX + 20,
        endX - 20,
      );

      const blocked = platformBands.some((b) => x >= b.minX && x <= b.maxX);
      if (blocked) continue;

      const tooClose = (this.palmTrees || []).some((t) => Math.abs(t.x - x) < TREE_MIN_GAP);
      if (tooClose) continue;

      const terrainY = this.getTerrainYAt(x);
      const finalY = terrainY + 80;
      const tree = this.add
        .image(x, animate ? finalY + 600 : finalY, 'palmtree')
        .setOrigin(0.5, 1)
        .setScale(TREE_SCALE)
        .setDepth(0);
      if (animate) {
        this.tweens.add({ targets: tree, y: finalY, duration: 700, ease: 'Power2.Out' });
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
