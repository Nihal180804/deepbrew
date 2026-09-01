/**
 * Hand-authored, detailed cozy character illustrations — one per timer state,
 * in a loose black-and-white doodle style: expressive faces, filled hairstyles,
 * clothing with fold lines, and small props. Monochrome — `currentColor` ink,
 * bodies filled with the surface colour (var(--bg-elev)) for volume; hair and
 * accents filled solid ink for contrast.
 *
 *   ready    → cross-legged, cradling a mug (idle / ready)
 *   focus    → at a desk with a laptop, glasses on, in the zone
 *   break    → seated side-stretch, content (short break)
 *   long     → reclining against a cushion, dozing (long break)
 *   complete → arms up, delighted (session done)
 */

import type { Phase, Status } from '@shared/timer/types.js';

export type IllustrationKind = 'ready' | 'focus' | 'break' | 'long' | 'complete';

export function illustrationFor(
  status: Status,
  phase: Phase,
  isLongBreak = false
): IllustrationKind {
  if (status === 'idle') return 'ready';
  if (phase === 'break') return isLongBreak ? 'long' : 'break';
  return 'focus';
}

interface Props {
  kind: IllustrationKind;
  size?: number;
  className?: string;
}

const INK = 'currentColor';
const FILL = 'var(--bg-elev, #ffffff)';

/* ------------------------------------------------------------------ *
 * Drop-in custom art. Any file placed in assets/illustrations/ named
 * <state>.svg|png|jpg|webp overrides the built-in drawing for that state.
 * SVGs are recoloured to the theme ink (currentColor); rasters are shown
 * grayscale and inverted in dark mode. See that folder's README.
 * ------------------------------------------------------------------ */

const svgRaw = import.meta.glob(
  '../assets/illustrations/{ready,focus,break,long,complete}.svg',
  { eager: true, query: '?raw', import: 'default' }
) as Record<string, string>;

const rasterUrl = import.meta.glob(
  '../assets/illustrations/{ready,focus,break,long,complete}.{png,jpg,jpeg,webp}',
  { eager: true, query: '?url', import: 'default' }
) as Record<string, string>;

const ALIASES: Record<string, IllustrationKind> = {
  idle: 'ready',
  start: 'ready',
  work: 'focus',
  working: 'focus',
  shortbreak: 'break',
  rest: 'break',
  longbreak: 'long',
  sleep: 'long',
  done: 'complete',
  celebrate: 'complete'
};

function baseName(path: string): string {
  return path.split('/').pop()!.replace(/\.[^.]+$/, '').toLowerCase();
}

function buildMap<T>(entries: Record<string, T>): Partial<Record<IllustrationKind, T>> {
  const out: Partial<Record<IllustrationKind, T>> = {};
  for (const [path, val] of Object.entries(entries)) {
    const name = baseName(path);
    if (name.startsWith('_')) continue; // ignore _source.png and helpers
    const kind = (['ready', 'focus', 'break', 'long', 'complete'] as IllustrationKind[]).includes(
      name as IllustrationKind
    )
      ? (name as IllustrationKind)
      : ALIASES[name];
    if (kind) out[kind] = val;
  }
  return out;
}

const customSvg = buildMap(svgRaw);
const customRaster = buildMap(rasterUrl);

