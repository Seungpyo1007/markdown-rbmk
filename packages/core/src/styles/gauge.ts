/**
 * Style `gauge` — analog control-room instrument.
 *
 * The core sits in a graduated tick bezel with an engraved nameplate; the
 * panel is a bolted instrument plate with a needle dial (total), segmented
 * bar meters (counters), a fuel-mix readout (languages) and a heat legend.
 * Pure string building; colours are emitted once as CSS classes.
 */
import {
  assignCells,
  escapeXml,
  grouped,
  MONO,
  num,
  REDUCED_MOTION_CSS,
  resolveStats,
  truncate,
} from './shared';
import type { CellShape, StatKey, StyleInput } from './types';

interface Palette {
  text: string;
  dim: string;
  accent: string;
  frame: string;
  faint: string;
  glow: string;
  idle: string;
  heat: readonly [string, string, string, string];
}

/**
 * Presets. Text/dim/accent are the only text colours; all >= 4.5:1 against
 * the page they target (#0d1117 for dark/cherenkov, #ffffff for light).
 * The SVG background itself stays transparent.
 */
const PRESETS: Record<string, Palette> = {
  dark: {
    text: '#d2eadb',
    dim: '#8fb39c',
    accent: '#3ddc84',
    frame: '#2c5a3d',
    faint: '#173323',
    glow: '#0f5a2c',
    idle: '#15301f',
    heat: ['#2ecc71', '#f1c40f', '#e67e22', '#e74c3c'],
  },
  light: {
    text: '#16301f',
    dim: '#4a6655',
    accent: '#137a45',
    frame: '#9dbba8',
    faint: '#dbe8df',
    glow: '#bfe8cc',
    idle: '#e3eee6',
    heat: ['#3fbf6f', '#e8b90c', '#e67e22', '#d9412f'],
  },
  cherenkov: {
    text: '#d6ecff',
    dim: '#8db3d9',
    accent: '#4cc3ff',
    frame: '#244a73',
    faint: '#132a44',
    glow: '#0d4a8a',
    idle: '#12243a',
    heat: ['#1f5fa8', '#2f8ee8', '#6cc4ff', '#e6f7ff'],
  },
};

function palette(input: StyleInput): Palette {
  const base = PRESETS[input.preset] ?? (PRESETS.dark as Palette);
  const h = input.heat;
  return {
    ...base,
    accent: input.accent ?? base.accent,
    idle: h ? h[0] : base.idle,
    heat: h ? [h[1], h[2], h[3], h[4]] : base.heat,
  };
}

// ───────────────────────── helpers ─────────────────────────

const r2 = (v: number): string => num(v);
const rad = (a: number): number => (a * Math.PI) / 180;

interface TextOpts {
  anchor?: 'start' | 'middle' | 'end';
  weight?: number;
  ls?: number;
}

/** A text element; `s` is escaped here, callers pass raw strings. */
function txt(x: number, y: number, s: string, size: number, cls: string, o: TextOpts = {}): string {
  return (
    `<text x="${r2(x)}" y="${r2(y)}" font-size="${size}"` +
    (o.weight ? ` font-weight="${o.weight}"` : '') +
    (o.anchor && o.anchor !== 'start' ? ` text-anchor="${o.anchor}"` : '') +
    (o.ls ? ` letter-spacing="${o.ls}"` : '') +
    ` class="${cls}">${escapeXml(s)}</text>`
  );
}

/** Arc path (screen degrees, clockwise). */
function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number) => `${r2(cx + r * Math.cos(rad(a)))} ${r2(cy + r * Math.sin(rad(a)))}`;
  return `M${p(a0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}`;
}

/** A round "rated" maximum a bit above v. */
function niceMax(v: number): number {
  const t = Math.max(1, v * 1.15);
  const k = 10 ** Math.floor(Math.log10(t));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) if (m * k >= t) return m * k;
  return 10 * k;
}

/** Cell symbol centred on 0,0 with nominal size s. */
function shapeDef(id: string, shape: CellShape, s: number): string {
  const h = s / 2;
  if (shape === 'circle') return `<circle id="${id}" r="${r2(h * 1.06)}"/>`;
  if (shape === 'hex') {
    const R = s * 0.62;
    const w = r2((R * Math.sqrt(3)) / 2);
    const q = r2(R / 2);
    return `<path id="${id}" d="M0 ${r2(-R)}l${w} ${q}v${r2(R)}l-${w} ${q}l-${w} -${q}v-${r2(R)}z"/>`;
  }
  const rx = shape === 'round' ? s * 0.28 : shape === 'square' ? 0 : s * 0.06;
  return `<rect id="${id}" x="${-h}" y="${-h}" width="${s}" height="${s}"${rx ? ` rx="${r2(rx)}"` : ''}/>`;
}

