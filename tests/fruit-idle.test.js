import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('phaser');

import PlaygroundScene from '../src/scenes/PlaygroundScene.js';

function makeIdleScene(fruitVelocity = { x: 0, y: 0 }) {
  const fruitIdleText = {
    setVisible: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    visible: false,
  };
  const respawnFruit = vi.fn();

  return {
    fruit: {
      body: { velocity: fruitVelocity },
    },
    fruitIdleTime: 0,
    fruitIdleText,
    respawnFruit,
  };
}

describe('Feature: Fruit Physics & Respawn — Idle Timer', () => {
  describe('Scenario: Idle fruit warning', () => {
    it('increments fruitIdleTime when fruit speed < 0.8 px/frame', () => {
      const scene = makeIdleScene({ x: 0.1, y: 0.1 }); // speed ≈ 0.14
      scene.fruitIdleTime = 0;

      PlaygroundScene.prototype.updateFruitIdleTimer.call(scene, 1000); // 1 second

      expect(scene.fruitIdleTime).toBeCloseTo(1, 1);
    });

    it('resets fruitIdleTime when speed >= 0.8', () => {
      const scene = makeIdleScene({ x: 1, y: 0 }); // speed = 1.0
      scene.fruitIdleTime = 5;

      PlaygroundScene.prototype.updateFruitIdleTimer.call(scene, 1000);

      expect(scene.fruitIdleTime).toBe(0);
    });

    it('shows warning text when 5 or fewer seconds remain (fruitIdleTime >= 5s)', () => {
      const scene = makeIdleScene({ x: 0, y: 0 }); // stopped
      scene.fruitIdleTime = 5.1; // 4.9s remaining before 10s mark

      PlaygroundScene.prototype.updateFruitIdleTimer.call(scene, 0);

      expect(scene.fruitIdleText.setVisible).toHaveBeenCalledWith(true);
    });

    it('warning text contains "respawning"', () => {
      const scene = makeIdleScene({ x: 0, y: 0 });
      scene.fruitIdleTime = 5.5; // ≥5 seconds

      PlaygroundScene.prototype.updateFruitIdleTimer.call(scene, 0);

      const textCall = scene.fruitIdleText.setText.mock.calls[0]?.[0] ?? '';
      expect(textCall).toMatch(/respawning/i);
    });

    it('hides warning text when more than 5 seconds remain', () => {
      const scene = makeIdleScene({ x: 0, y: 0 });
      scene.fruitIdleTime = 2; // 8 seconds remain

      PlaygroundScene.prototype.updateFruitIdleTimer.call(scene, 0);

      expect(scene.fruitIdleText.setVisible).toHaveBeenCalledWith(false);
    });
  });

  describe('Scenario: Idle fruit auto-respawn at 10 seconds', () => {
    it('calls respawnFruit when fruitIdleTime reaches 10 seconds', () => {
      const scene = makeIdleScene({ x: 0, y: 0 });
      scene.fruitIdleTime = 9.8;
      scene.respawnFruit = vi.fn();

      // delta pushes it over 10s
      PlaygroundScene.prototype.updateFruitIdleTimer.call(scene, 300);

      expect(scene.respawnFruit).toHaveBeenCalled();
    });

    it('resets fruitIdleTime to 0 after respawn', () => {
      const scene = makeIdleScene({ x: 0, y: 0 });
      scene.fruitIdleTime = 9.8;
      scene.respawnFruit = vi.fn();

      PlaygroundScene.prototype.updateFruitIdleTimer.call(scene, 300);

      expect(scene.fruitIdleTime).toBe(0);
    });
  });

  describe('Scenario: Fruit stays within world bounds', () => {
    it('resets fruitIdleTime when fruit has no body (destroyed or null)', () => {
      const scene = {
        fruit: null, // no fruit
        fruitIdleTime: 5,
        fruitIdleText: { setVisible: vi.fn().mockReturnThis() },
      };

      PlaygroundScene.prototype.updateFruitIdleTimer.call(scene, 1000);

      expect(scene.fruitIdleTime).toBe(0);
    });
  });
});
