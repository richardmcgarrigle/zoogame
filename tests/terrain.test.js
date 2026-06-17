import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('phaser');
import PlaygroundScene from '../src/scenes/PlaygroundScene.js';

describe('Feature: Terrain', () => {
  let mockScene;

  beforeEach(() => {
    mockScene = {
      terrainPoints: [{ x: 0, y: 900 }, { x: 100, y: 800 }],
    };
  });

  describe('getTerrainYAt', () => {
    it('returns exact y at a known point', () => {
      const y = PlaygroundScene.prototype.getTerrainYAt.call(mockScene, 0);
      expect(y).toBe(900);
    });

    it('linear interpolation at midpoint', () => {
      const y = PlaygroundScene.prototype.getTerrainYAt.call(mockScene, 50);
      expect(y).toBe(850);
    });

    it('clamps to first point for x < min', () => {
      const y = PlaygroundScene.prototype.getTerrainYAt.call(mockScene, -10);
      expect(y).toBe(900);
    });

    it('clamps to last point for x > max', () => {
      const y = PlaygroundScene.prototype.getTerrainYAt.call(mockScene, 200);
      expect(y).toBe(800);
    });
  });

  describe('minTerrainYInRange', () => {
    beforeEach(() => {
      mockScene.terrainPoints = [{ x: 0, y: 900 }, { x: 50, y: 800 }, { x: 100, y: 850 }];
      // minTerrainYInRange calls this.getTerrainYAt internally
      mockScene.getTerrainYAt = PlaygroundScene.prototype.getTerrainYAt.bind(mockScene);
    });

    it('returns minimum y (highest terrain) in range', () => {
      const minY = PlaygroundScene.prototype.minTerrainYInRange.call(mockScene, 0, 100);
      expect(minY).toBeLessThanOrEqual(800);
    });
  });
});