const use = (id: string, x: number, y: number, cls: string): string =>
  `<use href="#${id}" x="${r2(x)}" y="${r2(y)}" class="${cls}"/>`;

// ───────────────────────── core (local 660×660, centre 330) ─────────────────────────

const CS = 660;
const C = 330;
const STEP = 22;
const GRID = 24;
const MASK = 270;
const ORIGIN = C - 8 - ((GRID - 1) / 2) * STEP;

interface Pos {
  cx: number;
  cy: number;
  d: number;
}

/** Lattice positions, centre-out. Hex rows are offset ±¼ step (honeycomb). */
function positions(hex: boolean): Pos[] {
  const out: Pos[] = [];
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const off = hex ? (j % 2 ? STEP / 4 : -STEP / 4) : 0;
      const cx = ORIGIN + STEP * i + 8 + off;
      const cy = ORIGIN + STEP * j + 8;
      const d = Math.hypot(cx - C, cy - C);
      if (d <= MASK) out.push({ cx, cy, d });
    }
  }
  return out.sort((a, b) => a.d - b.d || a.cx - b.cx || a.cy - b.cy);
}

function core(input: StyleInput): string {
  const pos = positions(input.cell === 'hex');
  const cells = assignCells(input, pos.length);
  const maxD = pos[pos.length - 1]?.d ?? 1;
  const bands: string[][] = Array.from({ length: 6 }, () => []);
  const phase = () => (input.animate ? ` f${Math.floor(input.rng() * 6)}` : '');
  const hybrid = input.mode === 'hybrid';

  pos.forEach((p, i) => {
    const c = cells[i] ?? { kind: 'empty' as const };
    const b = Math.min(5, Math.floor((p.d / maxD) * 6));
    let out: string;
    if (c.kind === 'day') {
      const L = c.day.level;
      out = use('gc', p.cx, p.cy, L > 0 ? `h${L}${phase()}` : 'h0');
    } else if (c.kind === 'lang') {
      // Hybrid: the language rim is drawn smaller and dimmer and never
      // flickers, so it reads as a frame around the heat core, not noise.
      out = hybrid ? use('gr', p.cx, p.cy, `l${c.langIndex} rm`) : use('gc', p.cx, p.cy, `l${c.langIndex}${phase()}`);
    } else {
      out = use('gc', p.cx, p.cy, 'fa');
    }
    bands[b]!.push(out);
  });

  // Graduated bezel: minor 3°, mid 15°, major 30°; bottom gap for the nameplate.
  let minor = '';
  let major = '';
  for (let k = 0; k < 120; k++) {
    const a = k * 3;
    if (a > 54 && a < 126) continue;
    const cos = Math.cos(rad(a));
    const sin = Math.sin(rad(a));
    const isMaj = k % 10 === 0;
    const rr = isMaj ? 309 : k % 5 === 0 ? 304 : 299;
    const seg = `M${r2(C + 293 * cos)} ${r2(C + 293 * sin)}L${r2(C + rr * cos)} ${r2(C + rr * sin)}`;
    if (isMaj) major += seg;
    else minor += seg;
  }
  const idx = [-90, 0, 180]
    .map((a) => {
      const cos = Math.cos(rad(a));
      const sin = Math.sin(rad(a));
      const bx = C + 327 * cos;
      const by = C + 327 * sin;
      return `M${r2(C + 317 * cos)} ${r2(C + 317 * sin)}L${r2(bx - 5 * sin)} ${r2(by + 5 * cos)}L${r2(bx + 5 * sin)} ${r2(by - 5 * cos)}z`;
    })
    .join('');
  const np =
    `M${r2(C + 302 * Math.cos(rad(126)))} ${r2(C + 302 * Math.sin(rad(126)))}` +
    `A302 302 0 0 0 ${r2(C + 302 * Math.cos(rad(54)))} ${r2(C + 302 * Math.sin(rad(54)))}`;
  const plate = `RBMK · @${truncate(input.username, 16)} · ${input.mode.toUpperCase()}`;

  return [
    `<defs><radialGradient id="gl"><stop offset="0" class="g0" stop-opacity=".55"/>`,
    `<stop offset=".65" class="g0" stop-opacity=".18"/><stop offset="1" class="g0" stop-opacity=".01"/></radialGradient>`,
    `<path id="np" d="${np}"/></defs>`,
    `<g class="p"><circle cx="${C}" cy="${C}" r="288" fill="url(#gl)"${input.animate ? ' class="f0"' : ''}/>`,
    `<circle cx="${C}" cy="${C}" r="289" class="fr"/><circle cx="${C}" cy="${C}" r="313" class="fr" stroke-width="2"/>`,
    `<path d="${minor}" class="tk"/><path d="${major}" class="tj" stroke-width="2"/><path d="${idx}" class="a"/>`,
    `<circle cx="${C}" cy="${C}" r="296" class="sa${input.animate ? ' sw' : ''}" stroke-width="3" stroke-dasharray="90 1770" opacity=".55"/>`,
    `<text font-size="11" letter-spacing="2" class="m"><textPath href="#np" startOffset="50%" text-anchor="middle">${escapeXml(plate)}</textPath></text></g>`,
    ...bands.map((b, i) => `<g class="p p${i}">${b.join('')}</g>`),
  ].join('');
}

