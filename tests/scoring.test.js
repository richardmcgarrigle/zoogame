import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('phaser');

import PlaygroundScene from '../src/scenes/PlaygroundScene.js';

const FRUIT_RESPAWN_DELAY = 1700;

function makeGoalScene(initialScore = 0) {
  const fruit = {
    x: 500, y: 600,
    body: { label: 'fruit', velocity: { x: 0, y: 0 } },
    fruitType: 'orange',
    destroy: vi.fn(),
    active: true,
  };

  const fruitArrow = { setTint: vi.fn() };
  const goalArrow = { setTint: vi.fn() };

  const scoreText = {
    setText: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
  };

  const fruitIdleText = {
    setText: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
  };

  const fruitManager = {
    fruit,
    respawnFruit: vi.fn(),
  };

  const scene = {
    score: initialScore,
    // fruit getter/setter backed by fruitManager
    get fruit() { return this.fruitManager.fruit; },
    set fruit(v) { this.fruitManager.fruit = v; },
    fruitManager,
    fruitArrow,
    goalArrow,
    scoreText,
    fruitIdleText,
    worldWidth: 1280,
    props: [fruit],
    crates: [],
    scale: { width: 800, height: 600 },
    tweens: { add: vi.fn() },
    time: {
      addEvent: vi.fn(() => ({ remove: vi.fn() })),
      delayedCall: vi.fn(),
    },
    add: {
      text: vi.fn(() => ({
        setOrigin: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      })),
      image: vi.fn(() => ({
        setDepth: vi.fn().mockReturnThis(),
        setScale: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
        x: 0, y: 0,
      })),
    },
    matter: {
      body: { setVelocity: vi.fn(), setAngularVelocity: vi.fn() },
    },
    cameras: { main: { width: 800, height: 600 } },
    extendWorld: vi.fn(),
    celebrateGoal: vi.fn(),
    elephant: {
      sprite: { x: 100, y: 800 },
      celebrate: vi.fn(),
    },
  };

  return scene;
}

describe('Feature: Goal Scoring', () => {
  describe('Scenario: Score a goal', () => {
    it('increments score by 1', () => {
      const scene = makeGoalScene(0);
      PlaygroundScene.prototype.onGoalScored.call(scene);
      expect(scene.score).toBe(1);
    });

    it('updates scoreText with new score', () => {
      const scene = makeGoalScene(2);
      PlaygroundScene.prototype.onGoalScored.call(scene);
      expect(scene.scoreText.setText).toHaveBeenCalledWith('Score: 3');
    });

    it('destroys the fruit', () => {
      const scene = makeGoalScene(0);
      const fruit = scene.fruitManager.fruit;
      PlaygroundScene.prototype.onGoalScored.call(scene);
      expect(fruit.destroy).toHaveBeenCalled();
    });

    it('sets fruit to null after destroying', () => {
      const scene = makeGoalScene(0);
      PlaygroundScene.prototype.onGoalScored.call(scene);
      expect(scene.fruitManager.fruit).toBeNull();
    });
  });

  describe('Scenario: Fruit respawns after goal (1700ms delay)', () => {
    it('schedules fruit respawn with 1700ms delay', () => {
      const scene = makeGoalScene(0);
      PlaygroundScene.prototype.onGoalScored.call(scene);

      // delayedCall[0] = 1200ms flash cleanup, delayedCall[1] = 1700ms fruit respawn
      const fruitRespawnCall = scene.time.delayedCall.mock.calls[1];
      expect(fruitRespawnCall[0]).toBe(FRUIT_RESPAWN_DELAY);
    });
  });

  describe('Scenario: N crates drop after score N', () => {
    it('schedules N crate drops after score of N (score increments first)', () => {
      const scene = makeGoalScene(2); // score will become 3
      PlaygroundScene.prototype.onGoalScored.call(scene);

      // delayedCall[0] = flash cleanup, [1] = fruit respawn, [2..4] = 3 crates
      const crateCalls = scene.time.delayedCall.mock.calls.slice(2);
      expect(crateCalls.length).toBe(3); // new score = 3
    });

    it('schedules 1 crate for score 0→1', () => {
      const scene = makeGoalScene(0);
      PlaygroundScene.prototype.onGoalScored.call(scene);

      const crateCalls = scene.time.delayedCall.mock.calls.slice(2);
      expect(crateCalls.length).toBe(1);
    });
  });

  describe('Scenario: Score display flashes', () => {
    it('schedules score flash timer with 120ms interval', () => {
      const scene = makeGoalScene(0);
      PlaygroundScene.prototype.onGoalScored.call(scene);

      const flashCall = scene.time.addEvent.mock.calls[0];
      expect(flashCall[0].delay).toBe(120);
    });

    it('repeats flash for 10 cycles (repeat: 9 = 10 total events)', () => {
      const scene = makeGoalScene(0);
      PlaygroundScene.prototype.onGoalScored.call(scene);

      const flashCall = scene.time.addEvent.mock.calls[0];
      expect(flashCall[0].repeat).toBe(9);
    });
  });

  describe('Scenario: World extends on goal', () => {
    it('calls extendWorld after scoring', () => {
      const scene = makeGoalScene(0);
      PlaygroundScene.prototype.onGoalScored.call(scene);
      expect(scene.extendWorld).toHaveBeenCalled();
    });
  });

  describe('Scenario: Goal stars celebration', () => {
    it('spawns 12 star particles at the fruit position', () => {
      const scene = makeGoalScene(0);
      scene.add.image = vi.fn(() => ({
        setDepth: vi.fn().mockReturnThis(),
        setScale: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
        x: 0, y: 0,
      }));

      PlaygroundScene.prototype.celebrateGoal.call(scene, 500, 600);

      // celebrateGoal spawns STAR_COUNT=12 stars
      expect(scene.add.image).toHaveBeenCalledTimes(12);
    });
  });
});
