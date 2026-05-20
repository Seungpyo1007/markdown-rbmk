import { writeFileSync } from 'node:fs';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { collectContributions, collectStats, render } from '@markdown-rbmk/core';
import type { RenderMode, Scope, Theme } from '@markdown-rbmk/core';

/** Injectable dependencies — lets `run` be tested without network or disk. */
export interface RunDeps {
  collectStats?: typeof collectStats;
  collectContributions?: typeof collectContributions;
  writeFile?: (path: string, data: string) => void;
}

/** Use the `username` input, falling back to the repository owner. */
function resolveUsername(): string {
  const input = core.getInput('username').trim();
  if (input) return input;
  try {
    return github.context.repo.owner;
  } catch {
    return '';
  }
}

function parseMode(value: string): RenderMode {
  return value === 'language' || value === 'hybrid' ? value : 'commit';
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
    const username = resolveUsername();
    if (!username) {
      throw new Error('No "username" input given and the repository owner could not be determined.');
    }

    const mode = parseMode(core.getInput('mode'));
    const scope = (core.getInput('scope') || 'public') as Scope;
    const theme = (core.getInput('theme') || 'dark') as Theme;
    const outputPath = core.getInput('output_path') || 'reactor-core.svg';
    const parsedMax = Number.parseInt(core.getInput('max_repos') || '100', 10);
    const maxRepos = Number.isFinite(parsedMax) ? parsedMax : 100;
    const token = process.env.GITHUB_TOKEN;

    core.info(`Building ${mode}-mode badge for ${username}…`);
    const stats =
      mode === 'language' || mode === 'hybrid'
        ? await collectStatsFn({ username, scope, token, maxRepos })
        : undefined;
    const contributions =
      mode === 'commit' || mode === 'hybrid'
        ? await collectContributionsFn({ username, token })
        : undefined;

    const svg = render({ mode, username, theme, stats, contributions });
    writeFile(outputPath, svg);
    core.info(`Wrote ${outputPath} (${svg.length} bytes).`);
    core.setOutput('svg_path', outputPath);
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err));
  }
}
