// Traces the cropped raster illustrations into clean, resolution-independent
// SVGs (no JPG grain, crisp at any size, recolours to the theme via the loader).
//
// Prereq (pure-JS, no native build):  npm i potrace --no-save --ignore-scripts
// Run:                                node scripts/vectorize-illustrations.mjs
//
// Reads each <state>.png in assets/illustrations/, writes <state>.svg beside it.
// The loader prefers SVG over PNG, so the vectors take over automatically.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import potrace from 'potrace';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'renderer', 'assets', 'illustrations');
const STATES = ['ready', 'focus', 'break', 'long', 'complete'];
const SUPERSAMPLE = 4; // enlarge before tracing → smoother vector curves

function traceBuffer(buf) {
  return new Promise((res, rej) => {
    potrace.trace(
      buf,
      {
        turdSize: 6, // drop speckles ≤ this many px² → removes JPG grain
        threshold: 172, // pixels darker than this are "ink"
        optTolerance: 0.35, // curve fitting; lower = truer to source
        color: '#111111',
        background: 'transparent'
      },
      (err, svg) => (err ? rej(err) : res(svg))
    );
  });
}

async function main() {
  let done = 0;
  for (const state of STATES) {
    const png = join(dir, `${state}.png`);
    if (!existsSync(png)) {
      console.warn(`(skip) ${state}.png not found`);
      continue;
    }
    const img = await loadImage(readFileSync(png));
    const W = img.width * SUPERSAMPLE;
    const H = img.height * SUPERSAMPLE;
    const c = createCanvas(W, H);
    const ctx = c.getContext('2d');
    // Flatten onto white so tracing sees black-ink-on-white; interiors stay white.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, W, H);

    const svg = await traceBuffer(c.toBuffer('image/png'));
    writeFileSync(join(dir, `${state}.svg`), svg, 'utf8');
    // Remove the raster so the crisp SVG is unambiguously used.
    rmSync(png);
    console.log(`  ${state}.svg  ✓`);
    done++;
  }
  console.log(`Vectorised ${done} illustration(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
