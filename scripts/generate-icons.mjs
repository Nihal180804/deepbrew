// Generates the Deepbrew app icon as a PNG: a white coffee mug inside a focus
// (timer) ring, on a dark rounded square — matching the app's monochrome
// identity. Used as the window icon and the electron-builder source icon.
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawIcon(size) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const P = (v) => (v * size) / 512; // design in a 512 space, scaled
  const cx = size / 2;
  const cy = size / 2;

  // Background: dark rounded square with a subtle gradient.
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, '#1b1b1b');
  bg.addColorStop(1, '#070707');
  roundRect(ctx, 0, 0, size, size, P(112));
  ctx.fillStyle = bg;
  ctx.fill();

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Focus/timer ring: faint full track + a bright ¾ arc with a tip dot.
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = P(13);
  ctx.beginPath();
  ctx.arc(cx, cy, P(196), 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = P(16);
  ctx.beginPath();
  ctx.arc(cx, cy, P(196), -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.5);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy - P(196), P(11), 0, Math.PI * 2);
  ctx.fill();

  // Coffee mug, nudged down so it sits centered within the ring.
  const yo = P(14);

  // Steam.
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = P(13);
  for (const sx of [-30, 30]) {
    ctx.beginPath();
    ctx.moveTo(cx + P(sx), cy - P(60) + yo);
    ctx.bezierCurveTo(
      cx + P(sx + 26), cy - P(90) + yo,
      cx + P(sx - 26), cy - P(120) + yo,
      cx + P(sx), cy - P(150) + yo
    );
    ctx.stroke();
  }

  // Saucer.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx, cy + P(120) + yo, P(140), P(26), 0, 0, Math.PI * 2);
  ctx.fill();

  // Handle.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = P(24);
  ctx.beginPath();
  ctx.arc(cx + P(78), cy + P(18) + yo, P(46), -Math.PI / 2.2, Math.PI / 2.2);
  ctx.stroke();

  // Cup body.
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, cx - P(80), cy - P(40) + yo, P(150), P(120), P(22));
  ctx.fill();

  // Coffee surface (negative space).
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.ellipse(cx - P(5), cy - P(38) + yo, P(66), P(15), 0, 0, Math.PI * 2);
  ctx.fill();

  return c;
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
