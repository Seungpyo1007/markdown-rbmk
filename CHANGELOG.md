# Changelog

## v2.0.0 — 2026-09-30

Existing badges render exactly as before: without `style`, every URL still
produces the classic badge, byte for byte (pinned by golden snapshots).

### Added
- Eight named styles, selected with `style=`: `skala`, `blueprint`,
  `cherenkov`, `pyatachok`, `dosimeter`, `poster`, `gauge`, `minimal`.
- Style options: `view` (full · core · panel), `panel` (right · bottom),
  `cell` (square · round · circle · hex), `anim=off`, `accent`, `heat`,
  `stats`, and an extra `theme` preset per style.
- The website is now a style studio: gallery, live preview, every option,
  shareable links and copyable Markdown / HTML snippets.
- The Action accepts all the new options as inputs.

### Changed
- Styles use CSS animation that stops under `prefers-reduced-motion`.

## v1.1.0 — 2026-09-30

Existing badges render exactly as before — every legacy URL is pinned by
golden snapshot tests.

### Added
- Data options for the hosted badge and the Action: `days` (30–728), `langs`
  (1–8), `exclude`, `forks`, `archived`.
- The homepage is now a playground: pick options, preview live, copy Markdown.
- A floating `v1` tag, so `@v1` picks up future v1 fixes.

### Changed
- The Action runs on Node 24 (`using: node24`); CI runs on Node 24.
- Language requests are capped at 8 in flight to avoid GitHub rate limits.
- The Action now validates `theme` and `scope` and clamps `max_repos` (1–1000),
  and fetches stats and contributions in parallel.
- Hosted cache moved from the end-of-life `@vercel/kv` to `@upstash/redis`;
  cache keys are versioned.
- Dependencies upgraded to current majors and pinned exactly.

## v1.0.0

Initial release: `commit`, `language` and `hybrid` modes, dark and light
themes, hosted endpoint and GitHub Action.
