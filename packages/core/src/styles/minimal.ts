/**
 * Style `minimal` — quiet and GitHub-native. The core is the hero: one
 * hairline ring with four ticks around the cell lattice. The panel is a
 * typographic stat list with a slim segmented language bar.
 *
 * Ported from design/minimal/gen.mjs. Every cell is a `<use>` of one shared
 * `<defs>` shape, so rounded / circle / hex cells cost no more than squares.
 */
import type { LanguageStat } from '../types';
import {
  assignCells,
  escapeXml,
  grouped,
  MONO,
  num,
  REDUCED_MOTION_CSS,
  resolveStats,
  SANS,
  truncate,
} from './shared';
import type { CellShape, StatKey, StyleInput } from './types';

interface Palette {
  fg: string;
  muted: string;
  hairline: string;
  accent: string;
  /** [idle, h1, h2, h3, h4] */
  heat: readonly [string, string, string, string, string];
}

// `bg` is the intended page colour (never drawn — the badge is transparent).
// Measured contrast vs bg: fg 16.0 / 15.8 / 16.0, muted 6.5 / 6.1 / 6.7.
const PRESETS: Record<string, Palette & { bg: string }> = {
  dark: {
    bg: '#0d1117',
    fg: '#e6edf3',
    muted: '#9198a1',
    hairline: '#30363d',
    accent: '#4493f8',
    heat: ['#1b2129', '#0e4429', '#006d32', '#26a641', '#39d353'],
  },
  light: {
    bg: '#ffffff',
    fg: '#1f2328',
    muted: '#59636e',
    hairline: '#d1d9e0',
    accent: '#0969da',
    heat: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
  },
  cherenkov: {
    bg: '#0d1117',
    fg: '#e6edf3',
    muted: '#8b9bb4',
    hairline: '#1f2a44',
    accent: '#8fd3ff',
    heat: ['#161c2e', '#0c2d57', '#1558a8', '#2f8cf0', '#8fd3ff'],
  },
};

const MODE_LABEL = { commit: 'COMMIT CORE', language: 'LANGUAGE CORE', hybrid: 'HYBRID CORE' } as const;
const END = ' text-anchor="end"';
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

/** One shared cell shape per badge, 16x16 box at the origin. */
const SHAPE_DEFS: Record<Exclude<CellShape, 'default'>, string> = {
  square: '<rect id="c" width="16" height="16"/>',
  round: '<rect id="c" width="16" height="16" rx="4"/>',
  circle: '<circle id="c" cx="8" cy="8" r="8"/>',
  hex: '<path id="c" d="M8-1l7.8 4.5v9L8 17 .2 12.5v-9z"/>',
};

const txt = (x: number, y: number, s: string, cls: string, extra = '') =>
  `<text x="${num(x)}" y="${num(y)}" class="${cls}"${extra}>${escapeXml(s)}</text>`;
const hline = (x1: number, x2: number, y: number) =>
  `<path class="hl" d="M${x1} ${y}H${x2}" vector-effect="non-scaling-stroke"/>`;
const langColor = (l: LanguageStat) => (HEX_COLOR.test(l.color) ? l.color : '#8b949e');
const pct = (l: LanguageStat) => `${num(l.pct)}%`;

interface Ctx {
  input: StyleInput;
  shape: Exclude<CellShape, 'default'>;
  stats: Array<[string, string]>;
  showLangs: boolean;
  showHeat: boolean;
}

function statValue(k: StatKey, input: StyleInput): [string, string] {
  const s = input.summary;
  switch (k) {
    case 'total':
      return [grouped(s.total), 'CONTRIBUTIONS'];
    case 'active':
      return [grouped(s.active), 'ACTIVE DAYS'];
    case 'idle':
      return [grouped(s.idle), 'IDLE DAYS'];
    case 'peak':
      return [grouped(s.peak), 'PEAK DAY'];
    case 'streak':
      return [`${s.currentStreak}d`, 'STREAK'];
    case 'longest':
      return [`${s.longestStreak}d`, 'BEST STREAK'];
    case 'languages':
      return [String(input.langs.filter((l) => l.name !== 'Other').length || input.langs.length), 'LANGUAGES'];
  }
}

