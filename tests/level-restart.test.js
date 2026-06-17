import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('phaser');
import PlaygroundScene from '../src/scenes/PlaygroundScene.js';
import { createMockScene } from './helpers/mockScene.js';

describe('Feature: Level Restart', () => {
  let mockScene;

  beforeEach(() => {
    const { scene, sprite } = createMockScene();
    mockScene = {
      ...scene,
      score: 5,
      crates: [],
      fruit: null,
      elephant: {
        sprite,
        groundContacts: 0,
        wasGrounded: false,
        isDashing: false,
        facing: 1,
        windStreaks: [],
        celebrateTimer: 0,
      },
      terrainPoints: [{ x: 0, y: 900 }, { x: 2000, y: 900 }],
      worldWidth: 2000,
      cameras: scene.cameras,
      buildGround: vi.fn(),
      buildPlatforms: vi.fn(),
      buildPalms: vi.fn(),
      addFruit: vi.fn(() => ({
        body: { label: 'fruit', velocity: { x: 0, y: 0 }, position: { x: 0, y: 0 } },
        destroy: vi.fn(),
        fruitType: 'orange',
        x: 0, y: 0,
      })),
      addCrate: vi.fn(() => ({
        body: { label: 'crate', velocity: { x: 0, y: 0 } },
        destroy: vi.fn(),
      })),
      scoreText: { setText: vi.fn().mockReturnThis() },
      fruitArrow: { setTint: vi.fn() },
      getTerrainYAt: vi.fn(() => 900),
      repositionGoal: vi.fn(),
    };
  });

  it('preserves score across restart', () => {
    const oldScore = mockScene.score;
    PlaygroundScene.prototype.restartLevel.call(mockScene);
    expect(mockScene.score).toBe(oldScore);
  });

  it('resets elephant position to x=180', () => {
    PlaygroundScene.prototype.restartLevel.call(mockScene);
    expect(mockScene.elephant.sprite.setPosition).toHaveBeenCalledWith(180, expect.anything());
  });

  it('zeroes elephant velocity', () => {
    PlaygroundScene.prototype.restartLevel.call(mockScene);
    expect(mockScene.elephant.sprite.setVelocity).toHaveBeenCalledWith(0, 0);
  });

  it('rebuilds terrain', () => {
    PlaygroundScene.prototype.restartLevel.call(mockScene);
    expect(mockScene.buildGround).toHaveBeenCalled();
  });
});
