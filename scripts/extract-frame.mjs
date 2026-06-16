import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, '../src/assets/elephant.png');
const outPath = path.join(__dirname, '../src/assets/elephant-idle.png');

const png = PNG.sync.read(fs.readFileSync(srcPath));
const { width, data } = png;

const sx = 0;
const sy = 512;
const sw = 352;

const ALPHA_THRESHOLD = 20;

// Real character content sits at rows 274-497 within the row2 cell;
// 498-501 is a full-width opaque cell-boundary line, not part of the art.
const cropY0 = 273;
const cropY1 = 498; // exclusive
const ch = cropY1 - cropY0;

// Find x bounding box within that row range.
let minX = sw, maxX = -1;
for (let y = cropY0; y < cropY1; y++) {
  for (let x = 0; x < sw; x++) {
    const a = data[((sy + y) * width + (sx + x)) * 4 + 3];
    if (a > ALPHA_THRESHOLD) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
}
const PAD = 2;
minX = Math.max(0, minX - PAD);
maxX = Math.min(sw - 1, maxX + PAD);
const cw = maxX - minX + 1;

const out = new PNG({ width: cw, height: ch });
for (let y = 0; y < ch; y++) {
  for (let x = 0; x < cw; x++) {
    const srcIdx = ((sy + cropY0 + y) * width + (sx + minX + x)) * 4;
    const dstIdx = (y * cw + x) * 4;
    for (let c = 0; c < 4; c++) {
      out.data[dstIdx + c] = data[srcIdx + c] ?? 0;
    }
  }
}

fs.writeFileSync(outPath, PNG.sync.write(out));
console.log(`wrote ${outPath} (${cw}x${ch}), x range ${minX}-${maxX}`);
