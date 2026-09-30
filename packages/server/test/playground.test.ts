/**
 * The demo page builds badge URLs in the browser (public/playground.js).
 * Whatever it builds must parse, on the server, back to exactly the options
 * the user picked — and default choices must produce the plain legacy URL.
 */
import { describe, it, expect } from 'vitest';
import { parseBadgeOptions } from '@markdown-rbmk/core';
// @ts-expect-error — plain browser ES module without type declarations
import { buildBadgeUrl, buildMarkdown, buildQuery, DEFAULTS, normaliseExclude } from '../../../public/playground.js';

const parse = (url: string) => {
  const params = new URL(url).searchParams;
  return parseBadgeOptions((name) => params.get(name), 'server');
};

describe('playground URL builder', () => {
  it('emits only the username for default options (legacy URL)', () => {
    expect(buildQuery({ username: 'octocat', ...DEFAULTS })).toBe('username=octocat');
  });

  it('matches the server parser defaults', () => {
    const o = parse(buildBadgeUrl({ username: 'octocat', ...DEFAULTS }));
    expect(o).toMatchObject({
      mode: DEFAULTS.mode,
      theme: DEFAULTS.theme,
      maxRepos: DEFAULTS.maxRepos,
      days: DEFAULTS.days,
      langs: DEFAULTS.langs,
      exclude: [],
      forks: DEFAULTS.forks,
      archived: DEFAULTS.archived,
    });
  });

  it('round-trips every non-default option through the server parser', () => {
    const chosen = {
      username: 'octocat',
      mode: 'hybrid',
      theme: 'light',
      maxRepos: 25,
      days: 90,
      langs: 6,
      exclude: 'HTML, Jupyter Notebook',
      forks: true,
      archived: false,
    };
    expect(parse(buildBadgeUrl(chosen))).toEqual({
      username: 'octocat',
      mode: 'hybrid',
      theme: 'light',
      scope: 'public',
      maxRepos: 25,
      days: 90,
      langs: 6,
      exclude: ['html', 'jupyter notebook'],
      forks: true,
      archived: false,
      style: 'classic',
      preset: 'light',
      view: 'full',
      panel: 'right',
      cell: 'default',
      animate: true,
      accent: null,
      heat: null,
      stats: null,
    });
  });

  it('encodes user input safely', () => {
    const url = buildBadgeUrl({ username: 'octocat', exclude: 'C++, F#, a&b=c' });
    expect(url).not.toContain('&b=c');
    expect(parse(url).exclude).toEqual(['a&b=c', 'c++', 'f#']);
  });

  it('dedupes and trims the exclude list', () => {
    expect(normaliseExclude(' HTML ,html,, CSS ')).toBe('HTML,CSS');
  });

  it('builds a production Markdown snippet', () => {
    expect(buildMarkdown({ username: 'octocat', mode: 'language' })).toBe(
      '![markdown-RBMK reactor core](https://markdown-rbmk.vercel.app/api/badge?username=octocat&mode=language)',
    );
  });
});
