import { describe, it, expect, vi } from 'vitest';

vi.mock('phaser');

import TerrainManager from '../src/managers/TerrainManager.js';

function makeTerrainManager(points) {
  const manager = Object.create(TerrainManager.prototype);
  manager.terrainPoints = points;
  // scene stub — only needed for methods that use this.scene (not tested here)
  manager.scene = {};
  return manager;
}

describe('Feature: Terrain / getTerrainYAt', () => {
  describe('Scenario: Exact match returns that point', () => {
    it('returns the y of the first point when x matches exactly', () => {
      const manager = makeTerrainManager([{ x: 0, y: 900 }, { x: 100, y: 800 }]);
      const result = manager.getTerrainYAt(0);
      expect(result).toBe(900);
    });

    it('returns the y of the last point when x matches exactly', () => {
      const manager = makeTerrainManager([{ x: 0, y: 900 }, { x: 100, y: 800 }]);
      const result = manager.getTerrainYAt(100);
      expect(result).toBe(800);
    });
  });

  describe('Scenario: Linear interpolation between points', () => {
    it('interpolates y at midpoint correctly', () => {
      const manager = makeTerrainManager([{ x: 0, y: 900 }, { x: 100, y: 800 }]);
      const result = manager.getTerrainYAt(50);
      expect(result).toBe(850);
    });

    it('interpolates y at 25% of segment', () => {
      const manager = makeTerrainManager([{ x: 0, y: 1000 }, { x: 200, y: 800 }]);
      const result = manager.getTerrainYAt(50);
      expect(result).toBe(950);
    });

    it('works with multiple segments', () => {
      const manager = makeTerrainManager([
        { x: 0, y: 900 },
        { x: 100, y: 850 },
        { x: 200, y: 800 },
      ]);
      const result = manager.getTerrainYAt(150);
      expect(result).toBe(825);
    });
  });

  describe('Scenario: Clamped to terrain range', () => {
    it('clamps x below first point to first point y', () => {
      const manager = makeTerrainManager([{ x: 0, y: 900 }, { x: 100, y: 800 }]);
      const result = manager.getTerrainYAt(-50);
      expect(result).toBe(900);
    });

    it('clamps x beyond last point to last point y', () => {
      const manager = makeTerrainManager([{ x: 0, y: 900 }, { x: 100, y: 800 }]);
      const result = manager.getTerrainYAt(200);
      expect(result).toBe(800);
    });
  });
});

describe('Feature: Terrain / minTerrainYInRange', () => {
  it('returns the minimum y (highest ground point) in range', () => {
    const points = [
      { x: 0, y: 900 },
      { x: 50, y: 800 }, // highest ground (lowest y value = most elevated)
      { x: 100, y: 850 },
    ];
    const manager = makeTerrainManager(points);

    const result = manager.minTerrainYInRange(0, 100);

    expect(result).toBeLessThanOrEqual(800);
  });

  it('handles single-point range', () => {
    const manager = makeTerrainManager([{ x: 0, y: 900 }, { x: 100, y: 800 }]);

    const result = manager.minTerrainYInRange(50, 50);

    expect(result).toBe(850); // interpolated at x=50
  });
});
