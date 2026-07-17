---
name: execute-plan
description: Execute a checked-in implementation plan for this repo phase by phase. Commits land once per completed phase locally; push runs once after all phases are done — not after each phase. Monitor CI only if workflows exist. Use when the user provides a concrete plan path and wants end-to-end implementation, phase audits, plan updates, commits, and push. Do not use for creating a plan, one-off fixes without a checked-in plan, or read-only review work.
---

# Execute Plan

## Purpose

Execute an existing repo plan without collapsing the work into one giant
unreviewed change. The unit of progress is one completed phase at a time.

## Use When

- A concrete checked-in plan path exists in [docs/plans](../../../docs/plans).
- The plan is implementation-ready.
- The user wants the full implementation loop.

## Do Not Use When

- No checked-in plan exists yet.
- One-off fix without a real plan.
- Planning, brainstorming, or read-only review.

## Authority Model

- Explicit invocation (`$execute-plan`, “use execute-plan”) authorizes:
  - **During phases:** narrow phase commits on the current branch; local
    fetch/merge only — **no push** until all phases complete.
  - **After all phases:** one remote sync, push, watch CI (if any), fix until
    green.
- If only inferred, prepare local work but stop before the first commit/push.

## Procedure

1. Read [references/index.md](references/index.md) first.
2. Read the target plan plus linked product docs
   (`README.md`, `methodology.md`, `curriculum.md`) and `docs/notes/` before
   changing code.
3. Refuse to start if the plan is missing or too vague.
4. Execute one phase at a time:
   - **4a.** Implement only the active phase. Keep it simple and modular.
   - **4b.** Audit before marking complete:
     - Prefer **`phase-audit`** (local) on the phase surface.
     - When Codex / Claude Code CLIs are available, optionally run a fresh
       readonly cross-agent phase review (inline, same pattern as
       `audit-fix-loop` Part B — no helper script required).
     - If external review is unavailable, run the local rubric and note the gap.
   - **4c.** Update the plan: checkboxes + phase marked complete **before** the
     phase commit.
   - **4d.** Commit phase files via **`git-commit`**, including the updated
     plan document from 4c. **Do not push.**
5. After all phases complete (**once**): hand off to **`git-push`** (or run the
   same sync → push → CI-if-present procedure). If no CI exists, push and stop.

## Worktree Rules

- Ignore unrelated dirty files unless they conflict.
- Never revert unrelated user work.

## Audit Contract

Before each phase commit, verify:

- phase goal complete
- audit integrated or absence called out
- plan file shows the phase done
- edge cases / checks appropriate
- commit-ready

## Boundaries

- Do not create a new plan inside this workflow.
- Do not skip the audit step.
- Do not push between phase commits unless the user overrides.

## Handoff Rules

- Hand off to `phase-audit` when clean delegated review is available.
- Hand off to `create-plan` only if a new plan is actually needed.
