import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('phaser');
import PlaygroundScene from '../src/scenes/PlaygroundScene.js';
import { createMockScene } from './helpers/mockScene.js';

describe('Feature: Fruit Physics & Respawn', () => {
  let mockPlayground;

  beforeEach(() => {
    const { scene } = createMockScene();
    mockPlayground = {
      ...scene,
      matter: {
        ...scene.matter,
        body: {
          setVelocity: vi.fn(),
          setAngularVelocity: vi.fn(),
          setAngle: vi.fn(),
        },
      },
    };
  });

  describe('bounceFruitOffWall', () => {
    it('negates velocity and enforces min speed 4: vx=-2 dir=1 gives x=4', () => {
      const fruitBody = { velocity: { x: -2, y: 0 }, angularVelocity: 0 };
      PlaygroundScene.prototype.bounceFruitOffWall.call(mockPlayground, fruitBody, 1);
      expect(mockPlayground.matter.body.setVelocity).toHaveBeenCalled();
      const call = mockPlayground.matter.body.setVelocity.mock.calls[0];
      expect(call[1].x).toBe(4);
    });

    it('flips angular velocity on wall bounce', () => {
      const fruitBody = { velocity: { x: -5, y: 0 }, angularVelocity: 0.5 };
      PlaygroundScene.prototype.bounceFruitOffWall.call(mockPlayground, fruitBody, 1);
      expect(mockPlayground.matter.body.setAngularVelocity).toHaveBeenCalledWith(expect.anything(), -0.5);
    });

    it('preserves speed above min: vx=-6 dir=1 gives x=6', () => {
      const fruitBody = { velocity: { x: -6, y: 0 }, angularVelocity: 0 };
      PlaygroundScene.prototype.bounceFruitOffWall.call(mockPlayground, fruitBody, 1);
      const call = mockPlayground.matter.body.setVelocity.mock.calls[0];
      expect(call[1].x).toBe(6);
    });
  });

  describe('bounceFruitOffPlatform', () => {
    it('applies 1.5x boost: vy=-4 gives y=-6', () => {
      const fruitBody = { velocity: { x: 0, y: -4 }, angularVelocity: 0 };
      PlaygroundScene.prototype.bounceFruitOffPlatform.call(mockPlayground, fruitBody);
      const call = mockPlayground.matter.body.setVelocity.mock.calls[0];
      expect(call[1].y).toBe(-6);
    });

    it('enforces minimum bounce of 5: vy=-2 gives y=-5', () => {
      const fruitBody = { velocity: { x: 0, y: -2 }, angularVelocity: 0 };
      PlaygroundScene.prototype.bounceFruitOffPlatform.call(mockPlayground, fruitBody);
      const call = mockPlayground.matter.body.setVelocity.mock.calls[0];
      expect(call[1].y).toBe(-5);
    });

    it('skips bounce if |vy| < 0.5', () => {
      const fruitBody = { velocity: { x: 0, y: 0.3 }, angularVelocity: 0 };
      PlaygroundScene.prototype.bounceFruitOffPlatform.call(mockPlayground, fruitBody);
      expect(mockPlayground.matter.body.setVelocity).not.toHaveBeenCalled();
    });
  });
});
