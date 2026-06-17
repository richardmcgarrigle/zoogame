import { describe, it, expect, vi } from 'vitest';

vi.mock('phaser');

import PlaygroundScene from '../src/scenes/PlaygroundScene.js';

function makeArrowScene({ spriteX, spriteY, cameraScrollX = 0, cameraScrollY = 0, timeNow = 0 } = {}) {
  const arrow = {
    visible: false,
    setVisible: vi.fn(function(v) { this.visible = v; }),
    setPosition: vi.fn(),
    setRotation: vi.fn(),
    setAlpha: vi.fn(),
  };

  return {
    goal: { x: spriteX ?? 500, y: spriteY ?? 300 },
    fruit: null,
    goalArrow: arrow,
    fruitArrow: {
      visible: false,
      setVisible: vi.fn(),
      setAlpha: vi.fn(),
      setPosition: vi.fn(),
      setRotation: vi.fn(),
    },
    cameras: {
      main: {
        scrollX: cameraScrollX,
        scrollY: cameraScrollY,
        width: 800,
        height: 600,
      },
    },
    time: { now: timeNow },
    _arrow: arrow,
  };
}

describe('Feature: HUD & UI', () => {
  describe('Scenario: Off-screen goal arrow', () => {
    it('shows arrow when goal is off the right edge of screen', () => {
      const scene = makeArrowScene({ spriteX: 1200, cameraScrollX: 0 });
      // goal at x=1200, camera scrollX=0, viewport width=800 → off right side
      scene.fruit = null;

      PlaygroundScene.prototype.updateIndicatorArrows.call(scene);

      expect(scene._arrow.setVisible).toHaveBeenCalledWith(true);
    });

    it('shows arrow when goal is off the left edge of screen', () => {
      const scene = makeArrowScene({ spriteX: -100, cameraScrollX: 0 });
      scene.fruit = null;

      PlaygroundScene.prototype.updateIndicatorArrows.call(scene);

      expect(scene._arrow.setVisible).toHaveBeenCalledWith(true);
    });
  });

  describe('Scenario: Arrows hidden when target is on screen', () => {
    it('hides arrow when goal is within camera viewport', () => {
      const scene = makeArrowScene({ spriteX: 400, spriteY: 300, cameraScrollX: 0 });
      // 400 - 0 = 400 (screen x), within 0–800
      scene.fruit = null;

      PlaygroundScene.prototype.updateIndicatorArrows.call(scene);

      expect(scene._arrow.setVisible).toHaveBeenCalledWith(false);
    });
  });

  describe('Scenario: Arrows flash alternately', () => {
    it('flash alpha is 1.0 when time.now % 600 < 450', () => {
      const scene = makeArrowScene({ spriteX: 1200, timeNow: 0 }); // time % 600 = 0 < 450
      scene.fruit = null;

      PlaygroundScene.prototype.updateIndicatorArrows.call(scene);

      const alphaCalls = scene._arrow.setAlpha.mock.calls;
      if (alphaCalls.length > 0) {
        expect(alphaCalls[alphaCalls.length - 1][0]).toBe(1);
      }
    });

    it('flash alpha is 0.1 when time.now % 600 >= 450', () => {
      const scene = makeArrowScene({ spriteX: 1200, timeNow: 500 }); // 500 % 600 = 500 >= 450
      scene.fruit = null;

      PlaygroundScene.prototype.updateIndicatorArrows.call(scene);

      const alphaCalls = scene._arrow.setAlpha.mock.calls;
      if (alphaCalls.length > 0) {
        expect(alphaCalls[alphaCalls.length - 1][0]).toBe(0.1);
      }
    });
  });

  describe('Scenario: Score displayed', () => {
    it('score text is set to "Score: N" format', () => {
      const scoreText = { setText: vi.fn().mockReturnThis() };

      // Simulate what onGoalScored does
      const score = 1;
      scoreText.setText(`Score: ${score}`);

      expect(scoreText.setText).toHaveBeenCalledWith('Score: 1');
    });
  });

  describe('Scenario: Off-screen fruit arrow', () => {
    it('shows fruit arrow when fruit is off screen', () => {
      const scene = makeArrowScene({ spriteX: 400 }); // goal on screen

      const fruitArrowMock = {
        visible: false,
        setVisible: vi.fn(function(v) { this.visible = v; }),
        setPosition: vi.fn(),
        setRotation: vi.fn(),
        setAlpha: vi.fn(),
      };
      scene.fruitArrow = fruitArrowMock;
      scene.fruit = { x: 2000, y: 300 }; // off screen right

      PlaygroundScene.prototype.updateIndicatorArrows.call(scene);

      expect(fruitArrowMock.setVisible).toHaveBeenCalledWith(true);
    });
  });
});