// ---------------------------------------------------------------- style
function css(p: Palette, input: StyleInput): string {
  const heat = p.heat.map((c, i) => `.h${i}{fill:${c}}`).join('');
  const lang = input.langs.map((l, i) => `.l${i}{fill:${langColor(l)}}`).join('');
  let anim = '';
  if (input.animate) {
    const rings = [0, 1, 2, 3, 4, 5].map((k) => `.r${k}{animation:on .7s ${num(k * 0.2)}s ease-out backwards}`).join('');
    const flux = [0, 1, 2, 3, 4, 5].map((k) => `.d${k}{animation:flux 6s ${2 + k}s ease-in-out infinite}`).join('');
    const delay = input.view === 'panel' ? 0.1 : 1.3;
    anim =
      '@keyframes on{from{opacity:.05}}@keyframes flux{50%{opacity:.5}}' +
      rings +
      flux +
      `.pn{animation:on .9s ${delay}s ease-out backwards}` +
      REDUCED_MOTION_CSS;
  }
  return (
    '<style>' +
    `.fg{fill:${p.fg}}.mu{fill:${p.muted}}.ac{fill:${p.accent}}.acs{fill:none;stroke:${p.accent}}` +
    `.hl{fill:none;stroke:${p.hairline};stroke-width:1}${heat}.nd{opacity:.45}${lang}` +
    `text{font-family:${MONO}}` +
    `.n{font-family:${SANS};font-variant-numeric:tabular-nums}` +
    '.cap{font-size:13px;letter-spacing:1.2px}.t1{font-size:18px;font-weight:600}' +
    '.big{font-size:48px;font-weight:600;letter-spacing:-1px}.hr{font-size:40px}.mid{font-size:26px;font-weight:500}.sm{font-size:14px}' +
    anim +
    '</style>'
  );
}

// ---------------------------------------------------------------- core
function lattice(hex: boolean) {
  const out: Array<{ x: number; y: number; dist: number }> = [];
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 24; j++) {
      const x = 42 + 22 * i + (hex ? (j % 2 ? 5.5 : -5.5) : 0);
      const y = 42 + 22 * j;
      const dist = Math.hypot(x + 8 - 300, y + 8 - 300);
      if (dist <= 270) out.push({ x, y, dist });
    }
  }
  return out.sort((a, b) => a.dist - b.dist || a.x - b.x || a.y - b.y);
}

function core(c: Ctx): string {
  const { input } = c;
  const pos = lattice(c.shape === 'hex');
  const cells = assignCells(input, pos.length);
  const maxDist = pos[pos.length - 1]?.dist || 1;
  const pulse = (p: number) => (input.animate && input.rng() < p ? ` d${Math.floor(input.rng() * 6)}` : '');
  const rings: string[][] = [[], [], [], [], [], []];

  pos.forEach((p, i) => {
    const cell = cells[i] ?? { kind: 'empty' as const };
    let cls: string;
    if (cell.kind === 'day') cls = cell.day.level ? `h${cell.day.level}${pulse(1)}` : 'h0';
    else if (cell.kind === 'lang') cls = `l${cell.langIndex}${pulse(0.4)}`;
    else cls = 'h0 nd';
    const ring = rings[Math.min(5, Math.floor((p.dist / maxDist) * 6))] as string[];
    ring.push(`<use href="#c" x="${num(p.x)}" y="${p.y}" class="${cls}"/>`);
  });

  const today = pos[0];
  const ring =
    today && cells[0]?.kind === 'day'
      ? `<circle class="acs" cx="${num(today.x + 8)}" cy="${today.y + 8}" r="14" stroke-width="1.5"/>`
      : '';
  return (
    '<g>' +
    '<circle class="hl" cx="300" cy="300" r="288" vector-effect="non-scaling-stroke"/>' +
    '<path class="hl" d="M300 4V12M300 588V596M4 300H12M588 300H596" vector-effect="non-scaling-stroke"/>' +
    rings.map((r, k) => `<g class="r${k}">${r.join('')}</g>`).join('') +
    ring +
    '</g>'
  );
}

// ---------------------------------------------------------------- panel pieces
function header(x: number, y: number, c: Ctx, maxName: number): string {
  const { input } = c;
  const sub =
    input.mode === 'language'
      ? `${MODE_LABEL.language} · ${input.langs.length} LANGS`
      : `${MODE_LABEL[input.mode]} · ${input.summary.window} DAYS`;
  return (
    `<circle class="ac" cx="${x + 4}" cy="${y - 6}" r="4"/>` +
    txt(x + 16, y, `@${truncate(input.username, maxName)}`, 'n fg t1') +
    txt(x, y + 24, sub, 'cap mu')
  );
}

