import type { RenderMode, Scope, StatsInput, Theme } from './types';
import { DEFAULT_CONTRIBUTION_DAYS, MAX_CONTRIBUTION_DAYS } from './contributions';
import type { ContributionsInput } from './contributions';
import { DEFAULT_TOP_LANGUAGES } from './stats';
import { STYLE_META } from './styles/meta';
import { CELL_SHAPES, STAT_KEYS, STYLE_NAMES } from './styles/types';
import type { CellShape, PanelPosition, StatKey, StyleName, View } from './styles/types';
import type { BadgeStyle } from './types';

/**
 * Shared, strict parser for badge options. The hosted endpoint (query string)
 * and the GitHub Action (workflow inputs) both go through it so the same
 * input always means the same badge.
 *
 * Every value is untrusted: enums are whitelisted, numbers clamped, and
 * anything unrecognised silently falls back to its default — a badge must
 * render, never error, on a typo.
 */

/** Reads one raw option by its canonical (camelCase) name. */
export type OptionGetter = (name: string) => string | null | undefined;

/** Where the options come from — some limits differ per context. */
export type OptionContext = 'server' | 'action';

export interface BadgeOptions {
  username: string;
  mode: RenderMode;
  theme: Theme;
  scope: Scope;
  maxRepos: number;
  /** Recent contribution days (30-728). */
  days: number;
  /** Named languages before "Other" (1-8). */
  langs: number;
  /** Lower-cased language names to drop — sorted, deduped. */
  exclude: string[];
  /** Include forked repositories. */
  forks: boolean;
  /** Include archived repositories. */
  archived: boolean;
  // ---- v2 styles (ignored by classic) ----
  style: BadgeStyle;
  /** Preset of the chosen style (the `theme` param). For classic = theme. */
  preset: string;
  view: View;
  panel: PanelPosition;
  cell: CellShape;
  animate: boolean;
  /** `#rrggbb` or null. */
  accent: string | null;
  /** `[idle, h1, h2, h3, h4]` as `#rrggbb`, or null. */
  heat: [string, string, string, string, string] | null;
  /** Panel readouts in order, or null for the style default. */
  stats: StatKey[] | null;
}

/** GitHub usernames: 1-39 chars, alphanumeric or single hyphens. */
const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username);
}

/**
 * Upper bound for `maxRepos`. The shared server caps it to bound API cost;
 * the Action runs on the user's own token, so it may scan more.
 */
const MAX_REPOS_LIMIT: Record<OptionContext, number> = { server: 100, action: 1000 };
const MAX_REPOS_DEFAULT = 100;

/** List limits for `exclude` — it is matched, never rendered, but bound it. */
const MAX_EXCLUDE_ITEMS = 20;
const MAX_LANGUAGE_NAME = 40;

/**
 * Read a raw value. Only `username` is trimmed — the v1 endpoint compared
 * enum params verbatim, and legacy URLs must keep parsing identically.
 * (`core.getInput` already trims Action inputs.)
 */
function raw(get: OptionGetter, name: string): string {
  return get(name) ?? '';
}

/** Return `value` if it is one of `allowed`, else `fallback`. */
export function parseEnum<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Parse an integer and clamp it into [min, max]; non-numbers -> fallback. */
export function parseIntClamped(value: string, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** `true`/`1`/`yes` or `false`/`0`/`no` (case-insensitive); else fallback. */
export function parseBool(value: string, fallback: boolean): boolean {
  const v = value.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return fallback;
}

/** Comma-separated names -> lower-cased, trimmed, deduped, sorted, bounded. */
export function parseNameList(value: string): string[] {
  const names = value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0 && s.length <= MAX_LANGUAGE_NAME);
  return [...new Set(names)].sort().slice(0, MAX_EXCLUDE_ITEMS);
}

