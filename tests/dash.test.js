import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('phaser');

import { justDownMock } from 'phaser';
import Elephant from '../src/objects/Elephant.js';
import DashEffect from '../src/objects/DashEffect.js';
import { createMockScene } from './helpers/mockScene.js';

beforeEach(() => {
  justDownMock.mockReturnValue(false);
});

function makeElephant() {
  const { scene, sprite } = createMockScene();
  const elephant = new Elephant(scene, 0, 0);
  return { scene, sprite, elephant };
}

function makeDashEffect() {
  const scene = {
    add: {
      graphics: vi.fn(() => ({
        setDepth: vi.fn().mockReturnThis(),
        clear: vi.fn().mockReturnThis(),
        fillStyle: vi.fn().mockReturnThis(),
        fillRect: vi.fn().mockReturnThis(),
      })),
    },
  };
  const effect = new DashEffect(scene);
  return effect;
}

describe('Feature: Dash', () => {
  describe('Scenario: Dash while grounded', () => {
    it('dashes at 9 px/frame when dash held and grounded facing right', () => {
      const { sprite, elephant } = makeElephant();
      elephant.groundContacts = 1;
      elephant.facing = 1;
      elephant.cursors.shift.isDown = true;

      elephant.update(0, 16, []);

      expect(sprite.setVelocityX).toHaveBeenCalledWith(9);
    });

    it('dashes at -9 px/frame when dash held facing left', () => {
      const { sprite, elephant } = makeElephant();
      elephant.groundContacts = 1;
      elephant.facing = -1;
      elephant.cursors.shift.isDown = true;

      elephant.update(0, 16, []);

      expect(sprite.setVelocityX).toHaveBeenCalledWith(-9);
    });
  });

  describe('Scenario: Dash while airborne', () => {
    it('dashes at 9 px/frame when dash held in air', () => {
      const { sprite, elephant } = makeElephant();
      elephant.groundContacts = 0; // airborne
      elephant.facing = 1;
      elephant.cursors.shift.isDown = true;

      elephant.update(0, 16, []);

      expect(sprite.setVelocityX).toHaveBeenCalledWith(9);
    });
  });

  describe('Scenario: Dash ends when input released', () => {
    it('sets isDashing to false when dash input not held', () => {
      const { elephant } = makeElephant();
      elephant.isDashing = true;
      // shift not held (isDown: false by default)

      elephant.update(0, 16, []);

      expect(elephant.isDashing).toBe(false);
    });

    it('sets isDashing to true while dash held', () => {
      const { elephant } = makeElephant();
      elephant.cursors.shift.isDown = true;

      elephant.update(0, 16, []);

      expect(elephant.isDashing).toBe(true);
    });
  });

  describe('Scenario: Wind streaks appear while dashing (DashEffect)', () => {
    it('spawns 3 wind streak particles per frame while dashing and moving', () => {
      const effect = makeDashEffect();
      const before = effect._streaks.length;

      effect.update(16, 0, 0, true, 1, 9); // dashing, moving right

      expect(effect._streaks.length - before).toBe(3);
    });

    it('does not spawn streaks when not dashing', () => {
      const effect = makeDashEffect();
      const before = effect._streaks.length;

      effect.update(16, 0, 0, false, 1, 9); // not dashing

      expect(effect._streaks.length).toBe(before);
    });
  });

  describe('Scenario: Wind streak lifetime (DashEffect)', () => {
    it('removes streaks after 260ms lifetime', () => {
      const effect = makeDashEffect();
      effect._streaks.push({ x: 0, y: 0, vx: -280, len: 50, life: 260, maxLife: 260 });

      effect.update(300, 0, 0, false, 1, 0); // delta > life

      expect(effect._streaks.length).toBe(0);
    });

    it('keeps streaks alive within their lifetime', () => {
      const effect = makeDashEffect();
      effect._streaks.push({ x: 0, y: 0, vx: -280, len: 50, life: 260, maxLife: 260 });

      effect.update(100, 0, 0, false, 1, 0); // only 100ms elapsed

      expect(effect._streaks.length).toBe(1);
    });
  });

  describe('Scenario: Run animation accelerates while dashing', () => {
    it('plays run animation at 2.5x speed when dashing', () => {
      const { sprite, elephant } = makeElephant();
      elephant.groundContacts = 1;
      elephant.cursors.shift.isDown = true;
      elephant.cursors.right.isDown = true;

      elephant.update(0, 16, []);

      expect(sprite.play).toHaveBeenCalledWith('elephant-run', true);
      expect(sprite.anims.timeScale).toBe(2.5);
    });
  });
});