function segBar(x: number, y: number, w: number, langs: readonly LanguageStat[]): string {
  const gap = 2;
  const avail = w - gap * (langs.length - 1);
  const totalPct = langs.reduce((s, l) => s + l.pct, 0) || 1;
  let cx = x;
  return langs
    .map((l, i) => {
      const sw = i === langs.length - 1 ? x + w - cx : Math.round((l.pct / totalPct) * avail * 10) / 10;
      const s = `<rect class="l${i}" x="${num(cx)}" y="${y}" width="${num(Math.max(1, sw))}" height="8" rx="2"/>`;
      cx += sw + gap;
      return s;
    })
    .join('');
}

const swatch = (x: number, y: number, k: number) =>
  `<use href="#c" class="h${k}" transform="translate(${x} ${y}) scale(.75)"/>`;

// ---------------------------------------------------------------- column panel (right)
function panelColumn(x0: number, xr: number, c: Ctx): string {
  const { input } = c;
  const out = [header(x0, 64, c, 18), hline(x0, xr, 112)];
  let y = 112;
  const [hero, ...more] = c.stats;
  if (hero) {
    out.push(txt(x0, 172, hero[0], 'n fg big'), txt(x0, 198, hero[1], 'cap mu'));
    const colW = Math.floor((xr - x0) / 2);
    const rest = more.slice(0, 4); // overflow dropped, never overlapped
    rest.forEach(([v, l], i) => {
      const x = x0 + (i % 2) * colW;
      const sy = 252 + Math.floor(i / 2) * 70;
      out.push(txt(x, sy, v, 'n fg mid'), txt(x, sy + 22, l, 'cap mu'));
    });
    y = rest.length ? 252 + (Math.ceil(rest.length / 2) - 1) * 70 + 48 : 222;
    if (c.showLangs || c.showHeat) out.push(hline(x0, xr, y));
  }
  if (c.showLangs) {
    const langs = input.langs;
    out.push(txt(x0, y + 30, 'LANGUAGES', 'cap mu'), segBar(x0, y + 44, xr - x0, langs));
    const first = y + 78;
    const limit = c.showHeat ? 552 : 588;
    const pitch = langs.length > 1 ? Math.max(18, Math.min(24, (limit - first) / (langs.length - 1))) : 24;
    let rows = Math.max(1, Math.floor((limit - first) / pitch) + 1);
    if (rows < langs.length) rows = Math.max(1, rows - 1); // leave a line for "+N more"
    const shown = langs.slice(0, Math.min(rows, langs.length));
    shown.forEach((l, i) => {
      const ly = first + i * pitch;
      out.push(
        `<circle class="l${i}" cx="${x0 + 5}" cy="${num(ly - 5)}" r="5"/>`,
        txt(x0 + 18, ly, truncate(l.name, 16), 'n fg sm'),
        txt(xr, ly, pct(l), 'n mu sm', END),
      );
    });
    if (shown.length < langs.length) {
      out.push(txt(x0 + 18, first + shown.length * pitch, `+${langs.length - shown.length} more`, 'n mu sm'));
    }
    y = first + (shown.length - 1) * pitch;
  }
  if (c.showHeat) {
    const hy = c.showLangs ? Math.max(y + 40, 582) : y + 36;
    out.push(txt(x0, hy, 'LESS', 'cap mu'));
    for (let k = 0; k < 5; k++) out.push(swatch(x0 + 46 + k * 16, hy - 11, k));
    out.push(txt(x0 + 130, hy, 'MORE', 'cap mu'));
  }
  return `<g class="pn">${out.join('')}</g>`;
}

// ---------------------------------------------------------------- row panel (bottom / standalone)
const ROW_X0 = 24;
const ROW_XR = 576;

/** Inline legend layout: [x, y-offset] per language, wrapping. */
function legendLayout(langs: readonly LanguageStat[]): Array<[number, number, string]> {
  let x = ROW_X0;
  let row = 0;
  return langs.map((l) => {
    const name = truncate(l.name, 12);
    const w = 18 + (name.length + pct(l).length + 1) * 6.9 + 18;
    if (x + w > ROW_XR + 18 && x > ROW_X0) {
      x = ROW_X0;
      row++;
    }
    const at: [number, number, string] = [x, row * 22, name];
    x += w;
    return at;
  });
}

