import { writeFileSync } from 'node:fs';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { collectContributions, collectStats, parseBadgeOptions, render } from '@markdown-rbmk/core';

/** Injectable dependencies — lets `run` be tested without network or disk. */
export interface RunDeps {
  collectStats?: typeof collectStats;
  collectContributions?: typeof collectContributions;
  writeFile?: (path: string, data: string) => void;
}

/** Workflow inputs are snake_case; the shared parser uses camelCase names. */
function input(name: string): string {
  return core.getInput(name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`));
}

/** The repository owner, used when no `username` input is given. */
function repoOwner(): string {
  try {
    return github.context.repo.owner;
  } catch {
    return '';
  }
}

/**
 * GitHub Action entrypoint: collect stats and/or contributions, render the
 * badge and write it to `output_path`. Committing the file is left to the
 * user's workflow (SPEC 9.2).
 */
export async function run(deps: RunDeps = {}): Promise<void> {
  const collectStatsFn = deps.collectStats ?? collectStats;
  const collectContributionsFn = deps.collectContributions ?? collectContributions;
  const writeFile = deps.writeFile ?? writeFileSync;

  try {
    const opts = parseBadgeOptions(input, 'action');
    const username = opts.username || repoOwner();
    if (!username) {
      throw new Error('No "username" input given and the repository owner could not be determined.');
    }

    const { mode, scope, theme, maxRepos } = opts;
    const outputPath = core.getInput('output_path') || 'reactor-core.svg';
    const token = process.env.GITHUB_TOKEN;

    core.info(`Building ${mode}-mode badge for ${username}…`);
    // Independent requests — fetch in parallel, as the server does.
    const [stats, contributions] = await Promise.all([
      mode === 'language' || mode === 'hybrid'
        ? collectStatsFn({ username, scope, token, maxRepos })
        : Promise.resolve(undefined),
      mode === 'commit' || mode === 'hybrid'
        ? collectContributionsFn({ username, token })
        : Promise.resolve(undefined),
    ]);

    const svg = render({ mode, username, theme, stats, contributions });
    writeFile(outputPath, svg);
    core.info(`Wrote ${outputPath} (${svg.length} bytes).`);
    core.setOutput('svg_path', outputPath);
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err));
  }
}
