import { afterEach, describe, expect, it } from 'vitest';
import type { CacheClient } from '../src/cache';
import {
  cacheGet,
  cacheKey,
  cacheSet,
  createCacheClient,
  RENDER_VERSION,
  setCacheClient,
} from '../src/cache';
import { handleBadge } from '../src/badge';
import { fixtureContributions } from '../../core/test/fixtures';

/** In-memory stand-in for the Upstash client. */
function memoryClient(): CacheClient & { store: Map<string, string>; ttl: Map<string, number> } {
  const store = new Map<string, string>();
  const ttl = new Map<string, number>();
  return {
    store,
    ttl,
    async get<T>(key: string) {
      return (store.get(key) ?? null) as T | null;
    },
    async set(key: string, value: string, opts: { ex: number }) {
      store.set(key, value);
      ttl.set(key, opts.ex);
      return 'OK';
    },
  };
}

const failingClient: CacheClient = {
  async get() {
    throw new Error('redis down');
  },
  async set() {
    throw new Error('redis down');
  },
};

afterEach(() => setCacheClient(undefined));

describe('createCacheClient', () => {
  it('is disabled without credentials', () => {
    expect(createCacheClient({})).toBeNull();
    expect(createCacheClient({ KV_REST_API_URL: 'https://x.upstash.io' })).toBeNull();
  });

  it('accepts the legacy Vercel KV env names', () => {
    expect(
      createCacheClient({ KV_REST_API_URL: 'https://x.upstash.io', KV_REST_API_TOKEN: 't' }),
    ).not.toBeNull();
  });

  it('accepts the Upstash env names', () => {
    expect(
      createCacheClient({ UPSTASH_REDIS_REST_URL: 'https://x.upstash.io', UPSTASH_REDIS_REST_TOKEN: 't' }),
    ).not.toBeNull();
  });
});

describe('cache helpers', () => {
  it('namespaces keys with the render version', () => {
    expect(cacheKey('octocat:commit')).toBe(`badge:${RENDER_VERSION}:octocat:commit`);
  });

  it('no-ops when disabled', async () => {
    setCacheClient(null);
    await cacheSet('k', '<svg/>');
    expect(await cacheGet('k')).toBeNull();
  });

  it('round-trips with a 24h TTL', async () => {
    const mem = memoryClient();
    setCacheClient(mem);
    await cacheSet('k', '<svg/>');
    expect(await cacheGet('k')).toBe('<svg/>');
    expect(mem.ttl.get(cacheKey('k'))).toBe(86_400);
  });

  it('swallows client failures', async () => {
    setCacheClient(failingClient);
    await expect(cacheSet('k', '<svg/>')).resolves.toBeUndefined();
    await expect(cacheGet('k')).resolves.toBeNull();
  });
});

describe('handleBadge with a cache', () => {
  const deps = {
    collectContributions: async () => fixtureContributions(),
  };
  const req = () => new Request('https://example.com/api/badge?username=octocat');

  it('serves MISS then HIT with an identical body', async () => {
    setCacheClient(memoryClient());
    const first = await handleBadge(req(), deps);
    const second = await handleBadge(req(), deps);
    expect(first.headers.get('x-badge-cache')).toBe('MISS');
    expect(second.headers.get('x-badge-cache')).toBe('HIT');
    expect(await second.text()).toBe(await first.text());
  });

  it('still renders when the cache is down', async () => {
    setCacheClient(failingClient);
    const res = await handleBadge(req(), deps);
    expect(res.headers.get('x-badge-cache')).toBe('MISS');
    expect(await res.text()).toContain('<svg');
  });
});
