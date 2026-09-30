/**
 * Style `dosimeter` — a handheld Soviet-era counter. The core is an LCD
 * dot-matrix disc, the panel an LCD readout with seven-segment digits.
 * Plain string building; every colour comes from the preset palette (CSS).
 */
import { assignCells, escapeXml, grouped, MONO, num, REDUCED_MOTION_CSS, resolveStats, truncate } from './shared';
import type { CellShape, StatKey, StyleInput } from './types';

interface Palette {
  body: string;
  bodyEdge: string;
  bodyHi: string;
  screw: string;
  bezel: string;
  lcd: string;
  lcdEdge: string;
  /** Unlit LCD elements (bar-graph, battery, signal). */
  ghost: string;
  /** Unlit "8" behind the big total — deliberately faint. */
  ghostDigit: string;
  text: string;
  dim: string;
  accent: string;
  idle: string;
  heat: [string, string, string, string];
  glow: string;
  glowA: number;
  sheen: string;
  sheenA: number;
}

const PRESETS: Record<string, Palette> = {
  // Black plastic body, backlit amber LCD.
  dark: {
    body: '#1c1d1b', bodyEdge: '#4a4c45', bodyHi: '#2a2b28', screw: '#55574f', bezel: '#bdb8a6',
    lcd: '#140e05', lcdEdge: '#4a3616', ghost: '#2b1f0d', ghostDigit: '#1d1508',
    text: '#ffb547', dim: '#d39a52', accent: '#ffc861',
    idle: '#2b1f0d', heat: ['#6e4c14', '#b07a20', '#f0a534', '#ffe6b3'],
    glow: '#ffb547', glowA: 0.1, sheen: '#ffffff', sheenA: 0.04,
  },
  // Beige body, grey-green reflective LCD: darker means more.
  light: {
    body: '#cbc7b6', bodyEdge: '#8a8676', bodyHi: '#dcd9cb', screw: '#9a9686', bezel: '#2e2c25',
    lcd: '#aeb89a', lcdEdge: '#6f7862', ghost: '#9da88a', ghostDigit: '#a5b091',
    text: '#141a0e', dim: '#30382a', accent: '#0b0f06',
    idle: '#9da88a', heat: ['#78835f', '#4f5838', '#2c331b', '#0b0f06'],
    glow: '#e3ead2', glowA: 0.25, sheen: '#ffffff', sheenA: 0.3,
  },
  // Olive military body, green electroluminescent backlight.
  green: {
    body: '#262b20', bodyEdge: '#56604a', bodyHi: '#333a2b', screw: '#5d6751', bezel: '#c4ccb4',
    lcd: '#04140a', lcdEdge: '#1d4a2b', ghost: '#0d2a17', ghostDigit: '#092011',
    text: '#6dff9e', dim: '#4fcf7e', accent: '#a8ffc6',
    idle: '#0d2a17', heat: ['#1c6236', '#2f9d56', '#52d982', '#c4ffda'],
    glow: '#6dff9e', glowA: 0.11, sheen: '#ffffff', sheenA: 0.03,
  },
};

const f = (n: number): string => String(Math.round(n * 10) / 10);
const t = (cls: string, x: number, y: number, s: string): string =>
  `<text class="${cls}" x="${f(x)}" y="${f(y)}">${escapeXml(s)}</text>`;
/** Monospace width estimate. */
const tw = (s: string, size: number, ls = 0): number => s.length * size * (0.6 + ls);
const safeColor = (c: string): string => (/^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#7F8C8D');

/* ---------------------------- seven-segment ---------------------------- */
const SEGMAP: Record<string, string> = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd',
  6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '',
};
const SKEW = 0.07;
const pitchOf = (h: number): number => h * 0.7;
const segWidth = (n: number, h: number): number => n * pitchOf(h) - h * 0.2;

