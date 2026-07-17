---
name: debug
description: >-
  Systematic debugging for Wordbreak: consult README.md, methodology.md,
  curriculum.md, and docs/notes first, pull current library docs via Context7 MCP
  when needed, parallelize investigation with multiple subagents when stuck,
  prove fixes before calling success, then capture one consolidated note in
  docs/notes via **write-notes** as the **final** step before ending the session.
  For extreme cases, escalate with a multi-agent audit. Use when the user invokes
  **debug**, **use debug**, asks to debug or fix a tricky bug, or work is blocked
  by unclear failure modes after quick local checks.
---

# Debug

## Purpose

Reduce guesswork: **product docs and existing notes first**, **Context7 when
library behavior is uncertain**, **parallel hypotheses when stuck**, **proof
before “fixed”**, **one write-notes pass at session end**.

## Use When

- The user says **debug**, **use the debug skill**, or the task is clearly
  **bug investigation** / **root-cause** analysis that is stalling.

## Do Not Use When

- Trivial fix with an obvious stack / clear cause and no doc ambiguity.
- Greenfield feature work with no defect.

## Workflow (in order)

### 1. Read repo knowledge first (mandatory)

1. **Skim `README.md`** for product loop and intentional constraints.
2. **Skim `methodology.md` / `curriculum.md`** when the bug touches teaching
   logic, fork types, or word content.
3. **Skim `docs/notes/`** for past investigations.

Do **not** skip this step to “save time.”

### 2. Context7 MCP (library and platform docs)

When the bug touches specific libraries, browser APIs, or hosting tools:

1. Resolve the library ID, then fetch focused docs.
2. Prefer Context7 over memory for version-sensitive behavior.

If Context7 is unavailable, say so and fall back to official docs—**do not**
invent APIs.

### 3. Reproduce and narrow

- Confirm minimal repro or the exact UI path that fails.
- State a one-sentence hypothesis and what would falsify it.

### 4. Parallel investigation when stuck

If hard / cross-cutting / circling:

- Launch multiple readonly `Task` subagents with narrow charters, or run the
  same charters sequentially.
- Merge hypotheses; avoid duplicate deep reads.

### 5. Escalation — audit

When still stuck or blast radius is high: run **`audit`** on the scoped slice
(paths / feature / git range). Attach symptom + what was ruled out + relevant
docs/notes paths.

### 6. Prove the fix

Do not claim fixed until objective proof: manual repro clean, bad state gone,
checks green—not because a change *ought* to work.

### 7. Write notes once (mandatory last step)

After steps 2–6, one **`write-notes`** pass under `docs/notes/`. Skip only when
the user forbids notes or the outcome is a trivial one-liner.

## Output expectations

- What was read from product docs / notes
- Verification status (proven / unverified / blocked)
- Which `docs/notes/` file(s) were updated (or why skipped)
- Whether Context7 was used
- Root cause or leading hypotheses

## Anti-patterns

- Coding before reading docs/notes
- Declaring victory without verification
- Patching notes throughout the session instead of once at the end
- Escalating to audit for every typo

## Relation to other skills

- **`audit`:** structured review / escalation
- **`write-notes`:** end-of-session capture
- **`phase-audit`:** plan-phase checks, not production debugging
