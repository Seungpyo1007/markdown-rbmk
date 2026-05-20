/**
 * End-to-end check against the real GitHub API.
 * Run: pnpm --filter @markdown-rbmk/core exec tsx scripts/e2e.ts <username>
 *
 * Language mode works unauthenticated (REST). Commit mode also runs when a
 * GITHUB_TOKEN env var is present (the GraphQL contributions API needs auth).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectContributions, collectStats, render } from '../src/index';

const username = process.argv[2] ?? 'Seungpyo1007';
const token = process.env.GITHUB_TOKEN;
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const stats = await collectStats({ username, scope: 'public', token, maxRepos: 60 });
console.log(`[language] ${stats.reposScanned} repos, ${stats.totalBytes.toLocaleString()} bytes`);
for (const l of stats.langs) {
  console.log(`  ${l.name.padEnd(16)} ${String(l.pct).padStart(5)}%  ${l.color}`);
}
writeFileSync(join(outDir, 'e2e-language.svg'), render({ mode: 'language', username, stats }));
console.log('wrote e2e-language.svg');

if (token) {
  const contributions = await collectContributions({ username, token });
  console.log(
    `[commit]   ${contributions.totalContributions} contributions over ${contributions.days.length} days`,
  );
  writeFileSync(
    join(outDir, 'e2e-commit.svg'),
    render({ mode: 'commit', username, contributions }),
  );
  writeFileSync(
    join(outDir, 'e2e-hybrid.svg'),
    render({ mode: 'hybrid', username, stats, contributions }),
  );
  console.log('wrote e2e-commit.svg, e2e-hybrid.svg');
} else {
  console.log('[commit]   skipped — set GITHUB_TOKEN to render commit/hybrid modes');
}
