import { describe, it, expect } from 'vitest';
import { aggregateLanguages, collectStats } from '../src/stats';
import type { RepoFetcher, RepoInfo } from '../src/stats';
import { StatsError } from '../src/errors';
import { OTHER_COLOR } from '../src/colors';

describe('aggregateLanguages', () => {
  it('keeps the top 4 and folds the rest into "Other"', () => {
    const langs = aggregateLanguages({
      TypeScript: 5000,
      JavaScript: 2000,
      Python: 1500,
      Go: 1000,
      Ruby: 300,
      Shell: 200,
    });
    expect(langs.map((l) => l.name)).toEqual([
      'TypeScript',
      'JavaScript',
      'Python',
      'Go',
      'Other',
    ]);
    const other = langs[4]!;
    expect(other.bytes).toBe(500); // Ruby + Shell
    expect(other.color).toBe(OTHER_COLOR);
  });

  it('omits "Other" when there are 4 or fewer languages', () => {
    const langs = aggregateLanguages({ TypeScript: 100, JavaScript: 50, Go: 25 });
    expect(langs.map((l) => l.name)).toEqual(['TypeScript', 'JavaScript', 'Go']);
  });

  it('produces percentages that sum to ~100', () => {
    const langs = aggregateLanguages({ A: 700, B: 200, C: 100 });
    const sum = langs.reduce((s, l) => s + l.pct, 0);
    expect(sum).toBeCloseTo(100, 1);
  });

  it('returns [] for an empty byte map', () => {
    expect(aggregateLanguages({})).toEqual([]);
  });
});

const repo = (
  name: string,
  languages: Record<string, number>,
  opts: { isFork?: boolean; isArchived?: boolean } = {},
): RepoInfo => ({
  name,
  isFork: opts.isFork ?? false,
  isArchived: opts.isArchived ?? false,
  languages,
});

const fetcherOf =
  (repos: RepoInfo[]): RepoFetcher =>
  async () =>
    repos;

describe('collectStats', () => {
  it('aggregates languages across repositories', async () => {
    const result = await collectStats(
      { username: 'octocat', scope: 'public' },
      fetcherOf([repo('a', { TypeScript: 100 }), repo('b', { TypeScript: 50, Go: 50 })]),
    );
    expect(result.username).toBe('octocat');
    expect(result.totalBytes).toBe(200);
    expect(result.reposScanned).toBe(2);
    expect(result.langs[0]).toMatchObject({ name: 'TypeScript', bytes: 150 });
  });

  it('excludes forks by default', async () => {
    const result = await collectStats(
      { username: 'octocat', scope: 'public' },
      fetcherOf([
        repo('mine', { TypeScript: 100 }),
        repo('forked', { Python: 9999 }, { isFork: true }),
      ]),
    );
    expect(result.reposScanned).toBe(1);
    expect(result.langs.map((l) => l.name)).toEqual(['TypeScript']);
  });

  it('keeps forks when excludeForks is false', async () => {
    const result = await collectStats(
      { username: 'octocat', scope: 'public', excludeForks: false },
      fetcherOf([
        repo('mine', { TypeScript: 100 }),
        repo('forked', { Python: 50 }, { isFork: true }),
      ]),
    );
    expect(result.reposScanned).toBe(2);
    expect(result.langs.map((l) => l.name).sort()).toEqual(['Python', 'TypeScript']);
  });

  it('excludes archived repos when excludeArchived is true', async () => {
    const result = await collectStats(
      { username: 'octocat', scope: 'public', excludeArchived: true },
      fetcherOf([
        repo('live', { TypeScript: 100 }),
        repo('old', { Python: 50 }, { isArchived: true }),
      ]),
    );
    expect(result.reposScanned).toBe(1);
    expect(result.langs.map((l) => l.name)).toEqual(['TypeScript']);
  });

  it('throws no_data when there is no language data', async () => {
    await expect(
      collectStats({ username: 'octocat', scope: 'public' }, fetcherOf([repo('empty', {})])),
    ).rejects.toMatchObject({ code: 'no_data' });
  });

  it('throws auth_failed for scope=all without a token', async () => {
    const err = await collectStats({ username: 'octocat', scope: 'all' }, fetcherOf([])).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(StatsError);
    expect(err.code).toBe('auth_failed');
  });
});
