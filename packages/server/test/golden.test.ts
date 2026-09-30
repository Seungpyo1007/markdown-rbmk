/**
 * Golden snapshots of the hosted endpoint for legacy (v1) URLs — body and
 * headers. Existing README embeds depend on these; they must never change.
 */
import { describe, it, expect } from 'vitest';
import type { BadgeDeps } from '../src/badge';
import { handleBadge } from '../src/badge';
import { fallbackSvg } from '../src/fallback';
import { StatsError } from '@markdown-rbmk/core';
import {
  fixtureContributions,
  fixtureStats,
} from '../../core/test/fixtures';

const deps: BadgeDeps = {
  collectStats: async (input) => ({ ...fixtureStats, username: input.username }),
  collectContributions: async (input) => ({ ...fixtureContributions(), username: input.username }),
};

const LEGACY_URLS = [
  '?username=octocat',
  '?username=octocat&v=1',
  '?username=octocat&mode=commit',
  '?username=octocat&mode=language',
  '?username=octocat&mode=hybrid',
  '?username=octocat&mode=language&theme=light',
  '?username=octocat&mode=hybrid&theme=light&maxRepos=5',
  '?username=octocat&mode=bogus&theme=bogus&maxRepos=abc',
];

const name = (qs: string) =>
  qs.replace(/^\?/, '').replace(/[^a-z0-9]+/gi, '_');

async function snapshotOf(res: Response): Promise<string> {
  const headers = [...res.headers.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  return `status: ${res.status}\n${headers}\n\n${await res.text()}`;
}

describe('legacy endpoint golden snapshots', () => {
  for (const qs of LEGACY_URLS) {
    it(qs, async () => {
      const res = await handleBadge(new Request(`https://example.com/api/badge${qs}`), deps);
      await expect(await snapshotOf(res)).toMatchFileSnapshot(`./__golden__/${name(qs)}.txt`);
    });
  }

  const errorCases: Array<[string, string, BadgeDeps]> = [
    ['missing-username', '', deps],
    ['invalid-username', '?username=not%20valid%21', deps],
    ['scope-all', '?username=octocat&scope=all', deps],
    [
      'rate-limit-light',
      '?username=octocat&theme=light',
      { collectContributions: async () => { throw new StatsError('rate_limit', 'x', 42); } },
    ],
    [
      'user-not-found',
      '?username=ghost',
      { collectContributions: async () => { throw new StatsError('user_not_found', 'x'); } },
    ],
    [
      'unknown-error',
      '?username=ghost&mode=language',
      { collectStats: async () => { throw new Error('boom'); } },
    ],
  ];
  for (const [label, qs, d] of errorCases) {
    it(`fallback: ${label}`, async () => {
      const res = await handleBadge(new Request(`https://example.com/api/badge${qs}`), d);
      await expect(await snapshotOf(res)).toMatchFileSnapshot(`./__golden__/fallback-${label}.txt`);
    });
  }

  it('fallbackSvg direct', async () => {
    await expect(fallbackSvg(['a <b>', 'c & "d"'], 'light')).toMatchFileSnapshot(
      './__golden__/fallback-direct.svg',
    );
  });
});
