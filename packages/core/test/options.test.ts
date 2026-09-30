import { describe, it, expect } from 'vitest';
import { badgeCacheKey, isValidUsername, parseBadgeOptions, toContributionsInput, toStatsInput } from '../src/options';

/** Build a getter from a plain object, mimicking URLSearchParams.get. */
const from =
  (o: Record<string, string>) =>
  (name: string): string | null =>
    o[name] ?? null;

describe('parseBadgeOptions', () => {
  it('applies v1 defaults when nothing is given', () => {
    expect(parseBadgeOptions(from({}))).toEqual({
      username: '',
      mode: 'commit',
      theme: 'dark',
      scope: 'public',
      maxRepos: 100,
      days: 470,
      langs: 4,
      exclude: [],
      forks: false,
      archived: true,
    });
  });

  it('parses and clamps the data options', () => {
    expect(parseBadgeOptions(from({ days: '90', langs: '6' }))).toMatchObject({ days: 90, langs: 6 });
    expect(parseBadgeOptions(from({ days: '1', langs: '0' }))).toMatchObject({ days: 30, langs: 1 });
    expect(parseBadgeOptions(from({ days: '9999', langs: '99' }))).toMatchObject({ days: 728, langs: 8 });
    expect(parseBadgeOptions(from({ days: 'x', langs: 'y' }))).toMatchObject({ days: 470, langs: 4 });
  });

  it('parses boolean repo filters', () => {
    expect(parseBadgeOptions(from({ forks: 'true', archived: 'false' }))).toMatchObject({
      forks: true,
      archived: false,
    });
    expect(parseBadgeOptions(from({ forks: 'YES', archived: '0' }))).toMatchObject({ forks: true, archived: false });
    expect(parseBadgeOptions(from({ forks: 'maybe', archived: '' }))).toMatchObject({ forks: false, archived: true });
  });

  it('normalises the exclude list', () => {
    expect(parseBadgeOptions(from({ exclude: ' HTML, css,,Jupyter Notebook,html ' })).exclude).toEqual([
      'css',
      'html',
      'jupyter notebook',
    ]);
    const many = Array.from({ length: 50 }, (_, i) => `lang${i}`).join(',');
    expect(parseBadgeOptions(from({ exclude: many })).exclude).toHaveLength(20);
    expect(parseBadgeOptions(from({ exclude: 'x'.repeat(41) })).exclude).toEqual([]);
  });

  it('accepts every valid enum value', () => {
    for (const mode of ['commit', 'language', 'hybrid'] as const) {
      expect(parseBadgeOptions(from({ mode })).mode).toBe(mode);
    }
    expect(parseBadgeOptions(from({ theme: 'light' })).theme).toBe('light');
    expect(parseBadgeOptions(from({ scope: 'all' })).scope).toBe('all');
  });

  it('falls back to defaults on invalid values', () => {
    const o = parseBadgeOptions(from({ mode: 'bogus', theme: 'LIGHT', scope: 'private', maxRepos: 'abc' }));
    expect(o).toMatchObject({ mode: 'commit', theme: 'dark', scope: 'public', maxRepos: 100 });
  });

  it('compares enums verbatim like v1 (no trimming or case folding)', () => {
    expect(parseBadgeOptions(from({ theme: 'light ' })).theme).toBe('dark');
    expect(parseBadgeOptions(from({ mode: 'Hybrid' })).mode).toBe('commit');
  });

  it('trims the username', () => {
    expect(parseBadgeOptions(from({ username: '  octocat ' })).username).toBe('octocat');
  });

  it('clamps maxRepos to 1-100 on the server', () => {
    expect(parseBadgeOptions(from({ maxRepos: '0' })).maxRepos).toBe(1);
    expect(parseBadgeOptions(from({ maxRepos: '-5' })).maxRepos).toBe(1);
    expect(parseBadgeOptions(from({ maxRepos: '5000' })).maxRepos).toBe(100);
    expect(parseBadgeOptions(from({ maxRepos: '42' })).maxRepos).toBe(42);
  });

  it('allows up to 1000 repos in the Action', () => {
    expect(parseBadgeOptions(from({ maxRepos: '500' }), 'action').maxRepos).toBe(500);
    expect(parseBadgeOptions(from({ maxRepos: '5000' }), 'action').maxRepos).toBe(1000);
  });
});

describe('isValidUsername', () => {
  it('accepts GitHub-style usernames', () => {
    for (const u of ['octocat', 'a', 'a-b', 'A1-b2', 'x'.repeat(39)]) expect(isValidUsername(u)).toBe(true);
  });
  it('rejects everything else', () => {
    for (const u of ['', '-a', 'a-', 'a--b', 'a b', 'a/b', '<x>', 'x'.repeat(40)]) {
      expect(isValidUsername(u)).toBe(false);
    }
  });
});

describe('badgeCacheKey', () => {
  it('is identical for equivalent inputs', () => {
    const a = parseBadgeOptions(from({ username: 'octocat', maxRepos: '999' }));
    const b = parseBadgeOptions(from({ username: ' octocat', maxRepos: '100', mode: 'nope' }));
    expect(badgeCacheKey(a)).toBe(badgeCacheKey(b));
  });
  it('differs when output differs', () => {
    const a = parseBadgeOptions(from({ username: 'octocat' }));
    const b = parseBadgeOptions(from({ username: 'octocat', theme: 'light' }));
    expect(badgeCacheKey(a)).not.toBe(badgeCacheKey(b));
    for (const extra of [{ days: '90' }, { langs: '6' }, { exclude: 'html' }, { forks: 'true' }, { archived: 'false' }]) {
      expect(badgeCacheKey(parseBadgeOptions(from({ username: 'octocat', ...extra })))).not.toBe(badgeCacheKey(a));
    }
  });
  it('does not let an exclude entry forge key separators', () => {
    const a = parseBadgeOptions(from({ username: 'octocat', exclude: 'a:b' }));
    expect(badgeCacheKey(a).split(':')).toHaveLength(9);
  });
});

describe('collector inputs', () => {
  it('reproduce the v1 inputs for default options', () => {
    const o = parseBadgeOptions(from({ username: 'octocat' }));
    expect(toStatsInput(o, 'octocat', 't')).toEqual({
      username: 'octocat',
      scope: 'public',
      token: 't',
      maxRepos: 100,
      excludeForks: true,
      excludeArchived: false,
      topLanguages: 4,
      excludeLanguages: [],
    });
    expect(toContributionsInput(o, 'octocat', 't')).toEqual({ username: 'octocat', token: 't', days: 470 });
  });

  it('let the caller force the scope', () => {
    const o = parseBadgeOptions(from({ scope: 'all' }));
    expect(toStatsInput(o, 'octocat', 't', 'public').scope).toBe('public');
  });
});
