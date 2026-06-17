import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('phaser');
import Elephant from '../src/objects/Elephant.js';
import { createMockScene } from './helpers/mockScene.js';

describe('Feature: Dash', () => {
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
    sprite.setVelocityX.mockClear();
    sprite.play.mockClear();
  });

  it('dashes while grounded at DASH_SPEED=9', () => {
    elephant.cursors.shift.isDown = true;
    elephant.cursors.right.isDown = true;
    elephant.groundContacts = 1;
    elephant.facing = 1;
    elephant.update(0, 16, []);
    const calls = sprite.setVelocityX.mock.calls;
    expect(calls.some(c => c[0] === 9)).toBe(true);
  });

  it('dashes while airborne at DASH_SPEED=9', () => {
    elephant.cursors.shift.isDown = true;
    elephant.cursors.right.isDown = true;
    elephant.groundContacts = 0;
    elephant.facing = 1;
    elephant.update(0, 16, []);
    const calls = sprite.setVelocityX.mock.calls;
    expect(calls.some(c => c[0] === 9)).toBe(true);
  });

  it('stops dashing when shift released', () => {
    elephant.isDashing = true;
    elephant.cursors.shift.isDown = false;
    elephant.update(0, 16, []);
    expect(elephant.isDashing).toBe(false);
  });

  it('adds wind streaks when dashing', () => {
    elephant.isDashing = true;
    sprite.body.velocity.x = 9;
    const initialLength = elephant.windStreaks.length;
    elephant.updateWindEffect(16);
    expect(elephant.windStreaks.length).toBeGreaterThan(initialLength);
  });

  it('removes expired wind streaks after WIND_STREAK_LIFE=260ms', () => {
    elephant.windStreaks = [{ life: 260, x: 0, y: 0, vx: 0, vy: 0, alpha: 1, size: 5, maxLife: 260 }];
    elephant.updateWindEffect(300);
    expect(elephant.windStreaks.length).toBe(0);
  });

  it('sets run animation at 2.5x speed when dashing', () => {
    elephant.cursors.shift.isDown = true;
    elephant.cursors.right.isDown = true;
    elephant.groundContacts = 1;
    elephant.update(0, 16, []);
    expect(sprite.anims.timeScale).toBe(2.5);
  });
});
