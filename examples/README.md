# Examples

These badges are rendered from **real GitHub data** for
[`Seungpyo1007`](https://github.com/Seungpyo1007) by the end-to-end script
([`packages/core/scripts/e2e.ts`](../packages/core/scripts/e2e.ts)) — they are
not mockups. The repository README embeds them directly.

| File | Mode | What it shows |
| --- | --- | --- |
| [`commit.svg`](commit.svg) | `commit` | Daily contribution heatmap + activity panel |
| [`language.svg`](language.svg) | `language` | Language rings + fuel-channel panel |
| [`hybrid.svg`](hybrid.svg) | `hybrid` | Commit core + language rim, combined panel |

## Embed one

Hosted endpoint (public data):

```md
![reactor](https://markdown-rbmk.vercel.app/api/badge?username=YOUR_NAME&mode=commit)
```

Or a file committed by the GitHub Action:

```md
![reactor](reactor-core.svg)
```

## Regenerate these files

```sh
GITHUB_TOKEN=$(gh auth token) \
  pnpm --filter @markdown-rbmk/core exec tsx scripts/e2e.ts Seungpyo1007
cp packages/core/e2e-*.svg examples/
```

`language` mode works without a token; `commit` and `hybrid` need one because
the GitHub contribution calendar is only available over the authenticated
GraphQL API.
