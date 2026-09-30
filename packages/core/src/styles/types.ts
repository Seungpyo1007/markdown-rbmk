import type { ContributionDay, LanguageStat, RenderMode } from '../types';

/**
 * Named v2 styles. Each is a self-contained renderer in `styles/<name>.ts`;
 * `classic` (the frozen v1 look, `renderers/classic.ts`) stays the default.
 */
export const STYLE_NAMES = [
  'skala',
  'blueprint',
  'cherenkov',
  'pyatachok',
  'dosimeter',
  'poster',
  'gauge',
  'minimal',
] as const;
export type StyleName = (typeof STYLE_NAMES)[number];

/** Which parts of the badge to draw. */
export type View = 'full' | 'core' | 'panel';
/** Where the panel sits in `view=full` (and its shape in `view=panel`). */
export type PanelPosition = 'right' | 'bottom';
/** Cell shape; `default` means the style's own choice. */
export type CellShape = 'default' | 'square' | 'round' | 'circle' | 'hex';
export const CELL_SHAPES: readonly CellShape[] = ['default', 'square', 'round', 'circle', 'hex'];

/** Panel readouts a user can pick, in the order they are listed. */
export const STAT_KEYS = ['total', 'active', 'idle', 'peak', 'streak', 'longest', 'languages'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

/** A style's catalogue entry — used by the option parser and the website. */
export interface StyleMeta {
  name: StyleName;
  /** Short human title. */
  label: string;
  /** One line for the playground. */
  description: string;
  /** Palette presets; always includes `dark` and `light`, first is default. */
  presets: readonly string[];
}

/** One day as a style draws it: count plus a 0-4 heat level. */
export interface StyleDay extends ContributionDay {
  level: 0 | 1 | 2 | 3 | 4;
}

/** What one reactor cell shows, in centre-out order (index 0 = centre). */
export type CellContent =
  | { kind: 'day'; day: StyleDay; index: number }
  | { kind: 'lang'; lang: LanguageStat; langIndex: number }
  | { kind: 'empty' };

/** Precomputed figures every style can show. All real data, never invented. */
export interface StyleSummary {
  /** Days in the window (commit/hybrid), else 0. */
  window: number;
  total: number;
  active: number;
  idle: number;
  peak: number;
  /** YYYY-MM-DD of the peak day, or '' when there is none. */
  peakDate: string;
  /** Mean contributions per active day, 1 decimal. */
  avgPerActive: number;
  currentStreak: number;
  longestStreak: number;
  /** YYYY-MM-DD of the newest day, or '' (language mode). */
  latestDate: string;
  /** Heat thresholds: counts <= t[0] are level 1, <= t[1] level 2, ... */
  thresholds: [number, number, number];
}

/** Everything a style renderer receives. Validated before it gets here. */
export interface StyleInput {
  style: StyleName;
  mode: RenderMode;
  username: string;
  /** A preset name from the style's `presets`. */
  preset: string;
  view: View;
  panel: PanelPosition;
  cell: CellShape;
  /** false = no animation at all (static SVG). */
  animate: boolean;
  /** Validated `#rrggbb` accent override, or null. */
  accent: string | null;
  /** Validated `[idle, h1, h2, h3, h4]` heat override, or null. */
  heat: readonly [string, string, string, string, string] | null;
  /** Panel readouts in order; null = the style's default for the mode. */
  stats: readonly StatKey[] | null;
  /** Newest first. Empty in language mode. */
  days: readonly StyleDay[];
  /** Ranked languages incl. "Other". Empty in commit mode. */
  langs: readonly LanguageStat[];
  summary: StyleSummary;
  /** Seeded from the username — use for any decorative randomness. */
  rng: () => number;
}

/** A style renderer: pure function from input to a standalone SVG string. */
export type StyleRenderer = (input: StyleInput) => string;
