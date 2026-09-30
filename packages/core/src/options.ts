import type { RenderMode, Scope, StatsInput, Theme } from './types';
import { DEFAULT_CONTRIBUTION_DAYS, MAX_CONTRIBUTION_DAYS } from './contributions';
import type { ContributionsInput } from './contributions';
import { DEFAULT_TOP_LANGUAGES } from './stats';

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
  return {
    username: raw(get, 'username').trim(),
    mode: parseEnum<RenderMode>(raw(get, 'mode'), ['commit', 'language', 'hybrid'], 'commit'),
    theme: parseEnum<Theme>(raw(get, 'theme'), ['dark', 'light'], 'dark'),
    scope: parseEnum<Scope>(raw(get, 'scope'), ['public', 'all'], 'public'),
    maxRepos: parseIntClamped(raw(get, 'maxRepos'), 1, MAX_REPOS_LIMIT[context], MAX_REPOS_DEFAULT),
    days: parseIntClamped(raw(get, 'days'), 30, MAX_CONTRIBUTION_DAYS, DEFAULT_CONTRIBUTION_DAYS),
    langs: parseIntClamped(raw(get, 'langs'), 1, 8, DEFAULT_TOP_LANGUAGES),
    exclude: parseNameList(raw(get, 'exclude')),
    forks: parseBool(raw(get, 'forks'), false),
    archived: parseBool(raw(get, 'archived'), true),
  };
}

/**
 * A stable cache key for a set of normalised options: two requests that parse
 * to the same options share one key, whatever their raw spelling or order.
 * `scope` is omitted — the server only ever renders public data.
 */
export function badgeCacheKey(opts: BadgeOptions): string {
  return [
    opts.username,
    opts.mode,
    opts.theme,
    opts.maxRepos,
    opts.days,
    opts.langs,
    opts.exclude.map(encodeURIComponent).join(','),
    opts.forks ? 1 : 0,
    opts.archived ? 1 : 0,
  ].join(':');
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
