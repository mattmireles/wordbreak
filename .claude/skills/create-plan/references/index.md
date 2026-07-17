# Create Plan References

## Plan filename and id

- Canonical path: `docs/plans/{id}-{kebab-slug}.md`
- Pick the next id as one plus the max leading numeric prefix among files in
  `docs/plans/` (ignore `README.md`):

  ```bash
  find docs/plans -maxdepth 1 -name '[0-9]*.md' -type f
  ```

- Zero-pad to three digits below 1000 (`001-...`, `042-...`).
- Keep the folder **flat** — no category symlink tree.

## Cross-links

- Other plans: use the real filename once it exists, e.g. ``docs/plans/012-flag-ux-plan.md`` (do not link a path that is not in the tree yet).
- Product docs: `README.md`, `methodology.md`, `curriculum.md`
- Notes: `docs/notes/...`

## Docs to read

- `docs/skills/plan-workflow-skills-guide.md`
- `docs/skills/plans-template.md`
- `docs/plans/README.md`
- Relevant product docs and notes for the task domain
- Neighboring plans for local style
