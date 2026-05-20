/**
 * Seeded PRNG so that a given username always produces the same badge
 * (number pattern, animation timing). mulberry32 — fast, good enough here.
 */
export function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic 32-bit hash of a username (same algorithm as String.hashCode). */
export function seedFromUsername(username: string): number {
  let h = 0;
  for (let i = 0; i < username.length; i++) {
    h = (Math.imul(31, h) + username.charCodeAt(i)) | 0;
  }
  return h;
}

/** Convenience: a fresh RNG seeded from a username. */
export function createRng(username: string): () => number {
  return mulberry32(seedFromUsername(username));
}

/** Pick a uniformly random element from a non-empty array. */
export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)] as T;
}
