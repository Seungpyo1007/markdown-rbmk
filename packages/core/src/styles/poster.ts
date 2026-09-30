/**
 * Style `poster` — constructivist graphic poster.
 *
 * A flat-colour plate with a heavy diagonal accent band (bottom-left to
 * top-right), a knock-out disc holding the circular cell field (ink ring plus
 * an off-register accent ring), and a panel of big stacked numerals on slanted
 * colour blocks. Pure geometry and type; CSS @keyframes only.
 */
import { assignCells, contrast, escapeXml, grouped, num, REDUCED_MOTION_CSS, resolveStats, SANS, truncate } from './shared';
import type { CellShape, StatKey, StyleInput } from './types';

/* ------------------------------------------------------------------ */
/* Palettes — the only colour source.                                   */
/* ground = the plate, ink = type/rules, accent = band + blocks,        */
/* onAccent/onInk = type printed on accent/ink blocks, edge = keyline.  */
/* ------------------------------------------------------------------ */
interface Palette {
  ground: string;
  ink: string;
  dim: string;
  accent: string;
  onAccent: string;
  onInk: string;
  rule: string;
  edge: string;
  idle: string;
  heat: readonly string[];
}

const PRESETS: Record<string, Palette> = {
  dark: {
    ground: '#0f0f0f', ink: '#f2e8d5', dim: '#b3a78f', accent: '#ff4a36',
    onAccent: '#0f0f0f', onInk: '#0f0f0f', rule: '#3a3530', edge: '#6b6258',
    idle: '#26221f', heat: ['#5c2a22', '#a8352a', '#ff4a36', '#f2e8d5'],
  },
  light: {
    ground: '#f2e8d5', ink: '#161412', dim: '#5e5140', accent: '#b8221a',
    onAccent: '#f2e8d5', onInk: '#f2e8d5', rule: '#cdbfa4', edge: '#b3a489',
    idle: '#e0d2b6', heat: ['#e7a38e', '#d4553f', '#b8221a', '#161412'],
  },
  cobalt: {
    ground: '#13235b', ink: '#f4ecd8', dim: '#b9c1de', accent: '#ffc53d',
    onAccent: '#13235b', onInk: '#13235b', rule: '#2c3f82', edge: '#3b5bb0',
    idle: '#1f3274', heat: ['#3b5bb0', '#8aa6e8', '#ffc53d', '#fff6dc'],
  },
};

/* ------------------------------------------------------------------ */
/* Geometry: 600x600 core, 20 px lattice, 15 px cells, field r=246.     */
/* ------------------------------------------------------------------ */
const CORE = 600;
const C = 300;
const STEP = 20;
const R = 246;
const CELL = 15;
const H = CELL / 2;
const RING = 264;
/** Bottom of the usable area of the vertical panel (foot bar below). */
const V_LIMIT = 572;

const SHAPES: Record<Exclude<CellShape, 'default'>, string> = {
  square: `<rect id="c" width="${CELL}" height="${CELL}"/>`,
  round: `<rect id="c" width="${CELL}" height="${CELL}" rx="4"/>`,
  circle: `<circle id="c" cx="${H}" cy="${H}" r="${H}"/>`,
  hex: '<polygon id="c" points="7.5,0 14,3.75 14,11.25 7.5,15 1,11.25 1,3.75"/>',
};

interface Pos {
  cx: number;
  cy: number;
  dist: number;
}

