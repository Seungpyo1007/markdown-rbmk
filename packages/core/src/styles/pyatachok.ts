/**
 * Style `pyatachok` — the upper biological shield of an RBMK seen from above.
 * A disc of tightly packed steel channel caps, each carrying a coloured core
 * (day heat or language), with a bevelled, bolted rim and a riveted name tag.
 * The panel is a riveted stamped-steel plate with a stencilled header band,
 * engraved labels and recessed readout slots.
 *
 * Size notes: the steel caps are not emitted per cell. They are painted by a
 * 22 px cap pattern filling one rectangle per lattice row, so only the
 * coloured cores cost a `<use>` each.
 */
import { MONO, REDUCED_MOTION_CSS, assignCells, escapeXml, grouped, num, resolveStats, truncate } from './shared';
import type { CellShape, StatKey, StyleInput } from './types';

interface Palette {
  plate: [string, string, string];
  edge: string;
  hi: string;
  emb: string;
  floor: string;
  cap: [string, string, string];
  capEdge: string;
  text: string;
  dim: string;
  slot: string;
  slotText: string;
  slotDim: string;
  accent: string;
  mark: string;
  idle: string;
  heat: [string, string, string, string];
}

const PRESETS: Record<string, Palette> = {
  // Gunmetal steel (default)
  dark: {
    plate: ['#434b53', '#343a41', '#292e34'],
    edge: '#101316',
    hi: '#8d979f',
    emb: '#15181b',
    floor: '#111417',
    cap: ['#9aa3ab', '#5d666e', '#353b41'],
    capEdge: '#15181b',
    text: '#eef1f4',
    dim: '#c3cad1',
    slot: '#121518',
    slotText: '#f2f5f7',
    slotDim: '#a9b2ba',
    accent: '#ffb547',
    mark: '#ffb547',
    idle: '#1a1d21',
    heat: ['#1f7d64', '#3fc08a', '#f2c14e', '#ff5a36'],
  },
  // Galvanised light steel
  light: {
    plate: ['#e9ecef', '#d6dade', '#c5cbd0'],
    edge: '#59626b',
    hi: '#ffffff',
    emb: '#fbfcfd',
    floor: '#3a4148',
    cap: ['#fbfcfd', '#bcc3c9', '#8b949c'],
    capEdge: '#59626b',
    text: '#161b20',
    dim: '#3f4750',
    slot: '#22272c',
    slotText: '#f4f6f8',
    slotDim: '#b3bcc4',
    accent: '#ffb547',
    mark: '#c2410c',
    idle: '#4a525a',
    heat: ['#2f9e79', '#8cc63f', '#f0a93b', '#e0442a'],
  },
  // Weathered, oxidised hall steel
  oxide: {
    plate: ['#56473c', '#43372f', '#352c25'],
    edge: '#130f0c',
    hi: '#a88f7a',
    emb: '#17120e',
    floor: '#140f0c',
    cap: ['#a8927f', '#6d5a4b', '#3d322a'],
    capEdge: '#17120e',
    text: '#fbeee0',
    dim: '#e0cbb4',
    slot: '#18120e',
    slotText: '#ffeedd',
    slotDim: '#c7ae96',
    accent: '#ff9a4a',
    mark: '#ff9a4a',
    idle: '#221a15',
    heat: ['#6e4b2a', '#b5712f', '#eea542', '#ffe39a'],
  },
};

/* ------------------------------------------------------------------ */
/* Geometry: 24x24 lattice, step 22, centres 50+22i, mask r=270.       */
/* ------------------------------------------------------------------ */
const CORE = 600;
const C = 300;
const STEP = 22;
const MASK = 270;
const GAP = 14;
const R_FIELD = 284;
const R_RIM = 291;
const R_OUT = 298;

interface Pos {
  cx: number;
  cy: number;
  row: number;
  dist: number;
}

