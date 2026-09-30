import type { CellShape, PanelPosition, StatKey, StyleName, View } from './styles/types';

export type Scope = 'public' | 'all';
export type Theme = 'dark' | 'light';

export interface StatsInput {
  username: string;
  scope: Scope;
  token?: string;
  maxRepos?: number; // default 100
  excludeForks?: boolean; // default true
  excludeArchived?: boolean; // default false
  topLanguages?: number; // languages shown before "Other", default 4
  excludeLanguages?: string[]; // case-insensitive names to drop, default []
}

export interface LanguageStat {
  name: string;
  bytes: number;
  pct: number; // one decimal place
  color: string; // #hex
}

export interface StatsResult {
  username: string;
  scope: Scope;
  totalBytes: number;
  langs: LanguageStat[]; // pct descending, top 4 + "Other"
  reposScanned: number;
  generatedAt: string; // ISO 8601
}

export interface CellPosition {
  /** SVG x of the cell's 16x16 rect (top-left corner). */
  cx: number;
  /** SVG y of the cell's 16x16 rect (top-left corner). */
  cy: number;
  /** Distance from the cell centre to the reactor centre (300,300). */
  dist: number;
}

/** One day of GitHub contribution activity. */
export interface ContributionDay {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface ContributionResult {
  username: string;
  totalContributions: number; // over the fetched window
  days: ContributionDay[]; // newest first
  generatedAt: string; // ISO 8601
}

/** Consecutive active-day runs, in days. */
export interface Streaks {
  /** Run ending today — or yesterday, since today may not be over yet. */
  current: number;
  longest: number;
}

/** Badge display mode (SPEC v0.2). */
export type RenderMode = 'commit' | 'language' | 'hybrid';

/**
 * Visual style. `classic` is the v1 look and the default forever — existing
 * embeds never change. The rest are the named v2 styles in `styles/`.
 */
export type BadgeStyle = 'classic' | StyleName;

export interface RenderOptions {
  style?: BadgeStyle; // default 'classic'
  mode?: RenderMode; // default 'commit'
  username: string; // seeds the deterministic RNG
  theme?: Theme; // default 'dark' — classic only
  showLegend?: boolean; // default true — the instrument panel (classic only)
  stats?: StatsResult; // required for 'language' and 'hybrid'
  contributions?: ContributionResult; // required for 'commit' and 'hybrid'
  // ---- v2 styles only (ignored by classic) ----
  preset?: string; // a preset of the chosen style; default = theme
  view?: View; // default 'full'
  panel?: PanelPosition; // default 'right'
  cell?: CellShape; // default: the style's own
  animate?: boolean; // default true
  accent?: string | null; // validated #rrggbb
  heat?: readonly [string, string, string, string, string] | null; // idle + 4 levels
  panelStats?: readonly StatKey[] | null; // panel readouts in order
}
