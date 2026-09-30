/**
 * URL builder for the badge style studio. Kept as a plain browser ES module
 * so the demo page and the tests share it. DEFAULTS mirror the server's option
 * parser (packages/core/src/options.ts): a parameter equal to its default is
 * left out, so built URLs stay short and match what users would hand-write.
 */

export const BADGE_HOST = 'https://markdown-rbmk.vercel.app';

export const DEFAULTS = Object.freeze({
  mode: 'commit',
  style: 'classic',
  theme: 'dark',
  // ---- v2 styles only (ignored by classic) ----
  view: 'full',
  panel: 'right',
  cell: 'default',
  anim: true,
  accent: '',
  heat: '',
  stats: '',
  // ---- data ----
  maxRepos: 100,
  days: 470,
  langs: 4,
  exclude: '',
  forks: false,
  archived: true,
});

/**
 * The style catalogue: `classic` (the v1 look) followed by the v2 styles in
 * STYLE_META order (packages/core/src/styles/meta.ts). A test keeps the v2
 * entries identical to STYLE_META.
 */
export const STYLES = Object.freeze([
  {
    name: 'classic',
    label: 'Classic',
    description: 'The original reactor core — green heat cells and an instrument panel.',
    presets: ['dark', 'light'],
  },
  {
    name: 'skala',
    label: 'SKALA console',
    description: 'Control-room channel map with a phosphor CRT readout.',
    presets: ['dark', 'light', 'green'],
  },
  {
    name: 'blueprint',
    label: 'Blueprint',
    description: 'Engineering drawing of the core with a title-block panel.',
    presets: ['dark', 'light', 'sepia'],
  },
  {
    name: 'cherenkov',
    label: 'Cherenkov',
    description: 'The blue glow of a reactor pool — luminous points, calm breathing.',
    presets: ['dark', 'light', 'abyss'],
  },
  {
    name: 'pyatachok',
    label: 'Pyatachok',
    description: 'The reactor lid from above — steel channel caps and a riveted plate.',
    presets: ['dark', 'light', 'oxide'],
  },
  {
    name: 'dosimeter',
    label: 'Dosimeter',
    description: 'A handheld counter with a reflective LCD and seven-segment digits.',
    presets: ['dark', 'light', 'green'],
  },
  {
    name: 'poster',
    label: 'Poster',
    description: 'Bold constructivist geometry — diagonals, flat colour, big numbers.',
    presets: ['dark', 'light', 'cobalt'],
  },
  {
    name: 'gauge',
    label: 'Gauge',
    description: 'Analog instrument panel — tick bezel, needle dial and meters.',
    presets: ['dark', 'light', 'cherenkov'],
  },
  {
    name: 'minimal',
    label: 'Minimal',
    description: 'Quiet and GitHub-native — hairlines, big numbers, slim bars.',
    presets: ['dark', 'light', 'cherenkov'],
  },
]);

export const MODES = Object.freeze(['commit', 'language', 'hybrid']);
export const VIEWS = Object.freeze(['full', 'core', 'panel']);
export const PANELS = Object.freeze(['right', 'bottom']);
export const CELL_SHAPES = Object.freeze(['default', 'square', 'round', 'circle', 'hex']);
export const STAT_KEYS = Object.freeze(['total', 'active', 'idle', 'peak', 'streak', 'longest', 'languages']);

/** GitHub usernames: 1-39 chars, alphanumeric or single hyphens. */
export const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Catalogue entry for a style name (unknown -> classic). */
export function styleInfo(name) {
  return STYLES.find((s) => s.name === name) ?? STYLES[0];
}

/** Normalise a style name like the server (trim, lower-case, whitelist). */
export function normaliseStyle(value) {
  const v = String(value ?? '').trim().toLowerCase();
  return STYLES.some((s) => s.name === v) ? v : DEFAULTS.style;
}

/** A theme/preset valid for `style`; anything else falls back to `dark`. */
export function normaliseTheme(style, value) {
  const v = String(value ?? '').trim().toLowerCase();
  return styleInfo(normaliseStyle(style)).presets.includes(v) ? v : DEFAULTS.theme;
}

/** `#rgb` / `rrggbb` / `#rrggbb` -> `#rrggbb`, or '' when invalid. */
export function normaliseHex(value) {
  const m = HEX_RE.exec(String(value ?? '').trim());
  if (!m) return '';
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return `#${h.toLowerCase()}`;
}

/** Five valid colours (array or comma string) -> `#a,#b,...`, else ''. */
export function normaliseHeat(value) {
  if (value == null || value === '') return '';
  const parts = (Array.isArray(value) ? value : String(value).split(',')).map(normaliseHex);
  return parts.length === 5 && parts.every(Boolean) ? parts.join(',') : '';
}

/** Known stat keys (array or comma string), lower-cased, deduped, in order. */
export function normaliseStats(value) {
  if (value == null || value === '') return '';
  const keys = (Array.isArray(value) ? value : String(value).split(','))
    .map((s) => String(s).trim().toLowerCase())
    .filter((s) => STAT_KEYS.includes(s));
  return [...new Set(keys)].join(',');
}

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

const pick = (value, allowed, fallback) => {
  const v = String(value ?? '').trim().toLowerCase();
  return allowed.includes(v) ? v : fallback;
};