function lattice(hex: boolean): Pos[] {
  const out: Pos[] = [];
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 24; j++) {
      const off = hex ? (j % 2 ? 5.5 : -5.5) : 0;
      const cx = 50 + STEP * i + off;
      const cy = 50 + STEP * j;
      const dist = Math.hypot(cx - C, cy - C);
      if (dist <= MASK) out.push({ cx, cy, row: j, dist });
    }
  }
  out.sort((a, b) => a.dist - b.dist || a.cx - b.cx || a.cy - b.cy);
  return out;
}

/**
 * Cell shapes. `#p` = steel cap (own gradient fill), `#k` = coloured core with
 * a floor-coloured bore, `#K` = solid core for hot days (levels 3-4), so heat
 * reads clearly at small sizes. Core fill is inherited from the `<use>`.
 */
const SHAPES: Record<Exclude<CellShape, 'default'>, { cap: string; core: string; solid: string }> = {
  circle: {
    cap: '<circle id="p" r="10" fill="url(#cg)" class="ce"/>',
    core: '<g id="k"><circle r="7"/><circle r="2.1" class="ho"/></g>',
    solid: '<circle id="K" r="7"/>',
  },
  square: {
    cap: '<rect id="p" x="-10" y="-10" width="20" height="20" rx="2" fill="url(#cg)" class="ce"/>',
    core: '<g id="k"><rect x="-7" y="-7" width="14" height="14" rx="1.4"/><rect x="-2" y="-2" width="4" height="4" class="ho"/></g>',
    solid: '<rect id="K" x="-7" y="-7" width="14" height="14" rx="1.4"/>',
  },
  round: {
    cap: '<rect id="p" x="-10" y="-10" width="20" height="20" rx="6" fill="url(#cg)" class="ce"/>',
    core: '<g id="k"><rect x="-7" y="-7" width="14" height="14" rx="4"/><circle r="2.1" class="ho"/></g>',
    solid: '<rect id="K" x="-7" y="-7" width="14" height="14" rx="4"/>',
  },
  hex: {
    cap: '<polygon id="p" points="0,-10.6 9.18,-5.3 9.18,5.3 0,10.6 -9.18,5.3 -9.18,-5.3" fill="url(#cg)" class="ce"/>',
    core: '<g id="k"><polygon points="0,-7.4 6.41,-3.7 6.41,3.7 0,7.4 -6.41,3.7 -6.41,-3.7"/><circle r="2" class="ho"/></g>',
    solid: '<polygon id="K" points="0,-7.4 6.41,-3.7 6.41,3.7 0,7.4 -6.41,3.7 -6.41,-3.7"/>',
  },
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const f = (n: number): string => num(n);
const safeColor = (c: string): string => (/^#[0-9a-f]{3,8}$/i.test(c) ? c : '#7f8c8d');
/** Approximate monospace advance. */
const wT = (s: string, size: number, ls = 0): number => s.length * size * (0.6 + ls);
const tx = (cls: string, x: number, y: number, s: string, extra = ''): string =>
  `<text class="${cls}" x="${f(x)}" y="${f(y)}"${extra}>${escapeXml(s)}</text>`;
/** Stamped text: an offset copy in `emb` under the glyphs (embossed / engraved). */
const eng = (cls: string, size: string, x: number, y: number, s: string): string => {
  const anchor = cls
    .split(' ')
    .filter((c) => c === 'e' || c === 'm')
    .join(' ');
  return tx(`em ${size} ${anchor}`.trim(), x + 0.8, y + 1, s) + tx(`${cls} ${size}`, x, y, s);
};
const rivet = (x: number, y: number): string => `<use href="#rv" x="${f(x)}" y="${f(y)}"/>`;
/** A small cap + core, for the panel legend and language rows. */
const mini = (x: number, y: number, sc: number, cls: string, solid = false): string => {
  const tr = `translate(${f(x)} ${f(y)}) scale(${sc})`;
  return `<use href="#p" transform="${tr}"/><use href="#${solid ? 'K' : 'k'}" transform="${tr}" class="${cls}"/>`;
};
const groove = (x1: number, x2: number, y: number): string =>
  `<path d="M${f(x1)} ${f(y)}H${f(x2)}" class="ed"/><path d="M${f(x1)} ${f(y + 1)}H${f(x2)}" class="hl"/>`;
const slot = (x: number, y: number, w: number, h: number): string =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="3" class="sl"/>` +
  `<path d="M${f(x + 2)} ${f(y + h + 0.8)}H${f(x + w - 2)}" class="hl"/>`;
const polar = (a: number, r: number): [number, number] => [
  C + r * Math.cos((a * Math.PI) / 180),
  C + r * Math.sin((a * Math.PI) / 180),
];

/* ------------------------------------------------------------------ */
/* Panel type scale per orientation                                    */
/* ------------------------------------------------------------------ */
interface Sizes {
  lb: number; vl: number; bg: number; nm: number; pc: number; sm: number; pu: number; ps: number;
  fh: number; sh: number; th: number; lh: number; row: number; band: number; uy: number; nameMax: number;
}
const SIZES: Record<'v' | 'h', Sizes> = {
  v: { lb: 13, vl: 19, bg: 38, nm: 15, pc: 18, sm: 11, pu: 20, ps: 20, fh: 33, sh: 26, th: 84, lh: 66, row: 30, band: 34, uy: 80, nameMax: 11 },
  h: { lb: 12, vl: 16, bg: 32, nm: 14, pc: 15, sm: 11, pu: 18, ps: 18, fh: 30, sh: 23, th: 72, lh: 60, row: 22, band: 30, uy: 70, nameMax: 10 },
};

function css(P: Palette, langColors: string[], Z: Sizes | null, animate: boolean): string {
  const size = Z
    ? `.lb{font-size:${Z.lb}px;letter-spacing:.12em;font-weight:700}.vl{font-size:${Z.vl}px;font-weight:700}` +
      `.bg{font-size:${Z.bg}px;font-weight:700}.nm{font-size:${Z.nm}px}.pc{font-size:${Z.pc}px;font-weight:700}` +
      `.sm{font-size:${Z.sm}px;letter-spacing:.1em}.pu{font-size:${Z.pu}px;font-weight:700}` +
      `.ps{font-size:${Z.ps}px;font-weight:800;letter-spacing:.35em}`
    : '';
  const anim = animate
    ? `@keyframes on{from{opacity:.12}}@keyframes fx{50%{opacity:.6}}` +
      `.b0,.b1,.b2,.b3,.b4,.b5{animation:on .7s ease-out backwards}` +
      [0, 0.2, 0.4, 0.6, 0.8, 1].map((d, i) => `.b${i}{animation-delay:${d}s}`).join('') +
      (
        [
          [6.4, 0],
          [7.3, -1.4],
          [5.9, -2.6],
          [8.2, -3.3],
          [6.9, -4.7],
          [7.8, -5.6],
        ] as const
      )
        .map(([d, o], i) => `.d${i}{animation:fx ${d}s ease-in-out ${o}s infinite}`)
        .join('') +
      `.pp{animation:on .8s ease-out 1.1s backwards}.lp{animation:fx 4s ease-in-out infinite}` +
      REDUCED_MOTION_CSS
    : '';
  return (
    `text{font-family:${MONO}}.e{text-anchor:end}.m{text-anchor:middle}` +
    size +
    `.rt{font-size:11px;font-weight:700;letter-spacing:.14em}.tg{font-size:15px;font-weight:700}` +
    `.t{fill:${P.text}}.d{fill:${P.dim}}.sv{fill:${P.slotText}}.sd{fill:${P.slotDim}}.ac{fill:${P.accent}}` +
    `.sl{fill:${P.slot};stroke:${P.edge}}.gr{fill:${P.slot}}.ed{fill:none;stroke:${P.edge}}.hl{fill:none;stroke:${P.hi};stroke-opacity:.45}` +
    `.fl{fill:${P.floor};stroke:${P.edge};stroke-width:1.5}.ce{stroke:${P.capEdge};stroke-width:.8}.ho{fill:${P.floor}}` +
    `.pk{fill:none;stroke:${P.mark};stroke-width:2.4}.hy{fill:none;stroke:${P.mark};stroke-width:3;stroke-opacity:.55}` +
    `.pl{fill:url(#pg);stroke:${P.edge};stroke-width:2}.br{fill:url(#bp)}.bs{fill:${P.hi};opacity:.07}` +
    P.plate.map((c, i) => `.s${i}{stop-color:${c}}`).join('') +
    P.cap.map((c, i) => `.c${i}{stop-color:${c}}`).join('') +
    `.h0{fill:${P.idle}}` +
    P.heat.map((h, i) => `.h${i + 1}{fill:${h}}`).join('') +
    langColors.map((c, i) => `.g${i}{fill:${c}}`).join('') +
    `.em{fill:${P.emb}}` +
    anim
  );
}

/* ------------------------------------------------------------------ */
/* Core: the shield disc                                               */
/* ------------------------------------------------------------------ */
function drawCore(input: StyleInput, pos: Pos[], hex: boolean): string {
  const { mode, summary, animate, rng } = input;
  const n = pos.length;
  const cells = assignCells(input, n);
  const s: string[] = [];

  // Rim (bevelled via the plate gradient), floor, edges, brushed rings.
  s.push(`<circle cx="300" cy="300" r="${R_RIM}" fill="none" stroke="url(#pg)" stroke-width="14"/>`);
  s.push(`<circle cx="300" cy="300" r="${R_OUT}" class="ed" stroke-width="1.5"/>`);
  s.push(`<circle cx="300" cy="300" r="${R_FIELD}" class="fl"/>`);
  s.push(`<path d="M300 12.5a287.5 287.5 0 1 0 .01 0M300 5a295 295 0 1 0 .01 0" class="hl" stroke-width=".6"/>`);

  // Hybrid: painted boundary ring between the commit core and the language rim.
  const inner = mode === 'hybrid' ? cells.findIndex((c) => c.kind === 'lang') : -1;
  if (inner > 0) {
    const r = ((pos[inner - 1] as Pos).dist + (pos[inner] as Pos).dist) / 2;
    s.push(`<circle cx="300" cy="300" r="${f(r)}" class="hy"/>`);
  }

  // Steel caps: one pattern-filled rectangle per lattice row (static).
  const rows = new Map<number, number[]>();
  for (const p of pos) {
    const r = rows.get(p.cy) ?? [];
    r.push(p.cx);
    rows.set(p.cy, r);
  }
  const even: string[] = [];
  const odd: string[] = [];
  for (const [cy, xs] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
    xs.sort((a, b) => a - b);
    const target = hex && Math.round((cy - 50) / STEP) % 2 ? odd : even;
    let start = xs[0] as number;
    let prev = start;
    const flush = () => {
      const w = prev - start + STEP;
      target.push(`M${f(start - 11)} ${f(cy - 11)}h${f(w)}v22h-${f(w)}z`);
    };
    for (const x of xs.slice(1)) {
      if (x - prev > STEP + 0.5) {
        flush();
        start = x;
      }
      prev = x;
    }
    flush();
  }
  s.push(`<path d="${even.join('')}" fill="url(#cp)"/>`);
  if (odd.length) s.push(`<path d="${odd.join('')}" fill="url(#cq)"/>`);

  // Coloured cores in 6 radial power-up bands.
  const bands: string[][] = [[], [], [], [], [], []];
  let peakPos: Pos | null = null;
  cells.forEach((cell, i) => {
    const p = pos[i] as Pos;
    let cls: string;
    let solid = false;
    let live = true;
    if (cell.kind === 'empty') return; // channel beyond the data window: closed plug
    if (cell.kind === 'day') {
      const lv = cell.day.level;
      cls = `h${lv}`;
      solid = lv >= 3;
      live = lv > 0;
      if (!peakPos && summary.peak > 0 && cell.day.date === summary.peakDate) peakPos = p;
    } else cls = `g${cell.langIndex}`;
    if (animate && live) cls += ` d${Math.floor(rng() * 6) % 6}`;
    const band = Math.min(5, Math.floor((p.dist / MASK) * 6));
    (bands[band] as string[]).push(`<use href="#${solid ? 'K' : 'k'}" x="${f(p.cx)}" y="${f(p.cy)}" class="${cls}"/>`);
  });
  s.push(bands.map((b, i) => (animate ? `<g class="b${i}">${b.join('')}</g>` : b.join(''))).join(''));
  const pk = peakPos as Pos | null;
  if (pk) s.push(`<circle cx="${f(pk.cx)}" cy="${f(pk.cy)}" r="11.6" class="pk"/>`);

  // Rim bolts (skip the stamped-text arc and the name tag).
  for (let a = 0; a < 360; a += 15) {
    const d = a > 180 ? a - 360 : a;
    if (Math.abs(d + 90) <= 50 || Math.abs(d - 90) <= 30) continue;
    const [x, y] = polar(d, R_RIM);
    s.push(rivet(x, y));
  }
  // Stamped rim text along the top arc.
  const rim = `PYATACHOK \u00B7 UPPER SHIELD \u00B7 ${mode.toUpperCase()} \u00B7 ${n} CH`;
  s.push(`<text class="rt t m"><textPath href="#ra" startOffset="50%">${escapeXml(rim)}</textPath></text>`);
  // Name tag bolted over the bottom of the rim.
  const name = `@${truncate(input.username, 22)}`;
  const tw = Math.min(320, Math.max(160, wT(name, 15) + 60));
  const tX = C - tw / 2;
  const tY = 569;
  s.push(`<rect x="${f(tX)}" y="${tY}" width="${f(tw)}" height="29" rx="4" class="pl"/>`);
  s.push(rivet(tX + 11, tY + 14.5), rivet(tX + tw - 11, tY + 14.5));
  s.push(eng('t m', 'tg', C, tY + 20, name));
  return s.join('');
}

/* ------------------------------------------------------------------ */
/* Panel: riveted stamped-steel plate                                  */
/* ------------------------------------------------------------------ */
interface Block {
  h: number;
  draw: (x: number, y: number, w: number) => string;
}
type BlockKey = StatKey | 'legend' | 'fuel' | 'channels';

function field(Z: Sizes, label: string, value: string): Block {
  return {
    h: Z.fh,
    draw: (x, y, w) => {
      const sw = wT(value, Z.vl) + 18;
      const sy = y + (Z.fh - Z.sh) / 2 - 1;
      return (
        eng('d', 'lb', x, y + Z.fh / 2 + Z.lb * 0.35, label) +
        slot(x + w - sw, sy, sw, Z.sh) +
        tx('sv vl e', x + w - 9, sy + Z.sh / 2 + Z.vl * 0.36, value)
      );
    },
  };
}

function block(key: BlockKey, input: StyleInput, Z: Sizes, avail: number, cells: number): Block | null {
  const S = input.summary;
  switch (key) {
    case 'total':
      return {
        h: Z.th,
        draw: (x, y, w) => {
          const sh = Z.th - 28;
          const big = grouped(S.total);
          const unit = `${S.window} D`;
          const room = w - 24 - wT(unit, Z.sm, 0.1) - 10;
          const fs = Math.min(Z.bg, room / (big.length * 0.6));
          const fsAttr = fs < Z.bg ? ` style="font-size:${f(fs)}px"` : '';
          return (
            eng('d', 'lb', x, y + 14, 'TOTAL OUTPUT') +
            slot(x, y + 22, w, sh) +
            tx('ac bg', x + 12, y + 22 + sh / 2 + fs * 0.36, big, fsAttr) +
            tx('sd sm e', x + w - 10, y + 22 + sh / 2 + 4, unit)
          );
        },
      };
    case 'active':
      return field(Z, 'ACTIVE', `${S.active} D`);
    case 'idle':
      return field(Z, 'IDLE', `${S.idle} D`);
    case 'peak':
      return field(Z, 'PEAK/DAY', String(S.peak));
    case 'streak':
      return field(Z, 'STREAK', `${S.currentStreak} D`);
    case 'longest':
      return field(Z, 'LONGEST', `${S.longestStreak} D`);
    case 'fuel':
      return field(Z, 'FUEL TYPES', String(input.langs.length));
    case 'channels':
      return field(Z, 'CHANNELS', String(cells));
    case 'legend':
      return {
        h: Z.lh,
        draw: (x, y) => {
          let s = eng('d', 'lb', x, y + 14, 'CHANNEL OUTPUT');
          for (let i = 0; i < 5; i++) s += mini(x + 11 + i * 26, y + 33, 1, `h${i}`, i >= 3);
          return s + eng('d', 'sm', x, y + Z.lh - 3, 'IDLE') + eng('d e', 'sm', x + 126, y + Z.lh - 3, 'PEAK');
        },
      };
    case 'languages': {
      // Rows that do not fit are dropped (never overlapped).
      const rows = Math.min(input.langs.length, Math.floor((avail - 22) / Z.row));
      if (rows <= 0) return null;
      const langs = input.langs.slice(0, rows);
      return {
        h: 22 + Z.row * rows,
        draw: (x, y, w) => {
          let s = eng('d', 'lb', x, y + 14, 'FUEL CHANNELS');
          langs.forEach((l, i) => {
            const y0 = y + 22 + i * Z.row;
            const mid = y0 + Z.row / 2 - 2;
            const pct = Math.max(0, Math.min(100, l.pct));
            s +=
              mini(x + 8, mid, 0.72, `g${i}`) +
              eng('t', 'nm', x + 22, mid + Z.nm * 0.35, truncate(l.name, Z.nameMax)) +
              eng('t e', 'pc', x + w, mid + Z.pc * 0.35, `${num(pct)}%`) +
              `<rect x="${f(x + 22)}" y="${f(y0 + Z.row - 5)}" width="${f(w - 22)}" height="3" class="gr"/>` +
              `<rect x="${f(x + 22)}" y="${f(y0 + Z.row - 5)}" width="${f(((w - 22) * pct) / 100)}" height="3" class="g${i}"/>`;
          });
          return s;
        },
      };
    }
    default:
      return null;
  }
}

interface Placed {
  b: Block;
  col: number;
  y: number;
}

/** Greedy column flow at the smallest column height that fits; overflow is dropped. */
function flow(blocks: Block[], cols: number, avail: number, gap: number): Placed[] {
  if (!blocks.length) return [];
  for (let target = Math.max(...blocks.map((b) => b.h)); target <= avail; target += 2) {
    const out: Placed[] = [];
    let col = 0;
    let y = 0;
    let ok = true;
    for (const b of blocks) {
      if (y > 0 && y + b.h > target) {
        col++;
        y = 0;
      }
      if (col >= cols) {
        ok = false;
        break;
      }
      out.push({ b, col, y });
      y += b.h + gap;
    }
    if (ok) return out;
  }
  const out: Placed[] = [];
  let col = 0;
  let y = 0;
  for (const b of blocks) {
    if (y > 0 && y + b.h > avail) {
      col++;
      y = 0;
    }
    if (col >= cols) break;
    out.push({ b, col, y });
    y += b.h + gap;
  }
  return out;
}

function drawPanel(input: StyleInput, cells: number, V: boolean): { W: number; H: number; Z: Sizes; svg: string } {
  const Z = SIZES[V ? 'v' : 'h'];
  const W = V ? 280 : 600;
  const H = V ? 600 : 276;
  const s: string[] = [];
  s.push(`<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="8" class="pl"/>`);
  s.push(`<rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="6" class="br"/>`);
  s.push(`<rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="5.5" class="hl"/>`);
  const rv: Array<[number, number]> = [
    [11, 11],
    [W - 11, 11],
    [11, H - 11],
    [W - 11, H - 11],
  ];
  if (V) rv.push([11, H / 2], [W - 11, H / 2]);
  for (const [x, y] of rv) s.push(rivet(x, y));

  // Header: sprayed stencil band with a lamp, then the stamped username.
  const bx = 24;
  const bw = W - 48;
  const by = 12;
  const bh = Z.band;
  s.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="2" class="gr"/>`);
  const st = 'PYATACHOK';
  const stW = wT(st, Z.ps, 0.35) - Z.ps * 0.35;
  s.push(tx('ac ps', bx + 10, by + bh / 2 + Z.ps * 0.36, st));
  // Stencil bridge: a slot-coloured cut through the letters' mid-height.
  s.push(`<rect x="${bx + 8}" y="${f(by + bh / 2 - 1)}" width="${f(stW + 4)}" height="1.6" class="gr"/>`);
  const lamp = mini(bx + bw - 15, by + bh / 2, 0.72, 'ac');
  s.push(input.animate ? `<g class="lp">${lamp}</g>` : lamp);
  const uMax = Math.floor((W - 48) / (Z.pu * 0.6)) - 1;
  const uy = Z.uy;
  s.push(eng('t', 'pu', 24, uy, `@${truncate(input.username, uMax)}`));
  s.push(groove(16, W - 16, uy + 10));

  // Stat blocks.
  const top = uy + 22;
  const bottom = H - 42;
  const avail = bottom - top;
  const cols = V ? 1 : 3;
  const cg = 22;
  const cw = (W - 48 - cg * (cols - 1)) / cols;
  const keys: BlockKey[] = resolveStats(input);
  if (input.stats === null) {
    if (input.mode === 'language') keys.push('fuel', 'channels');
    else keys.push('legend');
  }
  const blocks = keys
    .map((k) => block(k, input, Z, avail, cells))
    .filter((b): b is Block => b !== null && b.h <= avail);
  const placed = flow(blocks, cols, avail, 6);
  // Vertical plate: a little leftover height between blocks (tight rows).
  let extra = 0;
  if (V && placed.length > 1) {
    const last = placed[placed.length - 1] as Placed;
    extra = Math.min(8, Math.max(0, (avail - (last.y + last.b.h)) / (placed.length - 1)));
  }
  let maxCol = 0;
  placed.forEach(({ b, col, y }, i) => {
    s.push(b.draw(24 + col * (cw + cg), top + y + i * extra, cw));
    maxCol = Math.max(maxCol, col);
  });
  for (let k = 1; k <= maxCol; k++) {
    const dx = 24 + k * (cw + cg) - cg / 2;
    s.push(`<path d="M${f(dx)} ${top}V${bottom}" class="ed"/><path d="M${f(dx + 1)} ${top}V${bottom}" class="hl"/>`);
  }

  // Footer: groove + stamped serial.
  s.push(groove(16, W - 16, H - 34));
  const mode = input.mode.toUpperCase();
  const serial = V
    ? `RBMK-1000 \u00B7 ${mode}`
    : `RBMK-1000 \u00B7 MODE ${mode} \u00B7 ${cells} CH` + (input.mode === 'language' ? '' : ` \u00B7 ${input.summary.window} D`);
  s.push(eng('d m', 'sm', W / 2, H - 15, serial));
  return { W, H, Z, svg: s.join('') };
}

/* ------------------------------------------------------------------ */
/* Document                                                            */
/* ------------------------------------------------------------------ */
function describe(input: StyleInput): string {
  const S = input.summary;
  const parts: string[] = [];
  if (input.mode !== 'language') {
    parts.push(
      `${grouped(S.total)} contributions over ${S.window} days; ${S.active} active days; ` +
        `peak ${S.peak} per day${S.peakDate ? ` on ${S.peakDate}` : ''}; current streak ${S.currentStreak} days; longest ${S.longestStreak} days.`,
    );
  }
  if (input.mode !== 'commit' && input.langs.length) {
    parts.push(`Languages: ${input.langs.map((l) => `${l.name} ${num(l.pct)}%`).join(', ')}.`);
  }
  return parts.join(' ');
}

export function render(input: StyleInput): string {
  const base = PRESETS[input.preset] ?? (PRESETS.dark as Palette);
  const P: Palette = {
    ...base,
    ...(input.accent ? { accent: input.accent, mark: input.accent } : {}),
    ...(input.heat ? { idle: input.heat[0], heat: [input.heat[1], input.heat[2], input.heat[3], input.heat[4]] } : {}),
  };
  const shape = input.cell === 'default' ? 'circle' : input.cell;
  const hex = shape === 'hex';
  const pos = lattice(hex);
  const V = input.panel === 'right';

  let W: number;
  let H: number;
  let body: string;
  let Z: Sizes | null = null;
  if (input.view === 'core') {
    W = H = CORE;
    body = drawCore(input, pos, hex);
  } else {
    const p = drawPanel(input, pos.length, V);
    Z = p.Z;
    const plate = input.animate ? `<g class="pp"` : '<g';
    if (input.view === 'panel') {
      W = p.W;
      H = p.H;
      body = `${plate}>${p.svg}</g>`;
    } else {
      W = V ? CORE + GAP + p.W : CORE;
      H = V ? CORE : CORE + GAP + p.H;
      const t = V ? `${CORE + GAP} 0` : `0 ${CORE + GAP}`;
      body = `<g>${drawCore(input, pos, hex)}</g>${plate} transform="translate(${t})">${p.svg}</g>`;
    }
  }

  const [ax, ay] = polar(-165, 287);
  const [bx, by] = polar(-15, 287);
  const sh = SHAPES[shape];
  const title = `markdown-RBMK pyatachok style: @${input.username}, ${input.mode} mode`;
  const hexPat = (id: string, x: number) =>
    `<pattern id="${id}" x="${x}" y="39" width="22" height="22" patternUnits="userSpaceOnUse"><use href="#p" x="11" y="11"/></pattern>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">`,
    `<title>${escapeXml(title)}</title><desc>${escapeXml(describe(input))}</desc>`,
    `<style>${css(P, input.langs.map((l) => safeColor(l.color)), Z, input.animate)}</style>`,
    `<defs>`,
    `<linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="s0"/><stop offset=".55" class="s1"/><stop offset="1" class="s2"/></linearGradient>`,
    `<linearGradient id="cg" x1=".15" y1=".1" x2=".85" y2=".95"><stop offset="0" class="c0"/><stop offset=".5" class="c1"/><stop offset="1" class="c2"/></linearGradient>`,
    `<pattern id="bp" width="6" height="3" patternUnits="userSpaceOnUse"><rect width="6" height="1" class="bs"/></pattern>`,
    `<path id="ra" d="M${f(ax)} ${f(ay)}A287 287 0 0 1 ${f(bx)} ${f(by)}"/>`,
    `<circle id="rv" r="3.4" fill="url(#cg)" class="ce"/>`,
    sh.cap,
    sh.core,
    sh.solid,
    hex ? hexPat('cp', 33.5) + hexPat('cq', 44.5) : hexPat('cp', 39),
    `</defs>`,
    body,
    `</svg>`,
  ].join('');
}
