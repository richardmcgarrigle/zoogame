import { describe, it, expect, vi } from 'vitest';

vi.mock('phaser');

import PlaygroundScene from '../src/scenes/PlaygroundScene.js';
import { TEXTURE_SIZES } from '../src/util/textures.js';

// Platform leaf dimensions: 260 x 36
const { width: PLAT_W, height: PLAT_H } = TEXTURE_SIZES.platformLeaf;

function makeTerrainScene() {
  const scene = {
    terrainPoints: [{ x: 0, y: 900 }, { x: 10000, y: 900 }],
  };
  // platformOverlapAmount calls minTerrainYInRange which calls getTerrainYAt
  scene.getTerrainYAt = PlaygroundScene.prototype.getTerrainYAt.bind(scene);
  scene.minTerrainYInRange = PlaygroundScene.prototype.minTerrainYInRange.bind(scene);
  return scene;
}

describe('Feature: Platforms — getPlatformBounds', () => {
  describe('Scenario: AABB at angle 0', () => {
    it('computes correct AABB for platform at origin, scale 1, angle 0', () => {
      const scene = makeTerrainScene();
      const bounds = PlaygroundScene.prototype.getPlatformBounds.call(scene, 0, 0, 1, 0);

      expect(bounds.minX).toBeCloseTo(-PLAT_W / 2, 2); // -130
      expect(bounds.maxX).toBeCloseTo(PLAT_W / 2, 2);  // 130
      expect(bounds.minY).toBeCloseTo(-PLAT_H / 2, 2); // -18
      expect(bounds.maxY).toBeCloseTo(PLAT_H / 2, 2);  // 18
    });

    it('scales correctly with scale factor', () => {
      const scene = makeTerrainScene();
      const bounds = PlaygroundScene.prototype.getPlatformBounds.call(scene, 0, 0, 2, 0);

      expect(bounds.minX).toBeCloseTo(-PLAT_W, 2); // -260
      expect(bounds.maxX).toBeCloseTo(PLAT_W, 2);  // 260
    });

    it('offsets bounds by position', () => {
      const scene = makeTerrainScene();
      const bounds = PlaygroundScene.prototype.getPlatformBounds.call(scene, 100, 200, 1, 0);

      expect(bounds.minX).toBeCloseTo(100 - PLAT_W / 2, 2);
      expect(bounds.maxX).toBeCloseTo(100 + PLAT_W / 2, 2);
      expect(bounds.minY).toBeCloseTo(200 - PLAT_H / 2, 2);
      expect(bounds.maxY).toBeCloseTo(200 + PLAT_H / 2, 2);
    });
  });

  describe('Scenario: AABB at angle 90°', () => {
    it('swaps width and height in AABB when rotated 90°', () => {
      const scene = makeTerrainScene();
      const bounds = PlaygroundScene.prototype.getPlatformBounds.call(scene, 0, 0, 1, 90);

      // At 90°: halfW = (W*0 + H*1)/2 = H/2; halfH = (W*1 + H*0)/2 = W/2
      expect(bounds.maxX - bounds.minX).toBeCloseTo(PLAT_H, 1); // 36
      expect(bounds.maxY - bounds.minY).toBeCloseTo(PLAT_W, 1); // 260
    });
  });

  describe('Scenario: AABB symmetry', () => {
    it('AABB is centered at the given position', () => {
      const scene = makeTerrainScene();
      const bounds = PlaygroundScene.prototype.getPlatformBounds.call(scene, 500, 300, 1, 30);

      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      expect(centerX).toBeCloseTo(500, 1);
      expect(centerY).toBeCloseTo(300, 1);
    });
  });
});

function makeOverlapScene() {
  const scene = {
    terrainPoints: [{ x: 0, y: 900 }, { x: 10000, y: 900 }],
  };
  scene.getTerrainYAt = PlaygroundScene.prototype.getTerrainYAt.bind(scene);
  scene.minTerrainYInRange = PlaygroundScene.prototype.minTerrainYInRange.bind(scene);
  return scene;
}

describe('Feature: Platforms — platformOverlapAmount', () => {
  describe('Scenario: Platforms clear the ground (110px clearance)', () => {
    it('returns 0 overlap when platform is well above terrain', () => {
      const scene = makeOverlapScene();
      // Platform high up at y=400; terrain at 900; clearance needed = 110
      const bounds = { minX: 0, maxX: 260, minY: 380, maxY: 420 };

      const result = PlaygroundScene.prototype.platformOverlapAmount.call(scene, bounds, []);

      // maxY + 110 = 530 < 900 terrain, so no overlap
      expect(result).toBe(0);
    });

    it('returns positive overlap when platform is too close to terrain', () => {
      const scene = makeOverlapScene();
      // Platform bottom (maxY=850) + 110 clearance = 960 > 900 terrain → overlap
      const bounds = { minX: 0, maxX: 260, minY: 810, maxY: 850 };

      const result = PlaygroundScene.prototype.platformOverlapAmount.call(scene, bounds, []);

      expect(result).toBeGreaterThan(0);
    });
  });

  describe('Scenario: Platforms do not overlap', () => {
    it('returns 0 when two platforms have sufficient separation', () => {
      const scene = makeOverlapScene();
      // Two platforms far apart vertically
      const bounds = { minX: 100, maxX: 360, minY: 400, maxY: 436 };
      const other = { minX: 100, maxX: 360, minY: 200, maxY: 236 };

      // vertical gap = 400 - 236 = 164 > ELEPHANT_CLEARANCE(110)
      const result = PlaygroundScene.prototype.platformOverlapAmount.call(scene, bounds, [other]);

      expect(result).toBe(0);
    });

    it('returns positive overlap when platforms are too close vertically', () => {
      const scene = makeOverlapScene();
      // Two overlapping platforms at same x
      const bounds = { minX: 100, maxX: 360, minY: 400, maxY: 436 };
      const other = { minX: 100, maxX: 360, minY: 350, maxY: 386 }; // close!

      const result = PlaygroundScene.prototype.platformOverlapAmount.call(scene, bounds, [other]);

      expect(result).toBeGreaterThan(0);
    });
  });
});
