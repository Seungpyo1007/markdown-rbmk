/**
 * Style `skala` — control-room console (SKALA / CRT).
 *
 * The core is a top-down channel map inside a mimic-panel bezel; the panel is
 * a terminal readout of labelled fields with a phosphor tint and scanlines.
 * Every colour is emitted once as CSS classes, cells are `<use>` of one shared
 * `#c` shape, so a full badge stays around 27 KB.
 */
import type { CellContent, CellShape, StatKey, StyleInput } from './types';
import { assignCells, escapeXml, grouped, MONO, num, REDUCED_MOTION_CSS, resolveStats, truncate } from './shared';

interface Palette {
  text: string;
  dim: string;
  accent: string;
  frame: string;
  grid: string;
  idle: string;
  heat: readonly [string, string, string, string];
  ok: string;
  warn: string;
  /** Phosphor bloom opacity at the core centre. */
  glow: number;
  /** Scanline opacity in the panel; 0 = no scanlines drawn at all. */
  scan: number;
}

/**
 * Palettes. Text / dim / accent are >= 4.5:1 against the intended page
 * (#0d1117 for dark + green, #ffffff for light) and against the header band
 * tint (accent at 12% over the page). The light accent is darkened from the
 * prototype's #b45309 (4.25:1 on its own band) to #8a3a06.
 */
const PRESETS: Record<string, Palette> = {
  // Amber phosphor CRT.
  dark: {
    text: '#ffc46b',
    dim: '#c29356',
    accent: '#ffb000',
    frame: '#5c4424',
    grid: '#3a2d1c',
    idle: '#261d12',
    heat: ['#6e4410', '#b36b12', '#f59e0b', '#ffe3a3'],
    ok: '#3ddc84',
    warn: '#ffb000',
    glow: 0.1,
    scan: 0.06,
  },
  // Printed mimic panel on paper.
  light: {
    text: '#1d2b22',
    dim: '#56645a',
    accent: '#8a3a06',
    frame: '#9aa59d',
    grid: '#cdd4cf',
    idle: '#e6ebe7',
    heat: ['#9fd39a', '#e3c13b', '#e07b24', '#c2331c'],
    ok: '#1f9d55',
    warn: '#d08700',
    glow: 0.07,
    scan: 0,
  },
  // P1 green phosphor.
  green: {
    text: '#7dffa6',
    dim: '#4fbf7a',
    accent: '#39ff88',
    frame: '#1f5a36',
    grid: '#173d27',
    idle: '#0f2619',
    heat: ['#145c32', '#1f9a52', '#3ee07f', '#c6ffd9'],
    ok: '#39ff88',
    warn: '#ffd24d',
    glow: 0.12,
    scan: 0.07,
  },
};

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

const CORE = 600;
const C = 300;
const STEP = 22;
const R = 270;
/** Solid bezel ring around the core. */
const RING = 282;
const GAP = 12;
const PANEL_V = { w: 272, h: 600 };
const PANEL_H = { w: 600, h: 260 };

const SHAPES: Record<CellShape, string> = {
  default: '<rect id="c" width="16" height="16" rx="1"/>',
  square: '<rect id="c" width="16" height="16"/>',
  round: '<rect id="c" width="16" height="16" rx="4.5"/>',
  circle: '<circle id="c" cx="8" cy="8" r="8"/>',
  hex: '<polygon id="c" points="8,0 14.93,4 14.93,12 8,16 1.07,12 1.07,4"/>',
};

interface Pos {
  r: number;
  c: number;
  cx: number;
  cy: number;
  dist: number;
}

