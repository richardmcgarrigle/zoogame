import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('phaser');
import { justDownMock } from 'phaser';
import Elephant from '../src/objects/Elephant.js';
import { createMockScene } from './helpers/mockScene.js';

describe('Feature: Jumping', () => {
  let elephant, scene, sprite;

  beforeEach(() => {
    ({ scene, sprite } = createMockScene());
    elephant = new Elephant(scene, 0, 0);
    elephant.groundContacts = 1;
    elephant.facing = 1;
    elephant.isDashing = false;
    elephant.celebrateTimer = 0;
    elephant.wasGrounded = true;
    elephant.contactBodies = new Map();
    elephant.windStreaks = [];
    elephant.windGraphics = scene.add.graphics();
    elephant._prevPadButtons = {};
    justDownMock.mockReset();
    justDownMock.mockReturnValue(false);
    sprite.setVelocityY.mockClear();
  });

  it('jumps from ground with JUMP_VELOCITY=-11', () => {
    elephant.groundContacts = 1;
    justDownMock.mockReturnValueOnce(true);
    elephant.update(0, 16, []);
    expect(sprite.setVelocityY).toHaveBeenCalledWith(-11);
  });

  it('cannot jump when airborne', () => {
    elephant.groundContacts = 0;
    justDownMock.mockReturnValue(true);
    elephant.update(0, 16, []);
    expect(sprite.setVelocityY).not.toHaveBeenCalledWith(-11);
  });

  it('caps fall velocity at NORMAL_MAX_FALL=11', () => {
    elephant.groundContacts = 0;
    sprite.body.velocity.y = 15;
    elephant.update(0, 16, []);
    expect(sprite.setVelocityY).toHaveBeenCalledWith(11);
  });

  it('triggers camera shake on hard landing (stomp)', () => {
    elephant.groundContacts = 1;
    elephant.wasGrounded = false;
    sprite.body.velocity.y = 8; // > STOMP_FALL_THRESHOLD=7
    elephant.update(0, 16, []);
    expect(scene.cameras.main.shake).toHaveBeenCalledWith(140, expect.anything());
  });

  it('plays jump-up animation when ascending', () => {
    elephant.groundContacts = 0;
    sprite.body.velocity.y = -3;
    sprite.play.mockClear();
    elephant.update(0, 16, []);
    expect(sprite.play).toHaveBeenCalledWith(expect.stringContaining('jump-up'), expect.anything());
  });

  it('plays jump-down animation when descending', () => {
    elephant.groundContacts = 0;
    sprite.body.velocity.y = 5;
    sprite.play.mockClear();
    elephant.update(0, 16, []);
    expect(sprite.play).toHaveBeenCalledWith(expect.stringContaining('jump-dn'), expect.anything());
  });
});
