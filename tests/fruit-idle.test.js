import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('phaser');
import PlaygroundScene from '../src/scenes/PlaygroundScene.js';
import { createMockScene } from './helpers/mockScene.js';

describe('Feature: Fruit Idle/Respawn Timing', () => {
  let mockScene;

  function makeMockFruit(vx, vy) {
    return {
      active: true,
      body: { velocity: { x: vx, y: vy } },
      x: 0, y: 0,
    };
  }

  beforeEach(() => {
    const { scene } = createMockScene();
    mockScene = {
      ...scene,
      fruitIdleTime: 0,
      fruit: makeMockFruit(0.1, 0.1),
      fruitIdleText: {
        setVisible: vi.fn().mockReturnThis(),
        setText: vi.fn().mockReturnThis(),
        visible: false,
      },
      respawnFruit: vi.fn(),
      cameras: scene.cameras,
    };
  });

  it('increments fruitIdleTime when speed < 0.8', () => {
    mockScene.fruit = makeMockFruit(0.1, 0.1); // speed ≈ 0.14
    PlaygroundScene.prototype.updateFruitIdleTimer.call(mockScene, 1000);
    expect(mockScene.fruitIdleTime).toBeGreaterThan(0);
  });

  it('resets fruitIdleTime when speed >= 0.8', () => {
    mockScene.fruitIdleTime = 5;
    mockScene.fruit = makeMockFruit(1, 0); // speed = 1.0
    PlaygroundScene.prototype.updateFruitIdleTimer.call(mockScene, 1000);
    expect(mockScene.fruitIdleTime).toBe(0);
  });

  it('shows warning when fruitIdleTime >= 5', () => {
    mockScene.fruitIdleTime = 5.1;
    mockScene.fruit = makeMockFruit(0.1, 0.1);
    PlaygroundScene.prototype.updateFruitIdleTimer.call(mockScene, 0);
    expect(mockScene.fruitIdleText.setVisible).toHaveBeenCalledWith(true);
    const textCall = mockScene.fruitIdleText.setText.mock.calls[0];
    expect(textCall[0].toLowerCase()).toContain('respawn');
  });

  it('auto-respawns at 10s: fruitIdleTime=9.9, delta=200ms pushes past 10', () => {
    mockScene.fruitIdleTime = 9.9;
    mockScene.fruit = makeMockFruit(0.1, 0.1);
    PlaygroundScene.prototype.updateFruitIdleTimer.call(mockScene, 200);
    expect(mockScene.respawnFruit).toHaveBeenCalled();
  });
});
