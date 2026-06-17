import { describe, it, expect, vi } from 'vitest';

vi.mock('phaser');

import PlaygroundScene from '../src/scenes/PlaygroundScene.js';

function makeTerrainScene(points) {
  return { terrainPoints: points };
}

describe('Feature: Terrain / getTerrainYAt', () => {
  describe('Scenario: Exact match returns that point', () => {
    it('returns the y of the first point when x matches exactly', () => {
      const scene = makeTerrainScene([{ x: 0, y: 900 }, { x: 100, y: 800 }]);
      const result = PlaygroundScene.prototype.getTerrainYAt.call(scene, 0);
      expect(result).toBe(900);
    });

    it('returns the y of the last point when x matches exactly', () => {
      const scene = makeTerrainScene([{ x: 0, y: 900 }, { x: 100, y: 800 }]);
      const result = PlaygroundScene.prototype.getTerrainYAt.call(scene, 100);
      expect(result).toBe(800);
    });
  });

  describe('Scenario: Linear interpolation between points', () => {
    it('interpolates y at midpoint correctly', () => {
      const scene = makeTerrainScene([{ x: 0, y: 900 }, { x: 100, y: 800 }]);
      const result = PlaygroundScene.prototype.getTerrainYAt.call(scene, 50);
      expect(result).toBe(850);
    });

    it('interpolates y at 25% of segment', () => {
      const scene = makeTerrainScene([{ x: 0, y: 1000 }, { x: 200, y: 800 }]);
      const result = PlaygroundScene.prototype.getTerrainYAt.call(scene, 50);
      expect(result).toBe(950);
    });

    it('works with multiple segments', () => {
      const scene = makeTerrainScene([
        { x: 0, y: 900 },
        { x: 100, y: 850 },
        { x: 200, y: 800 },
      ]);
      const result = PlaygroundScene.prototype.getTerrainYAt.call(scene, 150);
      expect(result).toBe(825);
    });
  });

  describe('Scenario: Clamped to terrain range', () => {
    it('clamps x below first point to first point y', () => {
      const scene = makeTerrainScene([{ x: 0, y: 900 }, { x: 100, y: 800 }]);
      const result = PlaygroundScene.prototype.getTerrainYAt.call(scene, -50);
      expect(result).toBe(900);
    });

    it('clamps x beyond last point to last point y', () => {
      const scene = makeTerrainScene([{ x: 0, y: 900 }, { x: 100, y: 800 }]);
      const result = PlaygroundScene.prototype.getTerrainYAt.call(scene, 200);
      expect(result).toBe(800);
    });
  });
});

describe('Feature: Terrain / minTerrainYInRange', () => {
  function makeTerrainSceneWithGetY(points) {
    const scene = makeTerrainScene(points);
    scene.getTerrainYAt = PlaygroundScene.prototype.getTerrainYAt.bind(scene);
    return scene;
  }

  it('returns the minimum y (highest ground point) in range', () => {
    const points = [
      { x: 0, y: 900 },
      { x: 50, y: 800 }, // highest ground (lowest y value = most elevated)
      { x: 100, y: 850 },
    ];
    const scene = makeTerrainSceneWithGetY(points);

    const result = PlaygroundScene.prototype.minTerrainYInRange.call(scene, 0, 100);

    expect(result).toBeLessThanOrEqual(800);
  });

  it('handles single-point range', () => {
    const scene = makeTerrainSceneWithGetY([{ x: 0, y: 900 }, { x: 100, y: 800 }]);

    const result = PlaygroundScene.prototype.minTerrainYInRange.call(scene, 50, 50);

    expect(result).toBe(850); // interpolated at x=50
  });
});
