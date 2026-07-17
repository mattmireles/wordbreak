---
name: execute-plan-hardcore
description: >-
  Execute a checked-in implementation plan like execute-plan (phase-by-phase,
  commits, push, CI), then run the full audit skill on the execution scope and
  require Architecture, Correctness risk, and Complexity debt grades all A—fix
  findings and repeat until all three are A. Use when the user explicitly
  invokes this skill or wants the hardcore post-audit gate after plan execution.
  Do not use for planning-only, read-only review, or when the user wants standard
  execute-plan without the audit-to-A loop.
---

# Execute Plan (Hardcore)

## Purpose

Same as **`execute-plan`**, plus a mandatory post-execution loop: audit the work,
require **A / A / A**, fix, repeat until those grades hold.

## Use When

- A concrete checked-in plan exists in [docs/plans](../../../docs/plans).
- The user explicitly invokes this skill.
- They want execute-plan **and** an audit-to-A gate.

## Do Not Use When

- No plan, or planning-only / read-only.
- Standard **`execute-plan`** without the hardcore gate.
- User forbids post-execution fix iterations.

## Authority Model

Explicit invocation authorizes everything **`execute-plan`** authorizes, plus
post-audit fix commits (and push if needed) until grades are **A / A / A**.

## Procedure

### Part A — Execute the plan

1. Read `docs/skills/plan-workflow-skills-guide.md` and
   `docs/skills/phase-audit-rubric.md`.
2. Follow **`execute-plan`** end-to-end (phases, phase-audit, plan updates,
   phase commits, then one push/CI tail).

### Part B — Hardcore audit gate

Run only after Part A is complete.

1. Scope the audit to the plan execution (`git` slice or touched paths).
2. Run **`audit`** with mechanical signals, multi-charter depth as warranted,
   and **`elon-musk`** pressure on Architecture / Complexity.
3. Pass only at **A / A / A**.
4. If below A: fix blockers, commit, re-audit until A/A/A.
5. After **A / A / A**: if Part A already pushed a pre-audit tip and Part B
   advanced `HEAD`, run **`git-push`** once more so the remote includes audit
   fixes (or note that nothing new needs pushing).
6. If stuck on a product/architecture tradeoff: stop and ask the user.

## Boundaries

- Do not skip Part B.
- Do not grade-inflate.
- Do not lower quality gates—raise quality.

## Relation to Other Skills

- **`execute-plan`:** Part A
- **`phase-audit`:** per-phase inside Part A
- **`audit`:** Part B local grading gate (required here)
- **`audit-fix-loop`:** use only when the user explicitly wants the dual
  internal + external Codex/Claude gate — not automatic inside hardcore
