import Phaser from 'phaser';
import { GROUND_SURFACE_Y } from '../util/constants.js';
import { TEXTURE_SIZES } from '../util/textures.js';

// Platform scale bounds.
const PLATFORM_MIN_SCALE = 0.6;
const PLATFORM_MAX_SCALE = 1.4;

// Angle progression with score.
const PLATFORM_ANGLE_PER_SCORE = 2;
const PLATFORM_MIN_ANGLE = 8;
const PLATFORM_MAX_ANGLE = 25;

// World-edge margins and Y extents.
const PLATFORM_MARGIN_X = 150;
const PLATFORM_MIN_Y = 250;
// Elephant sprite is ~90px tall at BODY_SCALE; leave enough headroom below a
// platform's lowest edge for it to walk underneath without colliding.
const ELEPHANT_CLEARANCE = 110;
const PLATFORM_MAX_Y = GROUND_SURFACE_Y - ELEPHANT_CLEARANCE - (TEXTURE_SIZES.platformLeaf.height * PLATFORM_MAX_SCALE) / 2;

// Keep consecutive platforms within the elephant's jump reach.
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
// Extend terrain clearance checks this far beyond the platform AABB on each
// side so that platforms near chunk boundaries (where the terrain elevation
// changes) still leave enough room for the elephant to pass underneath when
// approaching from adjacent higher terrain.
const TERRAIN_CLEARANCE_MARGIN = 80;

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

/**
 * PlatformSpawner manages all platform placement for PlaygroundScene.
 *
 * Responsibilities:
 * - Building and rebuilding the full platform layout
 * - Spawning platform clusters within world chunks
 * - Resolving platform overlap with terrain and sibling platforms
 * - Computing platform AABBs for collision queries
 * - Creating static platform physics bodies
 *
 * The spawner holds references to the host scene (for Matter, tweens, world
 * dimensions, and score) and a TerrainManager (for terrain height queries).
 */
export default class PlatformSpawner {
  /**
   * @param {Phaser.Scene} scene    The host scene (PlaygroundScene).
   * @param {TerrainManager} terrain  The terrain manager for height queries.
   */
  constructor(scene, terrain) {
    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {TerrainManager} */
    this.terrain = terrain;

    /** @type {Phaser.Physics.Matter.Image[]} */
    this.platforms = [];
  }

  // ---------------------------------------------------------------------------
  // Full rebuild

  /**
   * Full platform rebuild. Destroys all existing platforms and regenerates
   * across the whole world using the cluster approach.
   */
  buildPlatforms() {
    if (this.platforms) {
      for (const platform of this.platforms) {
        this.scene.matter.world.remove(platform.body);
        platform.destroy();
      }
    }
    this.platforms = [];
    const placedBounds = [this._getGoalBounds()];
    this.buildPlatformsForChunk(0, this.scene.worldWidth, placedBounds);
  }

  // ---------------------------------------------------------------------------
  // Chunk-based spawning

