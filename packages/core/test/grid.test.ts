import { describe, it, expect } from 'vitest';
import { computeGridPositions, distributeCells } from '../src/grid';
import type { LanguageStat } from '../src/types';

const lang = (name: string, pct: number): LanguageStat => ({
  name,
  pct,
  bytes: 0,
  color: '#000000',
});

describe('computeGridPositions', () => {
  const positions = computeGridPositions();

  it('produces ~485 cells', () => {
    expect(positions.length).toBeGreaterThan(460);
    expect(positions.length).toBeLessThan(510);
  });

  it('keeps every cell within the mask radius', () => {
    for (const p of positions) {
      expect(p.dist).toBeLessThanOrEqual(270);
    }
  });

  it('is sorted by distance ascending', () => {
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]!.dist).toBeGreaterThanOrEqual(positions[i - 1]!.dist);
    }
  });
});

describe('distributeCells', () => {
  const total = computeGridPositions().length;

  it('fills exactly totalCells', () => {
    const out = distributeCells(
      [lang('A', 55), lang('B', 22), lang('C', 12), lang('D', 8), lang('E', 3)],
      total,
    );
    expect(out.length).toBe(total);
  });

  it('puts the top language in the centre (first cells)', () => {
    const out = distributeCells([lang('A', 60), lang('B', 40)], total);
    expect(out[0]!.name).toBe('A');
    expect(out[Math.floor(total * 0.4)]!.name).toBe('A');
    expect(out[total - 1]!.name).toBe('B');
  });

  it('single language 100% -> every cell is that language', () => {
    const out = distributeCells([lang('Solo', 100)], total);
    expect(out.length).toBe(total);
    expect(out.every((c) => c.name === 'Solo')).toBe(true);
  });

  it('empty input -> empty result', () => {
    expect(distributeCells([], total)).toEqual([]);
  });
});