// ───────────────────────── panel modules ─────────────────────────

interface Module {
  h: number;
  draw(x: number, y: number, w: number): string;
}

type Counter = Exclude<StatKey, 'total' | 'languages'>;

function counter(input: StyleInput, id: Counter): { label: string; v: number; unit: string; max: number } {
  const s = input.summary;
  switch (id) {
    case 'active':
      return { label: 'ACTIVE DAYS', v: s.active, unit: 'd', max: Math.max(1, s.window) };
    case 'idle':
      return { label: 'IDLE DAYS', v: s.idle, unit: 'd', max: Math.max(1, s.window) };
    case 'peak':
      return { label: 'PEAK / DAY', v: s.peak, unit: '', max: niceMax(s.peak) };
    case 'streak':
      return { label: 'CURRENT STREAK', v: s.currentStreak, unit: 'd', max: Math.max(1, s.longestStreak) };
    case 'longest':
      return { label: 'LONGEST STREAK', v: s.longestStreak, unit: 'd', max: niceMax(s.longestStreak) };
  }
}

function modTotal(input: StyleInput): Module {
  const total = input.summary.total;
  const max = niceMax(total);
  const frac = Math.min(1, total / max);
  return {
    h: 138,
    draw(x, y) {
      const cx = x + 66;
      const cy = y + 72;
      const R = 58;
      const A0 = 150;
      const SW = 240;
      const va = A0 + SW * frac;
      let mi = '';
      let ma = '';
      for (let k = 0; k <= 24; k++) {
        const a = rad(A0 + k * 10);
        const c = Math.cos(a);
        const s = Math.sin(a);
        const big = k % 6 === 0;
        const r1 = R - (big ? 19 : 14);
        const seg = `M${r2(cx + (R - 9) * c)} ${r2(cy + (R - 9) * s)}L${r2(cx + r1 * c)} ${r2(cy + r1 * s)}`;
        if (big) ma += seg;
        else mi += seg;
      }
      const end = (a: number): [number, number] => [cx + R * Math.cos(rad(a)), cy + R * Math.sin(rad(a)) + 22];
      const [lx, ly] = end(A0);
      const [hx, hy] = end(A0 + SW);
      const tx = x + 148;
      const needle = `<path d="M${cx - 10} ${cy}H${cx + R - 8}" class="st" stroke-width="2.5" stroke-linecap="round"/>`;
      return [
        `<path d="${arc(cx, cy, R, A0, A0 + SW)}" class="sf" stroke-width="6"/>`,
        frac > 0 ? `<path d="${arc(cx, cy, R, A0, va)}" class="sa" stroke-width="6"/>` : '',
        `<path d="${arc(cx, cy, R + 7, A0 + SW * 0.8, A0 + SW)}" class="rl" stroke-width="2.5"/>`,
        `<path d="${mi}" class="tk"/><path d="${ma}" class="tj" stroke-width="2"/>`,
        txt(lx, ly, '0', 12, 'm', { anchor: 'middle' }),
        txt(hx, hy, grouped(max), 12, 'm', { anchor: 'middle' }),
        txt(cx, cy + 32, `${Math.round(frac * 100)}%`, 13, 't', { anchor: 'middle', weight: 700 }),
        `<g transform="rotate(${r2(va)} ${cx} ${cy})">`,
        input.animate
          ? `<g class="nd" style="--a:${r2(A0 - va)}deg"><circle cx="${cx}" cy="${cy}" r="${R - 6}" fill="none"/>${needle}</g>`
          : needle,
        `</g><circle cx="${cx}" cy="${cy}" r="5.5" class="a"/>`,
        txt(tx, y + 60, grouped(total), 32, 't', { weight: 700 }),
        txt(tx, y + 82, 'CONTRIBUTIONS', 13, 'm', { weight: 600, ls: 0.5 }),
        txt(tx, y + 102, `LAST ${input.summary.window} DAYS`, 12, 'm'),
        txt(tx, y + 120, `RATED ${grouped(max)}`, 12, 'm'),
      ].join('');
    },
  };
}

