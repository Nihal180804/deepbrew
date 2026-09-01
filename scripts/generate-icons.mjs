// Generates the Deepbrew app icon (coffee cup, warm tones) as a PNG.
// Used as the window icon and as the electron-builder source icon.
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function drawIcon(size) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const s = size / 512;

  // Rounded warm background.
  const r = 96 * s;
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#3b2f28');
  grad.addColorStop(1, '#5a463a');
  roundRect(ctx, 0, 0, size, size, r);
  ctx.fillStyle = grad;
  ctx.fill();

  // Saucer.
  ctx.fillStyle = '#e7d3bf';
  ctx.beginPath();
  ctx.ellipse(256 * s, 372 * s, 150 * s, 34 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cup body.
  ctx.fillStyle = '#f3e6d6';
  roundRect(ctx, 156 * s, 210 * s, 170 * s, 150 * s, 24 * s);
  ctx.fill();

  // Cup rim.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(241 * s, 214 * s, 86 * s, 20 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7b4b28';
  ctx.beginPath();
  ctx.ellipse(241 * s, 214 * s, 70 * s, 14 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Handle.
  ctx.lineWidth = 22 * s;
  ctx.strokeStyle = '#f3e6d6';
  ctx.beginPath();
  ctx.arc(330 * s, 275 * s, 42 * s, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  // Steam.
  ctx.strokeStyle = 'rgba(231,211,191,0.85)';
  ctx.lineWidth = 12 * s;
  ctx.lineCap = 'round';
  for (const x of [212, 268]) {
    ctx.beginPath();
    ctx.moveTo(x * s, 180 * s);
    ctx.bezierCurveTo((x + 30) * s, 150 * s, (x - 30) * s, 120 * s, x * s, 90 * s);
    ctx.stroke();
  }

  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

mkdirSync(join(root, 'build'), { recursive: true });
mkdirSync(join(root, 'resources'), { recursive: true });

for (const size of [512, 256]) {
  const buf = drawIcon(size).toBuffer('image/png');
  if (size === 512) {
    writeFileSync(join(root, 'build', 'icon.png'), buf);
    writeFileSync(join(root, 'resources', 'icon.png'), buf);
  }
  writeFileSync(join(root, 'resources', `icon-${size}.png`), buf);
}

console.log('Generated app icons in build/ and resources/.');
