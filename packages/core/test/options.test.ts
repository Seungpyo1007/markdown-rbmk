import { describe, it, expect } from 'vitest';
import { badgeCacheKey, isValidUsername, parseBadgeOptions } from '../src/options';

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
    });
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
  });
});
