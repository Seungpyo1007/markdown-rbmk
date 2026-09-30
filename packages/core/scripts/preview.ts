/**
 * Preview: render all three modes from deterministic fake data, so layout and
 * option changes can be eyeballed without the network. Open the written SVGs
 * in a browser.
 *
 *   pnpm preview                          # defaults
 *   pnpm preview "days=90&langs=6"        # any badge query string
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectContributions } from '../src/contributions';
import type { ContributionFetcher } from '../src/contributions';
import { parseBadgeOptions, toContributionsInput, toStatsInput } from '../src/options';
import { render } from '../src/render';
import { mulberry32 } from '../src/rng';
import { collectStats } from '../src/stats';
import type { RepoFetcher } from '../src/stats';
import type { RenderMode } from '../src/types';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const query = new URLSearchParams(process.argv[2] ?? '');
if (!query.has('username')) query.set('username', 'octocat');
const opts = parseBadgeOptions((name) => query.get(name));

// Fake repos with a long tail of languages, so `langs`/`exclude` are visible.
const fakeRepos: RepoFetcher = async () => [
  {
    name: 'app',
    isFork: false,
    isArchived: false,
    languages: { TypeScript: 550_000, JavaScript: 220_000, HTML: 60_000, CSS: 40_000 },
  },
  { name: 'ml', isFork: false, isArchived: false, languages: { Python: 120_000, 'Jupyter Notebook': 90_000 } },
  { name: 'svc', isFork: false, isArchived: true, languages: { Go: 80_000, Shell: 12_000 } },
  { name: 'fork', isFork: true, isArchived: false, languages: { Rust: 300_000, C: 30_000 } },
];

// Bursty fake activity: ~45% idle days, the rest a long tail of higher counts.
const fakeCalendar: ContributionFetcher = async (_login, _token, from, to) => {
  const rng = mulberry32(Math.floor(from.getTime() / 86_400_000));
  const days = [];
  for (let t = from.getTime(); t <= to.getTime(); t += 86_400_000) {
    const count = rng() < 0.45 ? 0 : Math.floor(rng() * rng() * 32) + 1;
    days.push({ date: new Date(t).toISOString().slice(0, 10), count });
  }
  return days;
};

const [stats, contributions] = await Promise.all([
  collectStats(toStatsInput(opts, opts.username, 'fake'), fakeRepos),
  collectContributions(toContributionsInput(opts, opts.username, 'fake'), fakeCalendar),
]);

console.log(`options: ${JSON.stringify(opts)}`);
console.log(`languages: ${stats.langs.map((l) => `${l.name} ${l.pct}%`).join(', ')}`);
console.log(`days: ${contributions.days.length}, total: ${contributions.totalContributions}`);

for (const mode of ['commit', 'language', 'hybrid'] as RenderMode[]) {
  const svg = render({ mode, username: opts.username, theme: opts.theme, stats, contributions });
  const out = join(outDir, `preview-${mode}.svg`);
  writeFileSync(out, svg);
  console.log(`wrote ${out} (${svg.length} bytes)`);
}
