import { describe, it, expect } from 'vitest';
import { mapLimit } from '../src/concurrency';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('mapLimit', () => {
  it('never runs more than `limit` tasks at once', async () => {
    let inFlight = 0;
    let peak = 0;
    await mapLimit(Array.from({ length: 30 }, (_, i) => i), 8, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await sleep(2);
      inFlight--;
    });
    expect(peak).toBe(8);
  });

  it('preserves input order even when tasks finish out of order', async () => {
    const out = await mapLimit([30, 1, 20, 5], 2, async (ms, i) => {
      await sleep(ms);
      return `${i}:${ms}`;
    });
    expect(out).toEqual(['0:30', '1:1', '2:20', '3:5']);
  });

  it('handles empty input and limits above the item count', async () => {
    expect(await mapLimit([], 8, async () => 1)).toEqual([]);
    expect(await mapLimit([1, 2], 50, async (n) => n * 2)).toEqual([2, 4]);
  });

  it('rejects when a task fails', async () => {
    await expect(
      mapLimit([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      }),
    ).rejects.toThrow('boom');
  });
});