function digitPath(ch: string, X: number, Y: number, h: number): string {
  const w = h * 0.5, th = h * 0.13, t2 = th / 2, g = th * 0.2;
  const P = (pts: Array<[number, number]>) =>
    'M' + pts.map(([x, y]) => `${f(x + (Y + h - y) * SKEW)} ${f(y)}`).join('L') + 'Z';
  const hz = (yc: number) =>
    P([[X + t2 + g, yc], [X + th + g, yc - t2], [X + w - th - g, yc - t2], [X + w - t2 - g, yc], [X + w - th - g, yc + t2], [X + th + g, yc + t2]]);
  const vt = (xc: number, y0: number, y1: number) =>
    P([[xc, y0 + g], [xc + t2, y0 + t2 + g], [xc + t2, y1 - t2 - g], [xc, y1 - g], [xc - t2, y1 - t2 - g], [xc - t2, y0 + t2 + g]]);
  const seg: Record<string, () => string> = {
    a: () => hz(Y + t2), g: () => hz(Y + h / 2), d: () => hz(Y + h - t2),
    f: () => vt(X + t2, Y + t2, Y + h / 2), b: () => vt(X + w - t2, Y + t2, Y + h / 2),
    e: () => vt(X + t2, Y + h / 2, Y + h - t2), c: () => vt(X + w - t2, Y + h / 2, Y + h - t2),
  };
  return [...(SEGMAP[ch] ?? '')].map((k) => seg[k]?.() ?? '').join('');
}

/**
 * Seven-segment number right-aligned at xr. With `ghost`, faint unlit "8"s
 * sit behind it (a shared <path> in <defs> reused via <use>).
 */
function seg7(value: string, xr: number, y: number, h: number, cls: string, slots: number, ghost: boolean, defs: Map<string, string>): string {
  const n = ghost ? Math.max(slots, value.length) : value.length;
  const x0 = xr - segWidth(n, h);
  const p = pitchOf(h);
  let out = '';
  if (ghost) {
    const id = `e${Math.round(h * 10)}`;
    if (!defs.has(id)) defs.set(id, `<path id="${id}" d="${digitPath('8', 0, 0, h)}"/>`);
    for (let i = 0; i < n; i++) out += `<use href="#${id}" x="${f(x0 + i * p)}" y="${f(y)}"/>`;
    out = `<g class="gd">${out}</g>`;
  }
  const pad = value.padStart(n, ' ');
  let lit = '';
  for (let i = 0; i < n; i++) lit += digitPath(pad[i] ?? ' ', x0 + i * p, y, h);
  return `${out}<path class="${cls}" d="${lit}"/>`;
}

/* ------------------------------ core ------------------------------ */
const C = 300, STEP = 22, R = 270;

/** Cell symbols. `default` is a 3x3 LCD dot matrix, with level 4 fully lit. */
function shapeDefs(shape: CellShape): string {
  if (shape === 'default') {
    const d = 4.6, gap = (16 - 3 * d) / 2;
    let p = '';
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) p += `M${f(i * (d + gap))} ${f(j * (d + gap))}h${d}v${d}h-${d}z`;
    return `<path id="c" d="${p}"/><rect id="c4" width="16" height="16" rx="1"/>`;
  }
  if (shape === 'square') return '<rect id="c" width="16" height="16" rx="1.5"/>';
  if (shape === 'round') return '<rect id="c" width="16" height="16" rx="5"/>';
  if (shape === 'circle') return '<circle id="c" cx="8" cy="8" r="7.6"/>';
  return '<polygon id="c" points="8,0 14.9,4 14.9,12 8,16 1.1,12 1.1,4"/>';
}
const cellRef = (shape: CellShape, level: number): string => (shape === 'default' && level === 4 ? '#c4' : '#c');

