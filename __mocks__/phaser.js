import { vi } from 'vitest';

export const justDownMock = vi.fn(() => false);

const Phaser = {
  Scene: class Scene {},
  Math: {
    Clamp: (value, min, max) => Math.min(Math.max(value, min), max),
    DEG_TO_RAD: Math.PI / 180,
    Between: (min, max) => Math.round(min + Math.random() * (max - min)),
    FloatBetween: (min, max) => min + Math.random() * (max - min),
    Vector2: class Vector2 {
      constructor(x = 0, y = 0) { this.x = x; this.y = y; }
    },
  },
  Curves: {
    Spline: class Spline {
      getPoints(n = 10) {
        return Array.from({ length: n + 1 }, (_, i) => ({ x: i, y: 0 }));
      }
    },
  },
  Input: {
    Keyboard: {
      JustDown: justDownMock,
    },
  },
  Utils: {
    Array: {
      GetRandom: (arr) => arr[0],
    },
  },
};

export default Phaser;
