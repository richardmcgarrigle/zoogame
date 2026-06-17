import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('phaser');

import { justDownMock } from 'phaser';
import Elephant from '../src/objects/Elephant.js';
import { createMockScene } from './helpers/mockScene.js';

beforeEach(() => {
  justDownMock.mockReturnValue(false);
});

function makeElephant() {
  const { scene, sprite } = createMockScene();
  const elephant = new Elephant(scene, 0, 0);
  return { scene, sprite, elephant };
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

  describe('Scenario: Wind streaks appear while dashing', () => {
    it('spawns 3 wind streak particles per frame while dashing and moving', () => {
      const { elephant } = makeElephant();
      elephant.isDashing = true;
      elephant.sprite.body.velocity.x = 9; // moving

      const before = elephant.windStreaks.length;
      elephant.updateWindEffect(16);

      expect(elephant.windStreaks.length - before).toBe(3);
    });

    it('does not spawn streaks when not dashing', () => {
      const { elephant } = makeElephant();
      elephant.isDashing = false;
      elephant.sprite.body.velocity.x = 9;

      const before = elephant.windStreaks.length;
      elephant.updateWindEffect(16);

      expect(elephant.windStreaks.length).toBe(before);
    });
  });

  describe('Scenario: Wind streak lifetime', () => {
    it('removes streaks after 260ms lifetime', () => {
      const { elephant } = makeElephant();
      elephant.windStreaks = [{ x: 0, y: 0, vx: -280, len: 50, life: 260, maxLife: 260 }];

      elephant.updateWindEffect(300); // delta > life

      expect(elephant.windStreaks.length).toBe(0);
    });

    it('keeps streaks alive within their lifetime', () => {
      const { elephant } = makeElephant();
      elephant.windStreaks = [{ x: 0, y: 0, vx: -280, len: 50, life: 260, maxLife: 260 }];

      elephant.updateWindEffect(100); // only 100ms elapsed

      expect(elephant.windStreaks.length).toBe(1);
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
