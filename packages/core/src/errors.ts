export type StatsErrorCode = 'user_not_found' | 'auth_failed' | 'no_data' | 'rate_limit';

/** Thrown by collectStats/collectContributions; callers render a fallback badge. */
export class StatsError extends Error {
  readonly code: StatsErrorCode;
  /** Seconds to wait before retrying — only set for rate_limit. */
  readonly retryAfter?: number;

  constructor(code: StatsErrorCode, message: string, retryAfter?: number) {
    super(message);
    this.name = 'StatsError';
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

/** Map an Octokit/GraphQL error to a StatsError; pass StatsError through. */
export function mapGitHubError(err: unknown): Error {
  if (err instanceof StatsError) return err;

  const e = err as { status?: number; response?: { headers?: Record<string, string> } };
  const status = e?.status;
  const headers = e?.response?.headers ?? {};

  if (status === 404) {
    return new StatsError('user_not_found', 'GitHub user not found.');
  }
  if (status === 401) {
    return new StatsError('auth_failed', 'GitHub authentication failed — check the token.');
  }
  if (status === 403 || status === 429) {
    const retryAfter =
      Number(headers['retry-after']) ||
      (headers['x-ratelimit-reset']
        ? Math.max(0, Number(headers['x-ratelimit-reset']) - Math.floor(Date.now() / 1000))
        : undefined);
    return new StatsError(
      'rate_limit',
      `GitHub rate limit exceeded${retryAfter ? ` — retry after ${retryAfter}s` : ''}.`,
      retryAfter,
    );
  }
  return err instanceof Error ? err : new Error(String(err));
}
