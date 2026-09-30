/**
 * The demo page builds badge URLs in the browser (public/playground.js).
 * Whatever it builds must parse, on the server, back to exactly the options
 * the user picked — and default choices must produce the plain legacy URL.
 */
import { describe, it, expect } from 'vitest';
import {
  CELL_SHAPES as SERVER_CELL_SHAPES,
  parseBadgeOptions,
  STAT_KEYS as SERVER_STAT_KEYS,
  STYLE_META,
  STYLE_NAMES,
} from '@markdown-rbmk/core';
import {
  buildBadgeUrl,
  buildHtml,
  buildMarkdown,
  buildQuery,
  buildSplitHtml,
  CELL_SHAPES,
  DEFAULTS,
  normaliseExclude,
  readQuery,
  STAT_KEYS,
  STYLES,
  // @ts-expect-error — plain browser ES module without type declarations
} from '../../../public/playground.js';

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

describe('playground style catalogue', () => {
  it('mirrors STYLE_META exactly, with classic first', () => {
    expect(STYLES[0]).toMatchObject({ name: 'classic', presets: ['dark', 'light'] });
    const v2 = STYLES.slice(1).map((s: { presets: readonly string[] }) => ({ ...s, presets: [...s.presets] }));
    expect(v2).toEqual(Object.values(STYLE_META).map((m) => ({ ...m, presets: [...m.presets] })));
    expect(STYLES.map((s: { name: string }) => s.name)).toEqual(['classic', ...STYLE_NAMES]);
  });

  it('mirrors the server enums', () => {
    expect(CELL_SHAPES).toEqual(SERVER_CELL_SHAPES);
    expect(STAT_KEYS).toEqual(SERVER_STAT_KEYS);
  });
});

describe('playground style params', () => {
  it('round-trips every style x every preset', () => {
    for (const s of STYLES as { name: string; presets: string[] }[]) {
      for (const preset of s.presets) {
        const o = parse(buildBadgeUrl({ username: 'octocat', style: s.name, theme: preset }));
        expect(o.style).toBe(s.name);
        expect(o.preset).toBe(preset);
        expect(o.theme).toBe(preset === 'light' ? 'light' : 'dark');
      }
    }
  });

  it('emits only the username for classic with defaults, and style for v2 defaults', () => {
    expect(buildQuery({ username: 'octocat', ...DEFAULTS, style: 'classic' })).toBe('username=octocat');
    expect(buildQuery({ username: 'octocat', ...DEFAULTS, style: 'gauge' })).toBe('username=octocat&style=gauge');
  });

  it('round-trips view/panel/cell/anim/accent/heat/stats', () => {
    const chosen = {
      username: 'octocat',
      mode: 'hybrid',
      style: 'blueprint',
      theme: 'sepia',
      view: 'panel',
      panel: 'bottom',
      cell: 'hex',
      anim: false,
      accent: '#F80',
      heat: ['#111', '222222', '#333333', '#444', '#ABCDEF'],
      stats: ['Streak', 'total', 'bogus', 'streak', 'languages'],
      days: 90,
    };
    const url = buildBadgeUrl(chosen);
    expect(url).toBe(
      'https://markdown-rbmk.vercel.app/api/badge?username=octocat&mode=hybrid&style=blueprint&theme=sepia' +
        '&view=panel&panel=bottom&cell=hex&anim=off&accent=ff8800' +
        '&heat=111111,222222,333333,444444,abcdef&stats=streak,total,languages&days=90',
    );
    expect(parse(url)).toMatchObject({
      style: 'blueprint',
      preset: 'sepia',
      view: 'panel',
      panel: 'bottom',
      cell: 'hex',
      animate: false,
      accent: '#ff8800',
      heat: ['#111111', '#222222', '#333333', '#444444', '#abcdef'],
      stats: ['streak', 'total', 'languages'],
      days: 90,
    });
  });

  it('round-trips each view, panel and cell value', () => {
    for (const view of ['full', 'core', 'panel']) {
      for (const panel of ['right', 'bottom']) {
        for (const cell of CELL_SHAPES as string[]) {
          const o = parse(buildBadgeUrl({ username: 'octocat', style: 'skala', view, panel, cell }));
          expect([o.view, o.panel, o.cell]).toEqual([view, panel, cell]);
        }
      }
    }
  });

  it('drops invalid heat/accent/stats and leaves classic free of v2 params', () => {
    const q = buildQuery({ username: 'octocat', style: 'minimal', accent: 'nope', heat: '#111,#222', stats: 'x,y' });
    expect(q).toBe('username=octocat&style=minimal');
    const classic = buildQuery({
      username: 'octocat', style: 'classic', theme: 'green', view: 'core', cell: 'hex', anim: false, accent: '#fff',
    });
    expect(classic).toBe('username=octocat');
    expect(parse(buildBadgeUrl({ username: 'octocat', style: 'classic', theme: 'green' }))).toMatchObject({
      style: 'classic', theme: 'dark', preset: 'dark', view: 'full', animate: true, accent: null,
    });
  });

  it('reads its own query back (deep links)', () => {
    const chosen = {
      username: 'octocat', mode: 'language', style: 'poster', theme: 'cobalt', view: 'core', panel: 'bottom',
      cell: 'circle', anim: false, accent: '#123456', heat: '#000000,#111111,#222222,#333333,#444444',
      stats: 'languages,total', maxRepos: 30, days: 60, langs: 7, exclude: 'HTML,CSS', forks: true, archived: false,
    };
    expect(readQuery(buildQuery(chosen))).toEqual(chosen);
    expect(readQuery('username=octocat')).toEqual({ username: 'octocat', ...DEFAULTS });
  });

  it('builds split core + panel snippets', () => {
    const html = buildSplitHtml({ username: 'octocat', style: 'gauge' });
    expect(html).toContain('style=gauge&amp;view=core');
    expect(html).toContain('style=gauge&amp;view=panel');
    expect(buildHtml({ username: 'octocat', mode: 'hybrid' })).toBe(
      '<img src="https://markdown-rbmk.vercel.app/api/badge?username=octocat&amp;mode=hybrid" width="680" alt="markdown-RBMK reactor core" />',
    );
  });
});
