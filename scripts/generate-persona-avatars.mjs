// Vectorises the profession doodle tiles chosen to represent each work-style
// persona into clean SVGs (crisp at any size, recoloured to the theme by the
// renderer). One-off: reads assets/illustrations/_tiles/tile-NN.png, writes
// assets/personas/<slug>.svg. Prereq: potrace (already a dev dep here).
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import potrace from 'potrace';

const base = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'renderer', 'assets');
const tilesDir = join(base, 'illustrations', '_tiles');
const outDir = join(base, 'personas');
const SUPERSAMPLE = 4;

// persona slug -> doodle tile index (single-figure doodles from the sheet).
const MAP = {
  'fresh-cup': 14,
  'deep-diver': 12, // astronaut / diver
  'sprinter': 8, // courier
  'marathoner': 9, // worker in overalls
  'steady-brewer': 10, // barista
  'context-shifter': 7, // tailor
  'restless-starter': 0, // busy clerk
  'focused-mind': 2 // composed officer
};

function traceBuffer(buf) {
  return new Promise((res, rej) => {
    potrace.trace(
      buf,
      { turdSize: 6, threshold: 172, optTolerance: 0.35, color: '#111111', background: 'transparent' },
      (err, svg) => (err ? rej(err) : res(svg))
    );
  });
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  let done = 0;
  for (const [slug, n] of Object.entries(MAP)) {
    const png = join(tilesDir, `tile-${String(n).padStart(2, '0')}.png`);
    if (!existsSync(png)) {
      console.warn(`(skip) ${png} not found`);
      continue;
    }
    const img = await loadImage(readFileSync(png));
    const W = img.width * SUPERSAMPLE;
    const H = img.height * SUPERSAMPLE;
    const c = createCanvas(W, H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, W, H);
    const svg = await traceBuffer(c.toBuffer('image/png'));
    writeFileSync(join(outDir, `${slug}.svg`), svg, 'utf8');
    console.log(`  ${slug}.svg  (tile-${n})  ✓`);
    done++;
  }
  console.log(`Vectorised ${done} persona avatar(s) into ${outDir}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
