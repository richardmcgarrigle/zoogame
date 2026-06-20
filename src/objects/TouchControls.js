/**
 * On-screen touch controls for mobile/tablet play.
 *
 * Anywhere on screen — dynamic analog stick:
 *   Appears where the user first touches or clicks (outside the buttons). The
 *   thumb follows the pointer and is clamped to a max radius. Horizontal
 *   displacement past a dead zone sets .left / .right.
 *
 * Radial jump zone — pushing the stick into the top 60° (−30° to +30° from
 *   straight up) triggers a jump.
 *
 * Bottom-right corner — fixed jump & dash buttons.
 *
 * Public state flags read by Elephant.js each frame:
 *   .left  .right  .jumpJustPressed  .dashHeld
 *
 * jumpJustPressed is true for exactly one frame after the first touch on the
 * jump button (mirrors JustDown keyboard behaviour).
 */

const STICK_BASE_RADIUS   = 85;
const STICK_THUMB_RADIUS  = 28;
const STICK_MAX_TRAVEL    = 80;   // max px thumb can move from base
const STICK_DEAD_ZONE     = 12;   // px dead zone before left/right activates
const STICK_DASH_THRESHOLD = 56;  // px beyond which drag activates dash
const STICK_BASE_ALPHA    = 0.30;
const STICK_THUMB_ALPHA   = 0.65;

// Jump zone: top 60° of the radial (−30° to +30° from straight up).
// In atan2 coords (Y-down), straight up is −π/2. The zone spans
// from −2π/3 (−120°) to −π/3 (−60°).
const JUMP_ZONE_MIN = -Math.PI * 2 / 3;  // −120°
const JUMP_ZONE_MAX = -Math.PI / 3;      // −60°

const BTN_SIZE   = 70;
const BTN_MARGIN = 20;
const BTN_GAP    = 12;
const ALPHA      = 0.45;
const ALPHA_DOWN = 0.80;

const COLORS = {
  jump: 0x44cc55,
  dash: 0xff8822,
};

export default class TouchControls {
  constructor(scene) {
    this.scene = scene;

    // Public state flags read by Elephant each frame.
    this.left            = false;
    this.right           = false;
    this.jumpJustPressed = false;
    this._jumpWasDown    = false;
    this.dashHeld        = false;
    this._inJumpZone     = false;  // tracks whether stick is currently in jump zone

    // --- analog stick ---
    this._stickPointerId = null;
    this._stickBase      = { x: 0, y: 0 };

    this._stickContainer = scene.add.container(0, 0).setDepth(200).setScrollFactor(0);
    this._stickBaseGfx   = scene.add.graphics();
    this._stickThumbGfx  = scene.add.graphics();
    this._stickContainer.add([this._stickBaseGfx, this._stickThumbGfx]);
    this._setStickVisible(false);

    // --- fixed buttons ---
    this._buttons    = {};
    this._pointerMap = {};
    this._btnContainer = scene.add.container(0, 0).setDepth(200).setScrollFactor(0);

    this._buildButton('jump', '▲', 0);
    this._buildButton('dash', '⚡', 1);
    this._repositionButtons();

    scene.scale.on('resize', () => this._repositionButtons());

    scene.input.on('pointerdown',      this._onDown, this);
    scene.input.on('pointermove',      this._onMove, this);
    scene.input.on('pointerup',        this._onUp,   this);
    scene.input.on('pointerupoutside', this._onUp,   this);
  }

  /**
   * Returns true if jump was just pressed this frame, then clears the flag.
   * Prefer this over reading jumpJustPressed directly — it makes the consume
   * contract impossible to forget (the flag clears itself on read).
   */
  consumeJump() {
    const v = this.jumpJustPressed;
    this.jumpJustPressed = false;
    return v;
  }

  /** @deprecated Use consumeJump() instead. */
  postUpdate() {
    this.jumpJustPressed = false;
  }

  // ---------------------------------------------------------------------------
  // Analog stick
  // ---------------------------------------------------------------------------

