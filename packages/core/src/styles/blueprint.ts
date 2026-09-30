/**
 * Style `blueprint`: an engineering drawing of the reactor core.
 *
 * The core is a drafted plan view on a drawing sheet: outlined channels whose
 * hatch density encodes activity, chain centre lines, an A–A cutting plane, a
 * diameter dimension and a detail balloon on the peak day. The panel is a
 * drawing title block of ruled cells. Pure string building, CSS-only motion.
 */
import type { LanguageStat } from '../types';
import type { CellContent, StatKey, StyleInput } from './types';
import { HYBRID_INNER_FRACTION, MONO, REDUCED_MOTION_CSS, SANS, assignCells, escapeXml, grouped, num, resolveStats, truncate } from './shared';

/* ------------------------------------------------------------------ */
/* Palettes: every colour in the drawing comes from one of these.      */
/* Text always sits on the opaque `card`; contrast is measured on it.  */
/* ------------------------------------------------------------------ */
interface Palette {
  card: string;
  gridMinor: string;
  gridMajor: string;
  frame: string;
  line: string;
  ink: string;
  dim: string;
  accent: string;
  rule: string;
  idle: string;
  idleLine: string;
  heat: readonly [string, string, string, string];
}

const PRESETS: Record<string, Palette> = {
  // Cyanotype: white/cyan lines on blueprint navy. ink/dim/accent 14.2/8.3/10.7.
  dark: {
    card: '#0b2545', gridMinor: '#11305a', gridMajor: '#1a4275',
    frame: '#d6ebff', line: '#9fd3ff', ink: '#eef7ff', dim: '#9cc3e6', accent: '#ffd166',
    rule: '#5b8cc0', idle: '#0e2d52', idleLine: '#44739f',
    heat: ['#5aa6e0', '#86c8ff', '#c2e6ff', '#ffffff'],
  },
  // Ink on paper with a pale drafting grid; redline accent. 18.9/7.6/6.2.
  light: {
    card: '#ffffff', gridMinor: '#eef2f7', gridMajor: '#dbe3ec',
    frame: '#111827', line: '#1f2937', ink: '#111111', dim: '#4b5563', accent: '#c1121f',
    rule: '#6b7280', idle: '#ffffff', idleLine: '#b4bec9',
    heat: ['#98a3b0', '#5c6877', '#2c3541', '#111111'],
  },
  // Sepia diazo print on aged vellum. 12.4/6.3/6.8.
  sepia: {
    card: '#f4ead5', gridMinor: '#ebdfc4', gridMajor: '#decdaa',
    frame: '#4a2e16', line: '#5a3a1e', ink: '#3a2210', dim: '#6b4f33', accent: '#9b1d1d',
    rule: '#9c8260', idle: '#f4ead5', idleLine: '#c6ae88',
    heat: ['#b99466', '#8e6739', '#61401f', '#3a2210'],
  },
};

/* ------------------------------------------------------------------ */
/* Geometry: core box 680x680, lattice centred at (340,340)            */
/* ------------------------------------------------------------------ */
const CORE = 680;
const C = 340;
const STEP = 22;
const R = 270; // lattice mask radius
const RB = 282; // drawn boundary circle
const M = 18; // sheet margin (thick inner border inset)
const PW = 302; // vertical panel width incl. margin
const PH = 282; // horizontal panel height incl. margin
const HEAD_H = 66;
/** Horizontal gap lane between the two bottom rows: the leader shoulder. */
const SHOULDER_Y = C + STEP * 11; // 582
/** Leftmost vertical gap lane the leader may descend (clear of NOTES). */
const MIN_LANE_X = C - STEP * 2; // 296

type Shape = 'square' | 'round' | 'circle' | 'hex';
const SHAPES: Record<Shape, string> = {
  square: '<rect id="c" width="16" height="16"/>',
  round: '<rect id="c" width="16" height="16" rx="4"/>',
  circle: '<circle id="c" cx="8" cy="8" r="8"/>',
  hex: '<polygon id="c" points="8,0 14.93,4 14.93,12 8,16 1.07,12 1.07,4"/>',
};

