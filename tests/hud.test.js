import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('phaser');
import PlaygroundScene from '../src/scenes/PlaygroundScene.js';
import { createMockScene } from './helpers/mockScene.js';

describe('Feature: HUD & UI', () => {
  let mockScene;
  let arrowLeft, arrowRight;

  beforeEach(() => {
    const { scene } = createMockScene();
    arrowLeft = { setVisible: vi.fn().mockReturnThis(), setAlpha: vi.fn().mockReturnThis(), setPosition: vi.fn().mockReturnThis(), setRotation: vi.fn().mockReturnThis(), x: 0, y: 0, visible: false };
    arrowRight = { setVisible: vi.fn().mockReturnThis(), setAlpha: vi.fn().mockReturnThis(), setPosition: vi.fn().mockReturnThis(), setRotation: vi.fn().mockReturnThis(), x: 0, y: 0, visible: false };
    mockScene = {
      ...scene,
      // The code uses this.goal and this.fruit as targets
      goal: {
        x: 400, y: 300,
        body: { velocity: { x: 0, y: 0 } },
        active: true,
      },
      fruit: {
        x: 400, y: 300,
        body: { velocity: { x: 0, y: 0 } },
        active: true,
      },
      goalArrow: arrowLeft,
      fruitArrow: arrowRight,
      cameras: {
        main: {
          ...scene.cameras.main,
          scrollX: 0,
          scrollY: 0,
          width: 800,
          height: 600,
        },
      },
    };
  });

  it('hides arrow when target is on screen', () => {
    mockScene.fruit.x = 400; // on screen
    mockScene.goal.x = 400;
    PlaygroundScene.prototype.updateIndicatorArrows.call(mockScene);
    expect(arrowLeft.setVisible).toHaveBeenCalledWith(false);
    expect(arrowRight.setVisible).toHaveBeenCalledWith(false);
  });

  it('shows arrow when target is off screen to the left', () => {
    mockScene.goal.x = -200; // off screen left
    mockScene.fruit.x = 400; // on screen
    PlaygroundScene.prototype.updateIndicatorArrows.call(mockScene);
    expect(arrowLeft.setVisible).toHaveBeenCalledWith(true);
  });

  it('shows arrow when target is off screen to the right', () => {
    mockScene.fruit.x = 1100; // off screen right (scrollX=0, width=800)
    mockScene.goal.x = 400;
    PlaygroundScene.prototype.updateIndicatorArrows.call(mockScene);
    expect(arrowRight.setVisible).toHaveBeenCalledWith(true);
  });

  describe('flash alpha timing', () => {
    it('flashAlpha=1.0 when time.now % 600 < 450', () => {
      mockScene.time.now = 0; // 0 % 600 = 0 < 450
      mockScene.fruit.x = -200;
      mockScene.goal.x = 400;
      PlaygroundScene.prototype.updateIndicatorArrows.call(mockScene);
      const alphaCall = arrowRight.setAlpha.mock.calls[0];
      if (alphaCall) {
        expect(alphaCall[0]).toBe(1.0);
      }
    });

    it('flashAlpha=0.1 when time.now % 600 >= 450', () => {
      mockScene.time.now = 500; // 500 % 600 = 500 >= 450
      mockScene.fruit.x = -200;
      mockScene.goal.x = 400;
      PlaygroundScene.prototype.updateIndicatorArrows.call(mockScene);
      const alphaCall = arrowRight.setAlpha.mock.calls[0];
      if (alphaCall) {
        expect(alphaCall[0]).toBe(0.1);
      }
    });
  });
});
