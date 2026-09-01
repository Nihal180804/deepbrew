// Crops a sheet of line-art characters into individual transparent PNGs.
//
//   1) Save the sheet to  src/renderer/assets/illustrations/_source.<png|jpg|webp>
//   2) node scripts/crop-illustrations.mjs            → dumps numbered tiles
//                                                        + a contact sheet
//   3) node scripts/crop-illustrations.mjs ready=3 focus=12 break=6 long=18 complete=9
//                                                     → writes <state>.png files
//
// Background removal is an edge flood-fill from the borders, so enclosed white
// areas (shirts, faces) are preserved while the outer background becomes
// transparent. The app inverts raster art in dark mode automatically.
import { createCanvas, loadImage, Image } from '@napi-rs/canvas';
import { readdirSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'src', 'renderer', 'assets', 'illustrations');
const tilesDir = join(dir, '_tiles');

function findSource() {
  const hit = readdirSync(dir).find((f) => /^_source\.(png|jpe?g|webp)$/i.test(f));
  if (!hit) {
    console.error(
      `\nNo source image found.\nSave your sheet as:\n  ${join(dir, '_source.png')}\n(then re-run this script)\n`
    );
    process.exit(1);
  }
  return join(dir, hit);
}

const BG_LUM = 232; // >= this (and low saturation) counts as removable background
const INK_LUM = 130; // < this counts as "ink" for segmentation
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const isBg = (r, g, b) => lum(r, g, b) >= BG_LUM && Math.max(r, g, b) - Math.min(r, g, b) < 26;

function floodFillTransparent(data, w, h) {
  const stack = [];
  const seen = new Uint8Array(w * h);
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (seen[i]) return;
    seen[i] = 1;
    const p = i * 4;
    if (isBg(data[p], data[p + 1], data[p + 2])) {
      data[p + 3] = 0;
      stack.push(x, y);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

// Split a boolean "hasInk" projection into runs, ignoring gaps < minGap.
function segments(hasInk, minGap) {
  const runs = [];
  let start = -1;
  let gap = 0;
  for (let i = 0; i < hasInk.length; i++) {
    if (hasInk[i]) {
      if (start < 0) start = i;
      gap = 0;
    } else if (start >= 0) {
      gap++;
      if (gap >= minGap) {
        runs.push([start, i - gap + 1]);
        start = -1;
        gap = 0;
      }
    }
  }
  if (start >= 0) runs.push([start, hasInk.length - 1]);
  return runs;
}

async function main() {
  const src = findSource();
  const img = await loadImage(src);
  const W = img.width;
  const H = img.height;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, W, H);
  const data = imageData.data;

  floodFillTransparent(data, W, H);
  ctx.putImageData(imageData, 0, 0);

  // ink map for segmentation (original darkness)
  const ink = (x, y) => {
    const p = (y * W + x) * 4;
    return lum(data[p], data[p + 1], data[p + 2]) < INK_LUM;
  };

  // rows -> bands
  const rowInk = new Uint8Array(H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ink(x, y)) { rowInk[y] = 1; break; }
  const bands = segments(rowInk, Math.round(H * 0.04)).filter(([a, b]) => b - a > H * 0.06);

  const tiles = [];
  for (const [y0, y1] of bands) {
    const colInk = new Uint8Array(W);
    for (let x = 0; x < W; x++) for (let y = y0; y <= y1; y++) if (ink(x, y)) { colInk[x] = 1; break; }
    const cols = segments(colInk, Math.round(W * 0.006)).filter(([a, b]) => b - a > W * 0.016);
    for (const [x0, x1] of cols) {
      // tight bbox within the cell
      let minX = x1, maxX = x0, minY = y1, maxY = y0;
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++)
          if (ink(x, y)) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
      if (maxX - minX < 20 || maxY - minY < 40) continue; // drop noise/watermark
      tiles.push({ minX, minY, maxX, maxY });
    }
  }

  mkdirSync(tilesDir, { recursive: true });
  const written = [];
  tiles.forEach((t, i) => {
    const pad = 12;
    const w = t.maxX - t.minX + 1;
    const h = t.maxY - t.minY + 1;
    const side = Math.max(w, h) + pad * 2;
    const c = createCanvas(side, side);
    const cx = c.getContext('2d');
    cx.putImageData(imageData, pad - t.minX + (side - pad * 2 - w) / 2, pad - t.minY + (side - pad * 2 - h) / 2, t.minX, t.minY, w, h);
    const buf = c.toBuffer('image/png');
    const name = `tile-${String(i).padStart(2, '0')}.png`;
    writeFileSync(join(tilesDir, name), buf);
    written.push({ name, side });
  });

  // contact sheet with indices (loadImage is async — Image-from-buffer won't
  // decode in time to draw).
  const cols = 6;
  const cell = 150;
  const rows = Math.ceil(written.length / cols);
  const sheet = createCanvas(cols * cell, rows * (cell + 18) + 8);
  const sx = sheet.getContext('2d');
  sx.fillStyle = '#fff';
  sx.fillRect(0, 0, sheet.width, sheet.height);
  for (let i = 0; i < written.length; i++) {
    const tImg = await loadImage(join(tilesDir, written[i].name));
    const cxp = (i % cols) * cell;
    const cyp = Math.floor(i / cols) * (cell + 18);
    sx.drawImage(tImg, cxp + 8, cyp + 8, cell - 16, cell - 16);
    sx.fillStyle = '#111';
    sx.font = '600 13px sans-serif';
    sx.textAlign = 'center';
    sx.fillText(`#${i}`, cxp + cell / 2, cyp + cell + 8);
  }
  writeFileSync(join(dir, '_contact-sheet.png'), sheet.toBuffer('image/png'));

  console.log(`Extracted ${written.length} tiles → ${tilesDir}`);
  console.log(`Contact sheet → ${join(dir, '_contact-sheet.png')}`);

  // Optional mapping: state=index args
  const map = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^(ready|focus|break|long|complete)=(\d+)$/);
    if (m) map[m[1]] = parseInt(m[2], 10);
  }
  if (Object.keys(map).length) {
    for (const [state, idx] of Object.entries(map)) {
      const from = join(tilesDir, `tile-${String(idx).padStart(2, '0')}.png`);
      if (existsSync(from)) {
        copyFileSync(from, join(dir, `${state}.png`));
        console.log(`  ${state}.png  ←  tile #${idx}`);
      } else {
        console.warn(`  (skip) no tile #${idx} for ${state}`);
      }
    }
  }
}

import { readFileSync as readFileSyncBuf } from 'node:fs';
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
