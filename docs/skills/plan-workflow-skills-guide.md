# Plan workflow skills

Wordbreak uses these skills for planned work:

1. **`create-plan`** — write a checked-in plan under `docs/plans/`
2. **`execute-plan`** — implement one phase at a time; commit per phase; push once at the end
3. **`phase-audit`** — findings-first review before each phase commit
4. **`execute-plan-hardcore`** — local audit-to-A after full plan execution (explicit invoke)
5. **`audit-fix-loop`** — internal + external A/A/A gate (explicit invoke; not automatic inside hardcore)

## Boundaries

- Do not invent plan policy an implementer would have to guess
- Do not push between phase commits unless the user overrides
- Prefer the product docs (`README.md`, `methodology.md`, `curriculum.md`) over invented guides
- Mechanical checks follow whatever tooling the repo actually has (often none yet)
