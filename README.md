# ☢️ markdown-RBMK

<p align="center">
  <a href="https://github.com/Seungpyo1007/markdown-rbmk/actions/workflows/ci.yml"><img src="https://github.com/Seungpyo1007/markdown-rbmk/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2ecc71" alt="MIT License"></a>
  <a href="https://markdown-rbmk.vercel.app"><img src="https://img.shields.io/badge/playground-live-2ecc71" alt="Live playground"></a>
  <img src="https://img.shields.io/badge/node-24-2ecc71" alt="Node 24">
</p>

**Your GitHub activity, rendered as an RBMK reactor core.** A self-contained,
animated SVG badge for your profile README — no JavaScript runtime, no canvas,
no GIF encoding. Just one `<img>` tag.

<p align="center">
  <a href="https://markdown-rbmk.vercel.app"><img src="https://markdown-rbmk.vercel.app/api/badge?username=Seungpyo1007&amp;v=1" width="680" alt="markdown-RBMK reactor core badge"></a>
</p>

Every cell is a fuel channel. The center runs hottest. A faint flux animation
keeps the core alive — and because it is pure SVG + SMIL, it animates straight
inside a GitHub README.

> 🎛️ **[Open the playground →](https://markdown-rbmk.vercel.app)** — pick a mode,
> theme and data options, watch the badge re-render live, and copy the Markdown.

---

## Modes

Pick what your reactor runs on with the `mode` parameter.

### ☢️ `commit` — contribution heatmap _(default)_

Each cell is a day; colour is commit intensity (idle → hot), the number is that
day's commit count. The instrument panel reports totals, active/idle days and
your peak day.

<a href="https://markdown-rbmk.vercel.app"><img src="https://markdown-rbmk.vercel.app/api/badge?username=Seungpyo1007&amp;v=1&amp;mode=commit" width="520" alt="commit mode"></a>

### 🧪 `language` — language rings

Concentric rings sized by language share — your most-used language fills the
core. The panel lists the fuel channels with exact percentages.

<a href="https://markdown-rbmk.vercel.app"><img src="https://markdown-rbmk.vercel.app/api/badge?username=Seungpyo1007&amp;v=1&amp;mode=language" width="520" alt="language mode"></a>

### ⚛️ `hybrid` — commit core + language rim

A commit heatmap core wrapped in an outer ring of your top languages, with both
readouts on one panel.

<a href="https://markdown-rbmk.vercel.app"><img src="https://markdown-rbmk.vercel.app/api/badge?username=Seungpyo1007&amp;v=1&amp;mode=hybrid" width="520" alt="hybrid mode"></a>

### 🌗 Light theme

Any mode also takes `&theme=light` for a light background:

<a href="https://markdown-rbmk.vercel.app"><img src="https://markdown-rbmk.vercel.app/api/badge?username=Seungpyo1007&amp;v=1&amp;mode=language&amp;theme=light" width="520" alt="light theme"></a>

---

## Quick start

### Hosted badge — public repositories

Drop this into your README and swap in your username:

```md
![reactor](https://markdown-rbmk.vercel.app/api/badge?username=YOUR_NAME)
```

Then tweak it straight from the URL — or build the URL in the
[playground](https://markdown-rbmk.vercel.app).

| Param      | Values                           | Default  | Applies to         |
| ---------- | -------------------------------- | -------- | ------------------ |
| `username` | any GitHub username              | required | all                |
| `mode`     | `commit` · `language` · `hybrid` | `commit` | all                |
| `theme`    | `dark` · `light`                 | `dark`   | all                |
| `days`     | `30`–`728` recent days           | `470`    | commit · hybrid    |
| `langs`    | `1`–`8` languages before “Other” | `4`      | language · hybrid  |
| `exclude`  | comma-separated languages        | none     | language · hybrid  |
| `forks`    | `true` · `false`                 | `false`  | language · hybrid  |
| `archived` | `true` · `false`                 | `true`   | language · hybrid  |
| `maxRepos` | `1`–`100` repositories scanned   | `100`    | language · hybrid  |

Invalid values quietly fall back to their default, so a typo never breaks the
image. Examples:

```md
<!-- last 90 days only -->
![reactor](https://markdown-rbmk.vercel.app/api/badge?username=octocat&days=90)

<!-- top 6 languages, without markup and notebooks -->
![reactor](https://markdown-rbmk.vercel.app/api/badge?username=octocat&mode=language&langs=6&exclude=HTML,Jupyter%20Notebook)

<!-- hybrid, light, counting forks too -->
![reactor](https://markdown-rbmk.vercel.app/api/badge?username=octocat&mode=hybrid&theme=light&forks=true)
```

> The hosted endpoint only ever reads **public** data. For private repositories,
> use the GitHub Action below. Badges are cached for up to a day.

### GitHub Action — public + private, commits the SVG

The Action runs in your own workflow, so it can read private repositories and
commit the rendered SVG into your repo:

```yaml
name: Reactor core
on:
  schedule: [{ cron: '0 0 * * *' }] # refresh daily
  workflow_dispatch:
jobs:
  reactor:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v7
      - uses: Seungpyo1007/markdown-rbmk/packages/action@v1.0.0
        with:
          username: ${{ github.repository_owner }}
          mode: commit
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - run: |
          git config user.name  github-actions
          git config user.email github-actions@github.com
          git add reactor-core.svg
          git diff --cached --quiet || git commit -m "chore: update reactor core"
          git push
```

Then embed the committed file:

```md
![reactor](reactor-core.svg)
```

For private repositories, pass a Personal Access Token (`repo` + `read:user`)
and set `scope: all`:

```yaml
        with:
          username: ${{ github.repository_owner }}
          mode: hybrid
          scope: all
        env:
          GITHUB_TOKEN: ${{ secrets.MY_PAT }}
```

| Input         | Values                           | Default            |
| ------------- | -------------------------------- | ------------------ |
| `username`    | GitHub username                  | repository owner   |
| `mode`        | `commit` · `language` · `hybrid` | `commit`           |
| `scope`       | `public` · `all` (needs a PAT)   | `public`           |
| `theme`       | `dark` · `light`                 | `dark`             |
| `output_path` | file path                        | `reactor-core.svg` |
| `max_repos`   | `1`–`1000`                       | `100`              |
| `days` ¹      | `30`–`728`                       | `470`              |
| `langs` ¹     | `1`–`8`                          | `4`                |
| `exclude` ¹   | comma-separated languages        | none               |
| `forks` ¹     | `true` · `false`                 | `false`            |
| `archived` ¹  | `true` · `false`                 | `true`             |

¹ New inputs — available from the first release after `v1.0.0`. Until then,
pin `@main` to use them, or use the hosted badge.

---

## How it works

- **Pure string SVG.** The badge is built by concatenating SVG markup — no
  headless browser, no `canvas`, no `sharp`. It renders anywhere an `<img>`
  works.
- **SMIL animation.** Each cell pulses on its own seeded clock, so the core
  shimmers without a single line of JavaScript.
- **Deterministic.** A username seeds a PRNG, so the same user always gets the
  same badge — numbers and animation timing included.
- **Transparent background.** The badge adapts to GitHub's light and dark
  themes automatically.
- **`commit` / `hybrid`** read the GitHub contribution calendar (GraphQL);
  **`language`** sums repository language bytes (REST, at most 8 requests in
  flight to stay clear of rate limits).
- **Stable forever.** Existing badge URLs are pinned by golden snapshot tests,
  so upgrades never change a badge you have already embedded.

---

## Development

Requires Node 24 and pnpm 10 (`corepack enable` picks the pinned version).

```sh
pnpm install
pnpm test                          # vitest, incl. golden snapshots
pnpm -r exec tsc --noEmit -p tsconfig.json
pnpm preview "days=90&langs=6"     # render all modes from fake data
pnpm build:fn                      # bundle the Vercel function
```

The hosted cache is optional: set `UPSTASH_REDIS_REST_URL` /
`UPSTASH_REDIS_REST_TOKEN` (or the legacy `KV_REST_API_*` names) to enable it.

---

## License

[MIT](LICENSE). Language colours adapted from
[github-linguist](https://github.com/github-linguist/linguist) (MIT).
