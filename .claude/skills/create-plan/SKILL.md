---
name: create-plan
description: Create an implementation plan for this repo. Use when the user wants a checked-in plan under docs/plans, wants the work scoped into phases, and expects the plan to be built from README.md, methodology.md, curriculum.md, and docs/notes first, with Context7 only when current external library or framework behavior materially affects the plan. Do not use for implementing the work, informal brainstorming, or lightweight notes.
---

# Create Plan

## Purpose

Turn a concrete request into a repo-native implementation plan at
`docs/plans/{id}-{kebab-slug}.md` — not a chat-only outline.

## Use When

- The work is large enough to need a real implementation plan.
- The user wants a plan written into the repo.

## Do Not Use When

- The user wants direct implementation.
- The request is still too vague to scope honestly.
- The output should be a note or brainstorm instead of a plan.

## Procedure

1. Read [references/index.md](references/index.md) first.
2. Gather repo context in this order:
   - `README.md`, `methodology.md`, `curriculum.md` as relevant
   - directly related `docs/notes/`
   - neighboring plans in `docs/plans/`
3. Use Context7 only when the plan depends on current external library /
   framework / API behavior.
4. If Context7 is insufficient, fall back to official vendor docs.
5. **Number the plan file:** next monotonic id, filename
   `{id}-{kebab-slug}.md` (zero-pad to three digits below 1000). See
   [references/index.md](references/index.md).
6. Write the draft to **`docs/plans/{id}-{kebab-slug}.md`**. Make it
   implementation-ready:
   - concrete phases
   - specific files where knowable
   - verification per phase
   - hard requirements
   - rollback or kill switch when relevant
7. When Codex or Claude Code CLIs are available, run a fresh cross-agent review
   on the saved draft. The concrete `codex exec` + `claude -p` command block
   lives in **`audit-fix-loop` Part B** — reuse that block inline (Wordbreak
   has no helper script). Integrate concrete findings; move unresolved
   disagreements to Open Questions.
8. If external reviewers are unavailable, audit locally and note the gap.
9. Final plan audit before stopping:
   - no missing policy an implementer would invent
   - no fake certainty
   - no implementation performed while planning

## Canonical Docs

Read [references/index.md](references/index.md) first.

## Handoff Rules

- Hand off to `execute-plan` only after the plan is checked in and the user
  wants implementation.
