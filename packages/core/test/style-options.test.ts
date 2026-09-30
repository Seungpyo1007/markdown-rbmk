import { describe, it, expect } from 'vitest';
import { badgeCacheKey, parseBadgeOptions, parseHeat, parseHex, parseStatList } from '../src/options';
import { STYLE_META, STYLE_NAMES } from '../src/styles';

const from =
  (o: Record<string, string>) =>
  (name: string): string | null =>
    o[name] ?? null;

describe('v2 style options', () => {
  it('defaults to classic, and classic ignores every v2 param in the cache key', () => {
    const legacy = parseBadgeOptions(from({ username: 'octocat' }));
    const noisy = parseBadgeOptions(from({ username: 'octocat', view: 'core', cell: 'hex', accent: 'ff0000' }));
    expect(legacy.style).toBe('classic');
    expect(badgeCacheKey(noisy)).toBe(badgeCacheKey(legacy));
  });

  it('accepts every style name, case-insensitively', () => {
    for (const s of STYLE_NAMES) {
      expect(parseBadgeOptions(from({ style: s.toUpperCase() })).style).toBe(s);
    }
    expect(parseBadgeOptions(from({ style: 'nope' })).style).toBe('classic');
  });

  it('maps theme to a style preset, falling back to dark/light', () => {
    expect(parseBadgeOptions(from({ style: 'blueprint', theme: 'sepia' }))).toMatchObject({
      preset: 'sepia',
      theme: 'dark', // classic/fallback theme stays valid
    });
    expect(parseBadgeOptions(from({ style: 'blueprint', theme: 'light' })).preset).toBe('light');
    expect(parseBadgeOptions(from({ style: 'blueprint', theme: 'abyss' })).preset).toBe('dark');
    expect(parseBadgeOptions(from({ style: 'classic', theme: 'sepia' })).theme).toBe('dark');
  });

  it('every style offers dark and light presets', () => {
    for (const s of STYLE_NAMES) expect(STYLE_META[s].presets.slice(0, 2)).toEqual(['dark', 'light']);
  });

  it('parses layout and cell options', () => {
    expect(parseBadgeOptions(from({ view: 'core', panel: 'bottom', cell: 'hex', anim: 'off' }))).toMatchObject({
      view: 'core',
      panel: 'bottom',
      cell: 'hex',
      animate: false,
    });
    expect(parseBadgeOptions(from({ view: 'x', panel: 'y', cell: 'z', anim: 'on' }))).toMatchObject({
      view: 'full',
      panel: 'right',
      cell: 'default',
      animate: true,
    });
  });

  it('accepts only strict hex colours', () => {
    expect(parseHex('ff8800')).toBe('#ff8800');
    expect(parseHex('#F80')).toBe('#ff8800');
    for (const bad of ['red', '#ff88', 'ff8800;x', '#ff8800"/><script>', 'url(#x)', '']) {
      expect(parseHex(bad)).toBeNull();
    }
  });

  it('needs exactly five valid heat colours', () => {
    expect(parseHeat('111,222,333,444,555')).toEqual(['#111111', '#222222', '#333333', '#444444', '#555555']);
    expect(parseHeat('111,222,333,444')).toBeNull();
    expect(parseHeat('111,222,333,444,zzz')).toBeNull();
  });

  it('keeps known stat keys in order, deduped', () => {
    expect(parseStatList('streak, TOTAL,bogus,streak')).toEqual(['streak', 'total']);
    expect(parseStatList('bogus')).toBeNull();
  });

  it('includes every v2 option in the cache key of a styled badge', () => {
    const base = { username: 'octocat', style: 'skala' };
    const key = badgeCacheKey(parseBadgeOptions(from(base)));
    for (const extra of [
      { theme: 'green' },
      { view: 'core' },
      { panel: 'bottom' },
      { cell: 'hex' },
      { anim: 'off' },
      { accent: 'ff0000' },
      { heat: '111,222,333,444,555' },
      { stats: 'total' },
    ]) {
      expect(badgeCacheKey(parseBadgeOptions(from({ ...base, ...extra })))).not.toBe(key);
    }
  });
});
