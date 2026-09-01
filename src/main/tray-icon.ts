import { nativeImage, type NativeImage } from 'electron';
import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';
import type { Status, Phase } from '@shared/timer/types.js';

/**
 * Renders the tray icon entirely in the main process (no offscreen window),
 * in STRICT MONOCHROME. State is never encoded with colour — it's shown with
 * shape, fill, stroke weight, and fill percentage:
 *
 *   idle    → outlined coffee cup, no ring
 *   running → solid progress ring (fills clockwise) + remaining time
 *   break   → dashed progress ring + remaining time
 *   paused  → dim full ring + pause bars (no number)
 *
 * The whole icon is drawn in near-white with a soft dark halo so the same
 * grayscale glyph stays legible on both light and dark taskbars.
 */

const SIZE = 32; // logical px; Windows/Linux downscale to 16 crisply enough
const FG = '#f5f5f5';
const FG_DIM = '#9a9a9a';
const TRACK = 'rgba(245,245,245,0.28)';

function readout(remainingMs: number): string {
  const secs = Math.max(0, Math.ceil(remainingMs / 1000));
  if (secs >= 60) return String(Math.ceil(secs / 60)); // minutes remaining
  return String(secs); // final minute: seconds
}

/** Wraps drawing in a soft dark halo so light glyphs read on any background. */
function withHalo(ctx: SKRSContext2D, draw: () => void): void {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 2.2;
  draw();
  ctx.restore();
}

function drawCup(ctx: SKRSContext2D, cx: number, cy: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const bodyW = 11;
  const bodyH = 9;
  const left = cx - bodyW / 2;
  const top = cy - bodyH / 2 + 1;

  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left + bodyW, top);
  ctx.lineTo(left + bodyW, top + bodyH - 3);
  ctx.quadraticCurveTo(left + bodyW, top + bodyH, left + bodyW - 3, top + bodyH);
  ctx.lineTo(left + 3, top + bodyH);
  ctx.quadraticCurveTo(left, top + bodyH, left, top + bodyH - 3);
  ctx.closePath();
  ctx.stroke();

  // Handle.
  ctx.beginPath();
  ctx.arc(left + bodyW + 1, top + 3.5, 2.6, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  // Steam.
  ctx.beginPath();
  ctx.moveTo(cx - 2.5, top - 2.5);
  ctx.quadraticCurveTo(cx - 0.5, top - 5, cx - 2.5, top - 7);
  ctx.moveTo(cx + 2.5, top - 2.5);
  ctx.quadraticCurveTo(cx + 4.5, top - 5, cx + 2.5, top - 7);
  ctx.stroke();
}

function drawPauseBars(ctx: SKRSContext2D, cx: number, cy: number, color: string): void {
  ctx.fillStyle = color;
  const w = 3;
  const h = 11;
  ctx.fillRect(cx - 5, cy - h / 2, w, h);
  ctx.fillRect(cx + 2, cy - h / 2, w, h);
}

export interface TrayIconInput {
  status: Status;
  phase: Phase;
  remainingMs: number;
  progress: number; // 0..1
}

export function renderTrayIcon(input: TrayIconInput): NativeImage {
  const { status, phase, progress } = input;
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const radius = SIZE / 2 - 3;

  ctx.clearRect(0, 0, SIZE, SIZE);

  if (status === 'idle') {
    // No ring — just the outlined cup.
    withHalo(ctx, () => drawCup(ctx, cx, cy, FG));
    return nativeImage.createFromBuffer(canvas.toBuffer('image/png'));
  }

  const paused = status === 'paused';
  const ringColor = paused ? FG_DIM : FG;
  const lineWidth = paused ? 2 : 3;

  withHalo(ctx, () => {
    // Track ring.
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = TRACK;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([]);
    ctx.stroke();

    // Progress ring (skip when paused — the pause bars carry the state).
    if (!paused && progress > 0) {
      const start = -Math.PI / 2;
      const end = start + Math.PI * 2 * Math.min(1, progress);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, start, end);
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      // Break rings are dashed; focus rings are solid.
      ctx.setLineDash(phase === 'break' ? [3.2, 2.6] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });

  // Center content.
  if (paused) {
    withHalo(ctx, () => drawPauseBars(ctx, cx, cy, FG_DIM));
  } else {
    const label = readout(input.remainingMs);
    withHalo(ctx, () => {
      ctx.fillStyle = FG;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${label.length >= 2 ? 15 : 18}px sans-serif`;
      ctx.fillText(label, cx, cy + 1);
    });
  }

  return nativeImage.createFromBuffer(canvas.toBuffer('image/png'));
}