interface Pos { cx: number; cy: number; dist: number }
function lattice(shape: CellShape): Pos[] {
  const out: Pos[] = [];
  for (let r = 0; r < 24; r++) {
    for (let c = 0; c < 24; c++) {
      const off = shape === 'hex' ? (r % 2 ? 5.5 : -5.5) : 0;
      const cx = C + (c - 11.5) * STEP + off, cy = C + (r - 11.5) * STEP;
      const dist = Math.hypot(cx - C, cy - C);
      if (dist <= R) out.push({ cx, cy, dist });
    }
  }
  out.sort((a, b) => a.dist - b.dist || a.cy - b.cy || a.cx - b.cx);
  return out;
}

/** Last 30 days against the busiest 30-day window, 0-100. */
function doseRate(input: StyleInput): number {
  const c = input.days.map((d) => d.count);
  if (!c.length) return 0;
  const W = Math.min(30, c.length);
  let sum = 0;
  for (let i = 0; i < W; i++) sum += c[i] ?? 0;
  const first = sum;
  let best = sum;
  for (let i = W; i < c.length; i++) {
    sum += (c[i] ?? 0) - (c[i - W] ?? 0);
    best = Math.max(best, sum);
  }
  return best > 0 ? Math.round((100 * first) / best) : 0;
}

interface Ctx {
  input: StyleInput;
  rate: number;
  /** Share of the top language (language mode ring / readout). */
  topPct: number;
  defs: Map<string, string>;
}

function trefoil(cx: number, cy: number, r: number): string {
  const r0 = r * 0.36;
  const pt = (a: number, rr: number) => `${f(cx + rr * Math.cos(a))} ${f(cy + rr * Math.sin(a))}`;
  let d = '';
  for (const base of [-90, 30, 150]) {
    const a0 = ((base - 30) * Math.PI) / 180, a1 = ((base + 30) * Math.PI) / 180;
    d += `M${pt(a0, r0)}L${pt(a0, r)}A${f(r)} ${f(r)} 0 0 1 ${pt(a1, r)}L${pt(a1, r0)}A${f(r0)} ${f(r0)} 0 0 0 ${pt(a0, r0)}Z`;
  }
  return `<g class="tk"><path class="ac" d="${d}"/><circle class="ac" cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.22)}"/></g>`;
}

function battery(xr: number, y: number): string {
  const x = xr - 30;
  let s = `<rect class="ow" x="${x}" y="${y}" width="26" height="14" rx="2"/><rect class="tx" x="${x + 26}" y="${y + 4}" width="3" height="6"/>`;
  for (let i = 0; i < 4; i++) s += `<rect class="${i < 3 ? 'tx' : 'gh'}" x="${f(x + 3 + i * 5.5)}" y="${y + 3}" width="4" height="8"/>`;
  return s;
}

function signal(xr: number, yb: number): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += `<rect class="${i < 3 ? 'tx' : 'gh'}" x="${xr - 26 + i * 7}" y="${yb - 5 - i * 3}" width="5" height="${5 + i * 3}"/>`;
  return s;
}

