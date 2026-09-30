import {
  badgeCacheKey,
  collectContributions,
  collectStats,
  isValidUsername,
  parseBadgeOptions,
  render,
  StatsError,
  toContributionsInput,
  toStatsInput,
} from '@markdown-rbmk/core';
import { cacheGet, cacheSet } from './cache';
import { fallbackSvg } from './fallback';

/** Stats providers — injectable so the handler can be tested without network. */
export interface BadgeDeps {
  collectStats?: typeof collectStats;
  collectContributions?: typeof collectContributions;
}

// `no-transform` keeps intermediaries from gzip-compressing the SVG. GitHub's
// camo image proxy mishandles a compressed response and serves a truncated
// copy, so the badge must go over the wire uncompressed.
const SUCCESS_CACHE =
  'public, max-age=3600, s-maxage=86400, stale-while-revalidate=300, no-transform';
const ERROR_CACHE = 'public, max-age=60, no-transform';

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
      // Declaring an encoding stops Vercel from gzip-compressing the body —
      // camo (GitHub's image proxy) corrupts a compressed SVG response.
      'Content-Encoding': 'identity',
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
  const opts = parseBadgeOptions((name) => params.get(name), 'server');
  const { username, theme, mode } = opts;

  if (!username) {
    return svgResponse(fallbackSvg('Missing ?username parameter', theme), 'error');
  }
  if (!isValidUsername(username)) {
    return svgResponse(fallbackSvg('Invalid username', theme), 'error');
  }
  // The server only ever reads public data — scope=all needs the user's PAT,
  // which must never be sent to a shared server (SPEC 8.2).
  if (opts.scope === 'all') {
    return svgResponse(
      fallbackSvg(['scope=all is not available here', 'use the GitHub Action for private repos'], theme),
      'error',
    );
  }

  const cacheKey = badgeCacheKey(opts);
  const cached = await cacheGet(cacheKey);
  if (cached) return svgResponse(cached, 'cached');

  try {
    const token = process.env.GITHUB_TOKEN;
    // Fetch stats and contributions in parallel (hybrid needs both). The
    // server never reads private data, whatever the options say.
    const [stats, contributions] = await Promise.all([
      mode === 'language' || mode === 'hybrid'
        ? collectStatsFn(toStatsInput(opts, username, token, 'public'))
        : Promise.resolve(undefined),
      mode === 'commit' || mode === 'hybrid'
        ? collectContributionsFn(toContributionsInput(opts, username, token))
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
