import { kv } from '@vercel/kv';

/**
 * Optional Vercel KV cache (SPEC 8.4). No-ops unless KV env vars are present,
 * so local dev and tests run fine without any KV setup. `kv` is a lazy proxy —
 * importing it is harmless; it only connects when a method is actually called.
 * Cache failures are swallowed — caching must never break the badge.
 */
const KV_ENABLED = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

/** 24h TTL, matching the s-maxage on the response. */
const TTL_SECONDS = 86_400;

export async function cacheGet(key: string): Promise<string | null> {
  if (!KV_ENABLED) return null;
  try {
    return (await kv.get<string>(`badge:${key}`)) ?? null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, svg: string): Promise<void> {
  if (!KV_ENABLED) return;
  try {
    await kv.set(`badge:${key}`, svg, { ex: TTL_SECONDS });
  } catch {
    /* ignore — caching is best-effort */
  }
}