function rowLayout(c: Ctx) {
  const barY = c.stats.length ? 172 : 84;
  const legend = c.showLangs ? legendLayout(c.input.langs) : [];
  const legendRows = legend.length ? (legend[legend.length - 1]?.[1] ?? 0) / 22 + 1 : 0;
  const height = c.showLangs ? barY + 36 + (legendRows - 1) * 22 + 24 : c.stats.length ? 170 : 84;
  return { barY, legend, height };
}

function panelRow(oy: number, c: Ctx): string {
  const { input } = c;
  const x0 = ROW_X0;
  const xr = ROW_XR;
  const lay = rowLayout(c);
  const out = [header(x0, oy + 40, c, c.showHeat ? 24 : 34)];
  if (c.showHeat) {
    out.push(txt(xr, oy + 40, 'MORE', 'cap mu', END));
    for (let k = 0; k < 5; k++) out.push(swatch(xr - 116 + k * 16, oy + 29, k));
    out.push(txt(xr - 122, oy + 40, 'LESS', 'cap mu', END));
  }
  if (c.stats.length) {
    // hero column is wider (176) so a 6-digit total at 40px never collides
    const heroW = 176;
    const colW = (xr - x0 - heroW) / 3;
    c.stats.slice(0, 4).forEach(([v, l], i) => {
      const x = Math.round(i === 0 ? x0 : x0 + heroW + (i - 1) * colW);
      out.push(txt(x, oy + 124, v, `n fg ${i === 0 ? 'big hr' : 'mid'}`), txt(x, oy + 148, l, 'cap mu'));
    });
  }
  if (c.showLangs) {
    const by = oy + lay.barY;
    out.push(segBar(x0, by, xr - x0, input.langs));
    lay.legend.forEach(([x, dy, name], i) => {
      const y = by + 36 + dy;
      const l = input.langs[i] as LanguageStat;
      out.push(
        `<circle class="l${i}" cx="${num(x + 5)}" cy="${y - 5}" r="5"/>`,
        `<text x="${num(x + 18)}" y="${y}" class="n fg sm">${escapeXml(name)} <tspan class="mu">${pct(l)}</tspan></text>`,
      );
    });
  }
  return `<g class="pn">${out.join('')}</g>`;
}

// ---------------------------------------------------------------- render
export function render(input: StyleInput): string {
  const base = PRESETS[input.preset] ?? PRESETS.dark!;
  const p: Palette = {
    fg: base.fg,
    muted: base.muted,
    hairline: base.hairline,
    accent: input.accent ?? base.accent,
    heat: input.heat ?? base.heat,
  };
  const c: Ctx = {
    input,
    shape: input.cell === 'default' ? 'square' : input.cell,
    stats: resolveStats(input).map((k) => statValue(k, input)),
    showLangs: input.mode !== 'commit' && input.langs.length > 0,
    showHeat: input.mode !== 'language',
  };

  let w: number;
  let h: number;
  let body: string;
  if (input.view === 'core') {
    w = 600;
    h = 600;
    body = core(c) + txt(8, 590, `@${truncate(input.username, 20)}`, 'cap mu');
  } else if (input.view === 'panel') {
    if (input.panel === 'right') {
      w = 288;
      h = 600;
      body = panelColumn(24, 264, c);
    } else {
      w = 600;
      h = rowLayout(c).height;
      body = panelRow(0, c);
    }
  } else if (input.panel === 'bottom') {
    w = 600;
    h = 600 + rowLayout(c).height;
    body = core(c) + panelRow(600, c);
  } else {
    w = 900;
    h = 600;
    body = core(c) + panelColumn(636, 880, c);
  }

  const s = input.summary;
  const desc =
    input.mode === 'language'
      ? `Top languages: ${input.langs.map((l) => `${l.name} ${pct(l)}`).join(', ')}.`
      : `${grouped(s.total)} contributions over ${s.window} days, ${s.active} active days, peak ${s.peak} in one day.`;
  const needsCells = input.view !== 'panel' || c.showHeat;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">` +
    `<title>markdown-RBMK minimal: @${escapeXml(input.username)} (${input.mode} mode)</title>` +
    `<desc>${escapeXml(desc)}</desc>` +
    css(p, input) +
    (needsCells ? `<defs>${SHAPE_DEFS[c.shape]}</defs>` : '') +
    body +
    '</svg>'
  );
}
