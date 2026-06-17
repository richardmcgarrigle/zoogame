import { describe, it, expect, vi } from 'vitest';

vi.mock('phaser');

import TouchControls from '../src/objects/TouchControls.js';

const STICK_DEAD_ZONE = 12;

function makeStickContext(baseX = 100, baseY = 100) {
  return {
    _stickBase: { x: baseX, y: baseY },
    left: false,
    right: false,
    _drawStick: vi.fn(),
  };
}

describe('Feature: Touch Controls', () => {
  describe('Scenario: Analog stick dead zone prevents drift', () => {
    it('does not register movement within 12px of stick base (right)', () => {
      const ctx = makeStickContext();
      // 12px exactly is the dead zone boundary — should NOT activate
      TouchControls.prototype._updateStick.call(ctx, 100 + STICK_DEAD_ZONE, 100);
      expect(ctx.right).toBe(false);
    });

    it('does not register movement within 12px of stick base (left)', () => {
      const ctx = makeStickContext();
      TouchControls.prototype._updateStick.call(ctx, 100 - STICK_DEAD_ZONE, 100);
      expect(ctx.left).toBe(false);
    });
  });

  describe('Scenario: Analog stick controls movement', () => {
    it('registers right movement when displaced more than 12px right', () => {
      const ctx = makeStickContext();
      TouchControls.prototype._updateStick.call(ctx, 100 + STICK_DEAD_ZONE + 1, 100);
      expect(ctx.right).toBe(true);
    });

    it('registers left movement when displaced more than 12px left', () => {
      const ctx = makeStickContext();
      TouchControls.prototype._updateStick.call(ctx, 100 - STICK_DEAD_ZONE - 1, 100);
      expect(ctx.left).toBe(true);
    });

    it('does not register movement for vertical displacement only', () => {
      const ctx = makeStickContext();
      TouchControls.prototype._updateStick.call(ctx, 100, 100 + 30); // only vertical
      expect(ctx.left).toBe(false);
      expect(ctx.right).toBe(false);
    });
  });

  describe('Scenario: Dash button triggers dash', () => {
    it('sets dashHeld=true when dash button pressed', () => {
      const ctx = { dashHeld: false, _jumpWasDown: false, jumpJustPressed: false };
      TouchControls.prototype._applyBtnState.call(ctx, 'dash', true);
      expect(ctx.dashHeld).toBe(true);
    });

    it('sets dashHeld=false when dash button released', () => {
      const ctx = { dashHeld: true, _jumpWasDown: false, jumpJustPressed: false };
      TouchControls.prototype._applyBtnState.call(ctx, 'dash', false);
      expect(ctx.dashHeld).toBe(false);
    });
  });

  describe('Scenario: Jump button triggers jump (exactly 1 frame)', () => {
    it('sets jumpJustPressed=true on first jump press', () => {
      const ctx = { dashHeld: false, _jumpWasDown: false, jumpJustPressed: false };
      TouchControls.prototype._applyBtnState.call(ctx, 'jump', true);
      expect(ctx.jumpJustPressed).toBe(true);
    });

    it('does not re-trigger jumpJustPressed while held (second call)', () => {
      const ctx = { dashHeld: false, _jumpWasDown: true, jumpJustPressed: false };
      TouchControls.prototype._applyBtnState.call(ctx, 'jump', true);
      expect(ctx.jumpJustPressed).toBe(false); // already was down
    });

    it('clears jumpJustPressed after postUpdate', () => {
      const gfxMock = () => ({
        clear: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        strokeCircle: vi.fn().mockReturnThis(),
        fillStyle: vi.fn().mockReturnThis(),
        fillCircle: vi.fn().mockReturnThis(),
        fillRoundedRect: vi.fn().mockReturnThis(),
        strokeRoundedRect: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
      });
      const txtMock = () => ({
        setOrigin: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
      });
      const containerMock = () => ({
        setDepth: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(),
        add: vi.fn(),
      });
      const mockScene = {
        add: {
          graphics: vi.fn(gfxMock),
          text: vi.fn(txtMock),
          container: vi.fn(containerMock),
        },
        input: { on: vi.fn() },
        scale: { width: 800, height: 600, on: vi.fn() },
      };

      const tc = new TouchControls(mockScene);
      tc.jumpJustPressed = true;

      tc.postUpdate();

      expect(tc.jumpJustPressed).toBe(false);
    });
  });

  describe('Scenario: Stick appears at touch origin', () => {
    it('_startStick sets stickBase to touch point', () => {
      const ctx = {
        _stickBase: { x: 0, y: 0 },
        left: true, right: true,
        _setStickVisible: vi.fn(),
        _drawStick: vi.fn(),
      };
      TouchControls.prototype._startStick.call(ctx, 200, 350);
      expect(ctx._stickBase).toEqual({ x: 200, y: 350 });
    });

    it('_startStick resets left/right to false', () => {
      const ctx = {
        _stickBase: { x: 0, y: 0 },
        left: true, right: true,
        _setStickVisible: vi.fn(),
        _drawStick: vi.fn(),
      };
      TouchControls.prototype._startStick.call(ctx, 200, 350);
      expect(ctx.left).toBe(false);
      expect(ctx.right).toBe(false);
    });
  });
});