  _setStickVisible(visible) {
    this._stickContainer.setVisible(visible);
  }

  _drawStick(thumbX, thumbY, dashing, inJumpZone) {
    const bx = this._stickBase.x;
    const by = this._stickBase.y;

    this._stickBaseGfx.clear();
    // Outer ring (dash zone boundary)
    this._stickBaseGfx.fillStyle(0xff8822, STICK_BASE_ALPHA * 0.8);
    this._stickBaseGfx.fillCircle(bx, by, STICK_BASE_RADIUS);
    this._stickBaseGfx.lineStyle(2, 0xff8822, 0.5);
    this._stickBaseGfx.strokeCircle(bx, by, STICK_BASE_RADIUS);
    // Inner ring (walk zone)
    this._stickBaseGfx.fillStyle(0xffffff, STICK_BASE_ALPHA);
    this._stickBaseGfx.fillCircle(bx, by, STICK_DASH_THRESHOLD);
    this._stickBaseGfx.lineStyle(2, 0xffffff, 0.5);
    this._stickBaseGfx.strokeCircle(bx, by, STICK_DASH_THRESHOLD);

    // Jump zone arc at the top of the stick base
    const jumpAlpha = inJumpZone ? 0.7 : 0.35;
    this._stickBaseGfx.lineStyle(3, 0x44cc55, jumpAlpha);
    this._stickBaseGfx.beginPath();
    this._stickBaseGfx.arc(bx, by, STICK_DEAD_ZONE + 4, JUMP_ZONE_MIN, JUMP_ZONE_MAX, false);
    this._stickBaseGfx.strokePath();
    this._stickBaseGfx.lineStyle(2, 0x44cc55, jumpAlpha * 0.7);
    this._stickBaseGfx.beginPath();
    this._stickBaseGfx.arc(bx, by, STICK_BASE_RADIUS - 4, JUMP_ZONE_MIN, JUMP_ZONE_MAX, false);
    this._stickBaseGfx.strokePath();

    const thumbColor = inJumpZone ? 0x44cc55 : dashing ? 0xff8822 : 0x3399ff;
    this._stickThumbGfx.clear();
    this._stickThumbGfx.fillStyle(thumbColor, STICK_THUMB_ALPHA);
    this._stickThumbGfx.fillCircle(thumbX, thumbY, STICK_THUMB_RADIUS);
    this._stickThumbGfx.lineStyle(2, 0xffffff, 0.8);
    this._stickThumbGfx.strokeCircle(thumbX, thumbY, STICK_THUMB_RADIUS);
  }

  _updateStick(px, py) {
    const dx = px - this._stickBase.x;
    const dy = py - this._stickBase.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamp = Math.min(dist, STICK_MAX_TRAVEL);
    const angle = Math.atan2(dy, dx);
    const tx = this._stickBase.x + Math.cos(angle) * clamp;
    const ty = this._stickBase.y + Math.sin(angle) * clamp;

    const dashing = dist >= STICK_DASH_THRESHOLD;
    this.dashHeld = dashing;

    const EPS = 1e-10;
    const inJumpZone = dist > STICK_DEAD_ZONE &&
      angle >= JUMP_ZONE_MIN - EPS && angle <= JUMP_ZONE_MAX + EPS;
    if (inJumpZone && !this._inJumpZone) {
      this.jumpJustPressed = true;
    }
    this._inJumpZone = inJumpZone;

    this._drawStick(tx, ty, dashing, inJumpZone);

    const hx = tx - this._stickBase.x;
    this.left  = hx < -STICK_DEAD_ZONE;
    this.right = hx >  STICK_DEAD_ZONE;
  }

  _startStick(px, py) {
    this._stickBase = { x: px, y: py };
    this._inJumpZone = false;
    this._setStickVisible(true);
    this._drawStick(px, py, false, false);
    this.left  = false;
    this.right = false;
  }