function modTiles(input: StyleInput, ids: Counter[]): Module {
  const rows = Math.ceil(ids.length / 2);
  const TH = 66;
  const G = 10;
  const gw = input.animate ? ' gw' : '';
  return {
    h: rows * TH + (rows - 1) * G,
    draw(x, y, w) {
      const tw = (w - G) / 2;
      const out: string[] = [];
      ids.forEach((id, i) => {
        const s = counter(input, id);
        const tx = x + (i % 2) * (tw + G);
        const ty = y + Math.floor(i / 2) * (TH + G);
        const segs = 12;
        const sg = 2;
        const sw = (tw - 20 - (segs - 1) * sg) / segs;
        const lit = s.v > 0 ? Math.min(segs, Math.max(1, Math.round((s.v / s.max) * segs))) : 0;
        let on = '';
        let off = '';
        for (let k = 0; k < segs; k++) {
          const r = `<rect x="${r2(tx + 10 + k * (sw + sg))}" y="${ty + 54}" width="${r2(sw)}" height="5"/>`;
          if (k < lit) on += r;
          else off += r;
        }
        const unit = s.unit ? `<tspan dx="3" font-size="13" font-weight="400" class="m">${s.unit}</tspan>` : '';
        out.push(
          `<rect x="${r2(tx)}" y="${ty}" width="${r2(tw)}" height="${TH}" rx="3" class="fr"/>`,
          txt(tx + 10, ty + 20, s.label, 13, 'm', { weight: 600 }),
          `<text x="${r2(tx + 10)}" y="${ty + 45}" font-size="24" font-weight="700" class="t">${grouped(s.v)}${unit}</text>`,
          txt(tx + tw - 10, ty + 45, `/${grouped(s.max)}`, 12, 'm', { anchor: 'end' }),
          off ? `<g class="fa">${off}</g>` : '',
          on ? `<g class="a${gw}">${on}</g>` : '',
        );
      });
      return out.join('');
    },
  };
}

function modLangs(input: StyleInput): Module {
  const langs = input.langs;
  const n = langs.length;
  const gw = input.animate ? ' gw' : '';
  const top = Math.max(0.01, langs[0]?.pct ?? 1);
  return {
    h: n ? 54 + (n - 1) * 24 + 6 : 34,
    draw(x, y, w) {
      const out = [txt(x, y + 14, 'FUEL MIX', 13, 'm', { weight: 600, ls: 0.5 })];
      if (!n) return out.join('');
      const sum = langs.reduce((a, l) => a + l.pct, 0) || 1;
      let bx = x;
      langs.forEach((l, i) => {
        const bw = (l.pct / sum) * w;
        if (bw > 2) out.push(`<rect x="${r2(bx)}" y="${y + 22}" width="${r2(bw - 2)}" height="10" class="l${i}"/>`);
        bx += bw;
      });
      const mx = x + 132;
      const mw = w - 132 - 64;
      langs.forEach((l, i) => {
        const ry = y + 58 + i * 24;
        out.push(
          use('gs', x + 6, ry - 5, `l${i}`),
          txt(x + 20, ry, truncate(l.name, 12), 14, 't'),
          `<rect x="${mx}" y="${ry - 7}" width="${r2(mw)}" height="4" class="fa"/>`,
          l.pct > 0 ? `<rect x="${mx}" y="${ry - 7}" width="${r2((mw * l.pct) / top)}" height="4" class="l${i}${gw}"/>` : '',
          txt(x + w, ry, `${num(l.pct)}%`, 14, 't', { anchor: 'end', weight: 700 }),
        );
      });
      return out.join('');
    },
  };
}

