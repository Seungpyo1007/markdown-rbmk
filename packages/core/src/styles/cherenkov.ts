/**
 * Style `cherenkov` — the blue glow of a reactor pool. A deep navy glow fades
 * into the page; every fuel channel is a luminous point whose brightness is
 * its activity. The brightest channels bloom and the pool breathes slowly.
 * The panel is a thin glass pane with light type and one glowing numeral.
 */
import { assignCells, escapeXml, grouped, num, resolveStats, truncate, REDUCED_MOTION_CSS, SANS } from './shared';
import type { CellContent, CellShape, StatKey, StyleInput } from './types';

interface Palette {
  /** Opaque card behind everything, or null for a transparent badge. */
  plate: string | null;
  edge: string | null;
  /** Pool-tile grout lines (light only). */
  tile: string | null;
  text: string;
  dim: string;
  accent: string;
  pool: string;
  poolA: [number, number];
  bloom: string;
  bloomA: number;
  glassC: string;
  glass: number;
  line: number;
  empty: string;
  idle: string;
  heat: readonly [string, string, string, string];
}

const PRESETS: Record<string, Palette> = {
  // Deep pool on the dark GitHub page. The ramp's low end is spread wider than
  // the prototype so idle and level 1 separate clearly on #0d1117.
  dark: {
    plate: null, edge: null, tile: null,
    text: '#d8f4ff', dim: '#86b0cf', accent: '#62d6ff',
    pool: '#0b2a5c', poolA: [0.95, 0.45], bloom: '#6fdcff', bloomA: 0.75,
    glassC: '#62d6ff', glass: 0.035, line: 0.22, empty: '#1d3a5c',
    idle: '#132740', heat: ['#2c64b8', '#3b95f2', '#72d4ff', '#e4fbff'],
  },
  // Pale pool tiles in daylight, deep-blue cells, a sunlit centre.
  light: {
    plate: '#e4f0f8', edge: '#b9d3e6', tile: '#cfe2ef',
    text: '#0b2545', dim: '#3a5f80', accent: '#0a56ad',
    pool: '#ffffff', poolA: [0.85, 0.35], bloom: '#3d9bff', bloomA: 0.4,
    glassC: '#ffffff', glass: 0.55, line: 0.3, empty: '#b9d3e6',
    idle: '#cadced', heat: ['#8db4dc', '#4a86c8', '#1f59a6', '#0b2f6e'],
  },
  // Opaque abyss card, blue-violet (the true Cherenkov hue).
  abyss: {
    plate: '#060d22', edge: '#1c2a5e', tile: null,
    text: '#e3e8ff', dim: '#99a5dc', accent: '#a9b8ff',
    pool: '#1b1f6b', poolA: [0.9, 0.4], bloom: '#8f9fff', bloomA: 0.85,
    glassC: '#a9b8ff', glass: 0.04, line: 0.22, empty: '#222a5a',
    idle: '#141836', heat: ['#3538a6', '#5260e0', '#859fff', '#e5ecff'],
  },
};

/* Geometry: the reference lattice (24x24, step 22, circular mask r 270). */
const CORE = 600;
const C = 300;
const STEP = 22;
const R = 270;
const POOL_R = 294;

const SHAPES: Record<Exclude<CellShape, 'default'>, string> = {
  circle: '<circle id="c" cx="8" cy="8" r="7.2"/>',
  square: '<rect id="c" x="1" y="1" width="14" height="14" rx="1.5"/>',
  round: '<rect id="c" x=".5" y=".5" width="15" height="15" rx="5"/>',
  hex: '<polygon id="c" points="8,0 14.93,4 14.93,12 8,16 1.07,12 1.07,4"/>',
};

interface Pos {
  cx: number;
  cy: number;
  dist: number;
}

/** Centre-out lattice; hex shifts odd rows for a honeycomb. */
function lattice(hex: boolean): Pos[] {
  const out: Pos[] = [];
  for (let r = 0; r < 24; r++) {
    for (let c = 0; c < 24; c++) {
      const off = hex ? (r % 2 ? 5.5 : -5.5) : 0;
      const cx = C + (c - 11.5) * STEP + off;
      const cy = C + (r - 11.5) * STEP;
      const dist = Math.hypot(cx - C, cy - C);
      if (dist <= R) out.push({ cx, cy, dist });
    }
  }
  out.sort((a, b) => a.dist - b.dist || a.cy - b.cy || a.cx - b.cx);
  return out;
}

