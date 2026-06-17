import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('phaser');
import Elephant from '../src/objects/Elephant.js';
import { createMockScene } from './helpers/mockScene.js';

describe('Feature: Player Movement', () => {
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
    // Reset mock counts
    sprite.setVelocityX.mockClear();
    sprite.play.mockClear();
  });

  it('walks right on flat ground at MOVE_SPEED=4.5', () => {
    elephant.cursors.right.isDown = true;
    elephant.update(0, 16, []);
    const calls = sprite.setVelocityX.mock.calls;
    expect(calls.some(c => c[0] === 4.5)).toBe(true);
  });

  it('walks left on flat ground at -MOVE_SPEED=-4.5', () => {
    elephant.cursors.left.isDown = true;
    elephant.update(0, 16, []);
    const calls = sprite.setVelocityX.mock.calls;
    expect(calls.some(c => c[0] === -4.5)).toBe(true);
  });

  it('has reduced air control at MOVE_SPEED_AIR=3.2', () => {
    elephant.groundContacts = 0;
    elephant.cursors.right.isDown = true;
    elephant.update(0, 16, []);
    const calls = sprite.setVelocityX.mock.calls;
    expect(calls.some(c => c[0] === 3.2)).toBe(true);
  });

  it('faces right when moving right', () => {
    elephant.cursors.right.isDown = true;
    elephant.update(0, 16, []);
    expect(elephant.facing).toBe(1);
  });

  it('faces left when moving left', () => {
    elephant.cursors.left.isDown = true;
    elephant.update(0, 16, []);
    expect(elephant.facing).toBe(-1);
  });

  it('plays idle animation when no input and grounded', () => {
    elephant.groundContacts = 1;
    sprite.body.velocity.x = 0;
    sprite.body.velocity.y = 0;
    elephant.update(0, 16, []);
    expect(sprite.play).toHaveBeenCalledWith(expect.stringContaining('idle'), expect.anything());
  });
});