function drawCore(ctx: Ctx, standalone: boolean): string {
  const { input } = ctx;
  const shape = input.cell;
  const pos = lattice(shape);
  const n = pos.length;
  const cells = assignCells(input, n);
  const bands: string[][] = [[], [], [], [], [], []];
  let peakPos: Pos | null = null;
  pos.forEach((p, i) => {
    const cell = cells[i] ?? { kind: 'empty' as const };
    let cls = 'h0';
    let level = 0;
    if (cell.kind === 'day') {
      level = cell.day.level;
      cls = level ? `h${level} d${Math.floor(input.rng() * 6)}` : 'h0';
      if (!peakPos && input.summary.peak > 0 && cell.day.date === input.summary.peakDate) peakPos = p;
    } else if (cell.kind === 'lang') {
      cls = `g${Math.min(cell.langIndex, 7)} d${Math.floor(input.rng() * 6)}`;
    }
    const b = Math.min(5, Math.floor((p.dist / R) * 6));
    bands[b]?.push(`<use href="${cellRef(shape, level)}" x="${f(p.cx - 8)}" y="${f(p.cy - 8)}" class="${cls}"/>`);
  });

  const s: string[] = [];
  // Rate ring: 60 radial ticks; the lit share is the 30-day dose rate (or top-language share).
  const ringPct = input.mode === 'language' ? ctx.topPct : ctx.rate;
  const lit = Math.round((ringPct / 100) * 60);
  let on = '', off = '';
  for (let k = 0; k < 60; k++) {
    const a = ((k * 6 - 90) * Math.PI) / 180, co = Math.cos(a), sn = Math.sin(a);
    const seg = `M${f(C + 287 * co)} ${f(C + 287 * sn)}L${f(C + 295 * co)} ${f(C + 295 * sn)}`;
    if (k < lit) on += seg;
    else off += seg;
  }
  if (off) s.push(`<path class="rk" d="${off}"/>`);
  if (on) s.push(`<path class="rl" d="${on}"/>`);
  s.push(`<circle class="ln" cx="${C}" cy="${C}" r="282"/>`);
  s.push(bands.map((b, i) => `<g class="b${i}">${b.join('')}</g>`).join(''));

  if (peakPos) {
    const pp = peakPos as Pos;
    const X = pp.cx - 8, Y = pp.cy - 8;
    s.push(
      `<path class="rt" d="M${f(X - 4)} ${f(Y + 2)}V${f(Y - 4)}H${f(X + 2)}M${f(X + 14)} ${f(Y - 4)}H${f(X + 20)}V${f(Y + 2)}` +
        `M${f(X + 20)} ${f(Y + 14)}V${f(Y + 20)}H${f(X + 14)}M${f(X + 2)} ${f(Y + 20)}H${f(X - 4)}V${f(Y + 14)}"/>`,
    );
  }

  // Corner readouts stay outside r = 300.
  const sum = input.summary;
  if (standalone) s.push(trefoil(26, 27, 10), t('u tx', 44, 34, '@' + truncate(input.username, 9)));
  else s.push(t('l dm', 16, 30, 'DOSE MAP'));
  s.push(t('s dm', 16, 54, input.mode === 'language' ? `${n} CH` : `${n} CH \u00B7 ${sum.window} D`));
  const top = input.langs[0];
  if (input.mode === 'language') {
    s.push(t('s dm e', 584, 30, 'CORE'), t('v tx e', 584, 52, `${num(ctx.topPct)}%`));
  } else {
    s.push(t('s dm e', 584, 30, 'RATE 30D'), t('v tx e', 584, 52, `${ctx.rate}%`));
  }
  s.push(t('s dm', 16, 566, 'MODE'), t('v tx', 16, 588, input.mode.toUpperCase()));
  if (input.mode === 'language') {
    if (top) s.push(t('s dm e', 584, 566, 'FUEL'), t('v tx e', 584, 588, truncate(top.name, 10)));
  } else {
    for (let i = 0; i < 5; i++) {
      s.push(`<use href="${cellRef(shape, i)}" class="h${i}" transform="translate(${508 + i * 16} 548) scale(.75)"/>`);
    }
    s.push(t('s dm', 508, 588, 'LO'), t('s dm e', 584, 588, 'HI'));
  }
  return s.join('');
}

/* ------------------------------ panel ------------------------------ */
interface Block { h: number; draw: (x: number, y: number, w: number) => string }

function row(ctx: Ctx, label: string, value: number, unit: string): Block {
  return {
    h: 38,
    draw: (x, y, w) => {
      const uw = tw(unit, 15) + 6;
      return t('l dm', x, y + 27, label) + t('l tx e', x + w, y + 31, unit) +
        seg7(String(Math.round(value)), x + w - uw, y + 6, 26, 'sg', 4, false, ctx.defs);
    },
  };
}

