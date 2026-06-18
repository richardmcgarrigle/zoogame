const WIND_STREAK_LIFE = 260;
const WIND_STREAK_SPEED = 280;
const WIND_STREAK_LEN_MIN = 35;
const WIND_STREAK_LEN_MAX = 100;

/**
 * Renders horizontal wind streaks behind the elephant while it is dashing.
 *
 * Owned by the scene rather than Elephant so visual effects stay separate
 * from input/movement logic. Elephant calls update() each frame and passes
 * its position, dash state, and facing direction.
 */
export default class DashEffect {
  constructor(scene) {
    this._graphics = scene.add.graphics().setDepth(9);
    this._streaks = [];
  }

  /**
   * Advances and redraws all active wind streaks.
   *
   * @param {number}  delta    Frame delta in milliseconds.
   * @param {number}  ex       Elephant world x.
   * @param {number}  ey       Elephant world y.
   * @param {boolean} dashing  Whether the dash is currently active.
   * @param {number}  facing   Movement direction: 1 = right, -1 = left.
   * @param {number}  velX     Current horizontal velocity (used to gate emission).
   */
  update(delta, ex, ey, dashing, facing, velX) {
    const isMoving = Math.abs(velX) > 1;

    if (dashing && isMoving) {
      for (let i = 0; i < 3; i++) {
        const len = WIND_STREAK_LEN_MIN + Math.random() * (WIND_STREAK_LEN_MAX - WIND_STREAK_LEN_MIN);
        const offsetX = facing * (Math.random() * 55 - 10);
        const offsetY = (Math.random() - 0.5) * 72;
        this._streaks.push({
          x: ex + offsetX,
          y: ey + offsetY,
          vx: -facing * WIND_STREAK_SPEED,
          len,
          life: WIND_STREAK_LIFE,
          maxLife: WIND_STREAK_LIFE,
        });
      }
    }

    this._graphics.clear();
    for (let i = this._streaks.length - 1; i >= 0; i--) {
      const s = this._streaks[i];
      s.x += s.vx * delta * 0.001;
      s.life -= delta;
      if (s.life <= 0) { this._streaks.splice(i, 1); continue; }
      const alpha = (s.life / s.maxLife) * 0.85;
      const color = Math.random() > 0.4 ? 0xddf4ff : 0xffffff;
      this._graphics.fillStyle(color, alpha);
      const drawX = s.vx < 0 ? s.x - s.len : s.x;
      this._graphics.fillRect(drawX, s.y - 2, s.len, 4);
    }
  }
}
