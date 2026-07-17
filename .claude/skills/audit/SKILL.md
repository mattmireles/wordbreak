---
name: audit
description: Triggered when the user’s message includes the word **audit** (primary routing hook). Findings-first review of the Wordbreak repo or a scoped slice (paths, diff, commits)—runs repo-appropriate mechanical signals, **reads and applies [`elon-musk`](../elon-musk/SKILL.md)** for first-principles systems judgment on architecture and complexity, optionally delegates readonly subagents by charter when scope or risk warrants it (**when in doubt, parallelize**), merges and dedupes findings, and assigns A–F grades for architecture, correctness risk, and complexity debt. Do not use when the user wants implementation fixes unless they explicitly ask to fix issues after the audit—for gating a plan phase, use phase-audit.
---

# Audit

## Purpose

Run a **structured, paranoid-friendly** audit focused on **bugs** and **needless
complexity**. The orchestrator **does not** silently rewrite code; it **surfaces**
issues with severity, paths, and letter grades.

**Posture:** use **judgment**. **Before consolidation and grading, read
[`elon-musk`](../elon-musk/SKILL.md)** and use its algorithm (question requirements,
delete before simplify, Idiot Index / local maxima, pipeline as product) when
forming **Architecture** and **Complexity debt** findings and grades.

Narrow scope can be a **single-agent** pass. **Whole-repo**, **large diff**,
**high blast radius**, or **uncertainty** → prefer **multiple readonly passes**
with **narrow charters**, then **merge and dedupe**. **When in doubt, use
multiple passes.**

## Use When

- The user’s message includes **`audit`** as a substring (primary trigger).

## Do Not Use When

- The user wants **implementation** only—unless they ask for fixes **after** the
  audit lands.
- The work is **only** gating an `execute-plan` phase—use **`phase-audit`**.

## Scope (ask or infer once)

| Kind | How to bound |
| --- | --- |
| **Whole codebase** | Repo root; usual surfaces: `wordbreak_v2.html`, `README.md`, `methodology.md`, `curriculum.md`, `docs/`, `.claude/skills/` |
| **Paths** | User-provided globs or directories |
| **Git delta** | Base branch / last N commits via `git diff` / `git log` |
| **Single feature** | Named flow (TYPE/FLAG/EXECUTE/PATCH, a stage/module, notes/plans)—map from `README.md`, `methodology.md`, `curriculum.md` |

State the **chosen scope** in the final report header.

## Mechanical signals (orchestrator, once)

From **repository root**:

1. If a root `package.json` exists: run available scripts (`typecheck` / `check`,
   `lint`, `test`) with the package manager the repo uses.
2. If **no** `package.json` (current Wordbreak default): note
   **mechanical checks: not run (no package.json)** and continue with review.
3. For HTML/JS in scope: spot-check the file opens, critical game-loop paths, and
   localStorage / progress assumptions when relevant.

Report command failures as **P0 / Critical**. Do not “fix” unless asked.

## Subagent delegation (use judgment)

**When one agent is enough:** tiny or localized scope; low coupling; quick pass.

**When to parallelize:** whole-repo; large `git` range; curriculum + runtime
coupling; **any uncertainty**. **When in doubt, use multiple chartered passes.**

### Harness compatibility

| Harness | How to run multiple charters |
| --- | --- |
| **Cursor (has `Task`)** | Up to four `Task` subagents, readonly, narrow charters |
| **No `Task`** | Same charters sequentially, then merge |

### Charter 1 — Architecture & modules

God modules; separation of concerns; UI vs curriculum data vs game-loop state;
fan-in choke points. Flag files approaching **~1000 LOC** or cramming unrelated
responsibilities (**repo norm:** keep the single HTML file coherent; split only
when a real boundary earns its keep).

### Charter 2 — Correctness & reliability

Logic bugs; impossible states in the four-beat loop; wrong fork routing
(Interrogation / Pull the Source / Legacy File); progress persistence bugs;
off-by-one in word/module maps; swallowed errors.

### Charter 3 — Security, privacy, operational

Unsafe HTML construction / XSS if any dynamic markup; secrets in repo; PII in
logs; broken static hosting assumptions; accidental network calls from a
no-server product.

### Charter 4 — Complexity, duplication, maintainability

Needless abstraction; duplication with drift (especially curriculum vs runtime);
dead code; comment/doc lies; naming that hides behavior.

## Consolidation (orchestrator)

0. **Elon-musk pass** for Architecture / Complexity debt.
1. **Dedupe** findings.
2. **Severity:** P0–P3.
3. **Grades:** Architecture / Correctness risk / Complexity debt (**A–F**).
   **Overall = worst of the three.**
4. **New teammate test:** one line.

## Grading rubric

| Grade | Meaning |
| --- | --- |
| **A** | Clear boundaries, hard to misuse, simple where it matters, issues cosmetic |
| **B** | Solid with minor debt; a few focused fixes would raise to A |
| **C** | Meaningful issues; would block merges without a plan |
| **D** | Serious structural or reliability risk |
| **F** | Unsafe, incomprehensible, or broken |

## Output template

```text
## Audit scope
- ...

## Mechanical checks
- package scripts: pass | fail | not run (summary)
- HTML/manual smoke when relevant: pass | fail | not run (summary)

## Grades
- Architecture: ?
- Correctness risk: ?
- Complexity debt: ?
- Overall (worst-of-three): ?

## Findings (severity order)
### P0 — Critical
- ...
### P1 — High
- ...
### P2 — Medium
- ...
### P3 — Low
- ...

## Delegation / overlap notes
- ...

## Residual risks / what we did not run
- ...

## New teammate test
- ...
```

## Anti-patterns

- Shallow whole-repo audit when depth was needed
- Four subagents for a three-line diff
- Findings without paths
- Auto-implementing during a review-only audit
- Grade inflation
- Ignoring mechanical failures when tooling exists

## Relation to other skills

- **`elon-musk`:** always load before final Architecture / Complexity grades
- **`phase-audit`:** phase-scoped gate inside plan execution
- **`git-commit`:** post-commit lightweight HEAD scan—not a substitute for audit
