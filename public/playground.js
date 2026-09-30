/**
 * URL builder for the badge playground. Kept as a plain browser ES module so
 * the demo page and the tests share it. DEFAULTS mirror the server's option
 * parser (packages/core/src/options.ts): a parameter equal to its default is
 * left out, so built URLs stay short and match what users would hand-write.
 */

export const BADGE_HOST = 'https://markdown-rbmk.vercel.app';

export const DEFAULTS = Object.freeze({
  mode: 'commit',
  theme: 'dark',
  maxRepos: 100,
  days: 470,
  langs: 4,
  exclude: '',
  forks: false,
  archived: true,
});

/** GitHub usernames: 1-39 chars, alphanumeric or single hyphens. */
export const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

/** Normalise a comma-separated language list the same way the server does. */
export function normaliseExclude(value) {
  const names = String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 40);
  const seen = new Set();
  const out = [];
  for (const n of names) {
    const key = n.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(n);
    }
  }
  return out.slice(0, 20).join(',');
}

/**
 * Build the query string for a set of playground options (username
 * required). Only non-default values are emitted, in a fixed order.
 */
export function buildQuery(opts) {
  const params = new URLSearchParams();
  params.set('username', String(opts.username ?? '').trim());
  if (opts.mode && opts.mode !== DEFAULTS.mode) params.set('mode', opts.mode);
  if (opts.theme && opts.theme !== DEFAULTS.theme) params.set('theme', opts.theme);
  if (opts.maxRepos != null && Number(opts.maxRepos) !== DEFAULTS.maxRepos) {
    params.set('maxRepos', String(opts.maxRepos));
  }
  if (opts.days != null && Number(opts.days) !== DEFAULTS.days) params.set('days', String(opts.days));
  if (opts.langs != null && Number(opts.langs) !== DEFAULTS.langs) params.set('langs', String(opts.langs));
  const exclude = normaliseExclude(opts.exclude);
  if (exclude) params.set('exclude', exclude);
  if (opts.forks === true) params.set('forks', 'true');
  if (opts.archived === false) params.set('archived', 'false');
  return params.toString();
}

/** Absolute badge URL. */
export function buildBadgeUrl(opts, host = BADGE_HOST) {
  return `${host}/api/badge?${buildQuery(opts)}`;
}

/** Markdown image snippet for a README. */
export function buildMarkdown(opts, host = BADGE_HOST) {
  return `![markdown-RBMK reactor core](${buildBadgeUrl(opts, host)})`;
}