/** Parse badge options from any key/value source. */
export function parseBadgeOptions(get: OptionGetter, context: OptionContext = 'server'): BadgeOptions {
  const theme = parseEnum<Theme>(raw(get, 'theme'), ['dark', 'light'], 'dark');
  const style = parseEnum<BadgeStyle>(raw(get, 'style').trim().toLowerCase(), ['classic', ...STYLE_NAMES], 'classic');
  return {
    username: raw(get, 'username').trim(),
    mode: parseEnum<RenderMode>(raw(get, 'mode'), ['commit', 'language', 'hybrid'], 'commit'),
    theme,
    scope: parseEnum<Scope>(raw(get, 'scope'), ['public', 'all'], 'public'),
    maxRepos: parseIntClamped(raw(get, 'maxRepos'), 1, MAX_REPOS_LIMIT[context], MAX_REPOS_DEFAULT),
    days: parseIntClamped(raw(get, 'days'), 30, MAX_CONTRIBUTION_DAYS, DEFAULT_CONTRIBUTION_DAYS),
    langs: parseIntClamped(raw(get, 'langs'), 1, 8, DEFAULT_TOP_LANGUAGES),
    exclude: parseNameList(raw(get, 'exclude')),
    forks: parseBool(raw(get, 'forks'), false),
    archived: parseBool(raw(get, 'archived'), true),
    style,
    preset: parsePreset(style, raw(get, 'theme'), theme),
    view: parseEnum<View>(raw(get, 'view').trim().toLowerCase(), ['full', 'core', 'panel'], 'full'),
    panel: parseEnum<PanelPosition>(raw(get, 'panel').trim().toLowerCase(), ['right', 'bottom'], 'right'),
    cell: parseEnum<CellShape>(raw(get, 'cell').trim().toLowerCase(), CELL_SHAPES, 'default'),
    animate: parseAnim(raw(get, 'anim')),
    accent: parseHex(raw(get, 'accent')),
    heat: parseHeat(raw(get, 'heat')),
    stats: parseStatList(raw(get, 'stats')),
  };
}

/** Strict colour: `rrggbb` or `#rrggbb` (also 3-digit), returned as `#rrggbb`. */
const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
export function parseHex(value: string): string | null {
  const m = HEX_RE.exec(value.trim());
  if (!m) return null;
  const h = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join('') : m[1]!;
  return `#${h.toLowerCase()}`;
}

/** `heat=idle,h1,h2,h3,h4` — all five must be valid, else ignored. */
export function parseHeat(value: string): [string, string, string, string, string] | null {
  if (!value.trim()) return null;
  const parts = value.split(',').map(parseHex);
  if (parts.length !== 5 || parts.some((p) => p === null)) return null;
  return parts as [string, string, string, string, string];
}

/** `stats=total,streak,...` — known keys, deduped, in the given order. */
export function parseStatList(value: string): StatKey[] | null {
  if (!value.trim()) return null;
  const keys = value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is StatKey => (STAT_KEYS as readonly string[]).includes(s));
  const unique = [...new Set(keys)];
  return unique.length ? unique : null;
}

/** `anim=off|none|false|0|static` disables animation; anything else keeps it. */
function parseAnim(value: string): boolean {
  return !['off', 'none', 'false', '0', 'static', 'no'].includes(value.trim().toLowerCase());
}

/** A style's preset from the `theme` param; unknown -> dark/light by theme. */
function parsePreset(style: BadgeStyle, rawTheme: string, theme: Theme): string {
  if (style === 'classic') return theme;
  const presets = STYLE_META[style as StyleName].presets;
  const wanted = rawTheme.trim().toLowerCase();
  return presets.includes(wanted) ? wanted : theme;
}

/**
 * A stable cache key for a set of normalised options: two requests that parse
 * to the same options share one key, whatever their raw spelling or order.
 * `scope` is omitted — the server only ever renders public data.
 */
export function badgeCacheKey(opts: BadgeOptions): string {
  const base = [
    opts.username,
    opts.mode,
    opts.theme,
    opts.maxRepos,
    opts.days,
    opts.langs,
    opts.exclude.map(encodeURIComponent).join(','),
    opts.forks ? 1 : 0,
    opts.archived ? 1 : 0,
  ];
  if (opts.style === 'classic') return base.join(':');
  return [
    ...base,
    opts.style,
    opts.preset,
    opts.view,
    opts.panel,
    opts.cell,
    opts.animate ? 1 : 0,
    opts.accent ?? '-',
    opts.heat?.join(',') ?? '-',
    opts.stats?.join(',') ?? '-',
  ].join(':');
}

/** Render options (minus data) implied by a set of badge options. */
export function toRenderOptions(opts: BadgeOptions, username: string = opts.username) {
  return {
    style: opts.style,
    mode: opts.mode,
    username,
    theme: opts.theme,
    preset: opts.preset,
    view: opts.view,
    panel: opts.panel,
    cell: opts.cell,
    animate: opts.animate,
    accent: opts.accent,
    heat: opts.heat,
    panelStats: opts.stats,
  };
}


/** Collector input for the language stats implied by a set of options. */
export function toStatsInput(
  opts: BadgeOptions,
  username: string,
  token: string | undefined,
  scope: Scope = opts.scope,
): StatsInput {
  return {
    username,
    scope,
    token,
    maxRepos: opts.maxRepos,
    excludeForks: !opts.forks,
    excludeArchived: !opts.archived,
    topLanguages: opts.langs,
    excludeLanguages: opts.exclude,
  };
}

/** Collector input for the contributions implied by a set of options. */
export function toContributionsInput(
  opts: BadgeOptions,
  username: string,
  token: string | undefined,
): ContributionsInput {
  return { username, token, days: opts.days };
}
