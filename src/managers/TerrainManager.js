import Phaser from 'phaser';
import {
  WORLD_HEIGHT,
  GROUND_SURFACE_Y,
  GROUND_DEPTH,
  TERRAIN_SEGMENT_WIDTH,
  TERRAIN_SLIDE_DURATION,
  OUTLINE,
  OUTLINE_WIDTH,
} from '../util/constants.js';

/**
 * TerrainManager owns all terrain state and operations for PlaygroundScene.
 *
 * Responsibilities:
 * - Generating terrain height profiles (full-world and chunk-based)
 * - Creating and removing Matter.js physics bodies for the ground
 * - Drawing and managing the ground graphics objects
 * - Answering spatial queries (getTerrainYAt, minTerrainYInRange)
 * - Extending the terrain when the world grows
 *
 * The manager holds a reference to the Phaser scene so it can call
 * `this.scene.add.graphics()`, `this.scene.matter`, `this.scene.tweens`, etc.
 */
export default class TerrainManager {
  /**
   * @param {Phaser.Scene} scene  The host scene (PlaygroundScene).
   */
  constructor(scene) {
    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {{ x: number, y: number }[]} */
    this.terrainPoints = [];

    /** @type {MatterJS.BodyType[]} */
    this.groundBodies = [];

    /** @type {Phaser.GameObjects.Graphics[]} */
    this.groundGraphicsObjects = [];

    /** @type {object | null} Dual-sine wave state; reset each full rebuild. */
    this.terrainWaveState = null;

    /** @type {number} Current maximum terrain amplitude in pixels. */
    this.terrainAmplitude = 0;
  }

  // ---------------------------------------------------------------------------
  // Full build / rebuild
  // ---------------------------------------------------------------------------

  /**
   * Builds a random rolling-hills terrain: a smooth height profile rendered
   * with a spline, backed by a chain of angled static rectangle bodies so
   * the ball rolls naturally across slopes instead of catching on edges.
   *
   * Destroys any previous ground bodies and graphics before building.
   */
  buildGround() {
    if (this.groundBodies) {
      for (const body of this.groundBodies) this.scene.matter.world.remove(body);
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

      const body = this.scene.matter.add.rectangle(cx, cy, segLength, GROUND_DEPTH, { isStatic: true });
      this.scene.matter.body.setAngle(body, angle);
      body.label = 'ground';
      this.groundBodies.push(body);
    }

    this.groundGraphicsObjects.push(this.drawGroundGraphicsSegment(points));
  }

  // ---------------------------------------------------------------------------
  // World extension
  // ---------------------------------------------------------------------------

  /**
   * Appends new terrain points and physics bodies from prevWidth to newWidth,
   * connecting smoothly from the last existing terrain point.
   *
   * @param {number} prevWidth  Previous world width in pixels.
   * @param {number} newWidth   New (larger) world width in pixels.
   * @returns {Phaser.Tweens.Tween} The slide tween animating the new chunk into place.
   */
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