function modLegend(): Module {
  return {
    h: 30,
    draw(x, y) {
      const out = [txt(x, y + 20, 'CORE OUTPUT', 13, 'm', { weight: 600, ls: 0.5 }), txt(x + 108, y + 20, 'IDLE', 12, 'm')];
      for (let i = 0; i < 5; i++) out.push(use('gc', x + 152 + i * 22, y + 15, `h${i}`));
      out.push(txt(x + 152 + 4 * 22 + 14, y + 20, 'PEAK', 12, 'm'));
      return out.join('');
    },
  };
}

interface Panel {
  w: number;
  h: number;
  svg: string;
}

/** Instrument plate. `v` = one tall column (340 wide), `h` = two-column strip (660). */
function panel(input: StyleInput, layout: 'v' | 'h'): Panel {
  const W = layout === 'v' ? 340 : 660;
  const PAD = 18;
  const GAP = 14;
  const HDR = 52;
  const CG = 18;
  const ids = resolveStats(input);

  const mods: Module[] = [];
  if (ids.includes('total')) mods.push(modTotal(input));
  const tiles = ids.filter((id): id is Counter => id !== 'total' && id !== 'languages');
  if (tiles.length) mods.push(modTiles(input, tiles));
  if (ids.includes('languages')) mods.push(modLangs(input));
  if (input.mode !== 'language') mods.push(modLegend());

  // A lone module (e.g. language mode's fuel mix) spans the whole strip.
  const cols = layout === 'v' || mods.length < 2 ? 1 : 2;
  const cw = (W - 2 * PAD - (cols - 1) * CG) / cols;

  // Masonry: each module goes into the currently shortest column, so the
  // plate grows to fit and nothing overlaps.
  const colY: number[] = Array.from({ length: cols }, () => PAD + HDR + GAP);
  const body: string[] = [];
  for (const m of mods) {
    const c = colY.indexOf(Math.min(...colY));
    body.push(m.draw(PAD + c * (cw + CG), colY[c]!, cw));
    colY[c]! += m.h + GAP;
  }
  const H = Math.max(PAD + HDR + GAP, Math.max(...colY) - GAP + PAD);
  const screws = [
    [10, 10],
    [W - 10, 10],
    [10, H - 10],
    [W - 10, H - 10],
  ]
    .map(([sx, sy]) => `<circle cx="${sx}" cy="${sy}" r="3" class="fr"/><path d="M${sx! - 2} ${sy! + 2}L${sx! + 2} ${sy! - 2}" class="tk"/>`)
    .join('');
  const maxName = Math.floor((W - 2 * PAD - 96) / 10.2);
  const stamp = input.summary.latestDate || 'RBMK-1000';
  const svg = [
    `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="8" class="fr" stroke-width="1.5"/>`,
    screws,
    txt(PAD, PAD + 20, `@${truncate(input.username, maxName)}`, 17, 't', { weight: 700 }),
    txt(PAD, PAD + 40, `REACTOR CORE · ${input.mode.toUpperCase()}`, 12, 'm', { ls: 0.5 }),
    `<circle cx="${W - PAD - 62}" cy="${PAD + 14}" r="4.5" class="a${input.animate ? ' f0' : ''}"/>`,
    txt(W - PAD, PAD + 19, 'ONLINE', 12, 'a', { anchor: 'end', weight: 700, ls: 1 }),
    txt(W - PAD, PAD + 40, stamp, 12, 'm', { anchor: 'end' }),
    `<path d="M${PAD} ${PAD + HDR}H${W - PAD}" class="tk"/>`,
    ...body,
  ].join('');
  return { w: W, h: H, svg };
}

// ───────────────────────── style + document ─────────────────────────

