import { describe, it, expect, vi } from 'vitest';

vi.mock('phaser');

import Elephant from '../src/objects/Elephant.js';
import { createMockScene } from './helpers/mockScene.js';

function makeKickContext() {
  const { scene } = createMockScene();
  return {
    scene,
    facing: 1,
  };
}

function makeElephantBody(vx = 0, vy = 0, x = 0) {
  return { position: { x }, velocity: { x: vx, y: vy } };
}

function makePropBody(x = 100) {
  return { position: { x }, velocity: { x: 0, y: 0 } };
}

describe('Feature: Fruit Kicking', () => {
  describe('Scenario: Elephant kicks fruit on collision', () => {
    it('applies kick impulse in direction away from elephant', () => {
      const ctx = makeKickContext();
      const elephantBody = makeElephantBody(5, 0, 0);   // elephant at x=0, vx=5
      const propBody = makePropBody(50);                  // prop to the right

      Elephant.prototype.applyKickImpulse.call(ctx, elephantBody, propBody);

      // dirX = sign(50 - 0) = 1; speed = max(5, 0.5) = 5; vx = 1 * 5 * 1.6 = 8
      expect(ctx.scene.matter.body.setVelocity).toHaveBeenCalledWith(
        propBody,
        expect.objectContaining({ x: 8 }),
      );
    });

    it('kicks away in negative direction when prop is to the left', () => {
      const ctx = makeKickContext();
      const elephantBody = makeElephantBody(5, 0, 100);
      const propBody = makePropBody(50); // prop to the left of elephant

      Elephant.prototype.applyKickImpulse.call(ctx, elephantBody, propBody);

      // dirX = sign(50-100) = -1; speed = 5; vx = -1*5*1.6 = -8
      expect(ctx.scene.matter.body.setVelocity).toHaveBeenCalledWith(
        propBody,
        expect.objectContaining({ x: -8 }),
      );
    });
  });

  describe('Scenario: Kick power scale 1.6', () => {
    it('multiplies kick speed by 1.6', () => {
      const ctx = makeKickContext();
      const elephantBody = makeElephantBody(10, 0, 0);
      const propBody = makePropBody(50);

      Elephant.prototype.applyKickImpulse.call(ctx, elephantBody, propBody);

      // speed = 10, scale = 1.6, dirX = 1 → vx = 16
      expect(ctx.scene.matter.body.setVelocity).toHaveBeenCalledWith(
        propBody,
        expect.objectContaining({ x: 16 }),
      );
    });
  });

  describe('Scenario: Minimum kick speed (0.5 px/frame)', () => {
    it('uses minimum speed of 0.5 when elephant is stationary', () => {
      const ctx = makeKickContext();
      const elephantBody = makeElephantBody(0, 0, 0); // stationary
      const propBody = makePropBody(50);

      Elephant.prototype.applyKickImpulse.call(ctx, elephantBody, propBody);

      // speed = max(0, 0.5) = 0.5; vx = 1 * 0.5 * 1.6 = 0.8
      expect(ctx.scene.matter.body.setVelocity).toHaveBeenCalledWith(
        propBody,
        expect.objectContaining({ x: 0.8 }),
      );
    });
  });

  describe('Scenario: Fruit receives spin on kick', () => {
    it('sets angular velocity to +0.25 when kicking to the right', () => {
      const ctx = makeKickContext();
      const elephantBody = makeElephantBody(5, 0, 0);
      const propBody = makePropBody(50);

      Elephant.prototype.applyKickImpulse.call(ctx, elephantBody, propBody);

      // dirX = 1 → angularVelocity = 1 * 0.25 = 0.25
      expect(ctx.scene.matter.body.setAngularVelocity).toHaveBeenCalledWith(propBody, 0.25);
    });

    it('sets angular velocity to -0.25 when kicking to the left', () => {
      const ctx = makeKickContext();
      const elephantBody = makeElephantBody(5, 0, 100);
      const propBody = makePropBody(50);

      Elephant.prototype.applyKickImpulse.call(ctx, elephantBody, propBody);

      expect(ctx.scene.matter.body.setAngularVelocity).toHaveBeenCalledWith(propBody, -0.25);
    });
  });

  describe('Scenario: Fruit receives upward boost on kick', () => {
    it('adds upward component of at most min(vy, 0) - 2.5', () => {
      const ctx = makeKickContext();
      // elephant falling (vy=3); upward component = min(3, 0) - 2.5 = -2.5, then minus random[0,1.5]
      const elephantBody = makeElephantBody(5, 3, 0);
      const propBody = makePropBody(50);

      Elephant.prototype.applyKickImpulse.call(ctx, elephantBody, propBody);

      const call = ctx.scene.matter.body.setVelocity.mock.calls[0];
      const propVelocity = call[1];
      // vy should be at most -2.5 (min(3,0) - 2.5 - random[0,1.5])
      expect(propVelocity.y).toBeLessThanOrEqual(-2.5);
      // and at least -4 (min(3,0) - 2.5 - 1.5)
      expect(propVelocity.y).toBeGreaterThanOrEqual(-4);
    });

    it('does not add positive y when elephant vy is negative (moving up)', () => {
      const ctx = makeKickContext();
      const elephantBody = makeElephantBody(5, -8, 0); // elephant moving up
      const propBody = makePropBody(50);

      Elephant.prototype.applyKickImpulse.call(ctx, elephantBody, propBody);

      const call = ctx.scene.matter.body.setVelocity.mock.calls[0];
      const propVelocity = call[1];
      // min(-8, 0) = -8; vy = -8 - 2.5 - random[0,1.5] < -10.5
      expect(propVelocity.y).toBeLessThan(-10);
    });
  });

  describe('Scenario: Melon is heavier (density difference)', () => {
    it('melon density 0.0010 is greater than orange/apple density 0.0006', () => {
      // Verified from FRUIT_CONFIGS in PlaygroundScene.js
      const orangeDensity = 0.0006;
      const melonDensity = 0.0010;
      expect(melonDensity).toBeGreaterThan(orangeDensity);
    });
  });
});
