/**
 * UIManager
 *
 * Owns all HUD and UI elements for PlaygroundScene:
 * - Score text
 * - Fruit idle nudge text
 * - Instruction text (top-left controls hint)
 * - Indicator arrows (goal & fruit)
 * - Controller selector dropdown
 * - GOAL! animation and score-flash animation
 */

// Goal animation constants
const GOAL_FLASH_INTERVAL = 120;   // ms between score text flash toggles
const GOAL_FLASH_DURATION = 1200;  // ms total flash duration
const GOAL_TEXT_FONT_SIZE = '120px';
const GOAL_TEXT_STROKE = 10;

export default class UIManager {
  constructor(scene) {
    this.scene = scene;
    this.selectedPadIndex = -1;

    this._createScoreText();
    this._createFruitIdleText();
    this._createInstructionText();
    this._createIndicatorArrows();
    this._createControllerDropdown();
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  get scoreText()     { return this._scoreText; }
  get fruitIdleText() { return this._fruitIdleText; }
  get goalArrow()     { return this._goalArrow; }
  get fruitArrow()    { return this._fruitArrow; }

  // ── Creation ──────────────────────────────────────────────────────────────

  _createScoreText() {
    const scene = this.scene;
    this._scoreText = scene.add
      .text(scene.scale.width - 12, 12, 'Score: 0', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#1a1a1a',
        backgroundColor: '#ffffffaa',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);
  }

  _createFruitIdleText() {
    const scene = this.scene;
    this._fruitIdleText = scene.add
      .text(scene.scale.width / 2, 56, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ff4422',
        backgroundColor: '#ffffffcc',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);
  }

  _createInstructionText() {
    this.scene.add
      .text(12, 12, 'Move: Arrows/AD  Jump: Up/W  Dash: Space/Square (hold)  Restart: R', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#1a1a1a',
        backgroundColor: '#ffffffaa',
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(100);
  }

  _createIndicatorArrows() {
    const scene = this.scene;

    this._goalArrow = scene.add
      .image(0, 0, 'arrowIndicator')
      .setScrollFactor(0)
      .setDepth(200)
      .setVisible(false)
      .setTint(0xffffff);

    this._fruitArrow = scene.add
      .image(0, 0, 'arrowIndicator')
      .setScrollFactor(0)
      .setDepth(200)
      .setVisible(false)
      .setTint(0xff8c3c);
  }

  _createControllerDropdown() {
    const scene = this.scene;

    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'position:fixed', 'top:8px', 'left:50%', 'transform:translateX(-50%)',
      'z-index:1000', 'font-family:monospace', 'font-size:13px',
      'background:rgba(255,255,255,0.75)', 'padding:4px 10px', 'border-radius:4px',
      'display:flex', 'align-items:center', 'gap:6px',
    ].join(';');

    const label = document.createElement('span');
    label.textContent = 'Controller:';

    const sel = document.createElement('select');
    sel.style.cssText = 'font-family:monospace;font-size:13px;max-width:220px';

    const refresh = () => {
      const prev = sel.value;
      sel.innerHTML = '';
      const opt0 = document.createElement('option');
      opt0.value = '-1';
      opt0.textContent = 'Auto (all)';
      sel.appendChild(opt0);

      const raw = navigator.getGamepads();
      for (let i = 0; i < raw.length; i++) {
        if (!raw[i]) continue;
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = raw[i].id.replace(/\s*\(.*\)/, '').trim() || `Pad ${i}`;
        sel.appendChild(opt);
        if (this.selectedPadIndex === -1 && raw[i].id.includes('STANDARD GAMEPAD')) {
          this.selectedPadIndex = i;
        }
      }
      sel.value = prev !== '' && [...sel.options].some(o => o.value === prev)
        ? prev
        : String(this.selectedPadIndex);
    };

    sel.addEventListener('change', () => {
      this.selectedPadIndex = parseInt(sel.value);
    });

    window.addEventListener('gamepadconnected', refresh);
    window.addEventListener('gamepaddisconnected', refresh);

    wrap.appendChild(label);
    wrap.appendChild(sel);
    document.body.appendChild(wrap);
    this._controllerDropdown = wrap;

    scene.events.once('shutdown', () => wrap.remove());

    refresh();
  }

  // ── Per-frame ─────────────────────────────────────────────────────────────

  /**
   * Updates indicator arrows each frame to point at off-screen targets.
   */
  updateIndicatorArrows() {
    const scene = this.scene;
    const cam = scene.cameras.main;
    const cw = cam.width;
    const ch = cam.height;
    const cx = cw / 2;
    const cy = ch / 2;
    const MARGIN = 52;

    const targets = [
      { sprite: scene.goal,  arrow: this._goalArrow },
      { sprite: scene.fruit, arrow: this._fruitArrow },
    ];

    for (const { sprite, arrow } of targets) {
      if (!sprite || !arrow) continue;

      const sx = sprite.x - cam.scrollX;
      const sy = sprite.y - cam.scrollY;

      if (sx >= 0 && sx <= cw && sy >= 0 && sy <= ch) {
        arrow.setVisible(false);
        continue;
      }

      arrow.setVisible(true);

      const dx = sx - cx;
      const dy = sy - cy;
      const angle = Math.atan2(dy, dx);

      const hw = cx - MARGIN;
      const hh = cy - MARGIN;
      let ex, ey;
      if (Math.abs(dx) * hh > Math.abs(dy) * hw) {
        const scale = hw / Math.abs(dx);
        ex = cx + Math.sign(dx) * hw;
        ey = cy + dy * scale;
      } else {
        const scale = hh / Math.abs(dy);
        ex = cx + dx * scale;
        ey = cy + Math.sign(dy) * hh;
      }

      arrow.setPosition(ex, ey);
      arrow.setRotation(angle);
    }

    const fruitVisible = this._fruitArrow?.visible;
    const goalVisible  = this._goalArrow?.visible;
    const flashAlpha = (scene.time.now % 600) < 450 ? 1 : 0.1;

    if (fruitVisible) {
      this._fruitArrow.setAlpha(flashAlpha);
      if (goalVisible) this._goalArrow.setAlpha(1);
    } else if (goalVisible) {
      this._goalArrow.setAlpha(flashAlpha);
    }
  }

  // ── Goal animations ───────────────────────────────────────────────────────

  /**
   * Flashes the score text on and off for GOAL_FLASH_DURATION ms.
   */
  flashScore() {
    const scene = this.scene;
    let flashes = 0;
    const flashTimer = scene.time.addEvent({
      delay: GOAL_FLASH_INTERVAL,
      repeat: 9,
      callback: () => {
        flashes++;
        this._scoreText.setVisible(flashes % 2 === 0);
      },
      callbackScope: this,
    });
    scene.time.delayedCall(GOAL_FLASH_DURATION, () => {
      flashTimer.remove();
      this._scoreText.setVisible(true);
    });
  }

  /**
   * Shows the big GOAL! text in the centre of the screen with a pop-in/fade-out tween.
   */
  showGoalAnimation() {
    const scene = this.scene;
    const { width, height } = scene.scale;
    const goalLabel = scene.add
      .text(width / 2, height / 2, 'GOAL!', {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: GOAL_TEXT_FONT_SIZE,
        color: '#ffffff',
        stroke: '#e63c00',
        strokeThickness: GOAL_TEXT_STROKE,
        shadow: { offsetX: 4, offsetY: 4, color: '#000', blur: 8, fill: true },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200)
      .setAlpha(0);

    scene.tweens.add({
      targets: goalLabel,
      alpha: { from: 0, to: 1 },
      scaleX: { from: 0.5, to: 1 },
      scaleY: { from: 0.5, to: 1 },
      duration: 250,
      ease: 'Back.Out',
      yoyo: false,
      onComplete: () => {
        scene.tweens.add({
          targets: goalLabel,
          alpha: 0,
          scaleX: 1.3,
          scaleY: 1.3,
          delay: 700,
          duration: 400,
          ease: 'Power2',
          onComplete: () => goalLabel.destroy(),
        });
      },
    });
  }

  /**
   * Called when the viewport resizes. Repositions score text and fruit idle text.
   */
  onResize(gameSize) {
    this._scoreText.setX(gameSize.width - 12);
    this._fruitIdleText.setX(gameSize.width / 2);
  }
}
