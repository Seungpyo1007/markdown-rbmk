/**
 * DOM wiring for the style studio (index.html). All URL logic lives in the
 * tested, pure playground.js; this file only keeps the page in sync with a
 * single `state` object.
 */
import {
  BADGE_HOST,
  DEFAULTS,
  STAT_KEYS,
  STYLES,
  USERNAME_RE,
  buildBadgeUrl,
  buildHtml,
  buildMarkdown,
  buildQuery,
  buildSplitHtml,
  readQuery,
  styleInfo,
} from './playground.js';

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const form = $('controls');
const DEFAULT_USER = 'Seungpyo1007';
// Preview through this deployment; copied snippets always point at production.
const PREVIEW_HOST = location.protocol.startsWith('http') ? location.origin : BADGE_HOST;

/** Style default readouts per mode (packages/core/src/styles/shared.ts). */
const DEFAULT_STATS = {
  commit: ['total', 'active', 'peak', 'streak', 'longest'],
  language: ['languages', 'total'],
  hybrid: ['total', 'active', 'streak', 'languages'],
};
const STAT_LABELS = {
  total: 'Total contributions',
  active: 'Active days',
  idle: 'Idle days',
  peak: 'Peak day',
  streak: 'Current streak',
  longest: 'Longest streak',
  languages: 'Languages',
};
/** A readout only renders when the mode has data for it. */
const statAvailable = (key, mode) => (key === 'languages' ? mode !== 'commit' : mode !== 'language');

// ---------------------------------------------------------------- state ----

const pageTheme = () => root.dataset.theme;

function initialState() {
  return {
    ...DEFAULTS,
    username: DEFAULT_USER,
    theme: pageTheme(),
    statsCustom: false,
    statsOn: new Set(),
    statsOrder: [...STAT_KEYS],
    backdrop: pageTheme(),
  };
}
let state = initialState();

/** Load a deep link (`?style=gauge&theme=cherenkov...`) into the state. */
function loadQuery(search) {
  const params = new URLSearchParams(search);
  if (![...params.keys()].length) return;
  const q = readQuery(search);
  state = { ...state, ...q, username: q.username || DEFAULT_USER };
  if (!params.has('theme')) state.theme = pageTheme();
  const stats = q.stats ? q.stats.split(',') : [];
  state.statsCustom = stats.length > 0;
  state.statsOn = new Set(stats);
  state.statsOrder = [...stats, ...STAT_KEYS.filter((k) => !stats.includes(k))];
  state.backdrop = state.theme === 'light' ? 'light' : 'dark';
}

/** The options actually sent: fields the mode/style ignores stay default. */
function effective(s = state) {
  const o = {
    username: s.username,
    mode: s.mode,
    style: s.style,
    theme: s.theme,
    days: s.days,
    langs: s.langs,
    exclude: s.exclude,
    maxRepos: s.maxRepos,
    forks: s.forks,
    archived: s.archived,
  };
  if (s.mode === 'language') o.days = DEFAULTS.days;
  if (s.mode === 'commit') {
    Object.assign(o, {
      langs: DEFAULTS.langs,
      exclude: DEFAULTS.exclude,
      maxRepos: DEFAULTS.maxRepos,
      forks: DEFAULTS.forks,
      archived: DEFAULTS.archived,
    });
  }
  if (s.style !== 'classic') {
    o.view = s.view;
    o.panel = s.view === 'core' ? DEFAULTS.panel : s.panel;
    o.cell = s.cell;
    o.anim = s.anim;
    o.accent = s.accent;
    o.heat = s.mode === 'language' ? '' : s.heat;
    o.stats =
      s.statsCustom && s.mode !== 'language'
        ? s.statsOrder.filter((k) => s.statsOn.has(k) && statAvailable(k, s.mode)).join(',')
        : '';
  }
  return o;
}

// -------------------------------------------------------------- gallery ----

