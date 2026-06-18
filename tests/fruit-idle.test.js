import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('phaser');

import FruitManager from '../src/managers/FruitManager.js';

function makeIdleManager(fruitVelocity = { x: 0, y: 0 }) {
  const fruitIdleText = {
    setVisible: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    visible: false,
  };

  const manager = Object.create(FruitManager.prototype);
  manager.fruit = {
    body: { velocity: fruitVelocity },
  };
  manager.fruitIdleTime = 0;
  manager.scene = {
    fruitIdleText,
    worldWidth: 1280,
    props: [],
    fruitArrow: { setTint: vi.fn() },
    matter: { body: { setVelocity: vi.fn(), setAngularVelocity: vi.fn() } },
  };
  manager.respawnFruit = vi.fn();

  return manager;
}

describe('Feature: Fruit Physics & Respawn — Idle Timer', () => {
  describe('Scenario: Idle fruit warning', () => {
    it('increments fruitIdleTime when fruit speed < 0.8 px/frame', () => {
      const manager = makeIdleManager({ x: 0.1, y: 0.1 }); // speed ≈ 0.14
      manager.fruitIdleTime = 0;

      FruitManager.prototype.updateFruitIdleTimer.call(manager, 1000); // 1 second

      expect(manager.fruitIdleTime).toBeCloseTo(1, 1);
    });

    it('resets fruitIdleTime when speed >= 0.8', () => {
      const manager = makeIdleManager({ x: 1, y: 0 }); // speed = 1.0
      manager.fruitIdleTime = 5;

      FruitManager.prototype.updateFruitIdleTimer.call(manager, 1000);

      expect(manager.fruitIdleTime).toBe(0);
    });

    it('shows warning text when 5 or fewer seconds remain (fruitIdleTime >= 5s)', () => {
      const manager = makeIdleManager({ x: 0, y: 0 }); // stopped
      manager.fruitIdleTime = 5.1; // 4.9s remaining before 10s mark

      FruitManager.prototype.updateFruitIdleTimer.call(manager, 0);

      expect(manager.scene.fruitIdleText.setVisible).toHaveBeenCalledWith(true);
    });

    it('warning text contains "respawning"', () => {
      const manager = makeIdleManager({ x: 0, y: 0 });
      manager.fruitIdleTime = 5.5; // ≥5 seconds

      FruitManager.prototype.updateFruitIdleTimer.call(manager, 0);

      const textCall = manager.scene.fruitIdleText.setText.mock.calls[0]?.[0] ?? '';
      expect(textCall).toMatch(/respawning/i);
    });

    it('hides warning text when more than 5 seconds remain', () => {
      const manager = makeIdleManager({ x: 0, y: 0 });
      manager.fruitIdleTime = 2; // 8 seconds remain

      FruitManager.prototype.updateFruitIdleTimer.call(manager, 0);

      expect(manager.scene.fruitIdleText.setVisible).toHaveBeenCalledWith(false);
    });
  });

  describe('Scenario: Idle fruit auto-respawn at 10 seconds', () => {
    it('calls respawnFruit when fruitIdleTime reaches 10 seconds', () => {
      const manager = makeIdleManager({ x: 0, y: 0 });
      manager.fruitIdleTime = 9.8;
      manager.respawnFruit = vi.fn();

      // delta pushes it over 10s
      FruitManager.prototype.updateFruitIdleTimer.call(manager, 300);

      expect(manager.respawnFruit).toHaveBeenCalled();
    });

    it('resets fruitIdleTime to 0 after respawn', () => {
      const manager = makeIdleManager({ x: 0, y: 0 });
      manager.fruitIdleTime = 9.8;
      manager.respawnFruit = vi.fn();

      FruitManager.prototype.updateFruitIdleTimer.call(manager, 300);

      expect(manager.fruitIdleTime).toBe(0);
    });
  });

  describe('Scenario: Fruit stays within world bounds', () => {
    it('resets fruitIdleTime when fruit has no body (destroyed or null)', () => {
      const manager = Object.create(FruitManager.prototype);
      manager.fruit = null; // no fruit
      manager.fruitIdleTime = 5;
      manager.scene = {
        fruitIdleText: { setVisible: vi.fn().mockReturnThis() },
      };

      FruitManager.prototype.updateFruitIdleTimer.call(manager, 1000);

      expect(manager.fruitIdleTime).toBe(0);
    });
  });
});
