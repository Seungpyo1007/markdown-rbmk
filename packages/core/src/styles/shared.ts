/**
 * Helpers shared by every v2 style. Styles own their look; data shaping,
 * escaping and cell assignment live here so every style tells the same truth.
 */
import { buildHeatScale, computeStreaks } from '../contributions';
import { distributeCells } from '../grid';
import { createRng } from '../rng';
import type { ContributionResult, RenderMode, StatsResult } from '../types';
import type {
  CellContent,
  CellShape,
  PanelPosition,
  StatKey,
  StyleDay,
  StyleInput,
  StyleName,
  StyleSummary,
  View,
} from './types';

/** Fraction of cells that form the commit core in hybrid mode (as classic). */
export const HYBRID_INNER_FRACTION = 0.65;

/** Put this in every style's <style>: the static frame must be complete. */
export const REDUCED_MOTION_CSS = '@media (prefers-reduced-motion:reduce){*{animation:none!important}}';

export const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
export const SANS = "system-ui,-apple-system,'Segoe UI',sans-serif";

export function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === '"' ? '&quot;' : '&apos;',
  );
}

/** Trim a number to 2 decimals without trailing zeros. */
export function num(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** 1234 -> "1,234" (locale-independent). */
export function grouped(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** WCAG relative-luminance contrast ratio of two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const h = hex.replace('#', '');
    const [r, g, bl] = [0, 2, 4].map((i) => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** Style defaults for the panel readouts, per mode. */
export function defaultStats(mode: RenderMode): StatKey[] {
  if (mode === 'language') return ['languages', 'total'];
  if (mode === 'hybrid') return ['total', 'active', 'streak', 'languages'];
  return ['total', 'active', 'peak', 'streak', 'longest'];
}

/**
 * The stats a style should show: the user's list, else the default, minus
 * anything the mode has no data for. `total` in language mode = bytes are not
 * contributions, so it is dropped there.
 */
export function resolveStats(input: Pick<StyleInput, 'mode' | 'stats'>): StatKey[] {
  const wanted = input.stats ?? defaultStats(input.mode);
  const hasDays = input.mode !== 'language';
  const hasLangs = input.mode !== 'commit';
  return wanted.filter((k) => (k === 'languages' ? hasLangs : hasDays));
}

/**
 * Map `count` centre-out positions to their content, exactly as classic does:
 * commit = day i at position i (index 0 = today, the centre); language =
 * rings by share; hybrid = the inner 65% commit, the rim languages.
 */
export function assignCells(input: Pick<StyleInput, 'mode' | 'days' | 'langs'>, count: number): CellContent[] {
  const day = (i: number): CellContent => {
    const d = input.days[i];
    return d ? { kind: 'day', day: d, index: i } : { kind: 'empty' };
  };
  const langCells = (n: number): CellContent[] =>
    distributeCells([...input.langs], n).map((lang) => ({
      kind: 'lang',
      lang,
      langIndex: Math.max(0, input.langs.indexOf(lang)),
    }));

  if (input.mode === 'commit') return Array.from({ length: count }, (_, i) => day(i));
  if (input.mode === 'language') {
    const cells = langCells(count);
    while (cells.length < count) cells.push({ kind: 'empty' });
    return cells;
  }
  const inner = Math.round(count * HYBRID_INNER_FRACTION);
  const rim = langCells(count - inner);
  return Array.from({ length: count }, (_, i) => (i < inner ? day(i) : (rim[i - inner] ?? { kind: 'empty' })));
}

/** Summaries from real data only. */
export function summarise(days: readonly StyleDay[]): StyleSummary {
  const counts = days.map((d) => d.count);
  const active = counts.filter((c) => c > 0).length;
  const total = counts.reduce((a, b) => a + b, 0);
  let peak = 0;
  let peakDate = '';
  for (const d of days) {
    if (d.count > peak) {
      peak = d.count;
      peakDate = d.date;
    }
  }
  const nonzero = counts.filter((c) => c > 0).sort((a, b) => a - b);
  const q = (p: number) => nonzero[Math.min(nonzero.length - 1, Math.floor(p * nonzero.length))] ?? 0;
  const streaks = computeStreaks(days);
  return {
    window: days.length,
    total,
    active,
    idle: days.length - active,
    peak,
    peakDate,
    avgPerActive: active ? Math.round((total / active) * 10) / 10 : 0,
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    latestDate: days[0]?.date ?? '',
    thresholds: [q(0.25), q(0.5), q(0.75)],
  };
}

export interface StyleRenderOptions {
  style: StyleName;
  mode: RenderMode;
  username: string;
  preset: string;
  view: View;
  panel: PanelPosition;
  cell: CellShape;
  animate: boolean;
  accent: string | null;
  heat: readonly [string, string, string, string, string] | null;
  stats: readonly StatKey[] | null;
  langStats?: StatsResult;
  contributions?: ContributionResult;
}

/** Build a StyleInput from collected data. Throws if a mode lacks its data. */
export function buildStyleInput(o: StyleRenderOptions): StyleInput {
  if ((o.mode === 'commit' || o.mode === 'hybrid') && !o.contributions) {
    throw new Error(`render: ${o.mode} mode requires \`contributions\`.`);
  }
  if ((o.mode === 'language' || o.mode === 'hybrid') && !o.langStats) {
    throw new Error(`render: ${o.mode} mode requires \`stats\`.`);
  }
  const raw = o.mode === 'language' ? [] : (o.contributions?.days ?? []);
  const heat = buildHeatScale(raw);
  const days: StyleDay[] = raw.map((d) => ({ date: d.date, count: d.count, level: heat(d.count) }));
  return {
    style: o.style,
    mode: o.mode,
    username: o.username,
    preset: o.preset,
    view: o.view,
    panel: o.panel,
    cell: o.cell,
    animate: o.animate,
    accent: o.accent,
    heat: o.heat,
    stats: o.stats,
    days,
    langs: o.mode === 'commit' ? [] : (o.langStats?.langs ?? []),
    summary: summarise(days),
    rng: createRng(`${o.style}:${o.username}`),
  };
}