/** Force every solid colour in an SVG to currentColor so it follows the theme. */
function normalizeSvg(raw: string): string {
  let s = raw
    .replace(
      /(fill|stroke)="(?!none|transparent|currentColor)(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|[a-zA-Z]+)"/g,
      '$1="currentColor"'
    )
    .replace(
      /(fill|stroke):\s*(?!none|transparent|currentColor)(#[0-9a-fA-F]{3,8}|rgba?\([^);]*\)|[a-zA-Z]+)/g,
      '$1:currentColor'
    );
  s = s.replace(/<svg([^>]*)>/, (_m, attrs: string) => {
    let a = attrs.replace(/\s(width|height)="[^"]*"/g, '');
    if (!/preserveAspectRatio/.test(a)) a += ' preserveAspectRatio="xMidYMid meet"';
    return `<svg${a} width="100%" height="100%" style="display:block">`;
  });
  return s;
}

export function Illustration({ kind, size = 160, className }: Props) {
  const svg = customSvg[kind];
  if (svg) {
    return (
      <span
        className={`illo-inline ${className ?? ''}`}
        style={{ width: size, height: size }}
        role="img"
        aria-label={`${kind} illustration`}
        dangerouslySetInnerHTML={{ __html: normalizeSvg(svg) }}
      />
    );
  }
  const url = customRaster[kind];
  if (url) {
    return (
      <img
        className={`illo-img ${className ?? ''}`}
        src={url}
        width={size}
        height={size}
        alt={`${kind} illustration`}
      />
    );
  }
  return <DrawnIllustration kind={kind} size={size} className={className} />;
}

function DrawnIllustration({ kind, size = 160, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      className={className}
      role="img"
      aria-label={`${kind} illustration`}
      fill="none"
      stroke={INK}
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === 'ready' && <Ready />}
      {kind === 'focus' && <Focus />}
      {kind === 'break' && <Break />}
      {kind === 'long' && <Long />}
      {kind === 'complete' && <Complete />}
    </svg>
  );
}

function Shadow({ cx = 120, cy = 214, rx = 66, ry = 9 }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={INK} stroke="none" opacity={0.12} />;
}

type Hair = 'wavy' | 'bun' | 'tousled' | 'soft';
type Expr = 'smile' | 'focused' | 'content' | 'sleepy' | 'delighted';

/**
 * A head drawn in LOCAL coords centred at (0,0), head radius ~22. Place it with
 * a <g transform="translate(x,y) rotate(deg)"> so face + hair + features stay
 * aligned when the head tilts. Draw order: back hair → face → front hair →
 * features, so the fringe overlaps the forehead and the face covers back hair.
 */
function Head({ hair, expr, glasses = false }: { hair: Hair; expr: Expr; glasses?: boolean }) {
  return (
    <g>
      <HairBack hair={hair} />
      {/* ears */}
      <path d="M-21 2 c-5 0 -6 8 -1 9 M21 2 c5 0 6 8 1 9" fill={FILL} />
      {/* face */}
      <path
        d="M-20 -5 C-20 -24 20 -24 20 -5 C21 13 12 25 0 27 C-12 25 -21 13 -20 -5 Z"
        fill={FILL}
      />
      <HairFront hair={hair} />
      <Features expr={expr} glasses={glasses} />
    </g>
  );
}

function HairBack({ hair }: { hair: Hair }) {
  if (hair === 'wavy') {
    return (
      <path
        d="M-24 -4 C-32 -30 -12 -42 0 -42 C12 -42 32 -30 24 -4 C29 12 27 30 32 44
           L22 44 C25 22 22 4 18 -8 C18 -12 16 -16 12 -18 C18 -6 18 6 16 20 L-16 20
           C-18 6 -18 -6 -12 -18 C-16 -16 -18 -12 -18 -8 C-22 4 -25 22 -22 44
           L-32 44 C-27 30 -29 12 -24 -4 Z"
        fill={INK}
        stroke="none"
      />
    );
  }
  if (hair === 'soft') {
    return (
      <path
        d="M-23 0 C-30 -28 -12 -40 0 -40 C12 -40 30 -28 23 0 C25 12 22 22 24 30
           L14 26 C18 8 16 -8 10 -16 C10 -12 12 -6 12 4 L-12 4 C-12 -6 -10 -12 -10 -16
           C-16 -8 -18 8 -14 26 L-24 30 C-22 22 -25 12 -23 0 Z"
        fill={INK}
        stroke="none"
      />
    );
  }
  // 'bun' and 'tousled' share a compact back cap
  return (
    <path
      d="M-22 2 C-28 -26 -10 -38 0 -38 C10 -38 28 -26 22 2 C18 -14 14 -18 12 -18
         C12 -22 -12 -22 -12 -18 C-14 -18 -18 -14 -22 2 Z"
      fill={INK}
      stroke="none"
    />
  );
}

