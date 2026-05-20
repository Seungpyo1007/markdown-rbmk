import type { RenderOptions, RenderMode, Theme } from './types';
import { computeGridPositions, distributeCells } from './grid';
import { buildHeatScale } from './contributions';
import { createRng, pick } from './rng';

const CENTER = 300;
/** Dot-grid mask radius (squared, for cheap comparison). */
const DOT_MASK_R2 = 275 * 275;
/** Fraction of cells that form the commit core in hybrid mode. */
const HYBRID_INNER_FRACTION = 0.65;

interface Palette {
  dot: string;
  outline: string;
  glowInner: string;
  glowMid: string;
  panelFrame: string;
  panelText: string;
  panelDim: string;
}

// Transparent background so the badge adapts to GitHub's light/dark theme.
const PALETTES: Record<Theme, Palette> = {
  dark: {
    dot: '#0d3a1a',
    outline: '#1a4a2a',
    glowInner: '#0a3a1a',
    glowMid: '#051a0a',
    panelFrame: '#1a4a2a',
    panelText: '#7fae8f',
    panelDim: '#3f6650',
  },
  light: {
    dot: '#c8e6c8',
    outline: '#888888',
    glowInner: '#bce3c8',
    glowMid: '#dcefe2',
    panelFrame: '#a8c8a8',
    panelText: '#4a6a55',
    panelDim: '#86a892',
  },
};

/** Commit-mode heat ramp for levels 1-4 (level 0 uses palette.dot). */
const HEAT_COLORS = ['#2ECC71', '#F1C40F', '#E67E22', '#E74C3C'];

/** One reactor cell: its fill colour and optional output number. */
interface Cell {
  color: string;
  value: number | null;
}

