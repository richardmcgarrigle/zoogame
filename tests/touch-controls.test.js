import { describe, it, expect, vi } from 'vitest';

vi.mock('phaser');

import TouchControls from '../src/objects/TouchControls.js';

const STICK_DEAD_ZONE = 12;

function makeStickContext(baseX = 100, baseY = 100) {
  return {
    _stickBase: { x: baseX, y: baseY },
    left: false,
    right: false,
    jumpJustPressed: false,
    _inJumpZone: false,
    dashHeld: false,
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

  describe('Scenario: Radial jump zone triggers jump', () => {
    it('triggers jumpJustPressed when stick enters the top 60° zone', () => {
      const ctx = makeStickContext();
      // Straight up: base at (100,100), pointer at (100, 100 - 20)
      TouchControls.prototype._updateStick.call(ctx, 100, 100 - 20);
      expect(ctx.jumpJustPressed).toBe(true);
    });

    it('does not re-trigger while stick stays in the jump zone', () => {
      const ctx = makeStickContext();
      // Enter jump zone
      TouchControls.prototype._updateStick.call(ctx, 100, 100 - 20);
      expect(ctx.jumpJustPressed).toBe(true);
      // Clear the flag (simulates Elephant consuming it)
      ctx.jumpJustPressed = false;
      // Move within zone — should not re-trigger
      TouchControls.prototype._updateStick.call(ctx, 102, 100 - 22);
      expect(ctx.jumpJustPressed).toBe(false);
    });

    it('re-triggers after leaving and re-entering the zone', () => {
      const ctx = makeStickContext();
      // Enter jump zone
      TouchControls.prototype._updateStick.call(ctx, 100, 100 - 20);
      expect(ctx.jumpJustPressed).toBe(true);
      ctx.jumpJustPressed = false;
      // Leave zone (move right)
      TouchControls.prototype._updateStick.call(ctx, 100 + 30, 100);
      expect(ctx.jumpJustPressed).toBe(false);
      // Re-enter zone
      TouchControls.prototype._updateStick.call(ctx, 100, 100 - 20);
      expect(ctx.jumpJustPressed).toBe(true);
    });

    it('does not trigger within the dead zone distance', () => {
      const ctx = makeStickContext();
      // Straight up but only 10px (within 12px dead zone)
      TouchControls.prototype._updateStick.call(ctx, 100, 100 - 10);
      expect(ctx.jumpJustPressed).toBe(false);
    });

    it('does not trigger at −31° from vertical (outside the 60° zone)', () => {
      const ctx = makeStickContext();
      // −31° from straight up = −121° in atan2 = past the boundary
      const angleDeg = -121;
      const angleRad = angleDeg * Math.PI / 180;
      const r = 30;
      TouchControls.prototype._updateStick.call(
        ctx, 100 + Math.cos(angleRad) * r, 100 + Math.sin(angleRad) * r);
      expect(ctx.jumpJustPressed).toBe(false);
    });

    it('does not trigger at +31° from vertical (outside the 60° zone)', () => {
      const ctx = makeStickContext();
      // +31° from straight up = −59° in atan2 = past the boundary
      const angleDeg = -59;
      const angleRad = angleDeg * Math.PI / 180;
      const r = 30;
      TouchControls.prototype._updateStick.call(
        ctx, 100 + Math.cos(angleRad) * r, 100 + Math.sin(angleRad) * r);
      expect(ctx.jumpJustPressed).toBe(false);
    });

    it('triggers at the boundary (−30° from vertical)', () => {
      const ctx = makeStickContext();
      // −30° from straight up = −120° in atan2 = exactly at boundary
      const angleDeg = -120;
      const angleRad = angleDeg * Math.PI / 180;
      const r = 30;
      TouchControls.prototype._updateStick.call(
        ctx, 100 + Math.cos(angleRad) * r, 100 + Math.sin(angleRad) * r);
      expect(ctx.jumpJustPressed).toBe(true);
    });

    it('sets left AND jumpJustPressed when pushing up-left at the zone boundary', () => {
      const ctx = makeStickContext();
      // −30° from vertical = −120° in atan2; cos(−120°) = −0.5, at r=30 → hx = −15
      const angleDeg = -120;
      const angleRad = angleDeg * Math.PI / 180;
      const r = 30;
      TouchControls.prototype._updateStick.call(
        ctx, 100 + Math.cos(angleRad) * r, 100 + Math.sin(angleRad) * r);
      expect(ctx.jumpJustPressed).toBe(true);
      expect(ctx.left).toBe(true);
      expect(ctx.right).toBe(false);
    });

    it('sets right AND jumpJustPressed when pushing up-right at the zone boundary', () => {
      const ctx = makeStickContext();
      // +30° from vertical = −60° in atan2; cos(−60°) = 0.5, at r=30 → hx = 15
      const angleDeg = -60;
      const angleRad = angleDeg * Math.PI / 180;
      const r = 30;
      TouchControls.prototype._updateStick.call(
        ctx, 100 + Math.cos(angleRad) * r, 100 + Math.sin(angleRad) * r);
      expect(ctx.jumpJustPressed).toBe(true);
      expect(ctx.right).toBe(true);
      expect(ctx.left).toBe(false);
    });

    it('sets jumpJustPressed without left/right when pushing straight up', () => {
      const ctx = makeStickContext();
      TouchControls.prototype._updateStick.call(ctx, 100, 100 - 30);
      expect(ctx.jumpJustPressed).toBe(true);
      expect(ctx.left).toBe(false);
      expect(ctx.right).toBe(false);
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
