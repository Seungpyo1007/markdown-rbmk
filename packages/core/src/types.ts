export type Scope = 'public' | 'all';
export type Theme = 'dark' | 'light';

export interface StatsInput {
  username: string;
  scope: Scope;
  token?: string;
  maxRepos?: number; // default 100
  excludeForks?: boolean; // default true
  excludeArchived?: boolean; // default false
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

/** Badge display mode (SPEC v0.2). */
export type RenderMode = 'commit' | 'language' | 'hybrid';

export interface RenderOptions {
  mode?: RenderMode; // default 'commit'
  username: string; // seeds the deterministic RNG
  theme?: Theme; // default 'dark'
  showLegend?: boolean; // default true — the instrument panel
  stats?: StatsResult; // required for 'language' and 'hybrid'
  contributions?: ContributionResult; // required for 'commit' and 'hybrid'
}