/** Big seven-segment readout that shrinks to fit width. */
function big(ctx: Ctx, label: string, value: string, unit: string): Block {
  return {
    h: 100,
    draw: (x, y, w) => {
      const uw = tw(unit, 16) + 8;
      const n = Math.max(5, value.length);
      const h = Math.min(60, (w - uw) / (0.7 * n - 0.2));
      return t('l dm', x, y + 15, label) + t('v tx e', x + w, y + 86, unit) +
        seg7(value, x + w - uw, y + 26 + (60 - h), h, 'sa', 5, true, ctx.defs);
    },
  };
}

function rateBlock(ctx: Ctx): Block {
  return {
    h: 66,
    draw: (x, y, w) => {
      const nSeg = 20, gap = 3, sw = (w - gap * (nSeg - 1)) / nSeg, lit = Math.round(ctx.rate / 5);
      let on = '', off = '';
      for (let i = 0; i < nSeg; i++) {
        const r = `M${f(x + i * (sw + gap))} ${y + 25}h${f(sw)}v15h${f(-sw)}Z`;
        if (i < lit) on += r;
        else off += r;
      }
      return t('l dm', x, y + 15, 'RATE 30D') + t('v tx e', x + w, y + 16, `${ctx.rate}%`) +
        (off ? `<path class="gh" d="${off}"/>` : '') + (on ? `<path class="ac" d="${on}"/>` : '') +
        t('s dm', x, y + 58, '0') + t('s dm m', x + w / 2, y + 58, '50') + t('s dm e', x + w, y + 58, '100');
    },
  };
}

function langBlock(ctx: Ctx): Block {
  const langs = ctx.input.langs.slice(0, 8);
  return {
    h: 24 + 28 * langs.length,
    draw: (x, y, w) => {
      let s = t('l dm', x, y + 15, 'FUEL MIX');
      langs.forEach((l, i) => {
        const y0 = y + 24 + i * 28;
        const pct = `${num(l.pct)}%`;
        const maxName = Math.max(3, Math.floor((w - 18 - tw(pct, 15, 0.06) - 12) / 9.9));
        s += `<use href="#c" class="g${i}" transform="translate(${f(x)} ${y0 + 5}) scale(.7)"/>` +
          t('l tx', x + 18, y0 + 16, truncate(l.name, maxName)) + t('l tx e', x + w, y0 + 16, pct) +
          `<rect class="gh" x="${f(x + 18)}" y="${y0 + 21}" width="${f(w - 18)}" height="3"/>` +
          `<rect class="g${i}" x="${f(x + 18)}" y="${y0 + 21}" width="${f(Math.max(0, ((w - 18) * Math.min(100, l.pct)) / 100))}" height="3"/>`;
      });
      return s;
    },
  };
}

function blocksFor(ctx: Ctx, keys: StatKey[]): Block[] {
  const sum = ctx.input.summary;
  const out: Block[] = [];
  for (const k of keys) {
    if (k === 'total') {
      out.push(big(ctx, `TOTAL \u00B7 ${sum.window} D`, String(sum.total), 'CTS'));
      out.push(rateBlock(ctx)); // the bar-graph meter rides with the dose total
    } else if (k === 'active') out.push(row(ctx, 'ACTIVE', sum.active, 'D'));
    else if (k === 'idle') out.push(row(ctx, 'IDLE', sum.idle, 'D'));
    else if (k === 'peak') out.push(row(ctx, 'PEAK', sum.peak, 'CTS'));
    else if (k === 'streak') out.push(row(ctx, 'STREAK', sum.currentStreak, 'D'));
    else if (k === 'longest') out.push(row(ctx, 'LONGEST', sum.longestStreak, 'D'));
    else if (k === 'languages' && ctx.input.langs.length) {
      if (ctx.input.mode === 'language') {
        const top = ctx.input.langs[0];
        out.push(big(ctx, `CORE \u00B7 ${truncate(top?.name ?? '', 12).toUpperCase()}`, String(Math.round(ctx.topPct)), '%'));
      }
      out.push(langBlock(ctx));
    }
  }
  return out;
}

