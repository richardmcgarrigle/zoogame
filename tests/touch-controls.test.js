import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('phaser');
import TouchControls from '../src/objects/TouchControls.js';

describe('Feature: Touch Controls', () => {
  describe('_updateStick dead zone (STICK_DEAD_ZONE=12)', () => {
    let tc;

    beforeEach(() => {
      tc = {
        _stickBase: { x: 100, y: 100 },
        left: false,
        right: false,
        _drawStick: vi.fn(),
      };
    });

    it('does NOT activate at exactly 12px displacement (not past dead zone)', () => {
      TouchControls.prototype._updateStick.call(tc, 112, 100);
      expect(tc.right).toBe(false);
    });

    it('activates right at 13px displacement (past dead zone)', () => {
      TouchControls.prototype._updateStick.call(tc, 113, 100);
      expect(tc.right).toBe(true);
    });

    it('activates left at 13px left displacement', () => {
      TouchControls.prototype._updateStick.call(tc, 87, 100);
      expect(tc.left).toBe(true);
    });
  });

  describe('_applyBtnState', () => {
    let tc;

    beforeEach(() => {
      tc = {
        dashHeld: false,
        jumpJustPressed: false,
        _jumpWasDown: false,
      };
    });

    it('sets dashHeld=true when dash pressed', () => {
      TouchControls.prototype._applyBtnState.call(tc, 'dash', true);
      expect(tc.dashHeld).toBe(true);
    });

    it('sets dashHeld=false when dash released', () => {
      tc.dashHeld = true;
      TouchControls.prototype._applyBtnState.call(tc, 'dash', false);
      expect(tc.dashHeld).toBe(false);
    });

    it('sets jumpJustPressed=true on first jump press', () => {
      TouchControls.prototype._applyBtnState.call(tc, 'jump', true);
      expect(tc.jumpJustPressed).toBe(true);
    });

    it('jumpJustPressed stays false if jump was already held', () => {
      tc._jumpWasDown = true;
      tc.jumpJustPressed = false;
      TouchControls.prototype._applyBtnState.call(tc, 'jump', true);
      expect(tc.jumpJustPressed).toBe(false);
    });
  });

  describe('postUpdate', () => {
    it('clears jumpJustPressed', () => {
      const tc = { jumpJustPressed: true };
      TouchControls.prototype.postUpdate.call(tc);
      expect(tc.jumpJustPressed).toBe(false);
    });
  });
});
