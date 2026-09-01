// Dev-only: renders the bespoke canvas visuals (monochrome tray states + the
// focus persona card) to PNGs for eyeballing without launching the GUI. Mirrors
// src/main/tray-icon.ts and src/renderer/lib/persona.ts.
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../.preview/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const FG = '#f5f5f5', FG_DIM = '#9a9a9a', TRACK = 'rgba(245,245,245,0.28)';

function withHalo(ctx, draw) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 2.2; draw(); ctx.restore();
}
function drawCup(ctx, cx, cy, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const bodyW = 11, bodyH = 9, left = cx - bodyW / 2, top = cy - bodyH / 2 + 1;
  ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left + bodyW, top);
  ctx.lineTo(left + bodyW, top + bodyH - 3);
  ctx.quadraticCurveTo(left + bodyW, top + bodyH, left + bodyW - 3, top + bodyH);
  ctx.lineTo(left + 3, top + bodyH);
  ctx.quadraticCurveTo(left, top + bodyH, left, top + bodyH - 3); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.arc(left + bodyW + 1, top + 3.5, 2.6, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 2.5, top - 2.5); ctx.quadraticCurveTo(cx - 0.5, top - 5, cx - 2.5, top - 7);
  ctx.moveTo(cx + 2.5, top - 2.5); ctx.quadraticCurveTo(cx + 4.5, top - 5, cx + 2.5, top - 7); ctx.stroke();
}
function drawPauseBars(ctx, cx, cy, color) {
  ctx.fillStyle = color; ctx.fillRect(cx - 5, cy - 5.5, 3, 11); ctx.fillRect(cx + 2, cy - 5.5, 3, 11);
}
// Draws one tray state onto ctx centered at (ox,oy) in a SIZE box.
function drawTray(ctx, ox, oy, { status, phase, remainingMs, progress }) {
  const SIZE = 32, cx = ox + SIZE / 2, cy = oy + SIZE / 2, radius = SIZE / 2 - 3;
  if (status === 'idle') { withHalo(ctx, () => drawCup(ctx, cx, cy, FG)); return; }
  const paused = status === 'paused';
  const ringColor = paused ? FG_DIM : FG, lw = paused ? 2 : 3;
  withHalo(ctx, () => {
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = TRACK; ctx.lineWidth = lw; ctx.setLineDash([]); ctx.stroke();
    if (!paused && progress > 0) {
      const start = -Math.PI / 2, end = start + Math.PI * 2 * Math.min(1, progress);
      ctx.beginPath(); ctx.arc(cx, cy, radius, start, end);
      ctx.strokeStyle = ringColor; ctx.lineWidth = lw; ctx.lineCap = 'round';
      ctx.setLineDash(phase === 'break' ? [3.2, 2.6] : []); ctx.stroke(); ctx.setLineDash([]);
    }
  });
  if (paused) { withHalo(ctx, () => drawPauseBars(ctx, cx, cy, FG_DIM)); return; }
  const secs = Math.max(0, Math.ceil(remainingMs / 1000));
  const label = secs >= 60 ? String(Math.ceil(secs / 60)) : String(secs);
  withHalo(ctx, () => {
    ctx.fillStyle = FG; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${label.length >= 2 ? 15 : 18}px sans-serif`;
    ctx.fillText(label, cx, cy + 1);
  });
}

// Tray contact sheet: 4 states x 2 backgrounds (light taskbar / dark taskbar).
{
  const states = [
    { name: 'idle', status: 'idle', phase: 'work', remainingMs: 25 * 60000, progress: 0 },
    { name: 'running', status: 'running', phase: 'work', remainingMs: 18 * 60000, progress: 0.28 },
    { name: 'break', status: 'running', phase: 'break', remainingMs: 3 * 60000, progress: 0.4 },
    { name: 'paused', status: 'paused', phase: 'work', remainingMs: 12 * 60000, progress: 0.52 }
  ];
  const cell = 32, scale = 4, pad = 18, cols = states.length;
  const cw = cell * scale, gap = 20;
  const width = pad * 2 + cols * cw + (cols - 1) * gap;
  const rowH = cw + 34;
  const c = createCanvas(width, pad * 2 + rowH * 2 + 10);
  const ctx = c.getContext('2d');
  const backgrounds = [{ bg: '#e9e9e9', label: 'light taskbar' }, { bg: '#1c1c1c', label: 'dark taskbar' }];
  backgrounds.forEach((row, ri) => {
    const y0 = pad + ri * rowH;
    ctx.fillStyle = row.bg; ctx.fillRect(0, y0 - 8, width, rowH);
    states.forEach((s, i) => {
      const x0 = pad + i * (cw + gap);
      ctx.save(); ctx.translate(x0, y0); ctx.scale(scale, scale);
      drawTray(ctx, 0, 0, s); ctx.restore();
      ctx.fillStyle = ri === 0 ? '#333' : '#ddd'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(s.name, x0 + cw / 2, y0 + cw + 18);
    });
  });
  writeFileSync(new URL('tray-sheet.png', OUT), c.toBuffer('image/png'));
}

// ---- persona card (mirror of src/renderer/lib/persona.ts) ----
const W = 640, H = 520, PAD = 40;
const INK = '#f5f5f5', GRAY = '#9a9a9a', FAINT = '#6a6a6a', BG = '#0d0d0d';
const CTRACK = 'rgba(245,245,245,0.12)';
const F = '"Segoe UI", system-ui, sans-serif';
function rr(ctx, x, y, w, h, r) {
  const q = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q); ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q); ctx.arcTo(x, y, x + w, y, q); ctx.closePath();
}
function hr(ctx, x1, y, x2) {
  ctx.strokeStyle = CTRACK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
}
function fmtDur(ms) {
  const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`; if (m > 0) return `${m}m`; return `${s}s`;
}
function persona(data) {
  const scale = 2, c = createCanvas(W * scale, H * scale), ctx = c.getContext('2d');
  ctx.scale(scale, scale); ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = BG; rr(ctx, 0, 0, W, H, 26); ctx.fill();
  ctx.strokeStyle = 'rgba(245,245,245,0.10)'; ctx.lineWidth = 1; rr(ctx, 0.5, 0.5, W - 1, H - 1, 26); ctx.stroke();
  ctx.fillStyle = INK; rr(ctx, PAD, 0, W - PAD * 2, 4, 0); ctx.fill();
  drawCup(ctx, PAD + 8, 44, INK);
  ctx.fillStyle = INK; ctx.font = `700 15px ${F}`; ctx.fillText('DEEPBREW', PAD + 24, 54);
  ctx.fillStyle = GRAY; ctx.font = `600 13px ${F}`; ctx.textAlign = 'right';
  ctx.fillText(data.rangeLabel.toUpperCase() + ' · FOCUS PERSONA', W - PAD, 54); ctx.textAlign = 'left';
  ctx.fillStyle = GRAY; ctx.font = `600 12px ${F}`; ctx.fillText('YOUR WORK STYLE', PAD, 96);
  ctx.fillStyle = INK; ctx.font = `800 46px ${F}`; ctx.fillText(data.workStyle, PAD, 140);
  ctx.fillStyle = GRAY; ctx.font = `400 16px ${F}`; ctx.fillText(data.workStyleBlurb, PAD, 168);
  hr(ctx, PAD, 194, W - PAD);
  ctx.fillStyle = INK; ctx.font = `800 66px ${F}`;
  const ht = data.focusHours.toFixed(1); ctx.fillText(ht, PAD, 268);
  const hw = ctx.measureText(ht).width;
  ctx.fillStyle = GRAY; ctx.font = `600 15px ${F}`; ctx.fillText('h', PAD + hw + 6, 268);
  ctx.font = `600 13px ${F}`; ctx.fillText('HOURS FOCUSED', PAD, 292);
  const mini = (right, base, val, lab) => {
    ctx.textAlign = 'right'; ctx.fillStyle = INK; ctx.font = `800 30px ${F}`; ctx.fillText(val, right, base);
    ctx.fillStyle = GRAY; ctx.font = `600 11px ${F}`; ctx.fillText(lab, right, base + 16); ctx.textAlign = 'left';
  };
  mini(W - PAD, 236, String(data.sessionsCompleted), 'SESSIONS');
  mini(W - PAD, 292, String(data.currentStreakDays), 'DAY STREAK');
  hr(ctx, PAD, 316, W - PAD);
  ctx.fillStyle = GRAY; ctx.font = `600 12px ${F}`; ctx.fillText('TOP APPS', PAD, 344);
  if (!data.topApps.length) {
    ctx.fillStyle = FAINT; ctx.font = `400 14px ${F}`;
    ctx.fillText('Enable active-app tracking to see your top apps.', PAD, 372);
  } else {
    const max = Math.max(...data.topApps.map((a) => a.focusMs), 1);
    const barX = 210, barW = W - PAD - barX - 74; let y = 366;
    for (const a of data.topApps) {
      ctx.fillStyle = INK; ctx.font = `600 15px ${F}`; ctx.fillText(a.appName, PAD, y + 4);
      ctx.fillStyle = CTRACK; rr(ctx, barX, y - 9, barW, 10, 5); ctx.fill();
      ctx.fillStyle = INK; rr(ctx, barX, y - 9, Math.max(6, (a.focusMs / max) * barW), 10, 5); ctx.fill();
      ctx.fillStyle = GRAY; ctx.font = `600 13px ${F}`; ctx.textAlign = 'right';
      ctx.fillText(fmtDur(a.focusMs), W - PAD, y + 3); ctx.textAlign = 'left'; y += 34;
    }
  }
  if (data.peakLabel) { ctx.fillStyle = FAINT; ctx.font = `400 13px ${F}`; ctx.fillText(data.peakLabel, PAD, 470); }
  hr(ctx, PAD, 486, W - PAD);
  ctx.fillStyle = INK; ctx.font = `600 15px ${F}`; ctx.fillText('Share it — or keep it for yourself.', PAD, 508);
  ctx.fillStyle = FAINT; ctx.font = `600 13px ${F}`; ctx.textAlign = 'right'; ctx.fillText('deepbrew', W - PAD, 508); ctx.textAlign = 'left';
  return c.toBuffer('image/png');
}
writeFileSync(new URL('persona-card.png', OUT), persona({
  rangeLabel: 'This week', focusHours: 14.2, sessionsCompleted: 23, currentStreakDays: 6,
  workStyle: 'Deep Diver', workStyleBlurb: 'Long, uninterrupted dives into the work that matters.',
  peakLabel: 'Peak focus around 10 AM',
  topApps: [
    { appName: 'VS Code', focusMs: 6.2 * 3600000, sessions: 12 },
    { appName: 'Figma', focusMs: 3.1 * 3600000, sessions: 6 },
    { appName: 'Chrome', focusMs: 1.4 * 3600000, sessions: 5 }
  ]
}));
writeFileSync(new URL('persona-card-empty.png', OUT), persona({
  rangeLabel: 'Today', focusHours: 2.5, sessionsCompleted: 5, currentStreakDays: 1,
  workStyle: 'Sprinter', workStyleBlurb: 'Short, sharp bursts of focus that add up fast.',
  peakLabel: 'Peak focus around 2 PM', topApps: []
}));

console.log('Wrote previews to .preview/');