function drawPanel(ctx: Ctx, vertical: boolean): { W: number; H: number; svg: string } {
  const { input } = ctx;
  const W = vertical ? 290 : 600, H = vertical ? 600 : 290;
  const s: string[] = [];
  const maxU = Math.floor((W - 36 - 112) / 12);
  s.push(t('u tx', 18, 34, '@' + truncate(input.username, maxU)));
  s.push(trefoil(W - 104, 25, 9), signal(W - 54, 32), battery(W - 18, 18));
  let ax = 18;
  for (const m of ['commit', 'language', 'hybrid'] as const) {
    const label = m === 'language' ? 'LANG' : m.toUpperCase();
    const wd = tw(label, 14, 0.06);
    if (m === input.mode) s.push(`<rect class="ow" x="${f(ax - 5)}" y="45" width="${f(wd + 10)}" height="20" rx="3"/>`);
    s.push(t(`a ${m === input.mode ? 'tx' : 'dm'}`, ax, 60, label));
    ax += wd + 20;
  }
  s.push(`<path class="ln dsh" d="M14 74H${W - 14}"/>`);

  // Blocks flow into columns; anything that does not fit is dropped.
  const top = 82, bottom = H - 34, cols = vertical ? 1 : 2, gap = 28;
  const cw = (W - 36 - gap * (cols - 1)) / cols;
  let col = 0, y = top;
  for (const b of blocksFor(ctx, resolveStats(input))) {
    if (y + b.h > bottom) {
      if (y === top) continue; // taller than a whole column
      col++;
      y = top;
      if (col >= cols) break;
      if (y + b.h > bottom) continue;
    }
    s.push(b.draw(18 + col * (cw + gap), y, cw));
    y += b.h + 6;
  }
  if (!vertical && col > 0 && col < cols + 1) s.push(`<path class="ln dsh" d="M${f(18 + cw + gap / 2)} ${top}V${bottom}"/>`);
  s.push(`<path class="ln dsh" d="M14 ${H - 30}H${W - 14}"/>`);
  const foot = input.mode === 'language' ? `FUEL ${input.langs.length} CH` : `WINDOW ${input.summary.window} D`;
  s.push(t('s dm', 18, H - 11, foot), t('s dm e', W - 18, H - 11, 'STATUS NOMINAL'));
  return { W, H, svg: s.join('') };
}

/* ------------------------------ body ------------------------------ */
interface Glass { x: number; y: number; w: number; h: number }

function drawBody(W: number, H: number, g: Glass, divider: string | null): string {
  const s: string[] = [];
  s.push(`<rect class="bd" x="1" y="1" width="${W - 2}" height="${H - 2}" rx="26"/>`);
  s.push(`<rect class="hi" x="8" y="6" width="${W - 16}" height="4" rx="2"/>`);
  for (const x of [20, W - 20]) {
    s.push(`<circle class="sc" cx="${x}" cy="20" r="6"/><path class="sl" d="M${x - 4} ${x < W / 2 ? 23 : 17}L${x + 4} ${x < W / 2 ? 17 : 23}"/>`);
  }
  s.push(t('k bz', 34, 25, '\u0414\u041E\u0417\u0418\u041C\u0415\u0422\u0420 \u0414\u0420\u0411-01'));
  if (W >= 600) {
    s.push(t('k bz e', W - 34, 25, 'markdown-RBMK'));
    let gr = '';
    for (let i = 0; i < 7; i++) gr += `M${f(W / 2 - 27 + i * 9)} 13V27`;
    s.push(`<path class="gr" d="${gr}"/>`);
  }
  const names = ['\u0420\u0415\u0416\u0418\u041C', '\u041F\u041E\u0414\u0421\u0412.', '\u0421\u0411\u0420\u041E\u0421'];
  const bw = 88, bg = 12, bx = W / 2 - (3 * bw + 2 * bg) / 2;
  names.forEach((nm, i) => {
    const x = bx + i * (bw + bg);
    s.push(`<rect class="bn" x="${f(x)}" y="${H - 31}" width="${bw}" height="22" rx="11"/>`, t('bt bz m', x + bw / 2, H - 15.5, nm));
  });
  s.push(`<rect class="lcd" x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="10"/>`);
  s.push(`<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="10" fill="url(#bl)"/>`);
  if (divider) s.push(`<path class="ln dsh" d="${divider}"/>`);
  return s.join('');
}

