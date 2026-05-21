import { collectContributions, collectStats, render, StatsError } from '@markdown-rbmk/core';
import type { RenderMode, Theme } from '@markdown-rbmk/core';
import { cacheGet, cacheSet } from './cache';
import { fallbackSvg } from './fallback';

/** Stats providers — injectable so the handler can be tested without network. */
export interface BadgeDeps {
  collectStats?: typeof collectStats;
  collectContributions?: typeof collectContributions;
}

/** GitHub usernames: 1-39 chars, alphanumeric or single hyphens. */
const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

// `no-transform` keeps intermediaries from gzip-compressing the SVG. GitHub's
// camo image proxy mishandles a compressed response and serves a truncated
// copy, so the badge must go over the wire uncompressed.
const SUCCESS_CACHE =
  'public, max-age=3600, s-maxage=86400, stale-while-revalidate=300, no-transform';
const ERROR_CACHE = 'public, max-age=60, no-transform';

function parseTheme(value: string | null): Theme {
  return value === 'light' ? 'light' : 'dark';
}

function parseMode(value: string | null): RenderMode {
  return value === 'language' || value === 'hybrid' ? value : 'commit';
}

function parseMaxRepos(value: string | null): number {
  const n = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(n)) return 100;
  return Math.min(100, Math.max(1, n));
}

function statsErrorLines(err: StatsError): string[] {
  switch (err.code) {
    case 'user_not_found':
      return ['GitHub user not found'];
    case 'no_data':
      return ['No activity data found'];
    case 'rate_limit':
      return ['GitHub rate limit hit', err.retryAfter ? `retry in ${err.retryAfter}s` : 'try again later'];
    case 'auth_failed':
      return ['Server token missing', 'or authentication failed'];
    default:
      return ['Could not build the badge'];
  }
}

function svgResponse(svg: string, kind: 'fresh' | 'cached' | 'error'): Response {
  return new Response(svg, {
    status: 200, // errors still return 200 + fallback SVG (SPEC 8.3)
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': kind === 'error' ? ERROR_CACHE : SUCCESS_CACHE,
      'X-Badge-Cache': kind === 'cached' ? 'HIT' : 'MISS',
    },
  });
}

/**
 * Handle `GET /api/badge`. Always resolves to a 200 SVG response — a fallback
 * badge on any error — so a README `<img>` never breaks.
 *
 * Query: username (required), mode, scope, theme, maxRepos.
 */
export async function handleBadge(request: Request, deps: BadgeDeps = {}): Promise<Response> {
  const collectStatsFn = deps.collectStats ?? collectStats;
  const collectContributionsFn = deps.collectContributions ?? collectContributions;

  const params = new URL(request.url).searchParams;
  const username = params.get('username')?.trim() ?? '';
  const theme = parseTheme(params.get('theme'));
  const mode = parseMode(params.get('mode'));
  const scope = params.get('scope') ?? 'public';
  const maxRepos = parseMaxRepos(params.get('maxRepos'));

  if (!username) {
    return svgResponse(fallbackSvg('Missing ?username parameter', theme), 'error');
  }
  if (!USERNAME_RE.test(username)) {
    return svgResponse(fallbackSvg('Invalid username', theme), 'error');
  }
  // The server only ever reads public data — scope=all needs the user's PAT,
  // which must never be sent to a shared server (SPEC 8.2).
  if (scope === 'all') {
    return svgResponse(
      fallbackSvg(['scope=all is not available here', 'use the GitHub Action for private repos'], theme),
      'error',
    );
  }

  const cacheKey = `${username}:${mode}:${theme}:${maxRepos}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return svgResponse(cached, 'cached');

  try {
    const token = process.env.GITHUB_TOKEN;
    // Fetch stats and contributions in parallel (hybrid needs both).
    const [stats, contributions] = await Promise.all([
      mode === 'language' || mode === 'hybrid'
        ? collectStatsFn({ username, scope: 'public', token, maxRepos })
        : Promise.resolve(undefined),
      mode === 'commit' || mode === 'hybrid'
        ? collectContributionsFn({ username, token })
        : Promise.resolve(undefined),
    ]);

    const svg = render({ mode, username, theme, stats, contributions });
    await cacheSet(cacheKey, svg);
    return svgResponse(svg, 'fresh');
  } catch (err) {
    const lines =
      err instanceof StatsError ? statsErrorLines(err) : ['Could not build the badge'];
    return svgResponse(fallbackSvg(lines, theme), 'error');
  }
}
