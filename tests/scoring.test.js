import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('phaser');
import PlaygroundScene from '../src/scenes/PlaygroundScene.js';
import { createMockScene } from './helpers/mockScene.js';

describe('Feature: Goal Scoring', () => {
  let mockScene;

  beforeEach(() => {
    const { scene } = createMockScene();
    mockScene = {
      ...scene,
      score: 0,
      crates: [],
      fruit: {
        active: true, body: { label: 'fruit', velocity: { x: 0, y: 0 }, position: { x: 0, y: 0 } },
        destroy: vi.fn(),
        x: 100, y: 100,
      },
      scoreText: { setText: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis() },
      fruitIdleTime: 0,
      fruitIdleText: { setVisible: vi.fn().mockReturnThis(), setText: vi.fn().mockReturnThis() },
      worldWidth: 1000,
      terrainPoints: [],
      getTerrainYAt: vi.fn(() => 900),
      respawnFruit: vi.fn(),
      addCrate: vi.fn(),
      extendWorld: vi.fn(),
      celebrateGoal: vi.fn(),
      props: [],
      fruitArrow: { setTint: vi.fn() },
    };
  });

  it('increments score on goal', () => {
    mockScene.score = 0;
    PlaygroundScene.prototype.onGoalScored.call(mockScene);
    expect(mockScene.score).toBe(1);
  });

  it('updates scoreText', () => {
    PlaygroundScene.prototype.onGoalScored.call(mockScene);
    expect(mockScene.scoreText.setText).toHaveBeenCalledWith(expect.stringContaining('1'));
  });

  it('destroys fruit', () => {
    const destroyMock = mockScene.fruit.destroy;
    PlaygroundScene.prototype.onGoalScored.call(mockScene);
    expect(destroyMock).toHaveBeenCalled();
  });

  it('schedules fruit respawn after FRUIT_RESPAWN_DELAY=1700ms', () => {
    PlaygroundScene.prototype.onGoalScored.call(mockScene);
    const calls = mockScene.time.delayedCall.mock.calls;
    expect(calls.some(c => c[0] === 1700)).toBe(true);
  });

  it('calls extendWorld', () => {
    PlaygroundScene.prototype.onGoalScored.call(mockScene);
    expect(mockScene.extendWorld).toHaveBeenCalled();
  });
});