function css(P: Palette, input: StyleInput): string {
  let c =
    `text{font-family:${MONO}}` +
    `.u{font-size:20px;font-weight:700}.l{font-size:15px;letter-spacing:.06em}.v{font-size:16px;font-weight:700}` +
    `.s{font-size:13px;letter-spacing:.04em}.a{font-size:14px;letter-spacing:.06em;font-weight:700}` +
    `.k{font-size:13px;font-weight:700;letter-spacing:.2em}.bt{font-size:12px;letter-spacing:.08em}` +
    `.e{text-anchor:end}.m{text-anchor:middle}` +
    `.bd{fill:${P.body};stroke:${P.bodyEdge};stroke-width:2}.hi{fill:${P.bodyHi}}.bn{fill:${P.bodyHi};stroke:${P.bodyEdge}}` +
    `.sc{fill:${P.screw}}.sl{stroke:${P.body};stroke-width:1.5}.gr{stroke:${P.bodyEdge};stroke-width:3;stroke-linecap:round}.bz{fill:${P.bezel}}` +
    `.lcd{fill:${P.lcd};stroke:${P.lcdEdge};stroke-width:2}.ln{fill:none;stroke:${P.lcdEdge}}.dsh{stroke-dasharray:3 5}` +
    `.tx,.sg{fill:${P.text}}.dm{fill:${P.dim}}.ac,.sa{fill:${P.accent}}.gh{fill:${P.ghost}}.gd{fill:${P.ghostDigit}}` +
    `.ow{fill:none;stroke:${P.text};stroke-width:1.5}.rt{fill:none;stroke:${P.accent};stroke-width:2}` +
    `.rk,.rl{stroke-width:3.5}.rk{stroke:${P.ghost}}.rl{stroke:${P.accent}}` +
    `.gs{stop-color:${P.glow}}.ge{stop-color:${P.glow}}.ss{stop-color:${P.sheen}}.se{stop-color:${P.sheen}}` +
    `.h0{fill:${P.idle}}` +
    P.heat.map((h, i) => `.h${i + 1}{fill:${h}}`).join('') +
    input.langs.slice(0, 8).map((l, i) => `.g${i}{fill:${safeColor(l.color)}}`).join('');
  if (input.animate) {
    // Base opacity is always 1: with animation off the frame is complete.
    c +=
      `@keyframes pw{from{opacity:.12}}@keyframes fx{50%{opacity:.62}}@keyframes tk{0%,70%{opacity:1}85%{opacity:.35}}` +
      `.b0,.b1,.b2,.b3,.b4,.b5{animation:pw .7s ease-out backwards}` +
      [0, 0.2, 0.4, 0.6, 0.8, 1].map((d, i) => `.b${i}{animation-delay:${d}s}`).join('') +
      `.pp{animation:pw .9s ease-out 1.1s backwards}` +
      ([[5.2, 0], [6.1, -1.4], [4.6, -2.2], [7, -3.3], [5.7, -4.1], [6.6, -5.2]] as const)
        .map(([d, dl], i) => `.d${i}{animation:fx ${d}s ease-in-out ${dl}s infinite}`)
        .join('') +
      `.tk{animation:tk 2.4s ease-in-out infinite}` +
      REDUCED_MOTION_CSS;
  }
  return c;
}

/* ------------------------------ assembly ------------------------------ */
const SIDE = 18, TOP = 40, BOT = 40;

