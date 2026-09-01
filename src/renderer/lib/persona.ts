import type { PersonaCardData } from '@shared/types.js';
import { formatDuration } from '@shared/timer/format.js';

/**
 * Draws the shareable "focus persona" card — strict black & white. Renders at
 * 2x for crispness onto the given canvas; the caller exports via toDataURL for
 * copy-to-clipboard / save-as-PNG.
 *
 * Content mirrors the real Deepbrew feature: focused hours, top apps (from
 * active-app tracking), and a "work style" label derived from session patterns,
 * finished with the "Share it — or keep it for yourself." tagline.
 */

const W = 640;
const H = 520;
const PAD = 40;

const INK = '#f5f5f5';
const GRAY = '#9a9a9a';
const FAINT = '#6a6a6a';
const BG = '#0d0d0d';
const TRACK = 'rgba(245,245,245,0.12)';
const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

export function drawPersonaCard(canvas: HTMLCanvasElement, data: PersonaCardData): void {
  const scale = 2;
  canvas.width = W * scale;
  canvas.height = H * scale;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.textBaseline = 'alphabetic';

  // Background + border.
  ctx.fillStyle = BG;
  roundRect(ctx, 0, 0, W, H, 26);
  ctx.fill();
  ctx.strokeStyle = 'rgba(245,245,245,0.10)';
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, W - 1, H - 1, 26);
  ctx.stroke();

  // Top rule.
  ctx.fillStyle = INK;
  roundRect(ctx, PAD, 0, W - PAD * 2, 4, 0);
  ctx.fill();

  // Header row. A vector cup (not the ☕ emoji) keeps the card self-contained
  // on systems without an emoji font.
  drawMiniCup(ctx, PAD + 8, 44, INK);
  ctx.fillStyle = INK;
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText('DEEPBREW', PAD + 24, 54);
  ctx.fillStyle = GRAY;
  ctx.font = `600 13px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(data.rangeLabel.toUpperCase() + ' · FOCUS PERSONA', W - PAD, 54);
  ctx.textAlign = 'left';

  // Hero: work style.
  ctx.fillStyle = GRAY;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('YOUR WORK STYLE', PAD, 96);
  ctx.fillStyle = INK;
  ctx.font = `800 46px ${FONT}`;
  ctx.fillText(data.workStyle, PAD, 140);
  ctx.fillStyle = GRAY;
  ctx.font = `400 16px ${FONT}`;
  ctx.fillText(data.workStyleBlurb, PAD, 168);

  hRule(ctx, PAD, 194, W - PAD);

  // Stats band: big focus hours (left) + sessions/streak (right).
  ctx.fillStyle = INK;
  ctx.font = `800 66px ${FONT}`;
  const hoursText = data.focusHours.toFixed(1);
  ctx.fillText(hoursText, PAD, 268);
  const hoursW = ctx.measureText(hoursText).width;
  ctx.fillStyle = GRAY;
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText('h', PAD + hoursW + 6, 268);
  ctx.fillStyle = GRAY;
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText('HOURS FOCUSED', PAD, 292);

  // Right-aligned mini stats.
  miniStat(ctx, W - PAD, 236, String(data.sessionsCompleted), 'SESSIONS');
  miniStat(ctx, W - PAD, 292, `${data.currentStreakDays}`, 'DAY STREAK');

  hRule(ctx, PAD, 316, W - PAD);

  // Top apps.
  ctx.fillStyle = GRAY;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('TOP APPS', PAD, 344);

  if (data.topApps.length === 0) {
    ctx.fillStyle = FAINT;
    ctx.font = `400 14px ${FONT}`;
    ctx.fillText('Enable active-app tracking to see your top apps.', PAD, 372);
  } else {
    const maxFocus = Math.max(...data.topApps.map((a) => a.focusMs), 1);
    const barX = 210;
    const barW = W - PAD - barX - 74;
    let y = 366;
    for (const app of data.topApps) {
      ctx.fillStyle = INK;
      ctx.font = `600 15px ${FONT}`;
      ctx.fillText(truncate(ctx, app.appName, 150), PAD, y + 4);

      // Bar.
      ctx.fillStyle = TRACK;
      roundRect(ctx, barX, y - 9, barW, 10, 5);
      ctx.fill();
      ctx.fillStyle = INK;
      const w = Math.max(6, (app.focusMs / maxFocus) * barW);
      roundRect(ctx, barX, y - 9, w, 10, 5);
      ctx.fill();

      ctx.fillStyle = GRAY;
      ctx.font = `600 13px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(formatDuration(app.focusMs), W - PAD, y + 3);
      ctx.textAlign = 'left';
      y += 34;
    }
  }

  // Peak label.
  if (data.peakLabel) {
    ctx.fillStyle = FAINT;
    ctx.font = `400 13px ${FONT}`;
    ctx.fillText(data.peakLabel, PAD, 470);
  }

  hRule(ctx, PAD, 486, W - PAD);

  // Tagline.
  ctx.fillStyle = INK;
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText('Share it — or keep it for yourself.', PAD, 508);
  ctx.fillStyle = FAINT;
  ctx.font = `600 13px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('deepbrew', W - PAD, 508);
  ctx.textAlign = 'left';
}

/** Small vector coffee cup for the header (emoji-free). */
function drawMiniCup(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
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
  ctx.beginPath();
  ctx.arc(left + bodyW + 1, top + 3.5, 2.4, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 2.5, top - 2);
  ctx.quadraticCurveTo(cx - 0.5, top - 4.5, cx - 2.5, top - 6.5);
  ctx.moveTo(cx + 2.5, top - 2);
  ctx.quadraticCurveTo(cx + 4.5, top - 4.5, cx + 2.5, top - 6.5);
  ctx.stroke();
  ctx.restore();
}

function miniStat(
  ctx: CanvasRenderingContext2D,
  right: number,
  baseline: number,
  value: string,
  label: string
): void {
  ctx.textAlign = 'right';
  ctx.fillStyle = INK;
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText(value, right, baseline);
  ctx.fillStyle = GRAY;
  ctx.font = `600 11px ${FONT}`;
  ctx.fillText(label, right, baseline + 16);
  ctx.textAlign = 'left';
}

function hRule(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number): void {
  ctx.strokeStyle = 'rgba(245,245,245,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
}

function truncate(ctx: CanvasRenderingContext2D, s: string, maxW: number): string {
  if (ctx.measureText(s).width <= maxW) return s;
  let out = s;
  while (out.length > 1 && ctx.measureText(out + '…').width > maxW) out = out.slice(0, -1);
  return out + '…';
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