function HairFront({ hair }: { hair: Hair }) {
  switch (hair) {
    case 'wavy':
      return (
        <path
          d="M-19 -6 C-20 -26 20 -26 19 -6 C12 -20 8 -14 0 -14 C-8 -14 -12 -20 -19 -6 Z"
          fill={INK}
          stroke="none"
        />
      );
    case 'bun':
      return (
        <>
          <circle cx={0} cy={-30} r={9} fill={INK} stroke="none" />
          <path d="M-19 -8 C-18 -24 18 -24 19 -8 C10 -18 -10 -18 -19 -8 Z" fill={INK} stroke="none" />
        </>
      );
    case 'tousled':
      return (
        <path
          d="M-20 -8 C-22 -22 -12 -28 -6 -26 C-8 -32 4 -34 8 -28 C16 -32 24 -22 20 -8
             C14 -18 10 -22 4 -20 C0 -24 -6 -22 -8 -18 C-12 -22 -16 -18 -20 -8 Z"
          fill={INK}
          stroke="none"
        />
      );
    case 'soft':
    default:
      return (
        <path d="M-19 -8 C-16 -22 16 -22 19 -8 C10 -16 4 -14 0 -14 C-6 -14 -12 -16 -19 -8 Z" fill={INK} stroke="none" />
      );
  }
}

function Features({ expr, glasses }: { expr: Expr; glasses: boolean }) {
  const eyeY = 0;
  return (
    <g stroke={INK} strokeWidth={2.4} fill="none">
      {/* brows */}
      {expr === 'focused' ? (
        <path d="M-13 -8 l8 3 M13 -8 l-8 3" />
      ) : (
        <path d="M-13 -9 q4 -3 8 -1 M5 -10 q4 -2 8 1" opacity={0.9} />
      )}

      {/* eyes */}
      {expr === 'content' || expr === 'sleepy' ? (
        <path d="M-13 0 q4 4 8 0 M5 0 q4 4 8 0" />
      ) : expr === 'delighted' ? (
        <>
          <path d="M-13 0 q4 4 8 0" />
          <circle cx={9} cy={0} r={2.6} fill={INK} stroke="none" />
        </>
      ) : (
        <>
          <circle cx={-9} cy={eyeY} r={2.6} fill={INK} stroke="none" />
          <circle cx={9} cy={eyeY} r={2.6} fill={INK} stroke="none" />
        </>
      )}

      {glasses && (
        <g strokeWidth={2.2}>
          <circle cx={-9} cy={0} r={7} />
          <circle cx={9} cy={0} r={7} />
          <path d="M-2 0 h4 M-16 -2 l-4 -2 M16 -2 l4 -2" />
        </g>
      )}

      {/* nose */}
      <path d="M1 4 q3 4 -2 6" strokeWidth={2.2} />

      {/* mouth */}
      {expr === 'delighted' ? (
        <path d="M-7 14 q7 8 14 0" strokeWidth={2.6} />
      ) : expr === 'focused' ? (
        <path d="M-5 15 h10" strokeWidth={2.4} />
      ) : expr === 'sleepy' ? (
        <path d="M-4 15 q4 2 8 0" strokeWidth={2.4} />
      ) : (
        <path d="M-6 14 q6 6 12 0" strokeWidth={2.4} />
      )}
    </g>
  );
}

/* Mug helper (upright), origin at top-left of cup body. */
function Mug({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0 h26 v13 a6 6 0 0 1 -6 6 h-14 a6 6 0 0 1 -6 -6 z" fill={FILL} />
      <path d="M26 3 a7 7 0 0 1 0 12" />
      <path d="M7 -4 c3 -5 -3 -8 0 -13 M17 -4 c3 -5 -3 -8 0 -13" strokeWidth={2.6} opacity={0.7} />
    </g>
  );
}