const gallery = $('gallery');
for (const s of STYLES) {
  const card = document.createElement('label');
  card.className = 'card';
  card.innerHTML = `
    <input type="radio" name="gallery" value="${s.name}" aria-describedby="card-desc-${s.name}" />
    <span class="card-body">
      <span class="thumb"><img src="gallery/${s.name}.svg" alt="" width="900" height="600" loading="lazy" decoding="async" /></span>
      <span class="card-text">
        <span class="card-name"><strong></strong><code>${s.name}</code></span>
        <span class="card-desc" id="card-desc-${s.name}"></span>
      </span>
    </span>
    <span class="card-state" aria-hidden="true">selected</span>`;
  card.querySelector('strong').textContent = s.label;
  card.querySelector('.card-desc').textContent = s.description;
  gallery.append(card);
}
gallery.addEventListener('change', (e) => {
  if (e.target.name !== 'gallery') return;
  setStyle(e.target.value);
  syncForm();
  const info = styleInfo(state.style);
  $('gallery-note').innerHTML = '';
  $('gallery-note').append(`${info.label} selected — `);
  const a = document.createElement('a');
  a.href = '#studio';
  a.textContent = 'tune it in the studio ↓';
  $('gallery-note').append(a);
  update();
});

// ------------------------------------------------------------- controls ----

const styleSelect = $('style');
for (const s of STYLES) styleSelect.add(new Option(`${s.label} (${s.name})`, s.name));

function setStyle(name) {
  state.style = styleInfo(name).name;
  const presets = styleInfo(state.style).presets;
  if (!presets.includes(state.theme)) state.theme = pageTheme();
}

