import { graphql } from '@octokit/graphql';
import { mapGitHubError, StatsError } from './errors';
import type { ContributionDay, ContributionResult } from './types';

export interface ContributionsInput {
  username: string;
  token?: string;
  /** Recent days to keep — enough to fill the reactor disc. Default 470. */
  days?: number;
}

/** Fetch raw contribution days for one date window — injectable for tests. */
export type ContributionFetcher = (
  login: string,
  token: string,
  from: Date,
  to: Date,
) => Promise<ContributionDay[]>;

const CALENDAR_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        weeks {
          contributionDays { date contributionCount }
        }
      }
    }
  }
}`;

interface CalendarResponse {
  user: {
    contributionsCollection: {
      contributionCalendar: {
        weeks: Array<{ contributionDays: Array<{ date: string; contributionCount: number }> }>;
      };
    };
  } | null;
}

const githubFetcher: ContributionFetcher = async (login, token, from, to) => {
  const gql = graphql.defaults({ headers: { authorization: `token ${token}` } });
  let res: CalendarResponse;
  try {
    res = await gql<CalendarResponse>(CALENDAR_QUERY, {
      login,
      from: from.toISOString(),
      to: to.toISOString(),
    });
  } catch (err) {
    throw mapGitHubError(err);
  }
  if (!res.user) {
    throw new StatsError('user_not_found', `GitHub user "${login}" not found.`);
  }

  const days: ContributionDay[] = [];
  for (const week of res.user.contributionsCollection.contributionCalendar.weeks) {
    for (const day of week.contributionDays) {
      days.push({ date: day.date, count: day.contributionCount });
    }
  }
  return days;
};

const DAY_MS = 86_400_000;

/**
 * Collect a user's daily contribution counts, newest first. Spans two 1-year
 * windows (the GraphQL range limit) so the full reactor disc can be filled.
 * Requires a token — the GitHub GraphQL API is authenticated-only.
 */
export async function collectContributions(
  input: ContributionsInput,
  fetcher: ContributionFetcher = githubFetcher,
): Promise<ContributionResult> {
  if (!input.token) {
    throw new StatsError('auth_failed', 'commit mode requires a GitHub token.');
  }

  const want = input.days ?? 470;
  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 364 * DAY_MS);
  const twoYearsAgo = new Date(now.getTime() - 728 * DAY_MS);

  const [older, recent] = await Promise.all([
    fetcher(input.username, input.token, twoYearsAgo, oneYearAgo),
    fetcher(input.username, input.token, oneYearAgo, now),
  ]);

  // Merge both windows, dedupe the shared boundary day, sort newest-first.
  const byDate = new Map<string, number>();
  for (const day of [...older, ...recent]) byDate.set(day.date, day.count);
  const days: ContributionDay[] = [...byDate.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, want);

  if (days.length === 0) {
    throw new StatsError('no_data', `No contribution data for "${input.username}".`);
  }

  return {
    username: input.username,
    totalContributions: days.reduce((sum, d) => sum + d.count, 0),
    days,
    generatedAt: new Date().toISOString(),
  };
}

/** Heat level 0 (no activity) through 4 (hottest). */
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

/**
 * Build a heat classifier mapping a day's count to a level 0-4. Levels 1-4
 * use quartiles of the user's own non-zero days, so the scale adapts per user.
 */
export function buildHeatScale(days: ContributionDay[]): (count: number) => HeatLevel {
  const nonzero = days
    .map((d) => d.count)
    .filter((c) => c > 0)
    .sort((a, b) => a - b);
  if (nonzero.length === 0) return () => 0;

  const quantile = (p: number): number =>
    nonzero[Math.min(nonzero.length - 1, Math.floor(p * nonzero.length))] as number;
  const t1 = quantile(0.25);
  const t2 = quantile(0.5);
  const t3 = quantile(0.75);

  return (count: number): HeatLevel => {
    if (count <= 0) return 0;
    if (count <= t1) return 1;
    if (count <= t2) return 2;
    if (count <= t3) return 3;
    return 4;
  };
}
