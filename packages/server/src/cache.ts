import { Redis } from '@upstash/redis';

/**
 * Optional Redis cache (SPEC 8.4), backed by Upstash — the store Vercel KV
 * was migrated to. It no-ops unless credentials are present, so local dev and
 * tests run without any setup. Both env naming schemes are accepted:
 *
 * - `KV_REST_API_URL` / `KV_REST_API_TOKEN` (legacy Vercel KV integration)
 * - `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (Upstash Marketplace)
 *
 * Cache failures are swallowed — caching must never break the badge.
 */

/**
 * Bump whenever rendered output changes for any key, so stale SVGs from the
 * previous deploy are never served. It namespaces every cache key.
 */
export const RENDER_VERSION = '2';

/** 24h TTL, matching the s-maxage on the response. */
const TTL_SECONDS = 86_400;

/** The subset of the Redis client the cache uses — injectable for tests. */
export interface CacheClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: string, opts: { ex: number }): Promise<unknown>;
}

type Env = Record<string, string | undefined>;

/** Build a client from env credentials, or null when caching is disabled. */
export function createCacheClient(env: Env = process.env): CacheClient | null {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch {
    return null; // malformed URL — run uncached rather than fail
  }
}

let client: CacheClient | null | undefined;

function getClient(): CacheClient | null {
  if (client === undefined) client = createCacheClient();
  return client;
}

/** Override the cache client (tests). Pass `undefined` to re-read the env. */
export function setCacheClient(next: CacheClient | null | undefined): void {
  client = next;
}

/** Namespace a logical key with the render version. */
export function cacheKey(key: string): string {
  return `badge:${RENDER_VERSION}:${key}`;
}

export async function cacheGet(key: string): Promise<string | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const value = await c.get<unknown>(cacheKey(key));
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, svg: string): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    await c.set(cacheKey(key), svg, { ex: TTL_SECONDS });
  } catch {
    /* ignore — caching is best-effort */
  }
}
