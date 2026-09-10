// Generates the Deepbrew app icon: a white coffee mug + steam inside a focus
// (timer) ring, on a dark rounded square — matching the app's monochrome
// identity. Emits crisp PNGs plus a multi-size .ico so small taskbar sizes
// stay sharp (each size is rendered natively, and tiny sizes drop the fine
// detail that would otherwise turn to mush).
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

/**
 * Draw the icon at `size`. Below ~48px the focus ring + fine steam don't
 * survive, so we draw a simpler, bolder mug that fills more of the tile.
 */
function drawIcon(size) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const P = (v) => (v * size) / 512; // design in a 512 space, scaled
  const cx = size / 2;
  const cy = size / 2;
  const detailed = size >= 64;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Background: dark rounded square with a subtle gradient.
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, '#1b1b1b');
  bg.addColorStop(1, '#070707');
  roundRect(ctx, 0, 0, size, size, P(detailed ? 112 : 96));
  ctx.fillStyle = bg;
  ctx.fill();

  // Simplified small icon: a single bold mug, no ring, maximum legibility.
  const scale = detailed ? 1 : 1.28;
  const yo = detailed ? P(14) : P(6);
  const M = (v) => P(v) * scale;

  if (detailed) {
    // Focus/timer ring: faint full track + bright ¾ arc with a tip dot.
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
  }

  // Steam.
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = M(detailed ? 13 : 18);
  for (const sx of [-30, 30]) {
    ctx.beginPath();
    ctx.moveTo(cx + M(sx), cy - M(60) + yo);
    ctx.bezierCurveTo(
      cx + M(sx + 26), cy - M(90) + yo,
      cx + M(sx - 26), cy - M(120) + yo,
      cx + M(sx), cy - M(150) + yo
    );
    ctx.stroke();
  }

  // Saucer.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx, cy + M(120) + yo, M(140), M(26), 0, 0, Math.PI * 2);
  ctx.fill();

  // Handle.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = M(24);
  ctx.beginPath();
  ctx.arc(cx + M(78), cy + M(18) + yo, M(46), -Math.PI / 2.2, Math.PI / 2.2);
  ctx.stroke();

  // Cup body.
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, cx - M(80), cy - M(40) + yo, M(150), M(120), M(22));
  ctx.fill();

  // Coffee surface (negative space).
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.ellipse(cx - M(5), cy - M(38) + yo, M(66), M(15), 0, 0, Math.PI * 2);
  ctx.fill();

  return c;
}

/** Pack PNG buffers into a multi-size .ico (PNG-compressed entries). */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + 16 * entries.length;
  const chunks = [header, dir];
  entries.forEach((e, i) => {
    const o = 16 * i;
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, o); // width (0 = 256)
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, o + 1); // height
    dir.writeUInt8(0, o + 2); // palette
    dir.writeUInt8(0, o + 3); // reserved
    dir.writeUInt16LE(1, o + 4); // planes
    dir.writeUInt16LE(32, o + 6); // bpp
    dir.writeUInt32LE(e.buf.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += e.buf.length;
    chunks.push(e.buf);
  });
  return Buffer.concat(chunks);
}

mkdirSync(join(root, 'build'), { recursive: true });
mkdirSync(join(root, 'resources'), { recursive: true });

// PNGs for the app / window / Linux.
for (const size of [512, 256]) {
  const buf = drawIcon(size).toBuffer('image/png');
  if (size === 512) {
    writeFileSync(join(root, 'build', 'icon.png'), buf);
    writeFileSync(join(root, 'resources', 'icon.png'), buf);
  }
  writeFileSync(join(root, 'resources', `icon-${size}.png`), buf);
}

// Multi-size Windows .ico (native render per size → crisp small icons).
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const ico = buildIco(icoSizes.map((size) => ({ size, buf: drawIcon(size).toBuffer('image/png') })));
writeFileSync(join(root, 'build', 'icon.ico'), ico);

console.log('Generated app icons (PNG + multi-size ICO) in build/ and resources/.');
