/**
 * On-screen virtual d-pad + buttons for touch/mobile play.
 *
 * Renders four semi-transparent buttons fixed to the HUD layer:
 *   Left / Right  — bottom-left corner
 *   Jump / Dash   — bottom-right corner
 *
 * Exposes boolean state flags that Elephant.js reads each frame:
 *   .left  .right  .jumpJustPressed  .dashHeld
 *
 * jumpJustPressed is true for exactly one frame after the first touch on
 * the jump button (mirrors JustDown keyboard behaviour).
 */

const BTN_SIZE   = 70;   // px (logical, before devicePixelRatio)
const BTN_MARGIN = 20;   // from screen edge
const BTN_GAP    = 12;   // between left/right and jump/dash
const ALPHA      = 0.45;
const ALPHA_DOWN = 0.80;

const COLORS = {
  left:  0x3399ff,
  right: 0x3399ff,
  jump:  0x44cc55,
  dash:  0xff8822,
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

    this._buttons = {};   // name → { gfx, label, active }
    this._pointerMap = {}; // pointerId → button name

    this._container = scene.add.container(0, 0).setDepth(200).setScrollFactor(0);

    this._buildButton('left',  '◀', -1, 0,   false);
    this._buildButton('right', '▶', -1, 1,   false);
    this._buildButton('jump',  '▲',  1, 0,   false);
    this._buildButton('dash',  '⚡',  1, 1,   false);

    this._repositionAll();

    scene.scale.on('resize', () => this._repositionAll());

    // Use the scene's input manager to catch all pointer events.
    scene.input.on('pointerdown',  this._onDown,  this);
    scene.input.on('pointermove',  this._onMove,  this);
    scene.input.on('pointerup',    this._onUp,    this);
    scene.input.on('pointerupoutside', this._onUp, this);
  }

  /**
   * Call at the END of Elephant.update so jumpJustPressed stays true for
   * exactly one frame.
   */
  postUpdate() {
    this.jumpJustPressed = false;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * side:  -1 = left cluster, +1 = right cluster
   * slot:   0 = first button (left/jump), 1 = second button (right/dash)
   */
  _buildButton(name, label, side, slot, active) {
    const gfx = this.scene.add.graphics();
    const txt = this.scene.add.text(0, 0, label, {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);

    this._container.add([gfx, txt]);
    this._buttons[name] = { gfx, txt, active: false, side, slot };
    this._drawButton(name, false);
  }

  _drawButton(name, pressed) {
    const btn = this._buttons[name];
    const color = COLORS[name];
    const alpha = pressed ? ALPHA_DOWN : ALPHA;

    btn.gfx.clear();
    btn.gfx.fillStyle(color, alpha);
    btn.gfx.fillRoundedRect(-BTN_SIZE / 2, -BTN_SIZE / 2, BTN_SIZE, BTN_SIZE, 14);
    btn.gfx.lineStyle(2, 0xffffff, pressed ? 0.9 : 0.3);
    btn.gfx.strokeRoundedRect(-BTN_SIZE / 2, -BTN_SIZE / 2, BTN_SIZE, BTN_SIZE, 14);
  }

  _repositionAll() {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    // Left cluster: left/right buttons sit side by side in bottom-left.
    const leftBaseX = BTN_MARGIN + BTN_SIZE / 2;
    const rightBaseX = leftBaseX + BTN_SIZE + BTN_GAP;
    const leftClusterY = H - BTN_MARGIN - BTN_SIZE / 2;

    // Right cluster: jump/dash side by side in bottom-right.
    const jumpBaseX = W - BTN_MARGIN - BTN_SIZE / 2 - BTN_SIZE - BTN_GAP;
    const dashBaseX = W - BTN_MARGIN - BTN_SIZE / 2;
    const rightClusterY = H - BTN_MARGIN - BTN_SIZE / 2;

    this._setPos('left',  leftBaseX,  leftClusterY);
    this._setPos('right', rightBaseX, leftClusterY);
    this._setPos('jump',  jumpBaseX,  rightClusterY);
    this._setPos('dash',  dashBaseX,  rightClusterY);
  }

  _setPos(name, x, y) {
    const btn = this._buttons[name];
    btn.gfx.setPosition(x, y);
    btn.txt.setPosition(x, y);
    btn.x = x;
    btn.y = y;
  }

  _hitTest(px, py) {
    const half = BTN_SIZE / 2 + 8; // small extra hit area
    for (const [name, btn] of Object.entries(this._buttons)) {
      if (Math.abs(px - btn.x) <= half && Math.abs(py - btn.y) <= half) {
        return name;
      }
    }
    return null;
  }

  _press(name) {
    if (!name) return;
    const btn = this._buttons[name];
    if (btn.active) return;
    btn.active = true;
    this._drawButton(name, true);
    this._applyState(name, true);
  }

  _release(name) {
    if (!name) return;
    const btn = this._buttons[name];
    if (!btn.active) return;
    btn.active = false;
    this._drawButton(name, false);
    this._applyState(name, false);
  }

  _applyState(name, down) {
    if (name === 'left')  this.left  = down;
    if (name === 'right') this.right = down;
    if (name === 'dash')  this.dashHeld = down;
    if (name === 'jump' && down && !this._jumpWasDown) {
      this.jumpJustPressed = true;
    }
    if (name === 'jump') this._jumpWasDown = down;
  }

  _onDown(pointer) {
    const name = this._hitTest(pointer.x, pointer.y);
    if (!name) return;
    this._pointerMap[pointer.id] = name;
    this._press(name);
  }

  _onMove(pointer) {
    if (!pointer.isDown) return;
    const prev = this._pointerMap[pointer.id];
    const curr = this._hitTest(pointer.x, pointer.y);
    if (prev !== curr) {
      this._release(prev);
      if (curr) {
        this._pointerMap[pointer.id] = curr;
        this._press(curr);
      } else {
        delete this._pointerMap[pointer.id];
      }
    }
  }

  _onUp(pointer) {
    const name = this._pointerMap[pointer.id];
    this._release(name);
    delete this._pointerMap[pointer.id];
  }
}