export function render(input: StyleInput): string {
  const base = PRESETS[input.preset] ?? (PRESETS.dark as Palette);
  const P: Palette = {
    ...base,
    ...(input.accent ? { accent: input.accent } : {}),
    ...(input.heat ? { idle: input.heat[0], heat: [input.heat[1], input.heat[2], input.heat[3], input.heat[4]] } : {}),
  };
  const ctx: Ctx = { input, rate: doseRate(input), topPct: input.langs[0]?.pct ?? 0, defs: new Map() };

  let W: number, H: number, glass: Glass, divider: string | null = null, inner: string;
  if (input.view === 'core') {
    W = H = 680;
    glass = { x: 40, y: TOP, w: 600, h: 600 };
    inner = `<g transform="translate(40 ${TOP})">${drawCore(ctx, true)}</g>`;
  } else if (input.view === 'panel') {
    const p = drawPanel(ctx, input.panel === 'right');
    W = p.W + 2 * SIDE;
    H = p.H + TOP + BOT;
    glass = { x: SIDE, y: TOP, w: p.W, h: p.H };
    inner = `<g class="pp" transform="translate(${SIDE} ${TOP})">${p.svg}</g>`;
  } else {
    const right = input.panel === 'right';
    const core = `<g transform="translate(${SIDE} ${TOP})">${drawCore(ctx, false)}</g>`;
    const p = drawPanel(ctx, right);
    if (right) {
      W = SIDE * 2 + 600 + p.W;
      H = TOP + 600 + BOT;
      glass = { x: SIDE, y: TOP, w: 600 + p.W, h: 600 };
      divider = `M${SIDE + 600} ${TOP + 14}V${TOP + 586}`;
      inner = core + `<g class="pp" transform="translate(${SIDE + 600} ${TOP})">${p.svg}</g>`;
    } else {
      W = SIDE * 2 + 600;
      H = TOP + 600 + p.H + BOT;
      glass = { x: SIDE, y: TOP, w: 600, h: 600 + p.H };
      divider = `M${SIDE + 14} ${TOP + 600}H${SIDE + 586}`;
      inner = core + `<g class="pp" transform="translate(${SIDE} ${TOP + 600})">${p.svg}</g>`;
    }
  }

  const sum = input.summary;
  const title = `markdown-RBMK \u00B7 dosimeter style \u00B7 @${input.username} (${input.mode} mode)`;
  const parts: string[] = [];
  if (input.mode !== 'language') {
    parts.push(
      `${grouped(sum.total)} (${sum.total}) contributions over ${sum.window} days, ${sum.active} active days, peak ${sum.peak} per day, ` +
        `current streak ${sum.currentStreak} days, longest ${sum.longestStreak} days, 30-day rate ${ctx.rate}% of record`,
    );
  }
  if (input.mode !== 'commit' && input.langs.length) {
    parts.push('languages: ' + input.langs.map((l) => `${l.name} ${num(l.pct)}%`).join(', '));
  }
  const desc = parts.join('; ') + '.';
  const sheen = `<rect x="${glass.x + 3}" y="${glass.y + 3}" width="${glass.w - 6}" height="${glass.h - 6}" rx="8" fill="url(#sh)"/>`;
  const body = drawBody(W, H, glass, divider) + inner + sheen;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">` +
    `<title>${escapeXml(title)}</title><desc>${escapeXml(desc)}</desc>` +
    `<style>${css(P, input)}</style>` +
    `<defs>${shapeDefs(input.cell)}${[...ctx.defs.values()].join('')}` +
    `<radialGradient id="bl" cx=".35" cy=".4" r=".8"><stop offset="0" class="gs" stop-opacity="${P.glowA}"/><stop offset="1" class="ge" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="sh" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" class="ss" stop-opacity="${P.sheenA}"/><stop offset=".45" class="se" stop-opacity="0"/></linearGradient></defs>` +
    body +
    `</svg>`
  );
}
