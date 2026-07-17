---
name: phase-audit
description: Audit a completed plan phase in this repo. Use when a phase has just been implemented and needs a findings-first review against the active plan, changed files, linked product docs, and the canonical audit rubric before commit or before moving to the next phase. Explicitly invokes elon-musk for architecture and complexity scrutiny alongside the phase rubric. Do not use for implementing fixes, broad product critique, or replacing tests and CI execution.
---

# Phase Audit

## Purpose

Audit a completed implementation phase like a skeptical senior engineer. Decide
whether the phase is actually complete and ready to commit—not to help implement
it.

## Authority Model

- **Read-only** when invoked directly.
- Inside `execute-plan`, findings return to that workflow for fixes.
- Inside `execute-plan-hardcore`, the parent owns the fix-to-A loop after all
  phases.

## Use When

- A plan phase was just implemented.
- Checkboxes need validation against reality.
- Findings-first review is needed before commit / next phase.

## Do Not Use When

- The request is to implement or patch code.
- Broad product/UX feedback.
- Replacing tests/CI with review prose.

## Procedure

1. Read [references/index.md](references/index.md) first.
1b. Read and follow [`elon-musk`](../elon-musk/SKILL.md).
2. Read the active plan and isolate the phase:
   - goal, checked tasks, verification text
   - linked refs in `README.md`, `methodology.md`, `curriculum.md`, `docs/notes/`
3. Inspect evidence: diffs, checks run, notes about scope.
4. Compare against `docs/skills/phase-audit-rubric.md` and linked docs.
5. Produce severity-ordered findings with concrete paths and an explicit
   complete / not-complete call.
6. Check: missing scope, edge cases, weak verification, checkbox drift,
   commit readiness, leftover complexity `elon-musk` would delete.
7. If no findings, say so and note residual risks.

## Boundaries

- Do not edit files.
- Do not silently fix instead of reporting.

## Handoff Rules

- Hand findings back to `execute-plan` or the user.
- Optional external CLI review may reuse the inline `codex exec` /
  `claude -p` pattern from `audit-fix-loop` Part B.