const f = num;
const t = (cls: string, x: number, y: number, s: string, extra = ''): string =>
  `<text class="${cls}" x="${f(x)}" y="${f(y)}"${extra}>${escapeXml(s)}</text>`;
const safeColor = (c: string): string => (/^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#8b949e');

/* ------------------------------------------------------------------ */
/* CSS                                                                  */
/* ------------------------------------------------------------------ */
function css(P: Palette, input: StyleInput): string {
  const base =
    `text{font-family:${SANS};font-variant-numeric:tabular-nums}` +
    `.u{font-size:22px;font-weight:300}.sb{font-size:11px;letter-spacing:.24em}` +
    `.lb{font-size:12px;letter-spacing:.16em}.sm{font-size:11px;letter-spacing:.12em}` +
    `.v{font-size:20px;font-weight:300}.n{font-size:14px;font-weight:300}` +
    `.big,.gw{font-size:54px;font-weight:200}.md{font-size:32px}.e{text-anchor:end}` +
    `.hl,.pk,.rg,.x,.tl{fill:none}.pk{stroke-width:1.2}.rg{stroke-opacity:.16}.x{stroke-width:1}.tl{stroke-width:1}` +
    // The numeral's glow twin: tight blur, low opacity, so the digits stay crisp.
    `.gw{opacity:.4}`;
  const anim = input.animate
    ? // One-sided keyframes animate toward the element's own style, so the
      // static frame is the final frame; power-up starts from low, not zero.
      `@keyframes pu{from{opacity:.04}}@keyframes br{50%{opacity:.55}}@keyframes sh{50%{opacity:.72}}` +
      `.b0,.b1,.b2,.b3,.b4,.b5{animation:pu 1.2s ease-out backwards}` +
      [0, 0.2, 0.4, 0.6, 0.8, 1].map((d, i) => `.b${i}{animation-delay:${d}s}`).join('') +
      `.pp{animation:pu 1.4s ease-out .9s backwards}` +
      `.bm{animation:pu 1.6s ease-out 1.1s backwards,br 9s ease-in-out 2.7s infinite}` +
      `.gw{animation:gb 9s ease-in-out 2.7s infinite}@keyframes gb{50%{opacity:.2}}` +
      `.pl{animation:br 13s ease-in-out infinite}` +
      (
        [
          [6.4, 0],
          [7.3, -1.7],
          [8.1, -3.2],
          [6.9, -4.4],
          [7.7, -2.5],
          [8.6, -5.6],
        ] as const
      )
        .map(([d, o], i) => `.d${i}{animation:sh ${d}s ease-in-out ${o}s infinite}`)
        .join('') +
      REDUCED_MOTION_CSS
    : '';
  const palette =
    `.u,.v,.n{fill:${P.text}}.lb,.sb,.sm{fill:${P.dim}}.big{fill:${P.accent}}.gw{fill:${P.bloom}}` +
    `.hl{stroke:${P.accent};stroke-opacity:${P.line}}.pk,.rg{stroke:${P.accent}}.x{stroke:${P.empty}}` +
    `.gl{fill:${P.glassC};fill-opacity:${P.glass};stroke:${P.accent};stroke-opacity:${P.line}}` +
    (P.plate ? `.pt{fill:${P.plate};stroke:${P.edge}}` : '') +
    (P.tile ? `.tl{stroke:${P.tile}}` : '') +
    `.s0{stop-color:${P.pool};stop-opacity:${P.poolA[0]}}.s1{stop-color:${P.pool};stop-opacity:${P.poolA[1]}}.s2{stop-color:${P.pool}}` +
    `.k{fill:${P.bloom}}.bo{opacity:${P.bloomA}}` +
    `.h0{fill:${P.idle}}` +
    P.heat.map((h, i) => `.h${i + 1}{fill:${h}}`).join('') +
    input.langs.map((l, i) => `.g${i}{fill:${safeColor(l.color)}}`).join('');
  return base + anim + palette;
}

/* ------------------------------------------------------------------ */
/* Core: glowing pool with luminous channel points                      */
/* ------------------------------------------------------------------ */
function drawCore(input: StyleInput, P: Palette, corners: boolean, legend: boolean): string {
  const pos = lattice(input.cell === 'hex');
  const cells: CellContent[] = assignCells(input, pos.length);
  const { summary: S, rng } = input;
  const bands: string[][] = [[], [], [], [], [], []];
  const bloom: string[] = [];
  let peak: Pos | null = null;
  const use = (p: Pos, cls: string) => `<use href="#c" x="${f(p.cx - 8)}" y="${f(p.cy - 8)}" class="${cls}"/>`;

  pos.forEach((p, i) => {
    const cell = cells[i] ?? { kind: 'empty' };
    let cls: string;
    let hot = false;
    if (cell.kind === 'day') {
      const lv = cell.day.level;
      cls = lv ? `h${lv}${lv >= 2 ? ` d${Math.floor(rng() * 6)}` : ''}` : 'h0';
      hot = lv >= 3;
      if (!peak && S.peak > 0 && cell.day.date === S.peakDate) peak = p;
    } else if (cell.kind === 'lang') {
      cls = `g${cell.langIndex} d${Math.floor(rng() * 6)}`;
      hot = input.mode === 'language' && cell.langIndex === 0; // the core fuel glows
    } else cls = 'x'; // no data for this channel: a faint ring
    bands[Math.min(5, Math.floor((p.dist / R) * 6))]!.push(use(p, cls));
    if (hot) bloom.push(use(p, 'k'));
  });

  const s: string[] = [];
  s.push(`<circle cx="${C}" cy="${C}" r="${POOL_R}" fill="url(#pg)" class="pl"/>`);
  s.push(`<circle cx="${C}" cy="${C}" r="${R + 14}" class="rg"/><circle cx="${C}" cy="${C}" r="${R / 2}" class="rg"/>`);
  if (bloom.length) s.push(`<g class="bo"><g class="bm" filter="url(#bl)">${bloom.join('')}</g></g>`);
  s.push(bands.map((b, i) => `<g class="b${i}">${b.join('')}</g>`).join(''));
  const pk = peak as Pos | null;
  if (pk) s.push(`<circle cx="${f(pk.cx)}" cy="${f(pk.cy)}" r="12.5" class="pk"/>`);

  const lang = input.mode === 'language';
  if (corners) {
    s.push(t('u', 24, 42, `@${truncate(input.username, 12)}`), t('sb', 24, 62, 'CHERENKOV'));
    s.push(t('sb e', 576, 42, lang ? 'LANGUAGE' : `${input.mode.toUpperCase()} · ${S.window} D`));
    s.push(t('big md e', 576, 560, grouped(lang ? input.langs.length : S.total)));
    s.push(t('sm e', 576, 582, lang ? 'LANGUAGES' : 'CONTRIBUTIONS'));
  }
  if (legend) {
    if (lang) {
      const top = input.langs[0];
      if (top) s.push(t('sm', 24, 560, 'CORE FUEL'), t('n', 24, 582, truncate(top.name, 18)));
    } else {
      for (let i = 0; i < 5; i++) s.push(`<use href="#c" x="${24 + i * 20}" y="548" class="h${i}"/>`);
      s.push(t('sm', 24, 584, 'FAINT'), t('sm e', 120, 584, 'BRIGHT'));
    }
  }
  return s.join('');
}

/* ------------------------------------------------------------------ */
/* Panel: glass pane, thin type, one glowing numeral                    */
/* ------------------------------------------------------------------ */
interface Block {
  h: number;
  legend?: boolean;
  big?: boolean;
  draw: (x: number, y: number, w: number) => string;
}
/** Builds a block for the height still free in the column (null = skip). */
type Maker = (avail: number) => Block | null;

const field = (label: string, value: string): Maker => () => ({
  h: 34,
  draw: (x, y, w) =>
    t('lb', x, y + 22, label) + t('v e', x + w, y + 23, value) + `<path d="M${f(x)} ${f(y + 33.5)}H${f(x + w)}" class="hl"/>`,
});

/** The big numeral with a crisp-ish glow twin; shrinks to fit the column. */
const numeral = (value: string, caption: string): Maker => () => ({
  h: 90,
  big: true,
  draw: (x, y, w) => {
    const size = Math.min(54, Math.floor(w / (value.length * 0.56)));
    const fs = size < 54 ? ` style="font-size:${size}px"` : '';
    return (
      t('gw', x - 3, y + 54, value, ` filter="url(#gb)"${fs}`) +
      t('big', x - 3, y + 54, value, fs) +
      t('sm', x, y + 78, truncate(caption, Math.floor(w / 7.8)))
    );
  },
});

function makers(input: StyleInput, key: StatKey): Maker | null {
  const S = input.summary;
  switch (key) {
    case 'total':
      return numeral(grouped(S.total), `CONTRIBUTIONS · ${S.window} D`);
    case 'active':
      return field('ACTIVE', `${grouped(S.active)} d`);
    case 'idle':
      return field('IDLE', `${grouped(S.idle)} d`);
    case 'peak':
      return field('PEAK DAY', grouped(S.peak));
    case 'streak':
      return field('STREAK', `${grouped(S.currentStreak)} d`);
    case 'longest':
      return field('LONGEST', `${grouped(S.longestStreak)} d`);
    case 'languages':
      return (avail) => {
        const rows = Math.min(input.langs.length, Math.floor((avail - 26) / 22));
        if (rows < 1) return null; // does not fit here: dropped, never overlaps
        return {
          h: 26 + 22 * rows,
          draw: (x, y, w) => {
            let s = t('lb', x, y + 12, 'FUEL');
            input.langs.slice(0, rows).forEach((l, i) => {
              const y0 = y + 22 + i * 22;
              const bw = ((w - 16) * Math.max(0, Math.min(100, l.pct))) / 100;
              s +=
                `<circle cx="${f(x + 4)}" cy="${f(y0 + 9)}" r="4" class="g${i}"/>` +
                t('n', x + 16, y0 + 14, truncate(l.name, Math.max(4, Math.floor((w - 70) / 7.5)))) +
                t('n e', x + w, y0 + 14, `${num(l.pct)}%`) +
                `<path d="M${f(x + 16)} ${f(y0 + 20.5)}H${f(x + w)}" class="hl"/>` +
                `<rect x="${f(x + w - bw)}" y="${f(y0 + 19.5)}" width="${f(bw)}" height="2" class="g${i}"/>`;
            });
            return s;
          },
        };
      };
  }
}

function drawPanel(input: StyleInput, vertical: boolean): { W: number; H: number; legendShown: boolean; svg: string } {
  const W = vertical ? 280 : 600;
  const H = vertical ? 600 : 220;
  const lang = input.mode === 'language';
  const s = [`<rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="16" class="gl"/>`];
  const x0 = 32;
  const top = vertical ? 36 : 34;
  const bottom = vertical ? H - 58 : H - 26;
  const cols = vertical ? 1 : 3;
  const gap = 28;
  const cw = (W - 64 - gap * (cols - 1)) / cols;
  const spare = vertical ? 12 : 8;

  const head: Maker = () => ({
    h: 58,
    draw: (x, y, w) =>
      t('u', x, y + 22, `@${truncate(input.username, Math.floor(w / 12.5))}`) +
      t('sb', x, y + 44, `CHERENKOV · ${lang ? 'LANG' : input.mode.toUpperCase()}`),
  });
  const list: Maker[] = [head];
  // Language mode has no contribution total: its numeral is the core fuel share.
  const topLang = input.langs[0];
  if (lang && topLang) list.push(numeral(`${num(topLang.pct)}%`, `CORE · ${topLang.name.toUpperCase()}`));
  for (const k of resolveStats(input)) {
    const m = makers(input, k);
    if (m) list.push(m);
  }
  if (!lang) {
    list.push(() => ({
      h: 58,
      legend: true,
      draw: (x, y) => {
        let r = t('lb', x, y + 12, 'LUMINANCE');
        for (let i = 0; i < 5; i++) r += `<use href="#c" x="${f(x + i * 20)}" y="${f(y + 22)}" class="h${i}"/>`;
        return r + t('sm', x, y + 56, 'FAINT') + t('sm e', x + 96, y + 56, 'BRIGHT');
      },
    }));
  }

  let col = 0;
  let y = top;
  let legendShown = false;
  let prevBig = false;
  let placedInCol = 0;
  for (let i = 0; i < list.length && col < cols; i++) {
    // Horizontal: identity + numeral own the first column.
    if (!vertical && i > 0 && col === 0 && placedInCol > 0) {
      const b0 = list[i]!(bottom - y);
      if (!(b0?.big && !prevBig)) {
        col++;
        y = top;
        placedInCol = 0;
        if (col >= cols) break;
      }
    }
    let b = list[i]!(bottom - y);
    if (!b || y + b.h > bottom) {
      if (placedInCol === 0) continue; // taller than a whole column: dropped
      col++;
      y = top;
      placedInCol = 0;
      if (col >= cols) break;
      b = list[i]!(bottom - y);
      if (!b || y + b.h > bottom) continue;
    }
    // Vertical: the legend settles at the foot, the readouts stay compact.
    if (vertical && b.legend) y = Math.max(y, bottom - b.h);
    s.push(b.draw(x0 + col * (cw + gap), y, cw));
    if (b.legend) legendShown = true;
    prevBig = !!b.big;
    y += b.h + (vertical && b.big ? spare + 10 : spare);
    placedInCol++;
  }
  if (vertical) {
    s.push(t('sm', x0, H - 32, 'markdown-RBMK'));
    if (!lang) s.push(t('sm e', W - 32, H - 32, `${input.summary.window} D`));
  }
  return { W, H, legendShown, svg: s.join('') };
}

/* ------------------------------------------------------------------ */
/* Document assembly                                                    */
/* ------------------------------------------------------------------ */
function tiles(W: number, H: number): string {
  // Pool-tile grout, aligned to the gaps between channels (44 px = 2 cells).
  let d = '';
  for (let x = 36; x < W; x += 44) d += `M${x} 1V${H - 1}`;
  for (let y = 36; y < H; y += 44) d += `M1 ${y}H${W - 1}`;
  return `<path d="${d}" class="tl"/>`;
}

export function render(input: StyleInput): string {
  const base = PRESETS[input.preset] ?? PRESETS.dark!;
  const P: Palette = {
    ...base,
    ...(input.accent ? { accent: input.accent } : {}),
    ...(input.heat ? { idle: input.heat[0], heat: [input.heat[1], input.heat[2], input.heat[3], input.heat[4]] as const } : {}),
  };
  const vertical = input.panel === 'right';

  let W: number;
  let H: number;
  let body: string;
  if (input.view === 'core') {
    W = H = CORE;
    body = drawCore(input, P, true, true);
  } else if (input.view === 'panel') {
    const p = drawPanel(input, vertical);
    W = p.W;
    H = p.H;
    body = `<g class="pp">${p.svg}</g>`;
  } else {
    const p = drawPanel(input, vertical);
    const core = drawCore(input, P, false, !p.legendShown);
    W = vertical ? CORE - 12 + p.W : CORE;
    H = vertical ? CORE : CORE - 12 + p.H;
    body = `<g>${core}</g><g class="pp" transform="translate(${vertical ? `${CORE - 12},0` : `0,${CORE - 12}`})">${p.svg}</g>`;
  }
  const plate = P.plate
    ? `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="20" class="pt"/>` + (P.tile ? tiles(W, H) : '')
    : '';

  const S = input.summary;
  const title = `markdown-RBMK · cherenkov style: @${input.username}, ${input.mode} mode`;
  const parts: string[] = [];
  if (input.mode !== 'language') {
    parts.push(
      `${grouped(S.total)} contributions over ${S.window} days`,
      `${S.active} active days`,
      `peak ${S.peak} per day`,
      `current streak ${S.currentStreak} days`,
      `longest ${S.longestStreak} days`,
    );
  }
  if (input.mode !== 'commit' && input.langs.length) {
    parts.push(`languages: ${input.langs.map((l) => `${l.name} ${num(l.pct)}%`).join(', ')}`);
  }
  const shape = input.cell === 'default' ? 'circle' : input.cell;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">`,
    `<title>${escapeXml(title)}</title><desc>${escapeXml(`${parts.join('; ')}.`)}</desc>`,
    `<style>${css(P, input)}</style>`,
    `<defs>${SHAPES[shape]}`,
    `<radialGradient id="pg"><stop offset="0" class="s0"/><stop offset=".62" class="s1"/><stop offset="1" class="s2" stop-opacity="0"/></radialGradient>`,
    `<filter id="bl" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>`,
    `<filter id="gb" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="2"/></filter></defs>`,
    plate,
    body,
    `</svg>`,
  ].join('');
}
