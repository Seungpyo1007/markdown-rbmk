import { describe, it, expect } from 'vitest';
import { createRng, mulberry32, seedFromUsername } from '../src/rng';

describe('mulberry32', () => {
  it('produces the same sequence for the same seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('stays within [0, 1)', () => {
    const r = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('seedFromUsername', () => {
  it('is deterministic', () => {
    expect(seedFromUsername('octocat')).toBe(seedFromUsername('octocat'));
  });

  it('differs for different usernames', () => {
    expect(seedFromUsername('octocat')).not.toBe(seedFromUsername('torvalds'));
  });
});

describe('createRng', () => {
  it('same username -> same sequence', () => {
    const a = createRng('octocat');
    const b = createRng('octocat');
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('different username -> different sequence', () => {
    const a = createRng('octocat');
    const b = createRng('torvalds');
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('is roughly uniform across 10 buckets', () => {
    const r = createRng('distribution-test');
    const buckets = new Array(10).fill(0);
    const N = 10_000;
    for (let i = 0; i < N; i++) buckets[Math.floor(r() * 10)]++;
    for (const count of buckets) {
      expect(count).toBeGreaterThan((N / 10) * 0.8);
      expect(count).toBeLessThan((N / 10) * 1.2);
    }
  });
});