function css(input: StyleInput, P: Palette): string {
  const h = P.heat;
  let s =
    `.t{fill:${P.text}}.m{fill:${P.dim}}.a{fill:${P.accent}}.fa{fill:${P.faint}}` +
    `.fr,.tk,.tj,.sa,.sf,.st,.rl{fill:none}.fr,.tk{stroke:${P.frame}}.tj{stroke:${P.dim}}` +
    `.sa{stroke:${P.accent}}.sf{stroke:${P.faint}}.st{stroke:${P.text}}.rl{stroke:${h[3]}}.g0{stop-color:${P.glow}}` +
    `.h0{fill:${P.idle}}` +
    h.map((c, i) => `.h${i + 1}{fill:${c}}`).join('') +
    input.langs.map((l, i) => `.l${i}{fill:${l.color}}`).join('') +
    '.rm{opacity:.6}';
  if (input.animate) {
    s +=
      '@keyframes on{from{opacity:.08}}@keyframes flux{50%{opacity:.55}}' +
      '@keyframes spin{to{transform:rotate(360deg)}}@keyframes nd{from{transform:rotate(var(--a))}}' +
      '@keyframes gw{from{transform:scaleX(.02)}}' +
      '.p{animation:on .6s ease-out backwards}' +
      [1, 2, 3, 4, 5].map((i) => `.p${i}{animation-delay:${r2(i * 0.18)}s}`).join('') +
      '.f0,.f1,.f2,.f3,.f4,.f5{animation:flux 6s ease-in-out infinite}' +
      [1, 2, 3, 4, 5].map((i) => `.f${i}{animation-delay:-${i}s}`).join('') +
      '.sw,.nd{transform-box:fill-box;transform-origin:center}.sw{animation:spin 40s linear infinite}' +
      '.nd{animation:nd 1.6s cubic-bezier(.3,1.3,.5,1) var(--pd) backwards}' +
      '.gw{transform-box:fill-box;transform-origin:left;animation:gw 1s ease-out var(--pd) backwards}' +
      '.pp{animation:on .7s ease-out var(--pd) backwards}' +
      REDUCED_MOTION_CSS;
  }
  return `<style>${s}</style>`;
}

function describe(input: StyleInput): string {
  const s = input.summary;
  const langs = input.langs.map((l) => `${l.name} ${num(l.pct)}%`).join(', ');
  const commit =
    `${grouped(s.total)} contributions over ${s.window} days; ${s.active} active days; peak ${s.peak} per day; ` +
    `current streak ${s.currentStreak} days; longest streak ${s.longestStreak} days.`;
  if (input.mode === 'language') return `Top languages: ${langs}.`;
  return input.mode === 'commit' ? commit : `${commit} Top languages: ${langs}.`;
}

export function render(input: StyleInput): string {
  const P = palette(input);
  const shape: CellShape = input.cell;
  let W: number;
  let H: number;
  let body: string;
  const pd = input.view === 'panel' ? 0.1 : 1.1; // panel power-up delay (after the core ripple)

  if (input.view === 'core') {
    W = H = CS;
    body = core(input);
  } else if (input.view === 'panel') {
    const p = panel(input, input.panel === 'right' ? 'v' : 'h');
    W = p.w;
    H = p.h;
    body = `<g class="pp">${p.svg}</g>`;
  } else if (input.panel === 'bottom') {
    const p = panel(input, 'h');
    W = CS;
    H = CS + 16 + p.h;
    body = core(input) + `<g class="pp" transform="translate(0 ${CS + 16})">${p.svg}</g>`;
  } else {
    const p = panel(input, 'v');
    const cs = Math.max(560, Math.min(CS, p.h));
    const s = cs / CS;
    W = cs + 16 + p.w;
    H = Math.max(cs, p.h);
    body =
      `<g transform="translate(0 ${r2((H - cs) / 2)}) scale(${r2(s)})">${core(input)}</g>` +
      `<g class="pp" transform="translate(${r2(cs + 16)} ${r2((H - p.h) / 2)})">${p.svg}</g>`;
  }
  W = Math.round(W);
  H = Math.round(H);

  // Shared cell symbols: core cell (16), hybrid rim cell (12), swatch (12).
  const defs =
    `<defs>${shapeDef('gc', shape, 16)}${shapeDef('gr', shape, 12)}` +
    `${shapeDef('gs', shape === 'default' ? 'square' : shape, 12)}</defs>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" font-family="${MONO}"` +
    (input.animate ? ` style="--pd:${pd}s"` : '') +
    '>' +
    `<title>markdown-RBMK gauge: @${escapeXml(input.username)} (${input.mode} mode)</title>` +
    `<desc>${escapeXml(describe(input))}</desc>` +
    css(input, P) +
    defs +
    body +
    '</svg>'
  );
}
