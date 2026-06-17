import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('phaser');
import PlaygroundScene from '../src/scenes/PlaygroundScene.js';
import { createMockScene } from './helpers/mockScene.js';

describe('Feature: Background Environment', () => {
  let mockScene;

  beforeEach(() => {
    const { scene } = createMockScene();
    mockScene = {
      ...scene,
      clouds: [],
      birds: [],
      worldWidth: 2000,
      fruit: null,
      terrainPoints: [{ x: 0, y: 900 }, { x: 2000, y: 900 }],
      getTerrainYAt: vi.fn(() => 900),
    };
  });

  describe('createClouds', () => {
    it('creates 6 clouds', () => {
      PlaygroundScene.prototype.createClouds.call(mockScene);
      expect(mockScene.clouds.length).toBe(6);
    });

    it('all cloud speeds are between 11 and 20', () => {
      PlaygroundScene.prototype.createClouds.call(mockScene);
      for (const cloud of mockScene.clouds) {
        expect(cloud._speed).toBeGreaterThanOrEqual(11);
        expect(cloud._speed).toBeLessThanOrEqual(20);
      }
    });
  });

  describe('createBirds', () => {
    it('creates 5 birds', () => {
      PlaygroundScene.prototype.createBirds.call(mockScene);
      expect(mockScene.birds.length).toBe(5);
    });

    it('all bird speeds are between 60 and 140', () => {
      PlaygroundScene.prototype.createBirds.call(mockScene);
      for (const bird of mockScene.birds) {
        expect(bird._speed).toBeGreaterThanOrEqual(60);
        expect(bird._speed).toBeLessThanOrEqual(140);
      }
    });
  });
});