function lattice(shape: CellShape): Pos[] {
  const out: Pos[] = [];
  for (let r = -12; r <= 12; r++) {
    for (let c = -13; c <= 13; c++) {
      const cx = C + c * STEP + (shape === 'hex' ? (r % 2 ? 5 : -5) : 0);
      const cy = C + r * STEP;
      const dist = Math.hypot(cx - C, cy - C);
      if (dist <= R) out.push({ cx, cy, dist });
    }
  }
  return out.sort((a, b) => a.dist - b.dist || a.cy - b.cy || a.cx - b.cx);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */
const f = num;
const pts = (a: ReadonlyArray<readonly [number, number]>) => a.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
const poly = (cls: string, a: ReadonlyArray<readonly [number, number]>) => `<polygon class="${cls}" points="${pts(a)}"/>`;
/** Text element; data is escaped here. `size` => inline font-size (auto-fitted). */
const t = (cls: string, x: number, y: number, s: string, size?: number) =>
  `<text class="${cls}" x="${f(x)}" y="${f(y)}"${size ? ` font-size="${f(size)}"` : ''}>${escapeXml(s)}</text>`;
/** Conservative width of heavy caps with letter-spacing `ls` em. */
const wCaps = (s: string, size: number, ls: number) => s.length * size * (0.72 + ls);
const HEAVY = 0.64;

/** Largest size <= max that fits `width`; below `min` the string is truncated. */
function fit(s: string, max: number, min: number, width: number): { s: string; size: number } {
  const size = Math.min(max, width / (Math.max(1, s.length) * HEAVY));
  if (size >= min) return { s, size };
  return { s: truncate(s, Math.max(2, Math.floor(width / (min * HEAVY)))), size: min };
}

const HEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
const safeColor = (c: string) => (HEX.test(c) ? c : '#8b8b8b');

/** Type metrics for the two text scales (big = the 900-wide full-right / vertical panel). */
interface Type {
  big: boolean;
  /** Small text size (tags, labels, units, language rows). */
  fs: number;
  tagLs: number;
  lbLs: number;
  unLs: number;
}
const TYPE_SMALL: Type = { big: false, fs: 13, tagLs: 0.22, lbLs: 0.04, unLs: 0.04 };
const TYPE_BIG: Type = { big: true, fs: 20, tagLs: 0.12, lbLs: 0.04, unLs: 0.02 };

/* ------------------------------------------------------------------ */
/* CSS                                                                  */
/* ------------------------------------------------------------------ */
function css(P: Palette, input: StyleInput, T: Type): string {
  const bd = T.big ? `font-size:19px;letter-spacing:.12em` : `font-size:15px;letter-spacing:.28em`;
  let s =
    `text{font-family:${SANS};font-weight:800}` +
    `.tg{font-size:${T.fs}px;letter-spacing:${T.tagLs}em}` +
    `.lb{font-size:${T.fs}px;letter-spacing:${T.lbLs}em}` +
    `.un{font-size:${T.fs}px;font-weight:600;letter-spacing:${T.unLs}em}` +
    `.nm{font-size:${T.fs}px;font-weight:700}.pc{font-size:${T.fs}px}` +
    `.bd{${bd}}` +
    `.st{font-size:${T.big ? 36 : 34}px;letter-spacing:-.02em}.hn{letter-spacing:-.03em}` +
    `.e{text-anchor:end}.m{text-anchor:middle}` +
    `.gr{fill:${P.ground}}.ik,.tk{fill:${P.ink}}.ac,.ta{fill:${P.accent}}.td{fill:${P.dim}}` +
    `.to{fill:${P.onAccent}}.ti{fill:${P.onInk}}.rl,.em{fill:${P.rule}}` +
    `.rg{fill:none;stroke:${P.ink};stroke-width:6}.mr{fill:none;stroke:${P.accent};stroke-width:2.5}` +
    `.pk{fill:none;stroke:${P.ink};stroke-width:2.5}.fr{fill:none;stroke:${P.edge};stroke-width:4}` +
    `.h0{fill:${P.idle}}` +
    P.heat.map((h, i) => `.h${i + 1}{fill:${h}}`).join('') +
    input.langs.map((l, i) => `.g${i}{fill:${safeColor(l.color)}}`).join('');
  if (input.animate) {
    s +=
      '@keyframes pu{from{opacity:.08}}' +
      '@keyframes fx{0%,100%{opacity:1}50%{opacity:.6}}' +
      '@keyframes sl{from{opacity:.1;transform:translate(-18px,12px)}}' +
      '.b0,.b1,.b2,.b3,.b4,.b5{animation:pu .7s ease-out backwards}' +
      [0, 0.12, 0.24, 0.36, 0.48, 0.6].map((d, i) => `.b${i}{animation-delay:${d}s}`).join('') +
      '.s0,.s1,.s2,.s3{animation:sl .8s cubic-bezier(.2,.7,.2,1) backwards}' +
      [0.1, 0.35, 0.55, 0.75].map((d, i) => `.s${i}{animation-delay:${d}s}`).join('') +
      [[6.5, 0], [7.4, -1.2], [5.8, -2.6], [8.2, -3.4], [6.9, -4.8], [7.8, -5.9]]
        .map(([d, o], i) => `.d${i}{animation:fx ${d}s ease-in-out ${o}s infinite}`)
        .join('') +
      REDUCED_MOTION_CSS;
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* Core: circular cell field on a diagonal band                         */
/* ------------------------------------------------------------------ */
function drawCore(input: StyleInput, T: Type): string {
  const s: string[] = [];
  const shape: CellShape = input.cell === 'default' ? 'square' : input.cell;
  const k = 78; // band half-width along x+y (≈55 px perpendicular)
  s.push(
    '<g class="s0">',
    poly('ac', [[0, 600 - k], [600 - k, 0], [600, 0], [600, k], [k, 600], [0, 600]]),
    poly('ik', [[0, 492], [492, 0], [504, 0], [0, 504]]),
    '</g>',
  );
  s.push(`<circle cx="${C}" cy="${C}" r="${RING}" class="gr"/>`);
  s.push(`<circle cx="${C + 6}" cy="${C - 6}" r="${RING + 8}" class="mr"/>`);
  s.push(`<circle cx="${C}" cy="${C}" r="${RING}" class="rg"/>`);

  const pos = lattice(shape);
  const cells = assignCells(input, pos.length);
  const bands: string[][] = [[], [], [], [], [], []];
  const flux = () => (input.animate ? ` d${Math.floor(input.rng() * 6) % 6}` : '');
  let peak: Pos | null = null;
  pos.forEach((p, i) => {
    const c = cells[i]!;
    let cls: string;
    if (c.kind === 'day') {
      cls = c.day.level ? `h${c.day.level}${flux()}` : 'h0';
      if (input.summary.peak > 0 && c.day.date === input.summary.peakDate) peak = p;
    } else if (c.kind === 'lang') cls = `g${c.langIndex}${flux()}`;
    else cls = 'em';
    const b = Math.min(5, Math.floor((p.dist / R) * 6));
    bands[b]!.push(`<use href="#c" x="${f(p.cx - H)}" y="${f(p.cy - H)}" class="${cls}"/>`);
  });
  s.push(bands.map((b, i) => `<g class="b${i}">${b.join('')}</g>`).join(''));
  const pk = peak as Pos | null;
  if (pk) s.push(`<rect x="${f(pk.cx - 11)}" y="${f(pk.cy - 11)}" width="22" height="22" class="pk"/>`);

  // Rotated band captions, printed on the band.
  s.push('<text class="bd to m" x="52" y="553" transform="rotate(-45 52 548)">RBMK</text>');
  s.push(t('bd to m', 548, 57, input.mode.toUpperCase()).replace('<text ', '<text transform="rotate(-45 548 52)" '));

  // Top-left: @username (the band already carries RBMK in the big scale).
  const user = `@${input.username}`;
  if (T.big) {
    const u = fit(user, 30, 19, 160);
    s.push(t('tk hn', 20, 48, u.s, u.size));
  } else {
    const tag = 'RBMK';
    s.push(`<rect x="22" y="18" width="${f(wCaps(tag, T.fs, T.tagLs) + 14)}" height="${T.fs + 8}" class="ik"/>`);
    s.push(t('tg ti', 29, 18 + T.fs + 2, tag));
    const u = fit(user, 26, 14, 128);
    s.push(t('tk hn', 20, 72, u.s, u.size));
  }

  // Bottom-right: heat scale (commit/hybrid) or primary fuel (language).
  if (input.mode === 'language') {
    const first = input.langs[0];
    if (first) {
      if (T.big) {
        s.push(t('lb ta e', 578, 548, 'FUEL'));
        const pf = fit(first.name, 26, 19, 120);
        s.push(t('tk e', 578, 580, pf.s, pf.size));
      } else {
        s.push(t('lb ta e', 578, 548, 'PRIMARY FUEL'));
        const pf = fit(first.name, 20, 13, 110);
        s.push(t('tk e', 578, 574, pf.s, pf.size));
      }
    }
  } else if (T.big) {
    s.push(t('lb ta', 440, 552, 'IDLE'), t('lb ta e', 581, 552, 'PEAK'));
    for (let i = 0; i < 5; i++) s.push(`<use href="#c" transform="translate(${440 + i * 29} 560) scale(1.4)" class="h${i}"/>`);
  } else {
    s.push(t('lb ta', 480, 550, 'IDLE'), t('lb ta e', 580, 550, 'PEAK'));
    for (let i = 0; i < 5; i++) s.push(`<use href="#c" x="${f(480 + i * 21.25)}" y="560" class="h${i}"/>`);
  }
  return s.join('');
}

/* ------------------------------------------------------------------ */
/* Panel: stacked heavy numbers on colour blocks                        */
/* ------------------------------------------------------------------ */
type Small = [value: string, label: string, unit: string];
const SMALL: Partial<Record<StatKey, (i: StyleInput) => Small>> = {
  active: (i) => [grouped(i.summary.active), 'ACTIVE', 'DAYS'],
  idle: (i) => [grouped(i.summary.idle), 'IDLE', 'DAYS'],
  peak: (i) => [grouped(i.summary.peak), 'PEAK', 'PER DAY'],
  streak: (i) => [grouped(i.summary.currentStreak), 'STREAK', 'DAYS'],
  longest: (i) => [grouped(i.summary.longestStreak), 'LONGEST', 'DAYS'],
};

function statCell(v: Small, x: number, y: number, w: number, T: Type): string {
  const [value, label, unit] = v;
  const size = T.big ? 36 : 34;
  const n = fit(value, size, 18, w - 14);
  const [bh, ny, ly, uy] = T.big ? [80, 34, 58, 80] : [62, 32, 49, 64];
  return (
    `<rect x="${f(x)}" y="${f(y)}" width="${T.big ? 6 : 5}" height="${bh}" class="ac"/>` +
    t('st tk', x + 13, y + ny, n.s, n.size < size ? n.size : undefined) +
    t('lb ta', x + 13, y + ly, label) +
    t('un td', x + 13, y + uy, unit)
  );
}

/** Stacked share bar + name/percent rows (column-major). Returns '' if nothing fits. */
function langBlock(input: StyleInput, x: number, y: number, w: number, maxY: number, T: Type, maxCols: number): string {
  const langs = input.langs;
  if (!langs.length) return '';
  const fs = T.fs;
  const pitch = T.big ? 26 : 19;
  const first = y + (T.big ? 42 : 34);
  const rowsFit = Math.floor((maxY - first) / pitch) + 1;
  if (rowsFit < 1) return '';
  const cols = Math.min(maxCols, Math.ceil(langs.length / rowsFit));
  const rows = Math.min(rowsFit, Math.ceil(langs.length / cols));
  const shown = langs.slice(0, rows * cols);
  let s = '';
  let bx = x;
  const totalPct = langs.reduce((a, l) => a + l.pct, 0) || 1;
  langs.forEach((l, i) => {
    const bw = i === langs.length - 1 ? x + w - bx : (w * l.pct) / totalPct;
    if (bw > 0) s += `<rect x="${f(bx)}" y="${f(y)}" width="${f(bw)}" height="14" class="g${i}"/>`;
    bx += bw;
  });
  const gap = 20;
  const cw = (w - gap * (cols - 1)) / cols;
  const sw = T.big ? 14 : 10;
  const pcW = 5.5 * fs * 0.6;
  const maxChars = Math.max(3, Math.floor((cw - sw - 6 - pcW - 6) / (fs * 0.6)));
  shown.forEach((l, i) => {
    const cx = x + Math.floor(i / rows) * (cw + gap);
    const cy = first + (i % rows) * pitch;
    s +=
      `<rect x="${f(cx)}" y="${f(cy - sw)}" width="${sw}" height="${sw}" class="g${i}"/>` +
      t('nm tk', cx + sw + 6, cy, truncate(l.name, maxChars)) +
      t('pc tk e', cx + cw, cy, `${num(l.pct)}%`);
  });
  return s;
}

function legendBlock(x: number, y: number, w: number, T: Type): { svg: string; h: number } {
  const fs = T.fs;
  const sw = Math.min(T.big ? 40 : 30, (w - 16) / 5);
  const sh = sw * 0.7;
  let s = t('lb ta', x, y + fs, 'CORE OUTPUT');
  const sy = y + fs + 8;
  for (let i = 0; i < 5; i++) s += `<rect x="${f(x + i * (sw + 4))}" y="${f(sy)}" width="${f(sw)}" height="${f(sh)}" class="h${i}"/>`;
  const end = x + 5 * sw + 16;
  const ly = sy + sh + fs + 4;
  s += t('un td', x, ly, 'IDLE') + t('un td e', end, ly, 'PEAK');
  return { svg: s, h: ly - y + 4 };
}

function drawPanel(input: StyleInput, vertical: boolean, T: Type): { W: number; H: number; svg: string } {
  const stats = resolveStats(input);
  const small = stats.flatMap((k) => (SMALL[k] ? [SMALL[k]!(input)] : []));
  const hasTotal = stats.includes('total');
  // A language panel with nothing selected would be empty: show the fuel mix.
  const hasLangs = stats.includes('languages') || (input.mode === 'language' && !small.length && !hasTotal);
  const tag = `RBMK \u00B7 ${input.mode.toUpperCase()}`;
  const user = `@${input.username}`;
  const win = input.summary.window;
  const fs = T.fs;
  const s: string[] = [];

  if (vertical) {
    s.push('<g class="s0">', poly('ik', [[0, 0], [300, 0], [300, 78], [0, 100]]), t('tg ti', 20, 32, tag));
    const u = fit(user, 32, 19, 262);
    s.push(t('ti hn', 18, 72, u.s, u.size), '</g>');
    let y = 118;
    if (hasTotal) {
      const n = fit(grouped(input.summary.total), 70, 30, 262);
      s.push(
        '<g class="s1">',
        poly('ac', [[0, 114], [300, 92], [300, 240], [0, 262]]),
        t('tg to', 20, 144, 'CONTRIBUTIONS'),
        t('to hn', 16, 210, n.s, n.size),
        t('lb to', 20, 238, `IN ${grouped(win)} DAYS`),
        '</g>',
      );
      y = 284;
    }
    if (small.length) {
      const rows = Math.min(Math.ceil(small.length / 2), Math.floor((V_LIMIT + 12 - y) / 96));
      if (rows > 0) {
        s.push('<g class="s2">');
        small.slice(0, rows * 2).forEach((v, i) => s.push(statCell(v, 20 + (i % 2) * 136, y + Math.floor(i / 2) * 96, 124, T)));
        s.push('</g>');
        y += rows * 96;
      }
    }
    s.push('<g class="s3">');
    const langs = hasLangs ? langBlock(input, 20, y + 30, 260, V_LIMIT, T, 1) : '';
    if (langs) s.push(t('lb ta', 20, y + 20, 'FUEL MIX'), langs);
    else if (input.mode !== 'language') {
      const lg = legendBlock(20, y, 260, T);
      if (y + lg.h <= V_LIMIT) s.push(lg.svg);
    }
    s.push(poly('ik', [[0, 580], [190, 580], [178, 600], [0, 600]]), '</g>');
    return { W: 300, H: 600, svg: s.join('') };
  }

  // Horizontal: slanted accent hero left, ink header strip, stat row, languages/legend.
  const x0 = hasTotal ? 252 : 20;
  if (hasTotal) {
    const n = fit(grouped(input.summary.total), 62, 28, 180);
    s.push(
      '<g class="s1">',
      poly('ac', [[0, 0], [232, 0], [200, 260], [0, 260]]),
      t('tg to', 20, 34, 'TOTAL'),
      t('to hn', 16, 112, n.s, n.size),
      t('lb to', 20, 144, 'CONTRIBUTIONS'),
      t('lb to', 20, 166, `IN ${grouped(win)} DAYS`),
      '<rect x="20" y="206" width="36" height="6" class="gr"/>',
      '</g>',
    );
  }
  s.push('<g class="s0">', poly('ik', hasTotal ? [[240, 0], [600, 0], [600, 56], [233, 56]] : [[0, 0], [600, 0], [600, 56], [0, 56]]));
  const tw = wCaps(tag, fs, T.tagLs);
  const u = fit(user, 26, 14, 584 - x0 - tw - 24);
  s.push(t('ti hn', x0, 38, u.s, u.size), t('tg ti e', 584, 34, tag), '</g>');
  const w = 584 - x0;
  if (small.length) {
    const labelW = Math.max(...small.map(([, l, un]) => Math.max(wCaps(l, fs, T.lbLs), wCaps(un, fs, T.unLs)))) + 20;
    const cols = Math.max(1, Math.min(small.length, Math.floor(w / labelW)));
    const cw = w / Math.max(cols, 3);
    s.push('<g class="s2">');
    small.slice(0, cols).forEach((v, i) => s.push(statCell(v, x0 + i * cw, 74, cw - 8, T)));
    s.push('</g>');
  }
  const y = small.length ? 158 : 74;
  s.push('<g class="s3">', `<rect x="${x0}" y="${y}" width="${w}" height="3" class="rl"/>`);
  if (hasLangs) s.push(langBlock(input, x0, y + 12, w, 250, T, 3));
  else if (input.mode !== 'language') s.push(legendBlock(x0, y + 12, Math.min(w, 200), T).svg);
  s.push('</g>');
  return { W: 600, H: 260, svg: s.join('') };
}

/* ------------------------------------------------------------------ */
/* Document                                                             */
/* ------------------------------------------------------------------ */
export function render(input: StyleInput): string {
  const base = PRESETS[input.preset] ?? PRESETS.dark!;
  const P: Palette = { ...base };
  if (input.accent) {
    P.accent = input.accent;
    // Keep type on accent blocks readable whatever the accent.
    P.onAccent = contrast(base.ground, input.accent) >= contrast(base.ink, input.accent) ? base.ground : base.ink;
  }
  if (input.heat) {
    P.idle = input.heat[0];
    P.heat = input.heat.slice(1);
  }
  const vertical = input.panel === 'right';
  const T = vertical && input.view !== 'core' ? TYPE_BIG : TYPE_SMALL;

  let W: number;
  let Hh: number;
  let body: string;
  let needCell = true;
  if (input.view === 'core') {
    W = Hh = CORE;
    body = drawCore(input, T);
  } else {
    const p = drawPanel(input, vertical, T);
    if (input.view === 'panel') {
      W = p.W;
      Hh = p.H;
      body = p.svg;
      needCell = false;
    } else {
      W = vertical ? CORE + p.W : CORE;
      Hh = vertical ? CORE : CORE + p.H;
      body = `<g>${drawCore(input, T)}</g><g transform="translate(${vertical ? `${CORE},0` : `0,${CORE}`})">${p.svg}</g>`;
    }
  }

  const shape = input.cell === 'default' ? 'square' : input.cell;
  const sm = input.summary;
  const title = `markdown-RBMK poster style: @${input.username}, ${input.mode} mode`;
  const desc =
    input.mode === 'language'
      ? `Language mix: ${input.langs.map((l) => `${l.name} ${num(l.pct)}%`).join(', ')}.`
      : `${grouped(sm.total)} contributions over ${sm.window} days; ${sm.active} active days; peak ${sm.peak} per day; current streak ${sm.currentStreak} days; longest streak ${sm.longestStreak} days.`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" role="img">`,
    `<title>${escapeXml(title)}</title><desc>${escapeXml(desc)}</desc>`,
    `<style>${css(P, input, T)}</style>`,
    needCell ? `<defs>${SHAPES[shape]}</defs>` : '',
    `<rect width="${W}" height="${Hh}" class="gr"/>`,
    body,
    `<rect x="2" y="2" width="${W - 4}" height="${Hh - 4}" class="fr"/>`,
    '</svg>',
  ].join('');
}
