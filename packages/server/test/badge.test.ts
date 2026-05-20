import { describe, it, expect } from 'vitest';
import { StatsError } from '@markdown-rbmk/core';
import type { ContributionResult, StatsResult } from '@markdown-rbmk/core';
import { handleBadge } from '../src/badge';
import type { BadgeDeps } from '../src/badge';

const fakeStats = (username: string): StatsResult => ({
  username,
  scope: 'public',
  totalBytes: 1000,
  reposScanned: 5,
  generatedAt: '2026-05-20T00:00:00.000Z',
  langs: [
    { name: 'TypeScript', bytes: 600, pct: 60, color: '#3178c6' },
    { name: 'JavaScript', bytes: 400, pct: 40, color: '#f1e05a' },
  ],
});

const fakeContributions = (username: string): ContributionResult => ({
  username,
  totalContributions: 742,
  days: Array.from({ length: 470 }, (_, i) => ({ date: `d${i}`, count: i % 9 })),
  generatedAt: '2026-05-20T00:00:00.000Z',
});

const okDeps: BadgeDeps = {
  collectStats: async (input) => fakeStats(input.username),
  collectContributions: async (input) => fakeContributions(input.username),
};

const req = (qs: string) => new Request(`https://example.com/api/badge${qs}`);

describe('handleBadge', () => {
  it('returns a 200 commit-mode SVG by default', async () => {
    const res = await handleBadge(req('?username=octocat'), okDeps);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
    const body = await res.text();
    expect(body).toContain('<svg');
    expect(body).not.toContain('<script');
    expect(body).toContain('CONTRIBUTIONS'); // commit-mode instrument panel
  });

  it('renders the language mode with a fuel-channel panel', async () => {
    const res = await handleBadge(req('?username=octocat&mode=language'), okDeps);
    const body = await res.text();
    expect(body).toContain('FUEL CHANNELS');
    expect(body).toContain('TypeScript');
  });

  it('sets long-lived cache headers on a fresh badge', async () => {
    const res = await handleBadge(req('?username=octocat'), okDeps);
    const cc = res.headers.get('cache-control') ?? '';
    expect(cc).toContain('s-maxage=86400');
    expect(cc).toContain('stale-while-revalidate');
    expect(res.headers.get('x-badge-cache')).toBe('MISS');
  });

  it('rejects scope=all with an advisory fallback SVG (still 200)', async () => {
    const res = await handleBadge(req('?username=octocat&scope=all'), okDeps);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('GitHub Action');
  });

  it('returns a fallback SVG when username is missing', async () => {
    const res = await handleBadge(req(''), okDeps);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('REACTOR OFFLINE');
  });

  it('returns a fallback SVG for an invalid username', async () => {
    const res = await handleBadge(req('?username=not%20valid%21'), okDeps);
    const body = await res.text();
    expect(body).toContain('Invalid username');
  });

  it('returns a fallback SVG (200) when collection fails', async () => {
    const failing: BadgeDeps = {
      collectContributions: async () => {
        throw new StatsError('user_not_found', 'nope');
      },
    };
    const res = await handleBadge(req('?username=ghost'), failing);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('REACTOR OFFLINE');
    expect(body).toContain('not found');
  });

  it('honours the light theme', async () => {
    const res = await handleBadge(req('?username=octocat&mode=language&theme=light'), okDeps);
    const body = await res.text();
    expect(body).toContain('#c8e6c8'); // light-theme dot colour
  });

  it('renders with a transparent background (no background fill)', async () => {
    const res = await handleBadge(req('?username=octocat'), okDeps);
    const body = await res.text();
    expect(body).not.toContain('background:');
    expect(body).not.toContain('<rect width="600" height="600"');
  });
});
