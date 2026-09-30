/**
 * Frozen fixtures for the golden snapshot tests. Do NOT edit these — the
 * classic snapshots are only meaningful while the inputs stay identical.
 */
import { mulberry32 } from '../../src/rng';
import type { ContributionResult, StatsResult } from '../../src/types';

export const FIXTURE_USER = 'octocat';

export const fixtureStats: StatsResult = {
  username: FIXTURE_USER,
  scope: 'public',
  totalBytes: 1_000_000,
  reposScanned: 42,
  generatedAt: '2026-05-20T00:00:00.000Z',
  langs: [
    { name: 'TypeScript', bytes: 550_000, pct: 55, color: '#3178c6' },
    { name: 'JavaScript', bytes: 220_000, pct: 22, color: '#f1e05a' },
    { name: 'Python', bytes: 120_000, pct: 12, color: '#3572A5' },
    { name: 'Go', bytes: 80_000, pct: 8, color: '#00ADD8' },
    { name: 'Other', bytes: 30_000, pct: 3, color: '#7F8C8D' },
  ],
};

/** 470 days of bursty activity, newest first, ending 2026-05-20. */
export function fixtureContributions(): ContributionResult {
  const rng = mulberry32(2026);
  const end = Date.UTC(2026, 4, 20);
  const days = Array.from({ length: 470 }, (_, i) => {
    const count = rng() < 0.45 ? 0 : Math.floor(rng() * rng() * 32) + 1;
    return { date: new Date(end - i * 86_400_000).toISOString().slice(0, 10), count };
  });
  return {
    username: FIXTURE_USER,
    totalContributions: days.reduce((s, d) => s + d.count, 0),
    days,
    generatedAt: '2026-05-20T00:00:00.000Z',
  };
}