  /**
   * Spawns platform clusters within [startX, endX]. placedBounds is shared
   * across all clusters so they avoid each other and the goal.
   *
   * @param {number}   startX
   * @param {number}   endX
   * @param {object[]} placedBounds  Shared AABB list updated in-place.
   * @param {boolean}  animate       If true, fade new platforms in.
   */
  buildPlatformsForChunk(startX, endX, placedBounds, animate = false) {
    const maxAngle = Math.min(this.scene.score * PLATFORM_ANGLE_PER_SCORE, PLATFORM_MAX_ANGLE);
    const miniChunkCount = Math.ceil((endX - startX) / CLUSTER_MINI_CHUNK_WIDTH);

    for (let i = 0; i < miniChunkCount; i++) {
      const miniStart = startX + i * CLUSTER_MINI_CHUNK_WIDTH;
      const miniEnd = Math.min(miniStart + CLUSTER_MINI_CHUNK_WIDTH, endX);
      const miniCenter = (miniStart + miniEnd) / 2;

      // Scale cluster probability by x-position so the left side (near spawn)
      // stays relatively clear and density builds toward the right.
      const xFrac = Math.min(miniCenter / Math.max(this.scene.worldWidth, 1), 1);
      const clusterChance = Math.min(
        (CHUNK_CLUSTER_CHANCE_BASE + this.scene.score * CHUNK_CLUSTER_CHANCE_PER_SCORE) * (0.2 + 0.8 * xFrac),
        CHUNK_CLUSTER_CHANCE_MAX,
      );

      if (Math.random() < clusterChance) {
        const groundY = this.terrain.getTerrainYAt(miniCenter);
        this.spawnPlatformCluster(miniCenter, groundY, miniStart, miniEnd, maxAngle, placedBounds, 0, animate);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Cluster placement

  /**
   * Recursively places a cluster of platforms rooted near (anchorX, anchorY).
   *
   * Each call places one platform using a two-phase strategy:
   *   1. Random sampling — tries PLATFORM_PLACEMENT_ATTEMPTS positions near the
   *      anchor and keeps the one with the lowest overlap score.
   *   2. Deterministic escape — calls resolveOverlap() to push the best candidate
   *      out of terrain and sibling platforms along the four cardinal escape axes.
   *
   * After placing the root, it may recurse to spawn left, right, and upward
   * neighbours. The `spreadChance` decays by CLUSTER_SPREAD_DECAY per depth level
   * so clusters thin out naturally rather than requiring a hard max-count limit.
   *
   * @param {number}   anchorX      Target x for this platform.
   * @param {number}   anchorY      Target y for this platform.
   * @param {number}   chunkStartX  Left boundary of the mini-chunk (used only for context).
   * @param {number}   chunkEndX    Right boundary of the mini-chunk.
   * @param {number}   maxAngle     Maximum tilt angle in degrees at the current score.
   * @param {object[]} placedBounds Shared AABB list; updated in-place as platforms land.
   * @param {number}   depth        Current recursion depth (0 = cluster root).
   * @param {boolean}  animate      If true, fade new platforms in rather than appearing instantly.
   */
  spawnPlatformCluster(anchorX, anchorY, chunkStartX, chunkEndX, maxAngle, placedBounds, depth, animate = false) {
    if (depth > CLUSTER_MAX_DEPTH) return;

    const scale = Phaser.Math.FloatBetween(PLATFORM_MIN_SCALE, PLATFORM_MAX_SCALE);
    const effectiveMax = Math.max(maxAngle, PLATFORM_MIN_ANGLE);
    const sign = Math.random() < 0.5 ? 1 : -1;
    const angle = sign * Phaser.Math.Between(PLATFORM_MIN_ANGLE, effectiveMax);

    const refBounds = this.getPlatformBounds(0, 0, scale, angle);
    const rotatedHalfW = (refBounds.maxX - refBounds.minX) / 2;
    const rotatedHalfH = (refBounds.maxY - refBounds.minY) / 2;
    // Sample terrain across the platform's potential footprint (plus margin)
    // so platforms near chunk boundaries where elevation drops still leave
    // enough clearance for the elephant approaching from higher terrain.
    const terrainAtAnchor = this.terrain.minTerrainYInRange(
      anchorX - rotatedHalfW - TERRAIN_CLEARANCE_MARGIN,
      anchorX + rotatedHalfW + TERRAIN_CLEARANCE_MARGIN,
    );
    const effectiveMaxY = terrainAtAnchor - ELEPHANT_CLEARANCE - rotatedHalfH;

    // Constrain to world edges only; mini-chunk boundaries are just anchor hints.
    const minX = PLATFORM_MARGIN_X;
    const maxX = this.scene.worldWidth - PLATFORM_MARGIN_X;
    if (minX >= maxX) return;

    // Root platforms sit above ground; children float near their parent.
    let targetY;
    if (depth === 0) {
      const groundAtAnchor = this.terrain.getTerrainYAt(anchorX);
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
      this.scene.tweens.add({ targets: platform, alpha: 1, duration: 600, ease: 'Power2.Out' });
    }

    // Spread to neighbouring platforms with probability decaying by depth.
    const spreadChance = Math.min(
      CLUSTER_SPREAD_BASE + this.scene.score * CLUSTER_SPREAD_PER_SCORE,
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

  // ---------------------------------------------------------------------------
  // Overlap resolution

  /**
   * Pushes a candidate platform position clear of the terrain and all sibling
   * platform bounds using a two-phase iterative escape algorithm.
   *
   * Each iteration:
   *   1. Ground check — if the platform's bottom edge is too close to the terrain
   *      (within ELEPHANT_CLEARANCE), moves it straight up.
   *   2. Sibling check — finds the sibling with the highest overlap score, then
   *      tries four escape positions (above/below/left/right the sibling centre)
   *      and moves to whichever has the lowest resulting overlap.
   *
   * The loop exits early when no overlap remains.  If the 30-iteration limit is
   * reached without convergence the best position found so far is returned;
   * spawnPlatformCluster then discards it if residual overlap exceeds 500 px².
   *
   * @param {number}   candX        Starting candidate x.
   * @param {number}   candY        Starting candidate y.
   * @param {number}   scale        Platform scale factor.
   * @param {number}   angle        Platform tilt angle in degrees.
   * @param {object[]} placedBounds Existing platform AABBs to avoid.
   * @param {number}   minX         Left world boundary for clamping.
   * @param {number}   maxX         Right world boundary for clamping.
   * @param {number}   effectiveMaxY  Lowest allowed y (accounts for terrain slope at anchor).
   * @returns {{ x: number, y: number, bounds: object }} Resolved position and its AABB.
   */
  resolveOverlap(candX, candY, scale, angle, placedBounds, minX, maxX, effectiveMaxY) {
    let cx = candX, cy = candY;
    let bounds = this.getPlatformBounds(cx, cy, scale, angle);
    let converged = false;

    for (let iter = 0; iter < 30; iter++) {
      const groundY = this.terrain.minTerrainYInRange(bounds.minX - TERRAIN_CLEARANCE_MARGIN, bounds.maxX + TERRAIN_CLEARANCE_MARGIN);
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
      if (!culprit) { converged = true; break; }

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

    if (!converged) {
      console.warn('resolveOverlap: iteration limit reached without convergence at', cx, cy);
    }

    return { x: cx, y: cy, bounds };
  }

  // ---------------------------------------------------------------------------
  // Geometry helpers

  /**
   * Axis-aligned bounding box of a platform, accounting for its rotation.
   *
   * @param {number} x        Centre x.
   * @param {number} y        Centre y.
   * @param {number} scale    Scale factor.
   * @param {number} angleDeg Rotation angle in degrees.
   * @returns {{ minX, maxX, minY, maxY }}
   */
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

  /**
   * Returns 0 if `bounds` clears the terrain and all `others` by at least
   * ELEPHANT_CLEARANCE; positive "how bad" score otherwise.
   *
   * @param {{ minX, maxX, minY, maxY }} bounds
   * @param {object[]} others
   * @returns {number}
   */
  platformOverlapAmount(bounds, others) {
    let overlap = 0;

    // Platform's bottom edge must be at least ELEPHANT_CLEARANCE above ground.
    // Sample terrain beyond the platform edges so that adjacent higher terrain
    // (e.g. at chunk boundaries where elevation drops) is accounted for.
    const groundY = this.terrain.minTerrainYInRange(bounds.minX - TERRAIN_CLEARANCE_MARGIN, bounds.maxX + TERRAIN_CLEARANCE_MARGIN);
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

  // ---------------------------------------------------------------------------
  // Physics body creation

  /**
   * Creates a static Matter.js platform image at the given position.
   *
   * @param {number} x          Centre x.
   * @param {number} y          Centre y.
   * @param {string} textureKey Phaser texture key.
   * @returns {Phaser.Physics.Matter.Image}
   */
  addStaticPlatform(x, y, textureKey) {
    const platform = this.scene.matter.add.image(x, y, textureKey, null, { isStatic: true });
    platform.body.label = 'platform';
    platform.setDepth(3);
    return platform;
  }

  // ---------------------------------------------------------------------------
  // Private helpers

  /**
   * Returns the AABB of the goal object, used to seed placedBounds so platforms
   * don't overlap the goal.
   *
   * @private
   */
  _getGoalBounds() {
    const goal = this.scene.goal;
    const halfW = TEXTURE_SIZES.goal.width / 2;
    const halfH = TEXTURE_SIZES.goal.height / 2;
    return {
      minX: goal.x - halfW,
      maxX: goal.x + halfW,
      minY: goal.y - halfH,
      maxY: goal.y + halfH,
    };
  }
}
