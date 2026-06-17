import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('phaser');

import Elephant from '../src/objects/Elephant.js';
import { createMockScene, createMockElephant } from './helpers/mockScene.js';

describe('Feature: Player Movement', () => {
  describe('Scenario: Walk right on flat ground', () => {
    it('moves at 4.5 px/frame when right input held on ground', () => {
      const elephant = createMockElephant();
      elephant.groundContacts = 1;
      elephant.cursors.right.isDown = true;

      Elephant.prototype.update.call(elephant, 0, 16, []);

      expect(elephant.sprite.setVelocityX).toHaveBeenCalledWith(4.5);
    });
  });

  describe('Scenario: Walk left on flat ground', () => {
    it('moves at -4.5 px/frame when left input held on ground', () => {
      const elephant = createMockElephant();
      elephant.groundContacts = 1;
      elephant.cursors.left.isDown = true;

      Elephant.prototype.update.call(elephant, 0, 16, []);

      expect(elephant.sprite.setVelocityX).toHaveBeenCalledWith(-4.5);
    });
  });

  describe('Scenario: Reduced air control while airborne', () => {
    it('moves at 3.2 px/frame (reduced) when right input held in air', () => {
      const elephant = createMockElephant();
      elephant.groundContacts = 0; // airborne
      elephant.cursors.right.isDown = true;

      Elephant.prototype.update.call(elephant, 0, 16, []);

      expect(elephant.sprite.setVelocityX).toHaveBeenCalledWith(3.2);
    });

    it('moves at -3.2 px/frame when left input held in air', () => {
      const elephant = createMockElephant();
      elephant.groundContacts = 0;
      elephant.cursors.left.isDown = true;

      Elephant.prototype.update.call(elephant, 0, 16, []);

      expect(elephant.sprite.setVelocityX).toHaveBeenCalledWith(-3.2);
    });
  });

  describe('Scenario: Elephant faces the direction of travel', () => {
    it('sets facing to 1 when moving right', () => {
      const elephant = createMockElephant();
      elephant.groundContacts = 1;
      elephant.cursors.right.isDown = true;

      Elephant.prototype.update.call(elephant, 0, 16, []);

      expect(elephant.facing).toBe(1);
    });

    it('sets facing to -1 when moving left', () => {
      const elephant = createMockElephant();
      elephant.groundContacts = 1;
      elephant.cursors.left.isDown = true;

      Elephant.prototype.update.call(elephant, 0, 16, []);

      expect(elephant.facing).toBe(-1);
    });
  });

  describe('Scenario: Elephant tilts to match slope', () => {
    it('lerps surfaceAngle toward contact body angle with factor 0.18', () => {
      const { scene, sprite } = createMockScene();
      const elephant = new Elephant(scene, 0, 0);

      const contactBody = { id: 99, angle: 0.5 };
      elephant.groundContacts = 1;
      elephant.contactBodies = new Map([[99, contactBody]]);
      elephant.surfaceAngle = 0;

      elephant.updateVisuals(0);

      const expected = 0 + (0.5 - 0) * 0.18;
      expect(elephant.surfaceAngle).toBeCloseTo(expected, 5);
    });

    it('clamps surface angle to ±35° (±0.61 rad)', () => {
      const { scene } = createMockScene();
      const elephant = new Elephant(scene, 0, 0);

      const contactBody = { id: 99, angle: 1.5 }; // beyond ±0.61
      elephant.groundContacts = 1;
      elephant.contactBodies = new Map([[99, contactBody]]);
      elephant.surfaceAngle = 0.60;

      elephant.updateVisuals(0);

      expect(elephant.surfaceAngle).toBeLessThanOrEqual(0.61);
    });
  });

  describe('Scenario: Elephant is stationary (idle animation)', () => {
    it('plays idle animation when no input and on ground', () => {
      const elephant = createMockElephant();
      elephant.groundContacts = 1;
      // no input keys pressed

      Elephant.prototype.update.call(elephant, 0, 16, []);

      expect(elephant.updateVisuals).toHaveBeenCalled();
      // The update method plays animations based on state. With no movement and grounded:
      // it calls sprite.play('elephant-idle', true) before calling updateVisuals
      // We need to check the real sprite.play — but updateVisuals is stubbed in createMockElephant
      // So let's use a real Elephant instance to verify the animation call
    });

    it('plays idle animation using real Elephant instance', () => {
      const { scene, sprite } = createMockScene();
      const elephant = new Elephant(scene, 0, 0);
      elephant.groundContacts = 1;
      // no keys pressed

      elephant.update(0, 16, []);

      expect(sprite.play).toHaveBeenCalledWith('elephant-idle', true);
    });
  });
});