/** 24x24 lattice clipped to a circle, sorted centre-out. Hex = offset rows. */
function lattice(hex: boolean): Pos[] {
  const out: Pos[] = [];
  for (let r = 0; r < 24; r++) {
    for (let c = 0; c < 24; c++) {
      const off = hex ? (r % 2 ? 5.5 : -5.5) : 0;
      const cx = C + (c - 11.5) * STEP + off;
      const cy = C + (r - 11.5) * STEP;
      const dist = Math.hypot(cx - C, cy - C);
      if (dist <= R) out.push({ r, c, cx, cy, dist });
    }
  }
  out.sort((a, b) => a.dist - b.dist || a.cy - b.cy || a.cx - b.cx);
  return out;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const f = num;
const t = (cls: string, x: number, y: number, s: string) =>
  `<text class="${cls}" x="${f(x)}" y="${f(y)}">${escapeXml(s)}</text>`;
/** Approximate advance width of monospace text. */
const wText = (s: string, size: number, ls = 0) => [...s].length * size * (0.6 + ls);
const chName = (p: Pos) => `${String(p.r + 1).padStart(2, '0')}-${String(p.c + 1).padStart(2, '0')}`;
const safeColor = (c: string) => (/^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#8b949e');

/* ------------------------------------------------------------------ */
/* CSS                                                                 */
/* ------------------------------------------------------------------ */

function css(input: StyleInput, P: Palette): string {
  const base =
    `text{font-family:${MONO}}` +
    `.l{font-size:13px;letter-spacing:.08em}.s{font-size:11px;letter-spacing:.06em}.c{font-size:10px}` +
    `.v{font-size:16px;font-weight:700}.n{font-size:14px}.p{font-size:13px;letter-spacing:.04em}` +
    `.b{font-size:40px;font-weight:700}.h{font-size:14px;font-weight:700;letter-spacing:.1em}` +
    `.e{text-anchor:end}.m{text-anchor:middle}` +
    `.fr,.gl,.x,.ld,.rt{fill:none}.ld{stroke-dasharray:1 4}.rt{stroke-width:1.5}.dsh{stroke-dasharray:2 6}.hb{fill-opacity:.12}`;

  // Two keyframe rules: a one-time power-up ripple (from dim, never from 0,
  // and only while running thanks to `backwards`) and a slow flux pulse.
  const anim = input.animate
    ? `@keyframes pu{from{opacity:.15}to{opacity:1}}` +
      `@keyframes fx{0%,100%{opacity:1}50%{opacity:.5}}` +
      `.b0,.b1,.b2,.b3,.b4,.b5,.pp{animation:pu .6s ease-out backwards}` +
      [0, 0.25, 0.5, 0.75, 1, 1.25].map((d, i) => `.b${i}{animation-delay:${d}s}`).join('') +
      `.pp{animation-duration:.8s;animation-delay:1.3s}` +
      (
        [
          [6.5, 0],
          [7.2, -1.3],
          [5.8, -2.4],
          [8, -3.1],
          [6.9, -4.6],
          [7.6, -5.5],
        ] as const
      )
        .map(([d, o], i) => `.d${i}{animation:fx ${d}s ease-in-out ${o}s infinite}`)
        .join('') +
      // FLUX lamp and the prompt cursor share one calm pulse (no hard blink).
      `.lf,.cur{animation:fx 3.2s ease-in-out infinite}` +
      REDUCED_MOTION_CSS
    : '';

  const palette =
    `.l,.s,.c{fill:${P.dim}}.v,.n,.p{fill:${P.text}}.b,.h{fill:${P.accent}}` +
    `.fr{stroke:${P.frame}}.gl,.x{stroke:${P.grid}}.ld{stroke:${P.dim}}.rt{stroke:${P.accent}}` +
    `.hb,.sc,.cur{fill:${P.accent}}.gs{stop-color:${P.accent};stop-opacity:${P.glow}}.ge{stop-color:${P.accent}}` +
    (P.scan > 0 ? `.so{opacity:${P.scan}}` : '') +
    `.lo{fill:${P.ok}}.lw{fill:${P.warn}}.lx{fill:${P.grid}}` +
    `.h0{fill:${P.idle}}` +
    P.heat.map((h, i) => `.h${i + 1}{fill:${h}}`).join('') +
    input.langs.map((l, i) => `.g${i}{fill:${safeColor(l.color)}}`).join('');

  return base + anim + palette;
}

/* ------------------------------------------------------------------ */
/* Core: top-down channel map with coordinate grid                     */
/* ------------------------------------------------------------------ */

interface Layout {
  pos: Pos[];
  cells: CellContent[];
  peakPos: Pos | null;
}

function layout(input: StyleInput): Layout {
  const pos = lattice(input.cell === 'hex');
  const cells = assignCells(input, pos.length);
  let peakPos: Pos | null = null;
  if (input.summary.peak > 0) {
    const i = cells.findIndex((c) => c.kind === 'day' && c.day.date === input.summary.peakDate);
    if (i >= 0) peakPos = pos[i] ?? null;
  }
  return { pos, cells, peakPos };
}

/**
 * Bezel ring with coordinate labels set into it like a dial scale: rows
 * 09–17 on the left, columns 09–17 on top. The ring is broken under each
 * label, so no label ever sits on the line; a label that would touch a cell
 * (hex offsets) slides outward a little, or is skipped.
 */
function ringWithLabels(pos: Pos[]): string {
  const labels: string[] = [];
  const gaps: number[] = []; // angles (radians) where the ring is broken
  const HALF_W = 6;
  const HALF_H = 4;
  const clear = (x: number, y: number) =>
    x - HALF_W > 12 &&
    y - HALF_H > 12 &&
    pos.every((p) => Math.abs(p.cx - x) > 8 + HALF_W + 2 || Math.abs(p.cy - y) > 8 + HALF_H + 2);

  for (let k = 8; k <= 16; k += 2) {
    const label = String(k + 1).padStart(2, '0');
    const line = C + (k - 11.5) * STEP;
    const off = Math.sqrt(RING * RING - (line - C) ** 2);
    // [x, y] of the label centre on the ring: row (left), then column (top).
    for (const [ux, uy] of [
      [C - off, line],
      [line, C - off],
    ] as const) {
      for (let push = 0; push <= 4; push += 2) {
        const s = (RING + push) / RING;
        const x = C + (ux - C) * s;
        const y = C + (uy - C) * s;
        if (!clear(x, y)) continue;
        labels.push(t('c m', x, y + 3.5, label));
        gaps.push(Math.atan2(uy - C, ux - C));
        break;
      }
    }
  }

  // Ring as arcs between the label gaps.
  const half = 10 / RING;
  const sorted = gaps.sort((a, b) => a - b);
  let ring: string;
  if (!sorted.length) ring = `<circle cx="${C}" cy="${C}" r="${RING}" class="fr"/>`;
  else {
    const pt = (a: number) => `${f(C + RING * Math.cos(a))} ${f(C + RING * Math.sin(a))}`;
    let d = '';
    sorted.forEach((g, i) => {
      const from = g + half;
      const to = (sorted[i + 1] ?? sorted[0]! + 2 * Math.PI) - half;
      const large = to - from > Math.PI ? 1 : 0;
      d += `M${pt(from)}A${RING} ${RING} 0 ${large} 1 ${pt(to)}`;
    });
    ring = `<path d="${d}" class="fr"/>`;
  }
  return ring + labels.join('');
}

function drawCore(input: StyleInput, L: Layout, lamps: boolean): string {
  const bands: string[][] = [[], [], [], [], [], []];
  L.pos.forEach((p, i) => {
    const cell = L.cells[i] ?? { kind: 'empty' };
    let cls: string;
    if (cell.kind === 'day') {
      const lv = cell.day.level;
      cls = lv ? `h${lv} d${Math.floor(input.rng() * 6)}` : 'h0';
    } else if (cell.kind === 'lang') {
      cls = `g${cell.langIndex} d${Math.floor(input.rng() * 6)}`;
    } else cls = 'x'; // channel with no data: outline only
    const b = Math.min(5, Math.floor((p.dist / R) * 6));
    bands[b]!.push(`<use href="#c" x="${f(p.cx - 8)}" y="${f(p.cy - 8)}" class="${cls}"/>`);
  });

  const s: string[] = [];
  // Bezel + edge ticks at every row and column (one path).
  s.push(`<rect x="4.5" y="4.5" width="591" height="591" rx="6" class="fr"/>`);
  let ticks = '';
  for (let k = 0; k < 24; k++) {
    const v = f(C + (k - 11.5) * STEP);
    ticks += `M${v} 5v5M${v} 595v-5M5 ${v}h5M595 ${v}h-5`;
  }
  s.push(`<path d="${ticks}" class="gl"/>`);
  // Phosphor bloom, reference rings, dashed axes.
  s.push(`<circle cx="300" cy="300" r="${RING}" fill="url(#gw)"/>`);
  s.push(`<circle cx="300" cy="300" r="141" class="gl dsh"/>`);
  s.push(`<path d="M300 14V586M14 300H586" class="gl dsh"/>`);
  s.push(ringWithLabels(L.pos));

  s.push(bands.map((b, i) => `<g class="b${i}">${b.join('')}</g>`).join(''));

  // Reticle (4 corner brackets) on the peak-day channel.
  if (L.peakPos) {
    const X = L.peakPos.cx - 8;
    const Y = L.peakPos.cy - 8;
    s.push(
      `<path class="rt" d="M${f(X - 4)} ${f(Y + 2)}V${f(Y - 4)}H${f(X + 2)}M${f(X + 14)} ${f(Y - 4)}H${f(X + 20)}V${f(Y + 2)}` +
        `M${f(X + 20)} ${f(Y + 14)}V${f(Y + 20)}H${f(X + 14)}M${f(X + 2)} ${f(Y + 20)}H${f(X - 4)}V${f(Y + 14)}"/>`,
    );
  }

  // Corner readouts, all outside the circular core.
  s.push(t('l', 18, 30, 'CHANNEL MAP'), t('v', 18, 52, `@${truncate(input.username, 14)}`));
  s.push(t('l', 18, 560, 'MODE'), t('v', 18, 582, `${input.mode.toUpperCase()} \u00B7 ${L.pos.length} CH`));
  if (lamps) {
    (
      [
        ['PWR', 'lo', 488],
        ['FLUX', 'lw lf', 528],
        ['AZ-5', 'lx', 568],
      ] as const
    ).forEach(([name, cls, x]) => {
      s.push(t('s m', x, 30, name), `<circle cx="${x}" cy="46" r="5" class="${cls}"/>`);
    });
  }
  if (input.mode === 'language') {
    const primary = input.langs[0];
    s.push(t('l e', 582, 560, 'PRIMARY FUEL'), t('v e', 582, 582, primary ? truncate(primary.name, 13) : '--'));
  } else {
    for (let i = 0; i < 5; i++) s.push(`<use href="#c" x="${466 + i * 22}" y="548" class="h${i}"/>`);
    s.push(t('s', 466, 584, 'IDLE'), t('s e', 570, 584, 'PEAK'));
  }
  return s.join('');
}

/* ------------------------------------------------------------------ */
/* Panel: terminal readout with labelled fields                        */
/* ------------------------------------------------------------------ */

interface Item {
  h: number;
  /** Keep in the same column as the next item (section headers). */
  keep?: boolean;
  draw: (x: number, y: number, w: number) => string;
}

function field(label: string, value: string): Item {
  return {
    h: 24,
    draw: (x, y, w) => {
      const a = x + wText(label, 13, 0.08) + 6;
      const b = x + w - wText(value, 16) - 6;
      return (
        t('l', x, y + 17, label) +
        t('v e', x + w, y + 17, value) +
        (b - a > 8 ? `<path d="M${f(a)} ${y + 14}H${f(b)}" class="ld"/>` : '')
      );
    },
  };
}

function statItems(key: StatKey, input: StyleInput, L: Layout): Item[] {
  const S = input.summary;
  switch (key) {
    case 'total':
      return [
        {
          h: 84,
          draw: (x, y) =>
            t('l', x, y + 14, 'TOTAL OUTPUT') +
            t('b', x - 2, y + 54, grouped(S.total)) +
            t('s', x, y + 72, `CONTRIBUTIONS / ${S.window} D`),
        },
      ];
    case 'active':
      return [field('ACTIVE', `${S.active} D`)];
    case 'idle':
      return [field('IDLE', `${S.idle} D`)];
    case 'peak': {
      const items = [field('PEAK/DAY', String(S.peak))];
      if (L.peakPos) items.push(field('PEAK CH', chName(L.peakPos)));
      return items;
    }
    case 'streak':
      return [field('STREAK', `${S.currentStreak} D`)];
    case 'longest':
      return [field('LONGEST', `${S.longestStreak} D`)];
    case 'languages': {
      const items: Item[] = [{ h: 20, keep: true, draw: (x, y) => t('l', x, y + 14, 'FUEL CHANNELS') }];
      input.langs.forEach((l, i) => {
        items.push({
          h: 22,
          draw: (x, y, w) => {
            const pct = Math.max(0, Math.min(100, l.pct));
            return (
              `<rect x="${f(x)}" y="${f(y + 3)}" width="10" height="10" rx="1" class="g${i}"/>` +
              t('n', x + 18, y + 13, truncate(l.name, 12)) +
              t('v e', x + w, y + 13, `${num(pct)}%`) +
              `<path d="M${f(x + 18)} ${f(y + 19.5)}H${f(x + w)}" class="gl"/>` +
              `<rect x="${f(x + 18)}" y="${f(y + 18)}" width="${f(((w - 18) * pct) / 100)}" height="3" class="g${i}"/>`
            );
          },
        });
      });
      return items;
    }
  }
}

function legendItem(): Item {
  return {
    h: 68,
    draw: (x, y) => {
      let s = t('l', x, y + 14, 'CORE OUTPUT');
      for (let i = 0; i < 5; i++) s += `<use href="#c" x="${f(x + i * 22)}" y="${f(y + 26)}" class="h${i}"/>`;
      return s + t('s', x, y + 62, 'IDLE') + t('s e', x + 104, y + 62, 'PEAK');
    },
  };
}

function drawPanel(input: StyleInput, L: Layout, vertical: boolean, P: Palette): { w: number; h: number; svg: string } {
  const { w: W, h: H } = vertical ? PANEL_V : PANEL_H;
  const s: string[] = [];
  s.push(`<rect x="4.5" y="4.5" width="${W - 9}" height="${H - 9}" rx="6" class="fr"/>`);
  s.push(`<rect x="5" y="5" width="${W - 10}" height="32" rx="5" class="hb"/>`);
  if (P.scan > 0) s.push(`<rect x="5" y="37" width="${W - 10}" height="${H - 42}" fill="url(#sl)" class="so"/>`);

  // Header: `SKALA ▸ @user`, dropping the prefix before truncating the name.
  const room = W - 16 - 72;
  const fits = (s2: string) => wText(s2, 14, 0.1) <= room;
  let head = `SKALA \u25B8 @${input.username}`;
  if (!fits(head)) head = `\u25B8 @${input.username}`;
  if (!fits(head)) head = `\u25B8 @${truncate(input.username, Math.max(3, Math.floor(room / (14 * 0.7)) - 3))}`;
  s.push(t('h', 16, 26, head));
  (
    [
      ['lo', W - 60],
      ['lw lf', W - 42],
      ['lx', W - 24],
    ] as const
  ).forEach(([cls, x]) => s.push(`<circle cx="${x}" cy="21" r="5" class="${cls}"/>`));

  // Flow the chosen readouts into columns (1 vertical, 3 horizontal).
  const items: Item[] = resolveStats(input).flatMap((k) => statItems(k, input, L));
  if (input.view === 'panel' && input.mode !== 'language') items.push(legendItem());
  const x0 = 16;
  const top = 48;
  const bottom = H - 44;
  const cols = vertical ? 1 : 3;
  const gap = 22;
  const cw = (W - 32 - gap * (cols - 1)) / cols;
  let col = 0;
  let y = top;
  let used = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    const next = it.keep ? items[i + 1] : undefined;
    const need = it.h + (next ? next.h + 2 : 0);
    if (y + need > bottom && y > top) {
      col++;
      y = top;
    }
    if (col >= cols || y + need > bottom) break; // overflow is dropped, never overlaps
    s.push(it.draw(x0 + col * (cw + gap), y, cw));
    used = col;
    y += it.h + 2;
  }
  for (let k = 1; k <= used; k++) {
    const dx = f(x0 + k * (cw + gap) - gap / 2);
    s.push(`<path d="M${dx} ${top}V${bottom}" class="gl dsh"/>`);
  }

  // Prompt footer with a calm block cursor.
  s.push(`<path d="M14 ${H - 38}H${W - 14}" class="gl dsh"/>`);
  const prompt = `> MODE=${input.mode.toUpperCase()} \u00B7 NOMINAL`;
  s.push(t('p', 16, H - 16, prompt));
  s.push(`<rect x="${f(16 + wText(prompt, 13, 0.04) + 4)}" y="${H - 28}" width="8" height="14" class="cur"/>`);
  return { w: W, h: H, svg: s.join('') };
}

/* ------------------------------------------------------------------ */
/* Document                                                            */
/* ------------------------------------------------------------------ */

function describe(input: StyleInput): string {
  const S = input.summary;
  const parts: string[] = [];
  if (input.mode !== 'language') {
    parts.push(
      `${grouped(S.total)} contributions over ${S.window} days; ${S.active} active days; peak ${S.peak} per day; current streak ${S.currentStreak} days.`,
    );
  }
  if (input.mode !== 'commit' && input.langs.length) {
    parts.push(`Languages: ${input.langs.map((l) => `${l.name} ${num(l.pct)}%`).join(', ')}.`);
  }
  return parts.join(' ');
}

export function render(input: StyleInput): string {
  const base = PRESETS[input.preset] ?? PRESETS.dark!;
  const P: Palette = {
    ...base,
    ...(input.accent ? { accent: input.accent } : {}),
    ...(input.heat ? { idle: input.heat[0], heat: [input.heat[1], input.heat[2], input.heat[3], input.heat[4]] } : {}),
  };
  const L = layout(input);

  let W: number;
  let H: number;
  let body: string;
  if (input.view === 'core') {
    W = H = CORE;
    body = drawCore(input, L, true);
  } else if (input.view === 'panel') {
    const p = drawPanel(input, L, input.panel === 'right', P);
    W = p.w;
    H = p.h;
    body = `<g class="pp">${p.svg}</g>`;
  } else {
    const right = input.panel === 'right';
    const core = drawCore(input, L, false);
    const p = drawPanel(input, L, right, P);
    W = right ? CORE + GAP + p.w : CORE;
    H = right ? CORE : CORE + GAP + p.h;
    const tx = right ? `${CORE + GAP},0` : `0,${CORE + GAP}`;
    body = `<g>${core}</g><g class="pp" transform="translate(${tx})">${p.svg}</g>`;
  }

  const title = `markdown-RBMK skala console: @${input.username}, ${input.mode} mode`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">`,
    `<title>${escapeXml(title)}</title><desc>${escapeXml(describe(input))}</desc>`,
    `<style>${css(input, P)}</style>`,
    `<defs>${SHAPES[input.cell]}`,
    `<radialGradient id="gw"><stop offset="0" class="gs"/><stop offset="1" class="ge" stop-opacity="0"/></radialGradient>`,
    P.scan > 0
      ? `<pattern id="sl" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" class="sc"/></pattern>`
      : '',
    `</defs>`,
    body,
    `</svg>`,
  ].join('');
}