interface Pos {
  cx: number;
  cy: number;
  dist: number;
}

/** 24x24 lattice clipped to r 270, sorted centre-out (hex: odd rows ±5.5). */
function lattice(shape: Shape): Pos[] {
  const out: Pos[] = [];
  for (let r = 0; r < 24; r++) {
    for (let c = 0; c < 24; c++) {
      const off = shape === 'hex' ? (r % 2 ? 5.5 : -5.5) : 0;
      const cx = C + (c - 11.5) * STEP + off;
      const cy = C + (r - 11.5) * STEP;
      const dist = Math.hypot(cx - C, cy - C);
      if (dist <= R) out.push({ cx, cy, dist });
    }
  }
  out.sort((a, b) => a.dist - b.dist || a.cy - b.cy || a.cx - b.cx);
  return out;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const f = num;
/** Text element; `s` is raw data and is always escaped here. */
const t = (cls: string, x: number, y: number, s: string, extra = ''): string =>
  `<text class="${cls}" x="${f(x)}" y="${f(y)}"${extra}>${escapeXml(s)}</text>`;
const arrow = (x: number, y: number, dx: number, dy: number): string => {
  const bx = x - dx * 9;
  const by = y - dy * 9;
  const px = -dy * 2.6;
  const py = dx * 2.6;
  return `<path class="ah" d="M${f(x)} ${f(y)}L${f(bx + px)} ${f(by + py)}L${f(bx - px)} ${f(by - py)}Z"/>`;
};
/** Max chars of 12 px mono text in `w` px. */
const monoFit = (w: number, size = 12): number => Math.max(4, Math.floor(w / (size * 0.6)));
const safeColor = (c: string): string => (/^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#7f8c8d');

/* ------------------------------------------------------------------ */
/* CSS: the palette object is the only colour source                   */
/* ------------------------------------------------------------------ */
function css(P: Palette, langs: readonly LanguageStat[], animate: boolean): string {
  const r: string[] = [];
  r.push(`text{font-family:${SANS};fill:${P.ink}}.mo{font-family:${MONO}}`);
  r.push(`.lb{font-size:11px;letter-spacing:.12em;fill:${P.dim}}`);
  r.push(`.sm{font-size:12px;fill:${P.dim}}`);
  r.push(`.us{font-size:18px;font-weight:700}.v{font-size:22px;font-weight:700}.hv{font-size:38px;font-weight:700}`);
  r.push(`.ti{font-size:17px;font-weight:700;letter-spacing:.06em}.cv{font-size:14px;font-weight:700}`);
  r.push(`.dm{font-size:14px}.sl{font-size:15px;font-weight:700}.nm{font-size:13px}.pc{font-size:15px;font-weight:700}`);
  r.push(`.ac{fill:${P.accent}}.e{text-anchor:end}.c{text-anchor:middle}`);
  // Line types (ISO 128 flavoured): continuous, chain (centre), dashed (hidden), thick.
  r.push(`.ln,.th,.cl,.ph,.ex,.cp,.rl,.gm,.gM,.acs,.k,.x{fill:none}`);
  r.push(`.ln{stroke:${P.line};stroke-width:1.2}.th{stroke:${P.frame};stroke-width:1.6}`);
  r.push(`.cl{stroke:${P.dim};stroke-width:.8;stroke-dasharray:16 3 2 3}.ph{stroke:${P.dim};stroke-width:.9;stroke-dasharray:6 4}`);
  r.push(`.ex{stroke:${P.line};stroke-width:.7}.cp{stroke:${P.frame};stroke-width:3}`);
  r.push(`.ah{fill:${P.line}}.acs{stroke:${P.accent};stroke-width:1.4}`);
  r.push(`.rl{stroke:${P.rule};stroke-width:1}.card{fill:${P.card};stroke:${P.frame};stroke-width:1}`);
  r.push(`.gm{stroke:${P.gridMinor};stroke-width:.6}.gM{stroke:${P.gridMajor};stroke-width:.9}`);
  // Cells: outline = level colour, fill = hatch of increasing density.
  r.push(`.cells use{stroke-width:1}`);
  r.push(`.h0{fill:${P.idle};stroke:${P.idleLine}}.x{stroke:${P.idleLine};stroke-dasharray:2 2}`);
  for (let i = 1; i <= 3; i++) r.push(`.h${i}{fill:url(#p${i});stroke:${P.heat[i - 1]}}.k${i}{stroke:${P.heat[i - 1]}}`);
  r.push(`.h4{fill:${P.heat[3]};stroke:${P.heat[3]}}`);
  langs.forEach((l, i) => {
    const col = safeColor(l.color);
    r.push(`.g${i}{fill:url(#q${i});stroke:${col}}.j${i}{stroke:${col}}.jb${i}{fill:${col};fill-opacity:.3}`);
  });
  if (animate) {
    // Base state is fully visible; `backwards` only holds the "from" frame during the delay.
    r.push(`@keyframes pu{from{opacity:.08}}@keyframes dr{from{stroke-dashoffset:100}}@keyframes fx{50%{opacity:.55}}`);
    r.push(`.b0,.b1,.b2,.b3,.b4,.b5{animation:pu .7s ease-out backwards}`);
    r.push([0, 0.15, 0.3, 0.45, 0.6, 0.75].map((d, i) => `.b${i}{animation-delay:${d}s}`).join(''));
    r.push(`.dw{stroke-dasharray:100 1;animation:dr 1.8s ease-in-out .1s backwards}`);
    r.push(`.pp{animation:pu .9s ease-out 1s backwards}`);
    const fx: Array<[number, number]> = [[6.4, 0], [7.1, -1.2], [5.8, -2.5], [7.9, -3.3], [6.8, -4.4], [7.5, -5.6]];
    r.push(fx.map(([d, o], i) => `.d${i}{animation:fx ${d}s ease-in-out ${o}s infinite}`).join(''));
    r.push(REDUCED_MOTION_CSS);
  }
  return r.join('');
}

function defs(shape: Shape, langs: readonly LanguageStat[]): string {
  const pat = (id: string, w: number, rot: number, body: string) =>
    `<pattern id="${id}" width="${w}" height="${w}" patternUnits="userSpaceOnUse" patternTransform="rotate(${rot})">${body}</pattern>`;
  const s = [SHAPES[shape]];
  // Heat hatches: sparse diagonal -> dense diagonal -> cross-hatch (h4 is solid).
  s.push(pat('p1', 6, 45, '<path class="k k1" stroke-width="1.3" d="M3 0V6"/>'));
  s.push(pat('p2', 3.5, 45, '<path class="k k2" stroke-width="1.3" d="M1.75 0V3.5"/>'));
  s.push(pat('p3', 4, 45, '<path class="k k3" stroke-width="1.2" d="M2 0V4M0 2H4"/>'));
  // Language "material" section hatches: one angle/density per language, so
  // the key never relies on colour alone.
  const LH: Array<[number, number, string]> = [
    [4, 45, 'M2 0V4'], [4, -45, 'M2 0V4'], [4, 0, 'M0 2H4'], [4, 90, 'M0 2H4'], [5, 45, 'M2.5 0V5M0 2.5H5'],
  ];
  langs.forEach((_, i) => {
    const [w, rot, d] = LH[i % LH.length] as [number, number, string];
    s.push(pat(`q${i}`, w, rot, `<rect width="${w}" height="${w}" class="jb${i}"/><path class="k j${i}" stroke-width="1.1" d="${d}"/>`));
  });
  // Drafting grid: 10 px minor, 50 px major.
  let minor = '';
  for (let k = 10; k < 50; k += 10) minor += `M${k} 0V50M0 ${k}H50`;
  s.push(`<pattern id="gp" width="50" height="50" patternUnits="userSpaceOnUse"><path class="gm" d="${minor}"/><path class="gM" d="M0 0H50M0 0V50"/></pattern>`);
  return `<defs>${s.join('')}</defs>`;
}

/* ------------------------------------------------------------------ */
/* Sheet: card, trim line, grid, thick inner border, zone ticks        */
/* (zone numbers/letters dropped: unreadable at README widths)         */
/* ------------------------------------------------------------------ */
function sheet(W: number, H: number): string {
  const s: string[] = [];
  s.push(`<rect class="card" x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="4"/>`);
  s.push(`<rect x="${M}" y="${M}" width="${W - 2 * M}" height="${H - 2 * M}" fill="url(#gp)"/>`);
  s.push(`<rect class="ex" x="6" y="6" width="${W - 12}" height="${H - 12}"/>`);
  s.push(`<rect class="th" x="${M}" y="${M}" width="${W - 2 * M}" height="${H - 2 * M}"/>`);
  let d = '';
  const nx = Math.max(2, Math.round((W - 2 * M) / 110));
  const zx = (W - 2 * M) / nx;
  for (let k = 1; k < nx; k++) d += `M${f(M + k * zx)} 6V${M}M${f(M + k * zx)} ${H - 6}V${H - M}`;
  const ny = Math.max(2, Math.round((H - 2 * M) / 110));
  const zy = (H - 2 * M) / ny;
  for (let k = 1; k < ny; k++) d += `M6 ${f(M + k * zy)}H${M}M${W - 6} ${f(M + k * zy)}H${W - M}`;
  s.push(`<path class="ex" d="${d}"/>`);
  return s.join('');
}

/* ------------------------------------------------------------------ */
/* Core: plan view with centre lines, cutting plane, dimensions        */
/* ------------------------------------------------------------------ */
interface Layout {
  pos: Pos[];
  cells: CellContent[];
  n: number;
  /** Cells that hold days (commit: all, hybrid: inner 65 %, language: 0). */
  inner: number;
}

function layout(input: StyleInput, shape: Shape): Layout {
  const pos = lattice(shape);
  const cells = assignCells(input, pos.length);
  const n = pos.length;
  const inner = input.mode === 'commit' ? n : input.mode === 'hybrid' ? Math.round(n * HYBRID_INNER_FRACTION) : 0;
  return { pos, cells, n, inner };
}

interface Peak {
  p: Pos;
  count: number;
  date: string;
}

/** The drawn cell of the peak day (summary.peakDate), else the hottest drawn day. */
function peakCell(L: Layout, peakDate: string): Peak | null {
  let best: Peak | null = null;
  for (let i = 0; i < L.cells.length; i++) {
    const c = L.cells[i];
    const p = L.pos[i];
    if (!c || c.kind !== 'day' || !p || c.day.count <= 0) continue;
    if (c.day.date === peakDate) return { p, count: c.day.count, date: c.day.date };
    if (!best || c.day.count > best.count) best = { p, count: c.day.count, date: c.day.date };
  }
  return best;
}

/**
 * Leader from the balloon to the BR note, routed only through lattice gap
 * lanes so it never crosses a channel: a vertical lane down to the shoulder
 * lane between the two bottom rows (square/round/circle), or — for hex, whose
 * shifted rows leave no vertical lanes — a horizontal lane out past the core.
 */
function leader(cx: number, cy: number, hex: boolean): string {
  const k = Math.sqrt(14 * 14 - 11 * 11); // balloon r 14 meets a lane 11 px off-centre
  if (hex) return `M${f(cx + k)} ${f(cy + 11)}H624V${SHOULDER_Y}H640`;
  const lane = cx + 11;
  if (lane >= MIN_LANE_X) return `M${f(lane)} ${f(cy + k)}V${SHOULDER_Y}H640`;
  return `M${f(cx + k)} ${f(cy + 11)}H${MIN_LANE_X}V${SHOULDER_Y}H640`;
}

function drawCore(input: StyleInput, L: Layout, shape: Shape, legend: boolean): string {
  const { mode, rng } = input;
  const bands: string[][] = [[], [], [], [], [], []];
  L.pos.forEach((p, i) => {
    const cell = L.cells[i] ?? { kind: 'empty' };
    let cls: string;
    if (cell.kind === 'day') cls = cell.day.level ? `h${cell.day.level} d${Math.floor(rng() * 6)}` : 'h0';
    else if (cell.kind === 'lang') cls = `g${cell.langIndex} d${Math.floor(rng() * 6)}`;
    else cls = 'x';
    const band = bands[Math.min(5, Math.floor((p.dist / R) * 6))] as string[];
    band.push(`<use href="#c" x="${f(p.cx - 8)}" y="${f(p.cy - 8)}" class="${cls}"/>`);
  });

  const s: string[] = [];
  // Core boundary (plotted in) and half-radius hidden line.
  s.push(`<circle class="ph" cx="${C}" cy="${C}" r="${RB / 2}"/>`);
  s.push(`<circle class="ln dw" pathLength="100" cx="${C}" cy="${C}" r="${RB}"/>`);
  s.push(`<g class="cells">${bands.map((b, i) => `<g class="b${i}">${b.join('')}</g>`).join('')}</g>`);

  // Centre lines (chain) through the lattice gaps + cutting plane A-A.
  s.push(`<path class="cl" d="M${C} 44V636M46 ${C}H630"/>`);
  s.push(`<path class="cp" d="M${C} 24V44M${C} 636V656"/>`);
  s.push(`<path class="ex" d="M${C} 30H326M${C} 650H326"/>`, arrow(318, 30, -1, 0), arrow(318, 650, -1, 0));
  s.push(t('sl c', 304, 35.5, 'A'), t('sl c', 304, 655.5, 'A'));

  // Diameter dimension on the right.
  s.push(`<path class="ex dw" pathLength="100" d="M352 ${C - RB}H660M352 ${C + RB}H660M652 ${C - RB}V${C + RB}"/>`);
  s.push(arrow(652, C - RB, 0, -1), arrow(652, C + RB, 0, 1));
  s.push(`<text class="dm mo c" transform="translate(645 ${C}) rotate(-90)">\u00D8 11.8 m</text>`);

  // Hybrid: phantom line where the commit core meets the language rim.
  const a = L.pos[L.inner - 1];
  const b = L.pos[L.inner];
  if (mode === 'hybrid' && a && b) {
    s.push(`<circle class="ph" cx="${C}" cy="${C}" r="${f((a.dist + b.dist) / 2 + 3)}"/>`);
  }

  // BR: detail balloon on the peak-day channel, or the primary fuel.
  if (mode !== 'language') {
    const pk = peakCell(L, input.summary.peakDate);
    if (pk) {
      s.push(`<circle class="acs" cx="${f(pk.p.cx)}" cy="${f(pk.p.cy)}" r="14"/>`);
      s.push(`<path class="acs" stroke-width="1" d="${leader(pk.p.cx, pk.p.cy, shape === 'hex')}"/>`);
      s.push(t('lb ac e', 640, 598, 'DETAIL B \u00B7 PEAK DAY'), t('sm mo e', 640, 616, `${grouped(pk.count)} / DAY \u00B7 ${pk.date}`));
    }
  } else if (input.langs[0]) {
    const l0 = input.langs[0];
    s.push(t('lb ac e', 640, 598, 'PRIMARY FUEL'), t('sm mo e', 640, 616, `${truncate(l0.name, 18)} ${num(l0.pct)}%`));
  }

  // TL: view title + identity.
  s.push(t('lb', 34, 46, 'PLAN VIEW \u00B7 SEC. A\u2013A'));
  s.push(t('us mo', 34, 70, `@${truncate(input.username, 19)}`));
  s.push(t('sm mo', 34, 88, `${mode.toUpperCase()} \u00B7 ${L.n} CH`));

  // BL: drawing notes.
  const note1 = { commit: '1. HATCH DENSITY = COMMITS/DAY', language: '1. HATCH = LANGUAGE MATERIAL', hybrid: '1. CORE COMMITS \u00B7 RIM LANGUAGES' }[mode];
  const note2 = mode === 'language' ? '2. CH 001 = TOP FUEL, AT CENTRE' : '2. CH 001 = NEWEST DAY, AT CENTRE';
  s.push(t('lb', 34, 590, 'NOTES'), t('sm', 34, 607, note1), t('sm', 34, 623, note2), t('sm', 34, 639, '3. PITCH 250 mm \u00B7 24 \u00D7 24'));

  // TR: hatch key (core view) or north arrow (full views; key lives in the panel).
  if (legend && mode !== 'language') {
    s.push(t('lb', 524, 78, 'HATCH KEY'));
    for (let i = 0; i < 5; i++) s.push(`<use href="#c" x="${524 + i * 24}" y="86" class="h${i}" stroke-width="1"/>`);
    s.push(t('sm mo c', 532, 118, '0'), t('sm mo e', 640, 118, 'MAX'));
  } else {
    s.push(`<circle class="ln" cx="612" cy="104" r="14"/><path class="ah" d="M612 89L605 113L612 108L619 113Z"/>`);
    s.push(t('sl c', 612, 84, 'N'));
  }
  return s.join('');
}

/* ------------------------------------------------------------------ */
/* Panel: drawing title block with ruled stat cells                    */
/* ------------------------------------------------------------------ */
interface Block {
  h: number;
  draw: (x: number, y: number, w: number) => string;
}

function row(label: string, value: string): Block {
  return {
    h: 38,
    draw: (x, y, w) =>
      `<path class="rl" d="M${f(x + w * 0.54)} ${y}V${y + 38}M${x} ${y + 38}H${x + w}"/>` +
      t('lb', x + 10, y + 24, label) +
      t('v mo e', x + w - 10, y + 27, value),
  };
}

function blocks(input: StyleInput): Record<StatKey, Block> & { key: Block | null } {
  const S = input.summary;
  const langs = input.langs;
  return {
    total: {
      h: 84,
      draw: (x, y, w) =>
        `<path class="rl" d="M${x} ${y + 84}H${x + w}"/>` +
        t('lb', x + 10, y + 20, 'TOTAL OUTPUT') +
        t('hv mo', x + 8, y + 58, grouped(S.total)) +
        t('sm mo', x + 10, y + 76, truncate(`CONTRIBUTIONS / ${S.window} D`, monoFit(w - 20))),
    },
    active: row('ACTIVE DAYS', `${grouped(S.active)} D`),
    idle: row('IDLE DAYS', `${grouped(S.idle)} D`),
    peak: row('PEAK / DAY', grouped(S.peak)),
    streak: row('STREAK', `${grouped(S.currentStreak)} D`),
    longest: row('LONGEST RUN', `${grouped(S.longestStreak)} D`),
    languages: {
      h: 30 + 26 * Math.max(1, langs.length),
      draw: (x, y, w) => {
        let s = t('lb', x + 10, y + 20, 'FUEL \u00B7 SECTION KEY');
        const maxN = Math.max(4, Math.floor((w - 32 - 10 - 52) / 7.8));
        if (!langs.length) s += t('sm mo', x + 10, y + 46, 'NO LANGUAGE DATA');
        langs.forEach((l, i) => {
          const y0 = y + 28 + i * 26;
          s +=
            `<rect x="${x + 10}" y="${y0 + 5}" width="14" height="14" class="g${i}"/>` +
            t('nm', x + 32, y0 + 17, truncate(l.name, maxN)) +
            t('pc mo e', x + w - 10, y0 + 18, `${num(l.pct)}%`) +
            `<path class="rl" stroke-dasharray="1 3" d="M${x + 32} ${y0 + 24}H${x + w - 10}"/>`;
        });
        const h = 30 + 26 * Math.max(1, langs.length);
        return s + `<path class="rl" d="M${x} ${y + h}H${x + w}"/>`;
      },
    },
    key:
      input.mode === 'language'
        ? null
        : {
            h: 74,
            draw: (x, y, w) => {
              const [q0, q1, q2] = S.thresholds;
              const labs = ['0', `\u2264${q0}`, `\u2264${q1}`, `\u2264${q2}`, `${q2 + 1}+`];
              let s = t('lb', x + 10, y + 20, 'HATCH KEY \u00B7 /DAY');
              const pitch = Math.min(34, (w - 20) / 5);
              labs.forEach((lab, i) => {
                const cx = x + 10 + i * pitch + 9;
                s += `<rect x="${f(cx - 9)}" y="${y + 30}" width="18" height="18" class="h${i}"/>` + t('sm mo c', cx, y + 64, lab);
              });
              return s + `<path class="rl" d="M${x} ${y + 74}H${x + w}"/>`;
            },
          },
  };
}

/** REMARKS filler: real figures only, sized to the column width. */
function remarks(input: StyleInput, w: number): string[] {
  const S = input.summary;
  if (input.mode === 'language') {
    const l0 = input.langs[0];
    const real = input.langs.filter((l) => l.name !== 'Other').length;
    return l0 ? [`${real} FUEL TYPES`, `PRIMARY ${l0.name}`] : ['NO LANGUAGE DATA'];
  }
  const avg = `AVG ${S.avgPerActive.toFixed(1)} / ACTIVE DAY`;
  const win = `WINDOW ${S.window} D \u00B7 IDLE ${S.idle} D`;
  return win.length <= monoFit(w - 20) ? [win, avg] : [`WINDOW ${S.window} D`, `IDLE ${S.idle} D`, avg];
}

function drawRemarks(input: StyleInput, x: number, y: number, w: number, room: number): string {
  const lines = remarks(input, w);
  if (room < 30 + 17 * lines.length) return '';
  return t('lb', x + 10, y + 20, 'REMARKS') + lines.map((l, i) => t('sm mo', x + 10, y + 40 + i * 17, truncate(l, monoFit(w - 20)))).join('');
}

function head(input: StyleInput, n: number, x: number, y: number, w: number): string {
  return (
    t('lb', x + 10, y + 20, 'markdown-RBMK \u00B7 TITLE') +
    t('ti', x + 10, y + 42, w > 260 ? 'REACTOR CORE \u2014 PLAN' : 'REACTOR CORE PLAN') +
    t('sm mo', x + 10, y + 58, `${input.mode.toUpperCase()} MODE \u00B7 ${n} CH`) +
    `<path class="rl" d="M${x} ${y + HEAD_H}H${x + w}"/>`
  );
}

/** Title-block grid: DRAWN BY row, then 2-up cells. */
function titleGrid(input: StyleInput, dwg: string, x: number, y: number, w: number, rh: number): string {
  const date = input.summary.latestDate || '\u2014';
  const cells: Array<Array<[string, string]>> = [
    [['DRAWN BY', `@${input.username}`]],
    [['DATE', date], ['DWG NO.', dwg]],
    [['SCALE', '1 : 20'], ['SHEET', '1 / 1']],
    [['STYLE', 'BLUEPRINT'], ['REV', 'A']],
  ];
  let s = '';
  cells.forEach((rw, r) => {
    const y0 = y + r * rh;
    const cw = w / rw.length;
    s += `<path class="rl" d="M${x} ${f(y0)}H${x + w}"/>`;
    rw.forEach(([lab, val], k) => {
      const x0 = x + k * cw;
      if (k) s += `<path class="rl" d="M${f(x0)} ${f(y0)}V${f(y0 + rh)}"/>`;
      const maxC = Math.max(4, Math.floor((cw - 18) / 8.4));
      s += t('lb', x0 + 10, y0 + 16, lab) + t('cv mo', x0 + 10, y0 + rh - 10, truncate(val, maxC));
    });
  });
  return s;
}

function drawPanel(input: StyleInput, n: number, dwg: string, px: number, py: number, pw: number, ph: number, vertical: boolean): string {
  const B = blocks(input);
  const list: Block[] = resolveStats(input).map((k) => B[k]);
  if (B.key) list.push(B.key);
  const s: string[] = [];
  if (vertical) {
    const rh = 42;
    const gridTop = py + ph - 4 * rh;
    s.push(head(input, n, px, py, pw));
    let y = py + HEAD_H;
    for (const b of list) {
      if (y + b.h > gridTop) break; // overflow dropped, never overlapped
      s.push(b.draw(px, y, pw));
      y += b.h;
    }
    s.push(drawRemarks(input, px, y, pw, gridTop - y));
    s.push(titleGrid(input, dwg, px, gridTop, pw, rh));
  } else {
    // Columns A, B hold stat blocks (height-balanced), column C the title block.
    const wA = Math.round(pw * 0.37);
    const wB = Math.round(pw * 0.29);
    const wC = pw - wA - wB;
    const cols: Array<[number, number]> = [[px, wA], [px + wA, wB]];
    const used = [0, 0];
    const sum = list.reduce((a, b) => a + b.h, 0);
    let col = 0;
    let y = py;
    for (const b of list) {
      if (col === 0 && y > py && (y - py + b.h > sum / 2 + 20 || y + b.h > py + ph)) {
        col = 1;
        y = py;
      }
      if (y + b.h > py + ph) break; // overflow dropped
      const [cx, cw] = cols[col] as [number, number];
      s.push(b.draw(cx, y, cw));
      y += b.h;
      used[col] = y - py;
    }
    // REMARKS go in the first column with room (B first, it is usually shorter).
    for (const k of [1, 0]) {
      const [cx, cw] = cols[k] as [number, number];
      const r = drawRemarks(input, cx, py + (used[k] ?? 0), cw, ph - (used[k] ?? 0));
      if (r) {
        s.push(r);
        break;
      }
    }
    const cx = px + wA + wB;
    s.push(`<path class="th" d="M${px + wA} ${py}V${py + ph}M${cx} ${py}V${py + ph}"/>`);
    s.push(head(input, n, cx, py, wC));
    s.push(titleGrid(input, dwg, cx, py + HEAD_H, wC, (ph - HEAD_H) / 4));
  }
  return s.join('');
}

/* ------------------------------------------------------------------ */
/* Document assembly                                                   */
/* ------------------------------------------------------------------ */
export function render(input: StyleInput): string {
  const base = PRESETS[input.preset] ?? (PRESETS.dark as Palette);
  const P: Palette = {
    ...base,
    ...(input.accent ? { accent: input.accent } : {}),
    ...(input.heat ? { idle: input.heat[0], heat: [input.heat[1], input.heat[2], input.heat[3], input.heat[4]] as const } : {}),
  };
  const shape: Shape = input.cell === 'default' ? 'square' : input.cell;
  const dwg = `RB-${1000 + Math.floor(input.rng() * 9000)}`;
  const L = layout(input, shape);
  const V = input.panel === 'right';

  let W: number;
  let H: number;
  let body: string;
  if (input.view === 'core') {
    W = H = CORE;
    body = sheet(W, H) + drawCore(input, L, shape, true);
  } else if (input.view === 'panel') {
    W = V ? PW + 2 * M : CORE;
    H = V ? CORE : PH + 2 * M;
    body = sheet(W, H) + `<g class="pp">${drawPanel(input, L.n, dwg, M, M, W - 2 * M, H - 2 * M, V)}</g>`;
  } else {
    W = V ? CORE + PW : CORE;
    H = V ? CORE : CORE + PH;
    const core = drawCore(input, L, shape, false);
    const pan = V
      ? drawPanel(input, L.n, dwg, CORE, M, PW - M, CORE - 2 * M, true)
      : drawPanel(input, L.n, dwg, M, CORE, CORE - 2 * M, PH - M, false);
    const sep = V ? `M${CORE} ${M}V${H - M}` : `M${M} ${CORE}H${W - M}`;
    body = sheet(W, H) + core + `<path class="th" d="${sep}"/><g class="pp">${pan}</g>`;
  }

  const S = input.summary;
  const title = `markdown-RBMK blueprint style: reactor core drawing for @${input.username}, ${input.mode} mode`;
  const parts: string[] = [];
  if (input.mode !== 'language') {
    parts.push(
      `${grouped(S.total)} contributions over ${S.window} days`,
      `${S.active} active days`,
      `peak ${S.peak} per day`,
      `current streak ${S.currentStreak} days`,
      `longest run ${S.longestStreak} days`,
    );
  }
  if (input.mode !== 'commit' && input.langs.length) {
    parts.push(`languages: ${input.langs.map((l) => `${l.name} ${num(l.pct)}%`).join(', ')}`);
  }
  const desc = parts.length ? `${parts.join('; ')}.` : 'No data.';

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">`,
    `<title>${escapeXml(title)}</title><desc>${escapeXml(desc)}</desc>`,
    `<style>${css(P, input.langs, input.animate)}</style>`,
    defs(shape, input.langs),
    body,
    '</svg>',
  ].join('');
}
