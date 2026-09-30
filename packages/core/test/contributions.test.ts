import { describe, it, expect } from 'vitest';
import { buildHeatScale, collectContributions, computeStreaks } from '../src/contributions';
import type { ContributionFetcher } from '../src/contributions';
import { StatsError } from '../src/errors';
import type { ContributionDay } from '../src/types';
import { fixtureContributions } from './fixtures';

describe('buildHeatScale', () => {
  it('maps every count to level 0 when there is no activity', () => {
    const heat = buildHeatScale([
      { date: '2026-01-01', count: 0 },
      { date: '2026-01-02', count: 0 },
    ]);
    expect(heat(0)).toBe(0);
    expect(heat(5)).toBe(0);
  });

  it('assigns level 0 to empty days and 1-4 to active days', () => {
    const days: ContributionDay[] = Array.from({ length: 100 }, (_, i) => ({
      date: `d${i}`,
      count: i, // 0..99
    }));
    const heat = buildHeatScale(days);
    expect(heat(0)).toBe(0);
    expect(heat(99)).toBe(4); // top quartile
    expect(heat(1)).toBeGreaterThanOrEqual(1);
    // levels are monotonic in count
    let prev = 0;
    for (let c = 0; c <= 99; c++) {
      const level = heat(c);
      expect(level).toBeGreaterThanOrEqual(prev);
      prev = level;
    }
  });
});

const window = (dates: string[], count = 1): ContributionDay[] =>
  dates.map((date) => ({ date, count }));

describe('collectContributions', () => {
  it('requires a token', async () => {
    await expect(collectContributions({ username: 'octocat' })).rejects.toMatchObject({
      code: 'auth_failed',
    });
  });

  it('merges both windows newest-first and dedupes the boundary day', async () => {
    const fetcher: ContributionFetcher = async (_login, _token, from) => {
      // older window vs recent window distinguished by `from`
      const isRecent = from.getTime() > Date.now() - 400 * 86_400_000;
      return isRecent
        ? window(['2026-05-01', '2026-05-02'], 3)
        : window(['2025-05-01', '2026-05-01'], 1); // 2026-05-01 overlaps
    };

    const result = await collectContributions({ username: 'octocat', token: 't' }, fetcher);
    expect(result.days.map((d) => d.date)).toEqual(['2026-05-02', '2026-05-01', '2025-05-01']);
    // recent window wins the deduped boundary day
    expect(result.days[1]).toEqual({ date: '2026-05-01', count: 3 });
    expect(result.totalContributions).toBe(3 + 3 + 1);
  });

  it('keeps only the requested number of recent days', async () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        date: `2026-${String(i).padStart(4, '0')}`,
        count: 1,
      }));
    const fetcher: ContributionFetcher = async () => many(300);
    const result = await collectContributions(
      { username: 'octocat', token: 't', days: 50 },
      fetcher,
    );
    expect(result.days).toHaveLength(50);
  });

  it('throws no_data when there are no contribution days', async () => {
    const fetcher: ContributionFetcher = async () => [];
    await expect(
      collectContributions({ username: 'octocat', token: 't' }, fetcher),
    ).rejects.toBeInstanceOf(StatsError);
  });

  it('makes one GraphQL request when a year is enough, two otherwise', async () => {
    let calls = 0;
    const fetcher: ContributionFetcher = async () => {
      calls++;
      return window(['2026-05-01']);
    };
    await collectContributions({ username: 'octocat', token: 't', days: 90 }, fetcher);
    expect(calls).toBe(1);
    calls = 0;
    await collectContributions({ username: 'octocat', token: 't' }, fetcher);
    expect(calls).toBe(2);
  });

  it('caps days at two windows', async () => {
    const fetcher: ContributionFetcher = async (_l, _t, from) =>
      Array.from({ length: 400 }, (_, i) => ({
        date: new Date(from.getTime() + i * 86_400_000).toISOString().slice(0, 10),
        count: 1,
      }));
    const result = await collectContributions({ username: 'octocat', token: 't', days: 5000 }, fetcher);
    expect(result.days.length).toBeLessThanOrEqual(728);
  });
});

/** Build newest-first days ending 2026-05-20 from counts (index 0 = newest). */
const daysOf = (counts: number[]): ContributionDay[] =>
  counts.map((count, i) => ({
    date: new Date(Date.UTC(2026, 4, 20) - i * 86_400_000).toISOString().slice(0, 10),
    count,
  }));

describe('computeStreaks', () => {
  it('returns zeros for no data or no activity', () => {
    expect(computeStreaks([])).toEqual({ current: 0, longest: 0 });
    expect(computeStreaks(daysOf([0, 0, 0]))).toEqual({ current: 0, longest: 0 });
  });

  it('counts the current run from today', () => {
    expect(computeStreaks(daysOf([2, 1, 3, 0, 5]))).toEqual({ current: 3, longest: 3 });
  });

  it('keeps the current streak alive when only today is idle', () => {
    expect(computeStreaks(daysOf([0, 1, 1, 0]))).toEqual({ current: 2, longest: 2 });
  });

  it('breaks the current streak after two idle days', () => {
    expect(computeStreaks(daysOf([0, 0, 1, 1, 1]))).toEqual({ current: 0, longest: 3 });
  });

  it('finds the longest run anywhere in the window', () => {
    expect(computeStreaks(daysOf([1, 0, 1, 1, 1, 1, 0, 1, 1]))).toEqual({ current: 1, longest: 4 });
  });

  it('treats a gap in the dates as a break', () => {
    const days: ContributionDay[] = [
      { date: '2026-05-20', count: 1 },
      { date: '2026-05-19', count: 1 },
      { date: '2026-05-10', count: 1 }, // 9-day gap
      { date: '2026-05-09', count: 1 },
      { date: '2026-05-08', count: 1 },
    ];
    expect(computeStreaks(days)).toEqual({ current: 2, longest: 3 });
  });

  it('is correct on the full golden fixture', () => {
    const days = fixtureContributions().days;
    const { current, longest } = computeStreaks(days);
    // brute-force reference: longest run of consecutive non-zero counts
    let best = 0;
    let run = 0;
    for (const d of days) {
      run = d.count > 0 ? run + 1 : 0;
      best = Math.max(best, run);
    }
    expect(longest).toBe(best);
    expect(current).toBeLessThanOrEqual(longest);
  });
});
