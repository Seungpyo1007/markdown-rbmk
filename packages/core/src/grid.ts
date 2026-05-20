import type { CellPosition, LanguageStat } from './types';

/** Reactor centre in SVG coordinates. */
const CENTER = 300;
/** Cell rect size (16x16). */
const CELL = 16;
/** Grid step between cells. */
const STEP = 22;
/** Top-left x/y of the first cell rect. */
const ORIGIN = 42;
/** Cells per row/column before masking. */
const GRID = 24;
/** Circular mask radius — a cell is kept if its centre is within this. */
const MASK_RADIUS = 270;

/**
 * Compute every reactor cell position: a 24x24 grid clipped to a circle,
 * sorted by distance from the centre (ascending). ~485 cells.
 */
export function computeGridPositions(): CellPosition[] {
  const out: CellPosition[] = [];
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const cx = ORIGIN + STEP * i;
      const cy = ORIGIN + STEP * j;
      const dx = cx + CELL / 2 - CENTER;
      const dy = cy + CELL / 2 - CENTER;
      const dist = Math.hypot(dx, dy);
      if (dist <= MASK_RADIUS) out.push({ cx, cy, dist });
    }
  }
  // Distance ascending; tie-break on coords for stable, deterministic output.
  out.sort((a, b) => a.dist - b.dist || a.cx - b.cx || a.cy - b.cy);
  return out;
}

/**
 * Spread cells across languages by percentage. Rounding error is absorbed by
 * the last slot. The returned array is ordered language-by-language, so the
 * first entries (paired with the most central positions) are the top language.
 */
export function distributeCells(langs: LanguageStat[], totalCells: number): LanguageStat[] {
  if (langs.length === 0 || totalCells <= 0) return [];

  const counts = langs.map((l) => Math.round((l.pct / 100) * totalCells));
  const sum = counts.reduce((a, b) => a + b, 0);
  const lastIdx = counts.length - 1;
  counts[lastIdx] = Math.max(0, (counts[lastIdx] as number) + (totalCells - sum));

  const out: LanguageStat[] = [];
  langs.forEach((lang, i) => {
    for (let n = 0; n < (counts[i] as number); n++) out.push(lang);
  });

  // Guard against under/overshoot from the clamp above.
  const last = langs[lastIdx] as LanguageStat;
  while (out.length < totalCells) out.push(last);
  out.length = Math.min(out.length, totalCells);
  return out;
}
