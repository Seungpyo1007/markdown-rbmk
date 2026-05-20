/**
 * Preview: render all three modes from hardcoded fake data. Open the files in
 * a browser to compare. Run: pnpm preview
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '../src/render';
import { mulberry32 } from '../src/rng';
import type { ContributionResult, RenderMode, StatsResult } from '../src/types';

const username = 'octocat';
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const fakeStats: StatsResult = {
  username,
  scope: 'public',
  totalBytes: 1_000_000,
  reposScanned: 42,
  generatedAt: '2026-05-20T00:00:00.000Z',
  langs: [
    { name: 'TypeScript', bytes: 550_000, pct: 55, color: '#2ECC71' },
    { name: 'JavaScript', bytes: 220_000, pct: 22, color: '#F1C40F' },
    { name: 'Python', bytes: 120_000, pct: 12, color: '#E74C3C' },
    { name: 'Go', bytes: 80_000, pct: 8, color: '#3498DB' },
    { name: 'Other', bytes: 30_000, pct: 3, color: '#27AE60' },
  ],
};

// Bursty fake activity: ~45% idle days, the rest a long tail of higher counts.
function fakeContributions(): ContributionResult {
  const rng = mulberry32(2026);
  const days = Array.from({ length: 470 }, (_, i) => {
    const count = rng() < 0.45 ? 0 : Math.floor(rng() * rng() * 32) + 1;
    return { date: `2026-day-${i}`, count };
  });
  return {
    username,
    totalContributions: days.reduce((s, d) => s + d.count, 0),
    days,
    generatedAt: '2026-05-20T00:00:00.000Z',
  };
}

for (const mode of ['commit', 'language', 'hybrid'] as RenderMode[]) {
  const svg = render({
    mode,
    username,
    theme: 'dark',
    stats: fakeStats,
    contributions: fakeContributions(),
  });
  const out = join(outDir, `preview-${mode}.svg`);
  writeFileSync(out, svg);
  console.log(`wrote ${out} (${svg.length} bytes)`);
}
