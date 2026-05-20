import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as core from '@actions/core';
import type { ContributionResult, StatsResult } from '@markdown-rbmk/core';
import { run } from '../src/run';

const fakeStats = (username: string, scope: 'public' | 'all'): StatsResult => ({
  username,
  scope,
  totalBytes: 1000,
  reposScanned: 7,
  generatedAt: '2026-05-20T00:00:00.000Z',
  langs: [
    { name: 'TypeScript', bytes: 600, pct: 60, color: '#3178c6' },
    { name: 'Go', bytes: 400, pct: 40, color: '#00ADD8' },
  ],
});

const fakeContributions = (username: string): ContributionResult => ({
  username,
  totalContributions: 321,
  days: Array.from({ length: 470 }, (_, i) => ({ date: `d${i}`, count: i % 5 })),
  generatedAt: '2026-05-20T00:00:00.000Z',
});

/** Clear all action input env vars between tests. */
function clearInputs() {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('INPUT_')) delete process.env[key];
  }
  delete process.env.GITHUB_REPOSITORY;
}

beforeEach(clearInputs);
afterEach(() => {
  clearInputs();
  process.exitCode = 0; // reset after core.setFailed()
});

describe('run', () => {
  it('writes a commit-mode badge to the default output path', async () => {
    process.env.INPUT_USERNAME = 'octocat';
    const written: Array<{ path: string; data: string }> = [];

    await run({
      collectContributions: async (input) => fakeContributions(input.username),
      writeFile: (path, data) => written.push({ path, data }),
    });

    expect(written).toHaveLength(1);
    expect(written[0]!.path).toBe('reactor-core.svg');
    expect(written[0]!.data).toContain('<svg');
    expect(process.exitCode ?? 0).toBe(0);
  });

  it('honours mode, scope, output_path and theme inputs', async () => {
    process.env.INPUT_USERNAME = 'octocat';
    process.env.INPUT_MODE = 'language';
    process.env.INPUT_SCOPE = 'all';
    process.env.INPUT_OUTPUT_PATH = 'badges/core.svg';
    process.env.INPUT_THEME = 'light';
    let seenScope = '';
    const written: Array<{ path: string; data: string }> = [];

    await run({
      collectStats: async (input) => {
        seenScope = input.scope;
        return fakeStats(input.username, input.scope);
      },
      writeFile: (path, data) => written.push({ path, data }),
    });

    expect(seenScope).toBe('all');
    expect(written[0]!.path).toBe('badges/core.svg');
    expect(written[0]!.data).toContain('#c8e6c8'); // light-theme dot colour
  });

  it('falls back to the repository owner when no username input is given', async () => {
    process.env.GITHUB_REPOSITORY = 'torvalds/linux';
    let seenUser = '';

    await run({
      collectContributions: async (input) => {
        seenUser = input.username;
        return fakeContributions(input.username);
      },
      writeFile: () => {},
    });

    expect(seenUser).toBe('torvalds');
  });

  it('fails the action (no file written) when collection throws', async () => {
    process.env.INPUT_USERNAME = 'ghost';
    // Stub setFailed so its `::error::` workflow command is not emitted as a
    // stray annotation when the suite itself runs inside GitHub Actions.
    const setFailed = vi.spyOn(core, 'setFailed').mockImplementation(() => {});
    let wrote = false;

    await run({
      collectContributions: async () => {
        throw new Error('boom');
      },
      writeFile: () => {
        wrote = true;
      },
    });

    expect(wrote).toBe(false);
    expect(setFailed).toHaveBeenCalledWith(expect.stringContaining('boom'));
    setFailed.mockRestore();
  });
});
