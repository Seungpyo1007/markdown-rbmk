import { describe, it, expect } from 'vitest';
import { buildHeatScale, collectContributions } from '../src/contributions';
import type { ContributionFetcher } from '../src/contributions';
import { StatsError } from '../src/errors';
import type { ContributionDay } from '../src/types';

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
});
