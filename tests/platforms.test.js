import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('phaser');
import PlaygroundScene from '../src/scenes/PlaygroundScene.js';

describe('Feature: Platforms', () => {
  let mockScene;

  beforeEach(() => {
    mockScene = {
      terrainPoints: [{ x: 0, y: 900 }, { x: 2000, y: 900 }],
      getTerrainYAt: PlaygroundScene.prototype.getTerrainYAt,
    };
    mockScene.getTerrainYAt = mockScene.getTerrainYAt.bind(mockScene);
  });

  describe('getPlatformBounds', () => {
    it('returns correct AABB for angle=0, scale=1', () => {
      const bounds = PlaygroundScene.prototype.getPlatformBounds.call(mockScene, 0, 0, 1, 0);
      // TEXTURE_SIZES.platformLeaf = {width:260, height:36}
      expect(bounds.minX).toBeCloseTo(-130, 0);
      expect(bounds.maxX).toBeCloseTo(130, 0);
      expect(bounds.minY).toBeCloseTo(-18, 0);
      expect(bounds.maxY).toBeCloseTo(18, 0);
    });

    it('returns correct AABB for angle=90, scale=1 (width and height swap)', () => {
      const bounds = PlaygroundScene.prototype.getPlatformBounds.call(mockScene, 0, 0, 1, 90);
      // At 90deg: AABB becomes 36w x 260h
      expect(bounds.maxX - bounds.minX).toBeCloseTo(36, 0);
      expect(bounds.maxY - bounds.minY).toBeCloseTo(260, 0);
    });
  });

  describe('platformOverlapAmount', () => {
    beforeEach(() => {
      // Give mockScene a minTerrainYInRange that returns a high value (no ground penetration)
      mockScene.minTerrainYInRange = vi.fn(() => 10000);
    });

    it('returns 0 when no overlap', () => {
      const bounds = { minX: 0, maxX: 260, minY: -100, maxY: -82 };
      const others = [{ minX: 0, maxX: 260, minY: 100, maxY: 118 }];
      const result = PlaygroundScene.prototype.platformOverlapAmount.call(mockScene, bounds, others);
      expect(result).toBe(0);
    });

    it('returns > 0 when overlap', () => {
      const bounds = { minX: 0, maxX: 260, minY: 0, maxY: 36 };
      const others = [{ minX: 0, maxX: 260, minY: 10, maxY: 46 }];
      const result = PlaygroundScene.prototype.platformOverlapAmount.call(mockScene, bounds, others);
      expect(result).toBeGreaterThan(0);
    });
  });
});