/* ---- ready: cross-legged, cradling a mug ---- */
function Ready() {
  return (
    <g>
      <Shadow cx={120} cy={212} rx={70} ry={9} />
      <path d="M72 206 C64 176 92 164 120 172 C148 164 176 176 168 206 C140 214 100 214 72 206 Z" fill={FILL} />
      <path d="M120 172 C104 188 96 196 92 205" />
      <path d="M120 172 C136 188 144 196 148 205" />
      <path d="M104 200 c-8 2 -14 1 -18 -2" />
      <path d="M136 200 c8 2 14 1 18 -2" />
      {/* torso / sweater with folds */}
      <path
        d="M96 120 C89 146 91 163 104 175 C120 181 136 181 152 175 C165 163 167 146 160 120 C140 108 116 108 96 120 Z"
        fill={FILL}
      />
      <path d="M108 118 q12 12 24 0" strokeWidth={2.6} />
      <path d="M104 150 q16 8 32 0" strokeWidth={2.2} opacity={0.55} />
      {/* arms cradling mug */}
      <path d="M100 126 C82 142 84 160 104 164" fill={FILL} />
      <path d="M156 126 C174 142 172 160 152 164" fill={FILL} />
      <Mug x={107} y={150} />
      {/* neck */}
      <path d="M112 108 h16 v-6 h-16 z" fill={FILL} stroke="none" />
      <g transform="translate(120 82)">
        <Head hair="wavy" expr="smile" />
      </g>
    </g>
  );
}

/* ---- focus: at a desk with a laptop, glasses ---- */
function Focus() {
  return (
    <g>
      <Shadow cx={126} cy={214} rx={80} ry={9} />
      <path d="M74 212 l6 -34 M112 212 l-4 -34" />
      <path d="M72 178 h44" />
      <path d="M92 176 C92 160 96 150 104 146" fill={FILL} />
      <path d="M104 176 h40" />
      <path d="M108 176 l2 -18 M140 176 l-2 -18" />
      {/* torso leaning forward */}
      <path
        d="M96 152 C92 130 100 114 116 108 C132 106 146 114 150 130 C150 142 146 152 140 158 C124 164 108 162 96 152 Z"
        fill={FILL}
      />
      <path d="M110 118 q10 8 20 2" strokeWidth={2.6} />
      <path d="M104 140 q14 8 30 2" strokeWidth={2.2} opacity={0.5} />
      {/* arm to laptop */}
      <path d="M138 130 C156 134 168 144 176 156" fill={FILL} />
      {/* neck */}
      <path d="M120 106 l10 3 l3 -6 l-10 -3 z" fill={FILL} stroke="none" />
      <g transform="translate(126 84) rotate(8)">
        <Head hair="tousled" expr="focused" glasses />
      </g>
      {/* desk + laptop + mug */}
      <path d="M150 178 h58" />
      <path d="M168 178 l6 -26 h28 l6 26" fill={FILL} />
      <path d="M174 152 h28" strokeWidth={2.6} opacity={0.6} />
      <Mug x={150} y={150} />
    </g>
  );
}

