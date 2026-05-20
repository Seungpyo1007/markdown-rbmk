import { Octokit } from '@octokit/rest';
import { graphql } from '@octokit/graphql';
import { resolveColor } from './colors';
import { mapGitHubError, StatsError } from './errors';
import type { LanguageStat, StatsInput, StatsResult } from './types';

/** One repository's language byte counts, normalised across REST and GraphQL. */
export interface RepoInfo {
  name: string;
  isFork: boolean;
  isArchived: boolean;
  languages: Record<string, number>;
}

/** StatsInput with all defaults applied. */
export interface ResolvedStatsInput {
  username: string;
  scope: 'public' | 'all';
  token?: string;
  maxRepos: number;
  excludeForks: boolean;
  excludeArchived: boolean;
}

/** Fetches repositories for a resolved input — injectable for testing. */
export type RepoFetcher = (input: ResolvedStatsInput) => Promise<RepoInfo[]>;

function resolveInput(input: StatsInput): ResolvedStatsInput {
  return {
    username: input.username,
    scope: input.scope,
    token: input.token,
    maxRepos: input.maxRepos ?? 100,
    excludeForks: input.excludeForks ?? true,
    excludeArchived: input.excludeArchived ?? false,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Turn a {language: bytes} map into ranked LanguageStat[]: the top 4 languages
 * plus an "Other" bucket for the remainder (SPEC 4.3). Empty map -> [].
 */
export function aggregateLanguages(byteMap: Record<string, number>): LanguageStat[] {
  const total = Object.values(byteMap).reduce((a, b) => a + b, 0);
  if (total === 0) return [];

  const sorted = Object.entries(byteMap).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 4);
  const rest = sorted.slice(4);

  const langs: LanguageStat[] = top.map(([name, bytes], i) => ({
    name,
    bytes,
    pct: round1((bytes / total) * 100),
    color: resolveColor(name, i),
  }));

  if (rest.length > 0) {
    const otherBytes = rest.reduce((sum, [, bytes]) => sum + bytes, 0);
    langs.push({
      name: 'Other',
      bytes: otherBytes,
      pct: round1((otherBytes / total) * 100),
      color: resolveColor('Other', 4),
    });
  }

  return langs;
}

/** Filter repos, sum language bytes and assemble the final StatsResult. */
function summarise(input: ResolvedStatsInput, repos: RepoInfo[]): StatsResult {
  const kept = repos.filter(
    (r) => !(input.excludeForks && r.isFork) && !(input.excludeArchived && r.isArchived),
  );

  const byteMap: Record<string, number> = {};
  for (const repo of kept) {
    for (const [lang, bytes] of Object.entries(repo.languages)) {
      byteMap[lang] = (byteMap[lang] ?? 0) + bytes;
    }
  }

  const totalBytes = Object.values(byteMap).reduce((a, b) => a + b, 0);
  if (totalBytes === 0) {
    throw new StatsError('no_data', `No language data found for "${input.username}".`);
  }

  return {
    username: input.username,
    scope: input.scope,
    totalBytes,
    langs: aggregateLanguages(byteMap),
    reposScanned: kept.length,
    generatedAt: new Date().toISOString(),
  };
}

/** REST path (SPEC 4.1, scope=public): list public repos + per-repo languages. */
async function fetchPublicRepos(input: ResolvedStatsInput): Promise<RepoInfo[]> {
  const octokit = new Octokit(input.token ? { auth: input.token } : {});
  const perPage = 100;
  const listed: Array<{ name: string; isFork: boolean; isArchived: boolean }> = [];

  try {
    for (let page = 1; listed.length < input.maxRepos; page++) {
      const { data } = await octokit.rest.repos.listForUser({
        username: input.username,
        per_page: perPage,
        page,
        type: 'owner',
        sort: 'pushed',
      });
      if (data.length === 0) break;

      for (const repo of data) {
        if (listed.length >= input.maxRepos) break;
        listed.push({
          name: repo.name,
          isFork: Boolean(repo.fork),
          isArchived: Boolean(repo.archived),
        });
      }
      if (data.length < perPage) break;
    }

    // Fetch per-repo languages concurrently — sequential calls are far too
    // slow for a badge endpoint (dozens of repos = several seconds).
    return await Promise.all(
      listed.map(async (repo) => {
        const { data: languages } = await octokit.rest.repos.listLanguages({
          owner: input.username,
          repo: repo.name,
        });
        return { ...repo, languages };
      }),
    );
  } catch (err) {
    throw mapGitHubError(err);
  }
}

const ALL_REPOS_QUERY = `
query($cursor: String) {
  viewer {
    repositories(
      first: 100
      after: $cursor
      ownerAffiliations: OWNER
      orderBy: { field: PUSHED_AT, direction: DESC }
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        name
        isFork
        isArchived
        languages(first: 30, orderBy: { field: SIZE, direction: DESC }) {
          edges {
            size
            node { name }
          }
        }
      }
    }
  }
}`;

interface AllReposResponse {
  viewer: {
    repositories: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: Array<{
        name: string;
        isFork: boolean;
        isArchived: boolean;
        languages: { edges: Array<{ size: number; node: { name: string } }> };
      }>;
    };
  };
}

/** GraphQL path (SPEC 4.1, scope=all): viewer repos incl. private + languages. */
async function fetchAllRepos(input: ResolvedStatsInput): Promise<RepoInfo[]> {
  const gql = graphql.defaults({
    headers: { authorization: `token ${input.token}` },
  });
  const repos: RepoInfo[] = [];
  let cursor: string | null = null;

  try {
    while (repos.length < input.maxRepos) {
      const res: AllReposResponse = await gql<AllReposResponse>(ALL_REPOS_QUERY, { cursor });
      const conn = res.viewer.repositories;

      for (const node of conn.nodes) {
        if (repos.length >= input.maxRepos) break;
        const languages: Record<string, number> = {};
        for (const edge of node.languages.edges) {
          languages[edge.node.name] = edge.size;
        }
        repos.push({
          name: node.name,
          isFork: node.isFork,
          isArchived: node.isArchived,
          languages,
        });
      }

      if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
      cursor = conn.pageInfo.endCursor;
    }
  } catch (err) {
    throw mapGitHubError(err);
  }

  return repos;
}

const defaultFetcher: RepoFetcher = (input) =>
  input.scope === 'all' ? fetchAllRepos(input) : fetchPublicRepos(input);

/**
 * Collect a user's language statistics. Throws StatsError on failure — the
 * caller (server/action) is expected to render a fallback badge instead.
 *
 * `fetcher` is injectable so the pipeline can be tested without the network.
 */
export async function collectStats(
  input: StatsInput,
  fetcher: RepoFetcher = defaultFetcher,
): Promise<StatsResult> {
  const resolved = resolveInput(input);

  if (resolved.scope === 'all' && !resolved.token) {
    throw new StatsError('auth_failed', 'scope "all" requires a GitHub token.');
  }

  const repos = await fetcher(resolved);
  return summarise(resolved, repos);
}
