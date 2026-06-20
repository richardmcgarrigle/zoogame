import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('phaser');

import Phaser, { justDownMock } from 'phaser';
import Elephant from '../src/objects/Elephant.js';
import { createMockScene } from './helpers/mockScene.js';

function makeGroundedElephant() {
  const { scene, sprite } = createMockScene();
  const elephant = new Elephant(scene, 0, 0);
  return { scene, sprite, elephant };
}

describe('Feature: Jumping', () => {
  beforeEach(() => {
    justDownMock.mockReturnValue(false);
  });

  describe('Scenario: Jump from ground', () => {
    it('launches upward at -11 px/frame vertical velocity when grounded and jump pressed', () => {
      const { sprite, elephant } = makeGroundedElephant();
      elephant.groundContacts = 1;
      justDownMock.mockReturnValueOnce(true); // JustDown for up/space/W

      elephant.update(0, 16, []);

      expect(sprite.setVelocityY).toHaveBeenCalledWith(-11);
    });
  });

  describe('Scenario: Double jump', () => {
    it('launches upward when jump pressed airborne and no mid-air jump used yet', () => {
      const { sprite, elephant } = makeGroundedElephant();
      elephant.groundContacts = 0;
      elephant.airJumpsUsed = 0;
      justDownMock.mockReturnValueOnce(true);

      elephant.update(0, 16, []);

      const jumpCalls = sprite.setVelocityY.mock.calls.filter(c => c[0] === -11);
      expect(jumpCalls.length).toBe(1);
    });

    it('increments airJumpsUsed after a mid-air jump', () => {
      const { sprite, elephant } = makeGroundedElephant();
      elephant.groundContacts = 0;
      elephant.airJumpsUsed = 0;
      justDownMock.mockReturnValueOnce(true);

      elephant.update(0, 16, []);

      expect(elephant.airJumpsUsed).toBe(1);
    });

    it('resets airJumpsUsed when grounded', () => {
      const { elephant } = makeGroundedElephant();
      elephant.groundContacts = 1;
      elephant.airJumpsUsed = 1;

      elephant.update(0, 16, []);

      expect(elephant.airJumpsUsed).toBe(0);
    });
  });

  describe('Scenario: Cannot jump a third time while airborne', () => {
    it('does not set velocity when jump pressed in air after mid-air jump consumed', () => {
      const { sprite, elephant } = makeGroundedElephant();
      elephant.groundContacts = 0;
      elephant.airJumpsUsed = 1;
      justDownMock.mockReturnValueOnce(true);

      elephant.update(0, 16, []);

      const jumpCalls = sprite.setVelocityY.mock.calls.filter(c => c[0] === -11);
      expect(jumpCalls.length).toBe(0);
    });
  });

  describe('Scenario: Ascending animation', () => {
    it('displays jump-up sprite frame when airborne and moving upward (velocity.y < -1)', () => {
      const { sprite, elephant } = makeGroundedElephant();
      elephant.groundContacts = 0;
      sprite.body.velocity.y = -3; // ascending

      elephant.update(0, 16, []);

      expect(sprite.play).toHaveBeenCalledWith('elephant-jump-up', true);
    });
  });

  describe('Scenario: Descending animation', () => {
    it('displays jump-down sprite frame when falling (velocity.y > 2)', () => {
      const { sprite, elephant } = makeGroundedElephant();
      elephant.groundContacts = 0;
      sprite.body.velocity.y = 5; // falling fast

      elephant.update(0, 16, []);

      expect(sprite.play).toHaveBeenCalledWith('elephant-jump-dn', true);
    });
  });

  describe('Scenario: Fall velocity capped', () => {
    it('clamps downward velocity to 11 px/frame when it would exceed that', () => {
      const { sprite, elephant } = makeGroundedElephant();
      elephant.groundContacts = 0; // airborne
      sprite.body.velocity.y = 15; // exceeds cap

      elephant.update(0, 16, []);

      expect(sprite.setVelocityY).toHaveBeenCalledWith(11);
    });

    it('does not cap velocity when below 11', () => {
      const { sprite, elephant } = makeGroundedElephant();
      elephant.groundContacts = 0;
      sprite.body.velocity.y = 8; // below cap

      elephant.update(0, 16, []);

      const capCalls = sprite.setVelocityY.mock.calls.filter(c => c[0] === 11);
      expect(capCalls.length).toBe(0);
    });
  });

  describe('Scenario: Landing resets radial jump zone', () => {
    it('calls resetJumpZone on touch controls when elephant lands', () => {
      const { scene, sprite, elephant } = makeGroundedElephant();
      const resetJumpZone = vi.fn();
      scene.touchControls = { consumeJump: () => false, dashHeld: false, left: false, right: false, resetJumpZone };
      elephant.wasGrounded = false;
      elephant.groundContacts = 1;

      elephant.update(0, 16, []);

      expect(resetJumpZone).toHaveBeenCalled();
    });

    it('does not call resetJumpZone when already grounded', () => {
      const { scene, sprite, elephant } = makeGroundedElephant();
      const resetJumpZone = vi.fn();
      scene.touchControls = { consumeJump: () => false, dashHeld: false, left: false, right: false, resetJumpZone };
      elephant.wasGrounded = true;
      elephant.groundContacts = 1;

      elephant.update(0, 16, []);

      expect(resetJumpZone).not.toHaveBeenCalled();
    });
  });

  describe('Scenario: Hard landing stomp', () => {
    it('shakes camera for 140ms when landing after falling faster than 7 px/frame', () => {
      const { scene, sprite, elephant } = makeGroundedElephant();
      elephant.wasGrounded = false; // was airborne
      elephant.groundContacts = 1;  // just landed
      sprite.body.velocity.y = 8;  // was falling > 7

      elephant.update(0, 16, []);

      expect(scene.cameras.main.shake).toHaveBeenCalledWith(140, expect.any(Number));
    });

    it('does not shake camera when landing gently (velocity <= 7)', () => {
      const { scene, sprite, elephant } = makeGroundedElephant();
      elephant.wasGrounded = false;
      elephant.groundContacts = 1;
      sprite.body.velocity.y = 5; // gentle landing

      elephant.update(0, 16, []);

      expect(scene.cameras.main.shake).not.toHaveBeenCalled();
    });

    it('does not shake when already grounded last frame', () => {
      const { scene, sprite, elephant } = makeGroundedElephant();
      elephant.wasGrounded = true; // was already grounded
      elephant.groundContacts = 1;
      sprite.body.velocity.y = 10;

      elephant.update(0, 16, []);

      expect(scene.cameras.main.shake).not.toHaveBeenCalled();
    });
  });
});
