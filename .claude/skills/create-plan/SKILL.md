---
name: create-plan
description: Create an implementation plan for this repo. Use when the user wants a checked-in plan under docs/plans, wants the work scoped into phases, and expects the plan to be built from README.md, methodology.md, curriculum.md, and docs/notes first, with Context7 only when current external library or framework behavior materially affects the plan. Do not use for implementing the work, informal brainstorming, or lightweight notes.
---

# Create Plan

## Template Contract (Non-Negotiable)

`assets/Plans-template.md` is this skill's canonical plan skeleton. It is a
build input, not optional reference material.

Every numbered phase (`### Phase N:`) must include a **Skills:** line naming
existing skills to read before that phase starts.

The task checkboxes inside `## Implementation Phases` are the only progress
tracker. Do not add a second progress checklist, execution diary, Debug Notes
section, dated checkpoint stream, or evidence ledger. `**Status:**` states only
the plan lifecycle: `Planned`, `In-Progress`, or `Complete`; it never summarizes
phase state. Every task checkbox represents one independently completable fact;
do not add a roll-up checkbox derived from child boxes or mirror a task owned by
another phase.
Keep the generated `**Progress model:** Phase task checkboxes only` declaration;
the validator uses it to enforce this contract. Tracked legacy plans whose
`HEAD` version predates the declaration keep their old validation behavior
until deliberately migrated. Plan 001 and every later numbered plan require it;
new or migrated plans cannot remove it later.

After choosing the target path, create the draft only by running:

```sh
scripts/scaffold-plan.sh <new-plan-path>
```

Fill that generated file; do not hand-write a competing skeleton. Preserve all
required headings in their existing order. Content under `## Modules` is
optional and may be selected or omitted only when it is not relevant. Before
handoff, run:

```sh
scripts/validate-plan.sh <new-plan-path>
```

The validator rejects a missing, renamed, or reordered required heading,
unfilled top-level placeholders, duplicate progress or execution-log sections,
task checkboxes outside implementation phases, nonstandard checkbox states,
duplicate implementation-phase sections, noncanonical lifecycle status, and
any phase with missing, empty, or unknown **Skills:**. Tracked plans numbered
000 or earlier retain legacy progress validation until deliberately migrated.
Use `--allow-placeholders` only to check a fresh scaffold before drafting.

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
   - **Skills:** on every phase, naming existing skills the implementer must
     read before starting that phase
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
