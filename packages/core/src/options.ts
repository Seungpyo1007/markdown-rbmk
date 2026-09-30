import type { RenderMode, Scope, Theme } from './types';

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

/** Parse badge options from any key/value source. */
export function parseBadgeOptions(get: OptionGetter, context: OptionContext = 'server'): BadgeOptions {
  return {
    username: raw(get, 'username').trim(),
    mode: parseEnum<RenderMode>(raw(get, 'mode'), ['commit', 'language', 'hybrid'], 'commit'),
    theme: parseEnum<Theme>(raw(get, 'theme'), ['dark', 'light'], 'dark'),
    scope: parseEnum<Scope>(raw(get, 'scope'), ['public', 'all'], 'public'),
    maxRepos: parseIntClamped(raw(get, 'maxRepos'), 1, MAX_REPOS_LIMIT[context], MAX_REPOS_DEFAULT),
  };
}

/**
 * A stable cache key for a set of normalised options: two requests that parse
 * to the same options share one key, whatever their raw spelling or order.
 * `scope` is omitted — the server only ever renders public data.
 */
export function badgeCacheKey(opts: BadgeOptions): string {
  return [opts.username, opts.mode, opts.theme, opts.maxRepos].join(':');
}
