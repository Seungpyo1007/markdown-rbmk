import { describe, it, expect } from 'vitest';
import { render } from '../src/render';
import type { ContributionResult, StatsResult } from '../src/types';

const stats: StatsResult = {
  username: 'octocat',
  scope: 'public',
  totalBytes: 1000,
  reposScanned: 5,
  generatedAt: '2026-05-20T00:00:00.000Z',
  langs: [
    { name: 'TypeScript', bytes: 600, pct: 60, color: '#3178c6' },
    { name: 'Go', bytes: 400, pct: 40, color: '#00ADD8' },
  ],
};

const contributions: ContributionResult = {
  username: 'octocat',
  totalContributions: 500,
  days: Array.from({ length: 470 }, (_, i) => ({ date: `d${i}`, count: i % 9 })),
  generatedAt: '2026-05-20T00:00:00.000Z',
};

describe('render', () => {
  it('renders every mode as a script-free, animated, titled SVG', () => {
    const svgs = [
      render({ mode: 'commit', username: 'octocat', contributions }),
      render({ mode: 'language', username: 'octocat', stats }),
      render({ mode: 'hybrid', username: 'octocat', stats, contributions }),
    ];
    for (const svg of svgs) {
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
      expect(svg).not.toContain('<script'); // SPEC 7.3
      expect(svg).not.toContain('href'); // no external resources
      expect(svg).toContain('<animate'); // animated
      expect(svg).toContain('<title>'); // accessible name
    }
  });

  it('is deterministic for the same input', () => {
    const opts = { mode: 'commit', username: 'octocat', contributions } as const;
    expect(render(opts)).toBe(render(opts));
  });

  it('produces different output for different usernames', () => {
    const a = render({ mode: 'commit', username: 'octocat', contributions });
    const b = render({ mode: 'commit', username: 'torvalds', contributions });
    expect(a).not.toBe(b);
  });

  it('widens the viewBox to 800 only when the legend is shown', () => {
    const base = { mode: 'language', username: 'octocat', stats } as const;
    expect(render({ ...base, showLegend: true })).toContain('viewBox="0 0 800 600"');
    expect(render({ ...base, showLegend: false })).toContain('viewBox="0 0 600 600"');
  });

  it('places ~485 reactor cells', () => {
    const svg = render({ mode: 'commit', username: 'octocat', contributions });
    const cells = svg.match(/width="16"/g) ?? [];
    expect(cells.length).toBeGreaterThan(460);
    expect(cells.length).toBeLessThan(500);
  });

  it('throws when a mode is missing its required data', () => {
    expect(() => render({ mode: 'commit', username: 'x' })).toThrow();
    expect(() => render({ mode: 'language', username: 'x' })).toThrow();
    expect(() => render({ mode: 'hybrid', username: 'x', stats })).toThrow();
  });

  it('honours the light theme', () => {
    const svg = render({ mode: 'language', username: 'octocat', stats, theme: 'light' });
    expect(svg).toContain('#c8e6c8'); // light-theme dot colour
  });
});
