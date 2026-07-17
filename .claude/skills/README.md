# Project skills (canonical)

Skills live under `skill-name/SKILL.md` with YAML frontmatter.

**Single source of truth:** **`.claude/skills/`** — create, edit, and review skills here.

**Mirrors (symlinks):**

- **`.agents/skills`** → `../.claude/skills`
- **`.cursor/skills`** → `../.claude/skills`

Do not duplicate skill directories under `.cursor` or `.agents`.

## Wordbreak docs map

| Need | Path |
| --- | --- |
| Product / loop / map | `README.md` |
| Teaching method | `methodology.md` |
| Curriculum content | `curriculum.md` |
| App | `wordbreak_v2.html` |
| Plans | `docs/plans/` |
| Notes | `docs/notes/` |
| Rubric / templates | `docs/skills/` |

## Mechanical checks

Wordbreak is currently a single-HTML app with no `package.json`. Audits and
post-commit checks should note **mechanical checks: not run (no package.json)**
unless tooling is added later. Prefer manual smoke of the game loop over
inventing a build pipeline.