/** Trim a number to 2 decimals without trailing zeros. */
function num(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === '"' ? '&quot;' : '&apos;',
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Black or white text for a given fill — tuned (YIQ brightness ≥ 140) so the
 * reference palette comes out right where a plain luminance>0.5 test fails.
 */
function textColor(fill: string): string {
  const h = fill.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 140 ? '#000' : '#fff';
}

/** Background dot matrix: 25x25 of 2x2 dots, clipped to a circle. */
function dotGrid(palette: Palette): string {
  const dots: string[] = [];
  for (let i = 0; i < 25; i++) {
    for (let j = 0; j < 25; j++) {
      const x = 38 + 22 * i;
      const y = 38 + 22 * j;
      const dx = x + 1 - CENTER;
      const dy = y + 1 - CENTER;
      if (dx * dx + dy * dy <= DOT_MASK_R2) {
        dots.push(`<rect x="${x}" y="${y}" width="2" height="2" fill="${palette.dot}"/>`);
      }
    }
  }
  return `<g id="dot-grid">${dots.join('')}</g>`;
}

/** Decorative "output value" for language cells (SPEC 2.5) — null = blank. */
function pickValue(rng: () => number): number | null {
  if (rng() >= 0.45) return null;
  const r = rng();
  if (r < 0.55) return 0;
  if (r < 0.75) return pick(rng, [20, 40, 60, 80]);
  if (r < 0.92) return pick(rng, [100, 120, 140, 160, 180, 200]);
  return pick(rng, [220, 240, 260]);
}

/** A commit cell: colour by heat level, number = real count (shown sparsely). */
function commitCell(count: number | undefined, palette: Palette, heatLevel: (c: number) => number, rng: () => number): Cell {
  if (count === undefined) return { color: palette.dot, value: null }; // rim with no data
  const level = heatLevel(count);
  const color = level === 0 ? palette.dot : (HEAT_COLORS[level - 1] as string);
  const value = count > 0 && rng() < 0.5 ? count : null;
  return { color, value };
}

/** Build the per-cell colour/value array for a mode (consumes the RNG). */
function buildCells(mode: RenderMode, count: number, opts: RenderOptions, palette: Palette, rng: () => number): Cell[] {
  if (mode === 'language') {
    if (!opts.stats) throw new Error('render: language mode requires `stats`.');
    const langs = distributeCells(opts.stats.langs, count);
    return Array.from({ length: count }, (_, i) => ({
      color: langs[i]?.color ?? palette.dot,
      value: pickValue(rng),
    }));
  }

  if (mode === 'commit') {
    if (!opts.contributions) throw new Error('render: commit mode requires `contributions`.');
    const days = opts.contributions.days;
    const heat = buildHeatScale(days);
    return Array.from({ length: count }, (_, i) => commitCell(days[i]?.count, palette, heat, rng));
  }

  // hybrid: inner core = commit heatmap, outer rings = top languages
  if (!opts.stats || !opts.contributions) {
    throw new Error('render: hybrid mode requires both `stats` and `contributions`.');
  }
  const innerCount = Math.round(count * HYBRID_INNER_FRACTION);
  const days = opts.contributions.days;
  const heat = buildHeatScale(days);
  const outerLangs = distributeCells(opts.stats.langs, count - innerCount);
  return Array.from({ length: count }, (_, i) => {
    if (i < innerCount) return commitCell(days[i]?.count, palette, heat, rng);
    return { color: outerLangs[i - innerCount]?.color ?? palette.dot, value: pickValue(rng) };
  });
}

function svgText(
  x: number,
  y: number,
  content: string,
  size: number,
  fill: string,
  anchor: 'start' | 'middle' | 'end',
  weight = 400,
): string {
  return (
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" ` +
    `font-family="ui-monospace,monospace" font-weight="${weight}" fill="${fill}">${escapeXml(content)}</text>`
  );
}

/** The right-hand instrument panel (SPEC 2.8) — widens the viewBox to 800. */
function instrumentPanel(mode: RenderMode, opts: RenderOptions, palette: Palette): string {
  const parts: string[] = [];
  const divider = (y: number): string =>
    `<line x1="632" y1="${y}" x2="768" y2="${y}" stroke="${palette.panelFrame}" stroke-width="1" opacity="0.5"/>`;
  const statRow = (y: number, label: string, value: string): string =>
    svgText(632, y, label, 10, palette.panelDim, 'start', 500) +
    svgText(768, y, value, 12, palette.panelText, 'end', 700);

  parts.push(
    `<rect x="616" y="48" width="168" height="504" rx="3" fill="none" ` +
      `stroke="${palette.panelFrame}" stroke-width="1" opacity="0.7"/>`,
  );
  parts.push(svgText(632, 86, `@${truncate(opts.username, 19)}`, 13, palette.panelText, 'start', 600));
  parts.push(divider(100));

  // Commit summary — full block for commit mode, compact for hybrid.
  if (mode === 'commit' || mode === 'hybrid') {
    const c = opts.contributions!;
    const counts = c.days.map((d) => d.count);
    const activeDays = counts.filter((n) => n > 0).length;
    const peak = counts.reduce((m, n) => Math.max(m, n), 0);
    const compact = mode === 'hybrid';

    parts.push(
      svgText(700, compact ? 148 : 178, String(c.totalContributions), compact ? 30 : 38, palette.panelText, 'middle', 700),
    );
    parts.push(svgText(700, compact ? 168 : 202, 'CONTRIBUTIONS', 10, palette.panelDim, 'middle', 600));

    if (compact) {
      parts.push(statRow(200, 'ACTIVE DAYS', String(activeDays)));
      parts.push(statRow(224, 'PEAK / DAY', String(peak)));
      parts.push(divider(248));
    } else {
      parts.push(svgText(700, 220, `OVER ${c.days.length} DAYS`, 9, palette.panelDim, 'middle', 400));
      parts.push(divider(244));
      parts.push(statRow(282, 'ACTIVE DAYS', String(activeDays)));
      parts.push(statRow(312, 'IDLE DAYS', String(c.days.length - activeDays)));
      parts.push(statRow(342, 'PEAK / DAY', String(peak)));
      parts.push(divider(366));
      parts.push(svgText(632, 398, 'CORE OUTPUT', 10, palette.panelDim, 'start', 600));
      [palette.dot, ...HEAT_COLORS].forEach((col, i) => {
        parts.push(`<rect x="${632 + i * 27}" y="410" width="22" height="22" rx="1" fill="${col}"/>`);
      });
      parts.push(svgText(634, 452, 'idle', 9, palette.panelDim, 'start', 400));
      parts.push(svgText(766, 452, 'peak', 9, palette.panelDim, 'end', 400));
    }
  }

  // Language legend — the "control panel" fuel-channel table.
  if (mode === 'language' || mode === 'hybrid') {
    const langs = opts.stats!.langs;
    const baseY = mode === 'hybrid' ? 272 : 128;
    parts.push(svgText(632, baseY, 'FUEL CHANNELS', 10, palette.panelDim, 'start', 600));
    langs.forEach((lang, i) => {
      const y = baseY + 22 + i * (mode === 'hybrid' ? 26 : 48);
      parts.push(`<rect x="632" y="${y}" width="16" height="16" rx="1" fill="${lang.color}"/>`);
      parts.push(svgText(658, y + 13, truncate(lang.name, 13), 12, palette.panelText, 'start', 500));
      parts.push(svgText(768, y + 13, `${lang.pct}%`, 12, palette.panelText, 'end', 600));
    });
  }

  return `<g id="panel">${parts.join('')}</g>`;
}

/**
 * Render a reactor-core badge as a standalone, animated SVG string.
 *
 * - `commit`  : a contribution heatmap (cell colour = activity, number = count)
 * - `language`: concentric language rings (the top language fills the core)
 * - `hybrid`  : commit core + outer language rings
 */
export function render(opts: RenderOptions): string {
  const mode: RenderMode = opts.mode ?? 'commit';
  const palette = PALETTES[opts.theme ?? 'dark'];
  const showLegend = opts.showLegend ?? true;
  const positions = computeGridPositions();
  const rng = createRng(opts.username);
  const cells = buildCells(mode, positions.length, opts, palette, rng);

  const cellSvg: string[] = [];
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i]!;
    const cell = cells[i]!;
    const dur = 1.5 + rng() * 2; // 1.5s - 3.5s
    const begin = rng() * 2; // 0s - 2s

    cellSvg.push(
      `<rect x="${pos.cx}" y="${pos.cy}" width="16" height="16" rx="1" fill="${cell.color}">` +
        `<animate attributeName="opacity" values="0.85;1;0.85" dur="${num(dur)}s" begin="${num(begin)}s" repeatCount="indefinite"/>` +
        `</rect>`,
    );
    if (cell.value !== null) {
      cellSvg.push(
        `<text x="${pos.cx + 8}" y="${pos.cy + 11}" text-anchor="middle" font-size="8" ` +
          `font-family="ui-monospace,monospace" font-weight="600" fill="${textColor(cell.color)}">${cell.value}</text>`,
      );
    }
  }

  const width = showLegend ? 800 : 600;
  return [
    `<svg viewBox="0 0 ${width} 600" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${width}px;display:block">`,
    `<defs><radialGradient id="bg-glow" cx="50%" cy="50%" r="50%">`,
    `<stop offset="0%" stop-color="${palette.glowInner}" stop-opacity="0.6"/>`,
    `<stop offset="60%" stop-color="${palette.glowMid}" stop-opacity="0.3"/>`,
    `<stop offset="100%" stop-color="${palette.glowMid}" stop-opacity="0"/>`,
    `</radialGradient></defs>`,
    `<circle cx="300" cy="300" r="280" fill="url(#bg-glow)">`,
    `<animate attributeName="opacity" values="0.6;1;0.6" dur="4s" repeatCount="indefinite"/>`,
    `</circle>`,
    dotGrid(palette),
    `<g id="cells">${cellSvg.join('')}</g>`,
    `<circle cx="300" cy="300" r="278" fill="none" stroke="${palette.outline}" stroke-width="1" opacity="0.5"/>`,
    showLegend ? instrumentPanel(mode, opts, palette) : '',
    `</svg>`,
  ].join('');
}