  _endStick() {
    this._stickPointerId = null;
    this._setStickVisible(false);
    this.left        = false;
    this.right       = false;
    this.dashHeld    = false;
    this._inJumpZone = false;
  }

  // ---------------------------------------------------------------------------
  // Fixed buttons
  // ---------------------------------------------------------------------------

  _buildButton(name, label, slot) {
    const gfx = this.scene.add.graphics();
    const txt = this.scene.add.text(0, 0, label, {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);

    this._btnContainer.add([gfx, txt]);
    this._buttons[name] = { gfx, txt, active: false, slot };
    this._drawButton(name, false);
  }

  _drawButton(name, pressed) {
    const btn = this._buttons[name];
    const alpha = pressed ? ALPHA_DOWN : ALPHA;
    btn.gfx.clear();
    btn.gfx.fillStyle(COLORS[name], alpha);
    btn.gfx.fillRoundedRect(-BTN_SIZE / 2, -BTN_SIZE / 2, BTN_SIZE, BTN_SIZE, 14);
    btn.gfx.lineStyle(2, 0xffffff, pressed ? 0.9 : 0.3);
    btn.gfx.strokeRoundedRect(-BTN_SIZE / 2, -BTN_SIZE / 2, BTN_SIZE, BTN_SIZE, 14);
  }

  _repositionButtons() {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const jumpX = W - BTN_MARGIN - BTN_SIZE / 2 - BTN_SIZE - BTN_GAP;
    const dashX = W - BTN_MARGIN - BTN_SIZE / 2;
    const y     = H - BTN_MARGIN - BTN_SIZE / 2;
    this._setPos('jump', jumpX, y);
    this._setPos('dash', dashX, y);
  }

  _setPos(name, x, y) {
    const btn = this._buttons[name];
    btn.gfx.setPosition(x, y);
    btn.txt.setPosition(x, y);
    btn.x = x;
    btn.y = y;
  }

  _hitTestBtn(px, py) {
    const half = BTN_SIZE / 2 + 8;
    for (const [name, btn] of Object.entries(this._buttons)) {
      if (Math.abs(px - btn.x) <= half && Math.abs(py - btn.y) <= half) return name;
    }
    return null;
  }

  _press(name) {
    if (!name) return;
    const btn = this._buttons[name];
    if (btn.active) return;
    btn.active = true;
    this._drawButton(name, true);
    this._applyBtnState(name, true);
  }

  _release(name) {
    if (!name) return;
    const btn = this._buttons[name];
    if (!btn.active) return;
    btn.active = false;
    this._drawButton(name, false);
    this._applyBtnState(name, false);
  }

  _applyBtnState(name, down) {
    if (name === 'dash') this.dashHeld = down;
    if (name === 'jump' && down && !this._jumpWasDown) this.jumpJustPressed = true;
    if (name === 'jump') this._jumpWasDown = down;
  }

  // ---------------------------------------------------------------------------
  // Pointer routing
  // ---------------------------------------------------------------------------

  _isLeftSide(px) {
    return px < this.scene.scale.width / 2;
  }

  _onDown(pointer) {
    // Button takes priority regardless of side.
    const btn = this._hitTestBtn(pointer.x, pointer.y);
    if (btn) {
      this._pointerMap[pointer.id] = btn;
      this._press(btn);
      return;
    }

    // Anywhere on screen → analog stick (one stick at a time).
    if (this._stickPointerId === null) {
      this._stickPointerId = pointer.id;
      this._startStick(pointer.x, pointer.y);
    }
  }

  _onMove(pointer) {
    if (!pointer.isDown) return;

    if (pointer.id === this._stickPointerId) {
      this._updateStick(pointer.x, pointer.y);
    }
    // Buttons are sticky once pressed — only released on pointerup.
  }

  _onUp(pointer) {
    if (pointer.id === this._stickPointerId) {
      this._endStick();
      return;
    }
    const name = this._pointerMap[pointer.id];
    this._release(name);
    delete this._pointerMap[pointer.id];
  }
}
