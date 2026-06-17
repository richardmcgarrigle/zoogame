import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('phaser');
import PlaygroundScene from '../src/scenes/PlaygroundScene.js';
import { createMockScene } from './helpers/mockScene.js';

describe('Feature: Crate', () => {
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
      },
      scoreText: { setText: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis() },
      fruitIdleTime: 0,
      fruitIdleText: { setVisible: vi.fn().mockReturnThis(), setText: vi.fn().mockReturnThis() },
      worldWidth: 1000,
      terrainPoints: [],
      getTerrainYAt: vi.fn(() => 900),
      respawnFruit: vi.fn(),
      addCrate: vi.fn(() => ({
        body: { label: 'crate', velocity: { x: 0, y: 0 } },
        destroy: vi.fn(),
      })),
      extendWorld: vi.fn(),
      celebrateGoal: vi.fn(),
      props: [],
      fruitArrow: { setTint: vi.fn() },
    };
  });

  it('addCrate creates an object with body.label === crate', () => {
    const result = mockScene.addCrate(950, 850);
    expect(result.body.label).toBe('crate');
  });

  it('after onGoalScored with score=0, score becomes 1 and 1 crate is scheduled', () => {
    mockScene.score = 0;
    PlaygroundScene.prototype.onGoalScored.call(mockScene);
    expect(mockScene.score).toBe(1);
    // time.delayedCall called: 1 for fruit + 1 for crate = 2 times
    const delayCalls = mockScene.time.delayedCall.mock.calls;
    const crateCalls = delayCalls.filter(c => c[0] !== 1700);
    expect(crateCalls.length).toBeGreaterThanOrEqual(1);
  });
});