function buildThemeSeg() {
  const seg = $('theme-seg');
  const presets = styleInfo(state.style).presets;
  if (seg.dataset.presets === presets.join()) return;
  seg.dataset.presets = presets.join();
  seg.replaceChildren(
    ...presets.map((p) => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="radio" name="theme" value="${p}" /><span>${p}</span>`;
      return label;
    }),
  );
}

const heatInputs = [...form.querySelectorAll('[data-heat]')];

/** Write the whole state into the controls. */
function syncForm() {
  $('username').value = state.username;
  form.elements.mode.value = state.mode;
  styleSelect.value = state.style;
  buildThemeSeg();
  form.elements.theme.value = state.theme;
  form.elements.view.value = state.view;
  form.elements.panel.value = state.panel;
  $('cell').value = state.cell;
  $('anim').checked = state.anim;
  if (state.accent) $('accent').value = state.accent;
  if (state.heat) state.heat.split(',').forEach((c, i) => (heatInputs[i].value = c));
  $('stats-custom').checked = state.statsCustom;
  $('days').value = state.days;
  $('langs').value = state.langs;
  $('exclude').value = state.exclude;
  $('maxRepos').value = state.maxRepos;
  $('forks').checked = state.forks;
  $('archived').checked = state.archived;
  document.querySelector(`input[name="backdrop"][value="${state.backdrop}"]`).checked = true;
  const card = gallery.querySelector(`input[value="${state.style}"]`);
  if (card) card.checked = true;
}

/** Read the plain form fields into the state. */
function readForm() {
  state.username = $('username').value.trim();
  state.mode = form.elements.mode.value;
  state.theme = form.elements.theme.value || state.theme;
  state.view = form.elements.view.value;
  state.panel = form.elements.panel.value;
  state.cell = $('cell').value;
  state.anim = $('anim').checked;
  state.days = Number($('days').value);
  state.langs = Number($('langs').value);
  state.exclude = $('exclude').value;
  const repos = Number.parseInt($('maxRepos').value, 10);
  state.maxRepos = Number.isFinite(repos) ? Math.min(100, Math.max(1, repos)) : DEFAULTS.maxRepos;
  state.forks = $('forks').checked;
  state.archived = $('archived').checked;
}

function onControl(e) {
  const t = e.target;
  if (t.dataset.heat != null) {
    state.heat = heatInputs.map((i) => i.value).join(',');
  } else if (t.id === 'accent') {
    state.accent = t.value;
  } else if (t.id === 'style') {
    setStyle(t.value);
    syncForm();
  } else if (t.id === 'stats-custom') {
    state.statsCustom = t.checked;
    if (t.checked && state.statsOn.size === 0) seedStats();
  } else if (t.dataset.stat) {
    if (t.checked) state.statsOn.add(t.dataset.stat);
    else state.statsOn.delete(t.dataset.stat);
  } else if (t.name === 'theme') {
    readForm();
    state.backdrop = state.theme === 'light' ? 'light' : state.theme === 'dark' ? 'dark' : state.backdrop;
    document.querySelector(`input[name="backdrop"][value="${state.backdrop}"]`).checked = true;
  } else {
    readForm();
  }
  update();
}
form.addEventListener('input', onControl);
form.addEventListener('change', (e) => {
  // Colour and range inputs already reported on `input`.
  if (e.target.type === 'color' || e.target.type === 'range' || e.target.type === 'text') return;
  onControl(e);
});
form.addEventListener('submit', (e) => e.preventDefault());

$('accent-clear').addEventListener('click', () => {
  state.accent = '';
  update();
});
$('heat-clear').addEventListener('click', () => {
  state.heat = '';
  update();
});

// ---- readouts: checklist + ordering ----

function seedStats() {
  const def = DEFAULT_STATS[state.mode];
  state.statsOn = new Set(def);
  state.statsOrder = [...def, ...STAT_KEYS.filter((k) => !def.includes(k))];
}

function renderStats() {
  const list = $('stats-list');
  const custom = state.statsCustom;
  const def = DEFAULT_STATS[state.mode];
  const order = custom ? state.statsOrder : [...def, ...STAT_KEYS.filter((k) => !def.includes(k))];
  const visible = order.filter((k) => statAvailable(k, state.mode));
  const on = custom ? state.statsOn : new Set(def);
  // The list is rebuilt on every change: remember what had keyboard focus.
  const active = list.contains(document.activeElement) ? document.activeElement : null;
  const focusSel = active?.dataset.stat
    ? `input[data-stat="${active.dataset.stat}"]`
    : active?.dataset.move
      ? `button[data-key="${active.dataset.key}"][data-move="${active.dataset.move}"]`
      : null;
  list.classList.toggle('off', !custom);
  list.replaceChildren(
    ...visible.map((key, i) => {
      const li = document.createElement('li');
      const name = STAT_LABELS[key];
      li.innerHTML = `
        <span class="pos" aria-hidden="true">${i + 1}</span>
        <label class="check"><input type="checkbox" data-stat="${key}" /> <span></span></label>
        <button type="button" class="small" data-move="-1" data-key="${key}" aria-label="Move ${name} up">↑</button>
        <button type="button" class="small" data-move="1" data-key="${key}" aria-label="Move ${name} down">↓</button>`;
      li.querySelector('.check span').textContent = name;
      const box = li.querySelector('input');
      box.checked = on.has(key);
      box.disabled = !custom;
      const [up, down] = li.querySelectorAll('button');
      up.disabled = !custom || i === 0;
      down.disabled = !custom || i === visible.length - 1;
      return li;
    }),
  );
  if (focusSel) list.querySelector(focusSel)?.focus();
  $('stats-hint').textContent = custom
    ? 'Checked readouts, top to bottom. None checked = style default.'
    : "Off: the style's default readouts for this mode.";
}

$('stats-list').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-move]');
  if (!btn || btn.disabled) return;
  const key = btn.dataset.key;
  const dir = Number(btn.dataset.move);
  const visible = state.statsOrder.filter((k) => statAvailable(k, state.mode));
  const i = visible.indexOf(key);
  const j = i + dir;
  if (j < 0 || j >= visible.length) return;
  // Swap with the neighbour among the visible rows.
  const a = state.statsOrder.indexOf(key);
  const b = state.statsOrder.indexOf(visible[j]);
  [state.statsOrder[a], state.statsOrder[b]] = [state.statsOrder[b], state.statsOrder[a]];
  update();
  // Keep keyboard focus on the moved row.
  const list = $('stats-list');
  const same = list.querySelector(`button[data-key="${key}"][data-move="${dir}"]`);
  const other = list.querySelector(`button[data-key="${key}"][data-move="${-dir}"]`);
  (same && !same.disabled ? same : other)?.focus();
  $('stats-live').textContent = `${STAT_LABELS[key]} moved to position ${j + 1} of ${visible.length}.`;
});

// ------------------------------------------------------ preview + output ----

const img = $('preview');
const stage = $('stage');
const status = $('status');
let timer;
let lastSrc = '';

function syncVisibility() {
  const v2 = state.style !== 'classic';
  for (const el of form.querySelectorAll('[data-v2]')) el.hidden = !v2;
  for (const el of form.querySelectorAll('[data-for]')) {
    el.hidden = !(state.mode === 'hybrid' || el.dataset.for === state.mode);
  }
  $('panel-field').hidden = state.view === 'core';
  $('heat-field').hidden = state.mode === 'language';
  $('stats-group').hidden = !v2 || state.mode === 'language';
  $('classic-note').hidden = v2;
  $('theme-legend').textContent = v2 ? 'Theme · preset' : 'Theme';
  $('style-desc').textContent = styleInfo(state.style).description;
  $('output-tag').textContent = `${state.style} · ${state.mode}`;
  $('tab-split').hidden = !(v2 && state.view !== 'full');
  if ($('tab-split').hidden && activeTab === 'split') selectTab('md', false);

  $('accent-row').classList.toggle('unset', !state.accent);
  $('accent-value').textContent = state.accent || 'style default';
  $('accent-clear').disabled = !state.accent;
  $('heat-row').classList.toggle('unset', !state.heat);
  $('heat-value').textContent = state.heat ? 'custom scale' : 'style default';
  $('heat-clear').disabled = !state.heat;
  $('days-out').value = state.days;
  $('langs-out').value = state.langs;
  stage.dataset.backdrop = state.backdrop;
}

let activeTab = 'md';
const SNIPPET_HINTS = {
  md: 'Paste into your profile README.',
  html: 'An <img> tag lets you set the width.',
  url: 'The raw image URL.',
  split: 'Two images: the core and its panel, side by side.',
};
function snippetText(opts) {
  if (activeTab === 'html') return buildHtml(opts);
  if (activeTab === 'url') return buildBadgeUrl(opts);
  if (activeTab === 'split') return buildSplitHtml(opts);
  return buildMarkdown(opts);
}

function selectTab(kind, focus = true) {
  activeTab = kind;
  for (const tab of document.querySelectorAll('[role="tab"]')) {
    const on = tab.dataset.kind === kind;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
    if (on) {
      $('snippet-panel').setAttribute('aria-labelledby', tab.id);
      if (focus) tab.focus();
    }
  }
  $('snippet-hint').textContent = SNIPPET_HINTS[kind];
  $('snippet').textContent = snippetText(effective());
}
const tablist = document.querySelector('[role="tablist"]');
tablist.addEventListener('click', (e) => {
  const tab = e.target.closest('[role="tab"]');
  if (tab) selectTab(tab.dataset.kind);
});
tablist.addEventListener('keydown', (e) => {
  const tabs = [...tablist.querySelectorAll('[role="tab"]:not([hidden])')];
  const i = tabs.findIndex((t) => t.dataset.kind === activeTab);
  let j = null;
  if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
  else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
  else if (e.key === 'Home') j = 0;
  else if (e.key === 'End') j = tabs.length - 1;
  if (j === null) return;
  e.preventDefault();
  selectTab(tabs[j].dataset.kind);
});

function update({ immediate = false } = {}) {
  syncVisibility();
  renderStats();
  const opts = effective();
  const valid = USERNAME_RE.test(opts.username);
  $('username').setAttribute('aria-invalid', String(!valid));
  $('username-error').textContent = valid ? '' : 'Enter a valid GitHub username.';
  $('snippet').textContent = snippetText(opts);
  if (!valid) return;

  // Shareable address bar: the studio state as a query string.
  const query = buildQuery(opts);
  const search = query === `username=${DEFAULT_USER}` ? '' : `?${query}`;
  history.replaceState(null, '', `${location.pathname}${search}${location.hash}`);

  // Debounce: every preview is a live render against the GitHub API.
  clearTimeout(timer);
  const render = () => {
    const src = buildBadgeUrl(opts, PREVIEW_HOST);
    if (src === lastSrc) return;
    lastSrc = src;
    stage.classList.add('loading');
    stage.classList.remove('failed');
    status.textContent = 'rendering…';
    img.alt = `markdown-RBMK badge for @${opts.username}: ${styleInfo(opts.style).label} style, ${opts.mode} mode`;
    img.src = src;
  };
  if (immediate) render();
  else timer = setTimeout(render, 600);
}

img.addEventListener('load', () => {
  stage.classList.remove('loading');
  status.textContent = 'online';
});
img.addEventListener('error', () => {
  stage.classList.remove('loading');
  stage.classList.add('failed');
  status.textContent = 'offline';
});

document.querySelector('.stage-tools').addEventListener('change', (e) => {
  if (e.target.name !== 'backdrop') return;
  state.backdrop = e.target.value;
  syncVisibility();
});

async function copyText(text, btn, label) {
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'Copied ✓';
  } catch {
    const range = document.createRange();
    range.selectNodeContents($('snippet'));
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    btn.textContent = 'Press Ctrl+C';
  }
  setTimeout(() => (btn.textContent = label), 1800);
}
$('copy').addEventListener('click', () => copyText($('snippet').textContent, $('copy'), 'Copy'));
$('share').addEventListener('click', () => copyText(location.href, $('share'), 'Copy share link'));

$('reset').addEventListener('click', () => {
  const { username, backdrop } = state;
  state = { ...initialState(), username: username || DEFAULT_USER, backdrop };
  syncForm();
  update();
});

// ------------------------------------------------------------ page theme ----

const heroImg = $('hero-badge');
function renderHero() {
  const theme = pageTheme();
  heroImg.src = buildBadgeUrl({ username: DEFAULT_USER, mode: 'hybrid', style: 'skala', theme }, PREVIEW_HOST);
}

function applyPageTheme(theme, { save = false } = {}) {
  const before = pageTheme();
  root.dataset.theme = theme;
  if (save) {
    try {
      localStorage.setItem('rbmk-page-theme', theme);
    } catch {
      /* private mode: the choice just isn't remembered */
    }
  }
  const btn = $('page-theme');
  btn.textContent = theme === 'dark' ? '☀ Light page' : '☾ Dark page';
  btn.setAttribute('aria-pressed', String(theme === 'light'));
  renderHero();
  // A plain dark/light badge follows the page; a named preset is left alone.
  if (before !== theme && (state.theme === 'dark' || state.theme === 'light')) {
    state.theme = theme;
    state.backdrop = theme;
    syncForm();
    update();
  }
}
$('page-theme').addEventListener('click', () =>
  applyPageTheme(pageTheme() === 'dark' ? 'light' : 'dark', { save: true }),
);
matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
  let saved = null;
  try {
    saved = localStorage.getItem('rbmk-page-theme');
  } catch {
    /* ignore */
  }
  if (!saved) applyPageTheme(e.matches ? 'light' : 'dark');
});

// ------------------------------------------------------------------ boot ----

loadQuery(location.search);
applyPageTheme(pageTheme());
syncForm();
update({ immediate: true });