      const body = this.scene.matter.add.rectangle(cx, cy, segLength, GROUND_DEPTH, { isStatic: true });
      this.scene.matter.body.setAngle(body, angle);
      body.label = 'ground';
      this.groundBodies.push(body);
    }

    // Draw only the new chunk; old chunk graphics stay in place.
    // Slide the new section up from below for a smooth reveal.
    const chunkGfx = this.drawGroundGraphicsSegment(segPoints);
    chunkGfx.setPosition(0, 600);
    const slideTween = this.scene.tweens.add({
      targets: chunkGfx,
      y: 0,
      duration: TERRAIN_SLIDE_DURATION,
      ease: 'Power2.Out',
    });
    (this.groundGraphicsObjects ??= []).push(chunkGfx);
    return slideTween;
  }

  // ---------------------------------------------------------------------------
  // Height generation
  // ---------------------------------------------------------------------------

  /**
   * Generates terrain heights for the full world. Amplitude ramps from near-zero
   * at the left edge to full terrainAmplitude at the right, so the level reads
   * as flat near the start and increasingly volatile further right.
   *
   * @returns {{ x: number, y: number }[]}
   */
  generateTerrainHeights() {
    const worldWidth = this.scene.worldWidth;
    const segments = Math.max(1, Math.round(worldWidth / TERRAIN_SEGMENT_WIDTH));
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
      const x = (worldWidth * i) / segments;
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

  /**
   * Generates terrain height samples for a single world chunk [startX, endX].
   *
   * The chunk is driven by a dual-sine wave (two overlapping frequencies) whose
   * parameters are stored in `this.terrainWaveState`. On the first call the state
   * is initialised from scratch; on subsequent calls it is slowly drifted toward
   * new random targets (25 % blend per chunk) so adjacent chunks share a family
   * resemblance rather than being completely independent.
   *
   * Phases are intentionally left unchanged between chunks — because the sine is
   * evaluated at absolute x coordinates the wave is automatically continuous
   * across the seam without any explicit blending of phase values.
   *
   * The first BLEND_SEGS segments linearly interpolate from startY to the wave
   * target so the junction with the previous chunk is seamless.
   *
   * @param {number} startX  Left edge of the chunk in world pixels.
   * @param {number} endX    Right edge of the chunk in world pixels.
   * @param {number} startY  Ground y-value at the left edge (last point of previous chunk).
   * @returns {{ x: number, y: number }[]} Array of sampled terrain points.
   */
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
        wavelength1: 700 + Math.random() * 700,
        wavelength2: 350 + Math.random() * 250,
        phase1: Math.random() * Math.PI * 2,
        phase2: Math.random() * Math.PI * 2,
        amp1Factor: 0.75 + Math.random() * 0.25,
        amp2Factor: 0.25 + Math.random() * 0.15,
      };
    } else {
      const ws = this.terrainWaveState;
      // 25% blend toward a new random target each chunk — gradual evolution.
      ws.wavelength1 = ws.wavelength1 * 0.75 + (700  + Math.random() * 700)  * 0.25;
      ws.wavelength2 = ws.wavelength2 * 0.75 + (350  + Math.random() * 250)  * 0.25;
      ws.amp1Factor  = ws.amp1Factor  * 0.80 + (0.75 + Math.random() * 0.25) * 0.20;
      ws.amp2Factor  = ws.amp2Factor  * 0.80 + (0.25 + Math.random() * 0.15) * 0.20;
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

  // ---------------------------------------------------------------------------
  // Graphics
  // ---------------------------------------------------------------------------

  /**
   * Draws terrain for the given points array and returns the Graphics object.
   * The caller is responsible for positioning, animating, and tracking it.
   *
   * @param {{ x: number, y: number }[]} points
   * @returns {Phaser.GameObjects.Graphics}
   */
  drawGroundGraphicsSegment(points) {
    const gfx = this.scene.add.graphics().setDepth(1);

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

  // ---------------------------------------------------------------------------
  // Spatial queries
  // ---------------------------------------------------------------------------

  /**
   * Interpolates the terrain height profile to find the ground y at a given x.
   *
   * @param {number} x  World x coordinate.
   * @returns {number}  Ground y coordinate at that x.
   */
  getTerrainYAt(x) {
    if (!this.terrainPoints?.length) {
      console.error('getTerrainYAt called before buildGround() — returning fallback y');
      return GROUND_SURFACE_Y;
    }
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

  /**
   * Samples terrain across [minX, maxX] and returns the minimum y (highest
   * ground point) — used to guarantee clearance over the whole platform width.
   *
   * @param {number} minX
   * @param {number} maxX
   * @returns {number}
   */
  minTerrainYInRange(minX, maxX) {
    let min = Infinity;
    const step = Math.max(1, (maxX - minX) / 8);
    for (let sx = minX; sx <= maxX + step; sx += step) {
      min = Math.min(min, this.getTerrainYAt(Math.min(sx, maxX)));
    }
    return min;
  }
}
