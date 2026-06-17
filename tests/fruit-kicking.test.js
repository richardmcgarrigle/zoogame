import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('phaser');
import Elephant from '../src/objects/Elephant.js';
import { createMockScene } from './helpers/mockScene.js';

describe('Feature: Fruit Kicking', () => {
  let scene, mockElephant;
  const setVelocityMock = vi.fn();
  const setAngularVelocityMock = vi.fn();

  beforeEach(() => {
    ({ scene } = createMockScene());
    scene.matter.body.setVelocity = setVelocityMock;
    scene.matter.body.setAngularVelocity = setAngularVelocityMock;
    setVelocityMock.mockClear();
    setAngularVelocityMock.mockClear();

    mockElephant = {
      scene,
      sprite: { x: 0, body: { velocity: { x: 0, y: 0 }, position: { x: 0, y: 0 } } },
      facing: 1,
    };
  });

  function makeElephantBody(vx, vy, px, py) {
    return { velocity: { x: vx, y: vy }, position: { x: px, y: py } };
  }

  function makePropBody(px, py) {
    return { velocity: { x: 0, y: 0 }, position: { x: px, y: py } };
  }

  it('kicks fruit to the right when fruit is to the right', () => {
    const elephantBody = makeElephantBody(5, 0, 0, 0);
    const propBody = makePropBody(10, 0);
    Elephant.prototype.applyKickImpulse.call(mockElephant, elephantBody, propBody);
    expect(setVelocityMock).toHaveBeenCalled();
    const call = setVelocityMock.mock.calls[0];
    expect(call[1].x).toBeGreaterThan(0);
  });

  it('applies KICK_POWER_SCALE=1.6: vx=5 right gives x=8', () => {
    const elephantBody = makeElephantBody(5, 0, 0, 0);
    const propBody = makePropBody(10, 0);
    Elephant.prototype.applyKickImpulse.call(mockElephant, elephantBody, propBody);
    const call = setVelocityMock.mock.calls[0];
    expect(call[1].x).toBeCloseTo(8, 0);
  });

  it('applies KICK_MIN_SPEED=0.5 when stationary: gives x=0.8', () => {
    const elephantBody = makeElephantBody(0, 0, 0, 0);
    const propBody = makePropBody(10, 0);
    Elephant.prototype.applyKickImpulse.call(mockElephant, elephantBody, propBody);
    const call = setVelocityMock.mock.calls[0];
    expect(call[1].x).toBeCloseTo(0.8, 1);
  });

  it('applies angular velocity of 0.25 when prop is to the right', () => {
    const elephantBody = makeElephantBody(0, 0, 0, 0);
    const propBody = makePropBody(10, 0);
    Elephant.prototype.applyKickImpulse.call(mockElephant, elephantBody, propBody);
    expect(setAngularVelocityMock).toHaveBeenCalledWith(expect.anything(), 0.25);
  });

  it('upward component: falling elephant (vy=3) gives negative y component', () => {
    const elephantBody = makeElephantBody(0, 3, 0, 0);
    const propBody = makePropBody(10, 0);
    Elephant.prototype.applyKickImpulse.call(mockElephant, elephantBody, propBody);
    const call = setVelocityMock.mock.calls[0];
    expect(call[1].y).toBeLessThan(0);
  });
});
