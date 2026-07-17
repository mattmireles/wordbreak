# Wordbreak docs

Canonical product truth stays at the repo root:

- [`README.md`](../README.md) — product pitch, core loop, map
- [`methodology.md`](../methodology.md) — how spelling instruction works here
- [`curriculum.md`](../curriculum.md) — stages, modules, word content

Agent workflow artifacts live here:

| Path | Purpose |
| --- | --- |
| [`plans/`](plans/) | Checked-in implementation plans |
| [`notes/`](notes/) | Durable debug / investigation memory |
| [`skills/`](skills/) | Plan rubric, templates, workflow contracts |

App code is currently one file: [`wordbreak_v2.html`](../wordbreak_v2.html).

## Curriculum vs runtime

- Teaching truth / word lists: `curriculum.md` (+ `methodology.md` for method).
- Live behavior: `wordbreak_v2.html`.
- When they diverge, fix the source of truth the change intended — do not leave silent drift.