/* ---- break: seated side-stretch, content ---- */
function Break() {
  return (
    <g>
      <Shadow cx={120} cy={214} rx={64} ry={9} />
      <path d="M84 206 C78 186 96 176 120 180 C150 178 168 190 160 206 C130 214 106 214 84 206 Z" fill={FILL} />
      <path d="M120 180 C110 192 100 198 92 204" />
      {/* torso leaning */}
      <path
        d="M104 122 C92 142 92 160 104 176 C120 182 134 180 146 172 C150 156 148 138 138 122 C126 112 114 112 104 122 Z"
        fill={FILL}
      />
      <path d="M110 120 q12 10 22 2" strokeWidth={2.6} />
      <path d="M104 150 q18 8 34 -2" strokeWidth={2.2} opacity={0.5} />
      {/* arm up (tube) + resting arm */}
      <path d="M111 118 C103 98 99 80 106 62" strokeWidth={9} />
      <path d="M140 126 C154 134 160 148 158 162" fill={FILL} />
      <circle cx={106} cy={60} r={7} fill={FILL} />
      {/* neck */}
      <path d="M118 106 l12 2 l1 -6 l-12 -2 z" fill={FILL} stroke="none" />
      <g transform="translate(124 92) rotate(-10)">
        <Head hair="bun" expr="content" />
      </g>
      {/* plant */}
      <path d="M188 206 v-14 h16 v14 z" fill={FILL} />
      <path d="M196 192 c-8 -6 -8 -16 -2 -22 M196 192 c8 -6 8 -14 3 -20" strokeWidth={3} />
    </g>
  );
}

/* ---- long: reclining against a cushion, dozing ---- */
function Long() {
  return (
    <g>
      <Shadow cx={128} cy={210} rx={86} ry={9} />
      <path d="M40 208 C34 180 56 168 84 176 L96 196 C86 206 64 212 40 208 Z" fill={FILL} />
      <path d="M110 196 C140 182 176 186 202 200" fill={FILL} />
      <path d="M120 202 C150 192 178 196 202 206" />
      <path d="M168 196 C170 178 160 168 148 172" />
      {/* torso reclined */}
      <path d="M78 176 C74 156 86 142 108 142 C128 146 138 160 134 180 C120 192 96 190 78 176 Z" fill={FILL} />
      <path d="M96 150 q18 6 30 -2" strokeWidth={2.2} opacity={0.5} />
      {/* arm holding mug */}
      <path d="M120 152 C132 142 142 140 150 144" fill={FILL} />
      <g transform="translate(150 128)"><Mug x={0} y={0} /></g>
      {/* head resting back */}
      <g transform="translate(92 138) rotate(-24)">
        <Head hair="soft" expr="sleepy" />
      </g>
      {/* zzz */}
      <path d="M150 96 h14 l-14 16 h14" strokeWidth={3} opacity={0.6} fill="none" />
      <path d="M172 78 h10 l-10 12 h10" strokeWidth={2.6} opacity={0.5} fill="none" />
    </g>
  );
}

/* ---- complete: arms up, delighted ---- */
function Complete() {
  return (
    <g>
      <Shadow cx={120} cy={214} rx={60} ry={9} />
      <path d="M104 150 C100 172 100 192 106 210" fill={FILL} />
      <path d="M136 150 C140 172 140 192 134 210" fill={FILL} />
      <path d="M100 210 h16 M124 210 h16" />
      {/* torso */}
      <path d="M100 118 C94 136 96 152 106 160 C120 166 134 164 146 156 C152 144 150 130 142 116 C128 108 112 108 100 118 Z" fill={FILL} />
      <path d="M110 116 q12 10 22 2" strokeWidth={2.6} />
      {/* arms up */}
      <path d="M104 120 C90 102 82 82 82 64" strokeWidth={9} />
      <path d="M140 118 C154 100 162 80 162 62" strokeWidth={9} />
      <circle cx={82} cy={60} r={7} fill={FILL} />
      <circle cx={162} cy={58} r={7} fill={FILL} />
      {/* neck */}
      <path d="M112 108 h18 v-6 h-18 z" fill={FILL} stroke="none" />
      <g transform="translate(121 82)">
        <Head hair="wavy" expr="delighted" />
      </g>
      {/* sparkles */}
      <path d="M60 70 v-12 M54 64 h12" strokeWidth={3} opacity={0.65} />
      <path d="M184 92 v-10 M179 87 h10" strokeWidth={3} opacity={0.6} />
    </g>
  );
}