/**
 * Build the query string for a set of studio options (username required).
 * Only non-default values are emitted, in a fixed order: username, mode,
 * style, theme, the v2 style params (never for classic, which ignores them),
 * then the data params. Commas are left readable.
 */
export function buildQuery(opts) {
  const params = new URLSearchParams();
  params.set('username', String(opts.username ?? '').trim());
  const mode = pick(opts.mode, MODES, DEFAULTS.mode);
  if (mode !== DEFAULTS.mode) params.set('mode', mode);
  const style = normaliseStyle(opts.style);
  if (style !== DEFAULTS.style) params.set('style', style);
  const theme = normaliseTheme(style, opts.theme);
  if (theme !== DEFAULTS.theme) params.set('theme', theme);

  if (style !== 'classic') {
    const view = pick(opts.view, VIEWS, DEFAULTS.view);
    if (view !== DEFAULTS.view) params.set('view', view);
    const panel = pick(opts.panel, PANELS, DEFAULTS.panel);
    if (panel !== DEFAULTS.panel) params.set('panel', panel);
    const cell = pick(opts.cell, CELL_SHAPES, DEFAULTS.cell);
    if (cell !== DEFAULTS.cell) params.set('cell', cell);
    if (opts.anim === false) params.set('anim', 'off');
    const accent = normaliseHex(opts.accent);
    if (accent) params.set('accent', accent.slice(1));
    const heat = normaliseHeat(opts.heat);
    if (heat) params.set('heat', heat.replaceAll('#', ''));
    const stats = normaliseStats(opts.stats);
    if (stats) params.set('stats', stats);
  }

  if (opts.maxRepos != null && Number(opts.maxRepos) !== DEFAULTS.maxRepos) {
    params.set('maxRepos', String(opts.maxRepos));
  }
  if (opts.days != null && Number(opts.days) !== DEFAULTS.days) params.set('days', String(opts.days));
  if (opts.langs != null && Number(opts.langs) !== DEFAULTS.langs) params.set('langs', String(opts.langs));
  const exclude = normaliseExclude(opts.exclude);
  if (exclude) params.set('exclude', exclude);
  if (opts.forks === true) params.set('forks', 'true');
  if (opts.archived === false) params.set('archived', 'false');
  // `,` is a legal query character; keep lists readable in READMEs.
  return params.toString().replaceAll('%2C', ',');
}

const clampInt = (value, min, max, fallback) => {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const bool = (value, fallback) => {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return fallback;
};

/**
 * Read studio options back from a query string (deep links). Inverse of
 * buildQuery for anything it emits; unknown values fall back to defaults.
 */
export function readQuery(search) {
  const p = new URLSearchParams(search);
  const get = (k) => p.get(k) ?? '';
  const style = normaliseStyle(get('style'));
  return {
    username: get('username').trim(),
    mode: pick(get('mode'), MODES, DEFAULTS.mode),
    style,
    theme: normaliseTheme(style, get('theme')),
    view: pick(get('view'), VIEWS, DEFAULTS.view),
    panel: pick(get('panel'), PANELS, DEFAULTS.panel),
    cell: pick(get('cell'), CELL_SHAPES, DEFAULTS.cell),
    anim: !['off', 'none', 'false', '0', 'static', 'no'].includes(get('anim').trim().toLowerCase()),
    accent: normaliseHex(get('accent')),
    heat: normaliseHeat(get('heat')),
    stats: normaliseStats(get('stats')),
    maxRepos: clampInt(get('maxRepos'), 1, 100, DEFAULTS.maxRepos),
    days: clampInt(get('days'), 30, 728, DEFAULTS.days),
    langs: clampInt(get('langs'), 1, 8, DEFAULTS.langs),
    exclude: normaliseExclude(get('exclude')),
    forks: bool(get('forks'), DEFAULTS.forks),
    archived: bool(get('archived'), DEFAULTS.archived),
  };
}

/** Absolute badge URL. */
export function buildBadgeUrl(opts, host = BADGE_HOST) {
  return `${host}/api/badge?${buildQuery(opts)}`;
}

/** Markdown image snippet for a README. */
export function buildMarkdown(opts, host = BADGE_HOST) {
  return `![markdown-RBMK reactor core](${buildBadgeUrl(opts, host)})`;
}

const escapeAttr = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** HTML `<img>` snippet (lets READMEs set a width). */
export function buildHtml(opts, host = BADGE_HOST, width = 680) {
  return `<img src="${escapeAttr(buildBadgeUrl(opts, host))}" width="${width}" alt="markdown-RBMK reactor core" />`;
}

/**
 * Core and panel as two separate images, side by side — handy for README
 * layouts that want the reactor and its readout in different places.
 */
export function buildSplitHtml(opts, host = BADGE_HOST, height = 240) {
  const img = (view, alt) =>
    `  <img src="${escapeAttr(buildBadgeUrl({ ...opts, view }, host))}" height="${height}" alt="${alt}" />`;
  return [
    '<p align="center">',
    img('core', 'markdown-RBMK reactor core'),
    img('panel', 'markdown-RBMK instrument panel'),
    '</p>',
  ].join('\n');
}
