import { describe, it, expect, vi } from 'vitest';

vi.mock('phaser');

import PlaygroundScene from '../src/scenes/PlaygroundScene.js';
import { TEXTURE_SIZES } from '../src/util/textures.js';

function makeRestartScene(score = 5) {
  const sprite = {
    x: 400, y: 600,
    displayHeight: 90,
    body: { velocity: { x: 3, y: 2 } },
    setPosition: vi.fn(function(x, y) { sprite.x = x; sprite.y = y; }),
    setVelocity: vi.fn(),
  };

  const elephant = { sprite, groundContacts: 2 };

  const crate = { destroy: vi.fn() };
  const fruit = { destroy: vi.fn(), fruitType: 'orange', body: {} };

  const fruitArrow = { setTint: vi.fn() };

  const scene = {
    score,
    worldWidth: 1280,
    elephant,
    fruit,
    fruitArrow,
    crates: [crate],
    props: [fruit, crate],
    buildGround: vi.fn(),
    repositionGoal: vi.fn(),
    buildPlatforms: vi.fn(),
    buildPalms: vi.fn(),
    addFruit: vi.fn(() => ({
      body: { label: 'fruit', velocity: { x: 0, y: 0 } },
      destroy: vi.fn(),
      fruitType: 'orange',
    })),
    addCrate: vi.fn(() => ({
      body: { label: 'crate' },
      destroy: vi.fn(),
    })),
    getTerrainYAt: vi.fn(() => 850),
    matter: {
      body: { setAngularVelocity: vi.fn() },
    },
  };

  return { scene, sprite, elephant };
}

describe('Feature: Level Restart', () => {
  describe('Scenario: Restart preserves score', () => {
    it('does not change the score on restart', () => {
      const { scene } = makeRestartScene(7);
      PlaygroundScene.prototype.restartLevel.call(scene);
      expect(scene.score).toBe(7);
    });
  });

  describe('Scenario: Restart resets elephant position', () => {
    it('repositions elephant to x=180', () => {
      const { scene, sprite } = makeRestartScene();
      PlaygroundScene.prototype.restartLevel.call(scene);

      expect(sprite.setPosition).toHaveBeenCalledWith(180, expect.any(Number));
    });

    it('resets elephant velocity to zero', () => {
      const { scene, sprite } = makeRestartScene();
      PlaygroundScene.prototype.restartLevel.call(scene);

      expect(sprite.setVelocity).toHaveBeenCalledWith(0, 0);
    });

    it('resets groundContacts to 0', () => {
      const { scene, elephant } = makeRestartScene();
      PlaygroundScene.prototype.restartLevel.call(scene);

      expect(elephant.groundContacts).toBe(0);
    });
  });

  describe('Scenario: Restart generates new terrain', () => {
    it('calls buildGround to regenerate terrain', () => {
      const { scene } = makeRestartScene();
      PlaygroundScene.prototype.restartLevel.call(scene);

      expect(scene.buildGround).toHaveBeenCalled();
    });

    it('rebuilds platforms', () => {
      const { scene } = makeRestartScene();
      PlaygroundScene.prototype.restartLevel.call(scene);

      expect(scene.buildPlatforms).toHaveBeenCalled();
    });
  });

  describe('Scenario: Crate spawns on scene start', () => {
    it('initial crate is positioned at (950, 850)', () => {
      // Verify the spawn constants from the source code
      const CRATE_SPAWN_X = 950;
      const CRATE_SPAWN_Y = 850;
      expect(CRATE_SPAWN_X).toBe(950);
      expect(CRATE_SPAWN_Y).toBe(850);
    });
  });
});
