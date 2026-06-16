// Generates simple "chunky cozy" placeholder textures at runtime using
// Phaser Graphics + generateTexture, so the slice needs no external art assets.
// Sizes here are final (no later scaling) so Matter physics bodies — which are
// derived from texture frame size — line up with what's drawn on screen.

const OUTLINE = 0x1a1a1a;
const OUTLINE_WIDTH = 6;

export const TEXTURE_SIZES = {
  platformLeaf: { width: 260, height: 36 },
  orange: { width: 56, height: 56 },
  apple:  { width: 56, height: 56 },
  melon:  { width: 84, height: 84 },
  crate: { width: 64, height: 64 },
  goal: { width: 120, height: 260 },
  star: { width: 32, height: 32 },
  arrowIndicator: { width: 48, height: 36 },
  cloud: { width: 160, height: 72 },
  bird: { width: 44, height: 20 },
};

// Returns alternating outer/inner points for a 5-point star, centered at (cx, cy).
function starPoints(cx, cy, outerR, innerR) {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  }
  return points;
}

export function generatePlaceholderTextures(scene) {
  const g = scene.add.graphics();

  // Leaf platform: chunky rounded green branch.
  {
    const { width: w, height: h } = TEXTURE_SIZES.platformLeaf;
    g.clear();
    g.fillStyle(0x5fae46, 1);
    g.lineStyle(OUTLINE_WIDTH, OUTLINE, 1);
    g.fillRoundedRect(OUTLINE_WIDTH / 2, OUTLINE_WIDTH / 2, w - OUTLINE_WIDTH, h - OUTLINE_WIDTH, 14);
    g.strokeRoundedRect(OUTLINE_WIDTH / 2, OUTLINE_WIDTH / 2, w - OUTLINE_WIDTH, h - OUTLINE_WIDTH, 14);
    g.lineStyle(3, 0x3f7d30, 1);
    g.beginPath();
    g.moveTo(10, h / 2);
    g.lineTo(w - 10, h / 2);
    g.strokePath();
    g.generateTexture('platformLeaf', w, h);
  }

  // Orange: bright round citrus with stem nub.
  {
    const { width: w, height: h } = TEXTURE_SIZES.orange;
    const cx = w / 2, cy = h / 2, r = w / 2 - OUTLINE_WIDTH / 2;
    g.clear();
    g.fillStyle(0xff8c3c, 1);
    g.lineStyle(OUTLINE_WIDTH, OUTLINE, 1);
    g.fillCircle(cx, cy, r);
    g.strokeCircle(cx, cy, r);
    // Highlight
    g.fillStyle(0xffb87a, 0.55);
    g.fillCircle(cx - 9, cy - 9, 10);
    // Stem nub
    g.fillStyle(0x4f7a3a, 1);
    g.fillRoundedRect(cx - 4, 2, 8, 11, 4);
    g.generateTexture('orange', w, h);
  }

  // Apple: red with leaf and shine.
  {
    const { width: w, height: h } = TEXTURE_SIZES.apple;
    const cx = w / 2, cy = h / 2 + 2, r = w / 2 - OUTLINE_WIDTH / 2 - 1;
    g.clear();
    g.fillStyle(0xd42b22, 1);
    g.lineStyle(OUTLINE_WIDTH, OUTLINE, 1);
    g.fillCircle(cx, cy, r);
    g.strokeCircle(cx, cy, r);
    // Highlight
    g.fillStyle(0xff6a5e, 0.5);
    g.fillCircle(cx - 9, cy - 8, 9);
    // Stem
    g.lineStyle(3, 0x3a1e08, 1);
    g.beginPath(); g.moveTo(cx + 1, cy - r); g.lineTo(cx + 5, cy - r - 8); g.strokePath();
    // Leaf
    g.fillStyle(0x3a9128, 1);
    g.lineStyle(2, OUTLINE, 1);
    g.fillEllipse(cx + 10, cy - r - 5, 16, 9);
    g.strokeEllipse(cx + 10, cy - r - 5, 16, 9);
    g.generateTexture('apple', w, h);
  }

  // Melon: large green sphere with curved stripes.
  {
    const { width: w, height: h } = TEXTURE_SIZES.melon;
    const cx = w / 2, cy = h / 2, r = w / 2 - OUTLINE_WIDTH / 2;
    g.clear();
    g.fillStyle(0x5cb82e, 1);
    g.fillCircle(cx, cy, r);
    // Lighter curved stripes — 6 arcs spread around the sphere
    g.lineStyle(5, 0x84d44a, 0.75);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath();
      g.arc(cx, cy, r * 0.62, a - 0.55, a + 0.55);
      g.strokePath();
    }
    // Outline
    g.lineStyle(OUTLINE_WIDTH, OUTLINE, 1);
    g.strokeCircle(cx, cy, r);
    // Highlight
    g.fillStyle(0x90e050, 0.4);
    g.fillCircle(cx - 14, cy - 14, 14);
    // Stem nub
    g.fillStyle(0x3a6010, 1);
    g.fillRoundedRect(cx - 5, 2, 10, 12, 4);
    g.generateTexture('melon', w, h);
  }

  // Crate: bamboo-stack-style square with stripes.
  {
    const { width: w, height: h } = TEXTURE_SIZES.crate;
    g.clear();
    g.fillStyle(0xd9b46a, 1);
    g.lineStyle(OUTLINE_WIDTH, OUTLINE, 1);
    g.fillRoundedRect(OUTLINE_WIDTH / 2, OUTLINE_WIDTH / 2, w - OUTLINE_WIDTH, h - OUTLINE_WIDTH, 8);
    g.strokeRoundedRect(OUTLINE_WIDTH / 2, OUTLINE_WIDTH / 2, w - OUTLINE_WIDTH, h - OUTLINE_WIDTH, 8);
    g.lineStyle(3, 0xb9914a, 1);
    for (const fx of [w * 0.33, w * 0.66]) {
      g.beginPath();
      g.moveTo(fx, 6);
      g.lineTo(fx, h - 6);
      g.strokePath();
    }
    g.generateTexture('crate', w, h);
  }

  // Goal: open-fronted frame with a net, posts on top/right/bottom.
  {
    const { width: w, height: h } = TEXTURE_SIZES.goal;
    const postSize = 18;
    g.clear();
    g.fillStyle(0xfafafa, 1);
    g.lineStyle(OUTLINE_WIDTH, OUTLINE, 1);
    // Top crossbar
    g.fillRoundedRect(0, 0, w, postSize, 6);
    g.strokeRoundedRect(0, 0, w, postSize, 6);
    // Back post (right side)
    g.fillRoundedRect(w - postSize, 0, postSize, h, 6);
    g.strokeRoundedRect(w - postSize, 0, postSize, h, 6);
    // Bottom support
    g.fillRoundedRect(0, h - postSize, w, postSize, 6);
    g.strokeRoundedRect(0, h - postSize, w, postSize, 6);
    // Net cross-hatch
    g.lineStyle(2, 0xcccccc, 0.9);
    for (let x = 0; x <= w; x += 14) {
      g.beginPath();
      g.moveTo(x, postSize);
      g.lineTo(x, h - postSize);
      g.strokePath();
    }
    for (let y = postSize; y <= h - postSize; y += 14) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.strokePath();
    }
    g.generateTexture('goal', w, h);
  }

  // Star: small bright burst piece for goal celebrations.
  {
    const { width: w, height: h } = TEXTURE_SIZES.star;
    g.clear();
    g.fillStyle(0xffd84a, 1);
    g.lineStyle(3, OUTLINE, 1);
    g.fillPoints(starPoints(w / 2, h / 2, w / 2 - 2, (w / 2 - 2) * 0.45), true);
    g.strokePoints(starPoints(w / 2, h / 2, w / 2 - 2, (w / 2 - 2) * 0.45), true);
    g.generateTexture('star', w, h);
  }

  // Cloud: white fluffy shape from overlapping circles.
  {
    const { width: w, height: h } = TEXTURE_SIZES.cloud;
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(36, h - 16, 26);
    g.fillCircle(64, h - 26, 34);
    g.fillCircle(100, h - 18, 28);
    g.fillCircle(130, h - 14, 22);
    g.fillCircle(50, h - 38, 24);
    g.fillCircle(88, h - 40, 20);
    g.generateTexture('cloud', w, h);
  }

  // Bird: dark silhouette — small oval body with two swept-back wing arcs.
  {
    const { width: w, height: h } = TEXTURE_SIZES.bird;
    const cx = w / 2, cy = h / 2;
    g.clear();
    g.fillStyle(0x2a2a2a, 1);
    // Body
    g.fillEllipse(cx, cy + 2, 14, 9);
    // Left wing arc
    g.lineStyle(3, 0x2a2a2a, 1);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx - 18, cy - 6);
    g.lineTo(cx - 4, cy + 1);
    g.strokePath();
    g.fillStyle(0x2a2a2a, 1);
    g.fillTriangle(cx, cy, cx - 18, cy - 6, cx - 4, cy + 1);
    // Right wing arc
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + 18, cy - 6);
    g.lineTo(cx + 4, cy + 1);
    g.strokePath();
    g.fillTriangle(cx, cy, cx + 18, cy - 6, cx + 4, cy + 1);
    g.generateTexture('bird', w, h);
  }

  // Off-screen indicator arrow: white triangle pointing right, tinted per target.
  {
    const { width: w, height: h } = TEXTURE_SIZES.arrowIndicator;
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.lineStyle(4, OUTLINE, 1);
    g.fillTriangle(4, 3, 4, h - 3, w - 4, h / 2);
    g.strokeTriangle(4, 3, 4, h - 3, w - 4, h / 2);
    g.generateTexture('arrowIndicator', w, h);
  }

  g.destroy();
}
