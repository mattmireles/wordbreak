# Plan 003 cross-agent review — raw findings and dispositions

External review of the first draft of
[docs/plans/003-budgeted-session-compiler-plan.md](../plans/003-budgeted-session-compiler-plan.md)
(budgeted session compiler, one CTA), run 2026-07-21 as fresh `codex exec`
(read-only sandbox) and `claude -p` (plan mode) threads against the draft plus
ground truth (`wordbreak_v2.html`, README, methodology, plan 002).

**Verdicts on the draft:** Codex — Architecture C, Correctness risk D,
Complexity debt C (2 P0, 7 P1). Claude — Architecture A-, Correctness risk B-,
Complexity debt B+ (1 P0, 4 P1). The spread came from severity judgment, not
disagreement on facts: the finding sets overlapped heavily and none
contradicted each other. All P0/P1 findings were verified against the live file
and integrated; the current plan reflects them.

## Session review-wall feedback — 2026-07-30 — resolved

**Summary:** A real learner reported that the single start action opened an
unusually long assignment whose repeated words did not appear to advance map
progress. The session compiler now leads with one frontier module and treats
reviews as a short maintenance dose.

**Symptom:** A session displayed `block 15/29`: a 30-minute inherited budget
compiled almost entirely from one-word review blocks. Reviews correctly updated
their spaced-return schedule, but do not clear modules, so they looked like a
long scoreless assignment.

**Repro:** Seed 29 due schedule entries with an uncleared frontier module, then
start a session using the original `{budgetMin:30}` configuration.

**Root cause:** Decision 2 made reviews a strict, budget-only first tier. With
`SEC_REV=60`, the default 30-minute budget admitted 30 reviews before any
module; the inherited default also gave the learner no visible indication that
they had been assigned a half-hour session.

**Fix / status:** New configurations use 10 minutes. Every pre-v3 30-minute
configuration resets once, because stored data cannot tell an old default from
an old deliberate choice; choices made after this release are versioned and
remain intact. `compileSession()` queues one frontier module
first, limits reviews to four, and only adds later modules when they fit the
observer-selected budget. Versioned queues also invalidate the previously
frozen review wall and recompile it on the next load. The home copy now
promises a new module followed by a few reviews.

**Verification:** Proven locally in a real browser: the legacy 30-minute
configuration migrated to a 10-minute `mod, rev, rev` session; an explicitly
selected 30-minute compile started with `mod` and contained exactly four review
blocks (rather than 29). Both shipped HTML files parse and remain identical.

**Related:** [README](../../README.md#7-whats-deliberately-not-in-here),
[methodology](../../methodology.md), and
[session compiler plan](../plans/003-budgeted-session-compiler-plan.md).

## P0s (both integrated)

| Finding | Source | Verified? | Disposition in plan |
|---|---|---|---|
| Session "day-scoped" logic rides on UTC `today()` (rolls over ~4–5pm US local): a paused session discards and a completed one re-arms mid-afternoon | Claude P0-1, Codex P1-1 | Yes — `today()` L817 is UTC-day | Decision 4: new `localDay()` scopes `P.session`/`P.sessions` only; SRS keeps `today()`; rollover enforced at home render + `startSession`, never mid-block |
| Cursor advance on CTA press is not atomic with `logWord`'s ledger writes → reload from the done screen replays a completed review and double-feeds `P.log`/`P.codes` | Codex P0-2 | Yes — `logWord` L1256 saves before `renderDone` CTA | Decision 11: block completion increments `idx` (and `stats`) inside `logWord` before its `saveP`; done-CTA is pure navigation; single-`setItem` atomicity noted |
| "Uncapped due reviews" contradicted by budget-cut Tier 1 | Codex P0-1 | Wording, not logic | Decision 2 restates the contract exactly: no fixed count cap, budget is the only bound, crossing item included, backlog carries |

## P1s

| Finding | Source | Disposition |
|---|---|---|
| Bonus round state model undefined; obvious impl regresses the day's `done` and skews metrics | Claude P1-1, Codex P1-3 | Decision 7: bonus replaces `P.session` with `bonus:true, baseDone:true`; day-complete rule `done \|\| baseDone`; metrics over non-bonus rows only |
| Fast-pass strip cells lie when a fast-pass module faults (full set runs behind 1 cell) | Claude P1-2, Codex P2-2 | Decision 5: cells are a compile-time snapshot; strip never changes length; divergence changes pace, not length |
| `P.sessions` row lifecycle unspecified; abandoned sessions invisible to the completion-rate alarm | Claude P1-3, Codex P1-3 | Phase 4: one row per session, appended at start (scalars only), mutated in place; `endedAt:null` = abandoned, visible by design |
| Budget control is writable on a kid-reachable screen (debrief has no gate) | Claude P1-4 | Decision 8: named accepted-by-convention; tamper-visible (per-row `budgetMin` in history); gating deferred to Open Q6 — DevTools makes any gate theater |
| Session first-pass rate derivable from neither `S.log` (reset per run) nor `P.log` tail (capped, no session ids) | Codex P1-2, Claude P2-4 | Decision 3: `P.session.stats={words,clean}` bumped in `logWord`, survives reload |
| `renderRun` has no quit/home control, so "quit mid-module" verification is unperformable | Codex P1-4 | Phase 2: ghost `⏸ pause` added to the session header |
| `S.session`/`S.docsReadOnly` lifecycle unowned; read-only mode can leak | Codex P1-5 | Decision 12: one owner per flag, cleared at named exits and legacy entries |
| `saveP` swallows failures; cursor-write failure recreates replay | Codex P1-6 | Dissolved by decision 11: cursor and ledger ride one `setItem` — they fail or persist together; `P.sessions` stores scalars to keep the write small |
| "`compileSession(10)` strictly fewer blocks than `(45)`" is false for empty/short workloads (fake certainty) | Codex P1-7 | Phase 1 verification rewritten: seeded workload, monotone non-decreasing assertion |

## P2s

Stale-rev test corrected to `e.due > today()` (entries are never deleted —
Claude P2-1/Codex P2-1, decision 4 + `schedKey` helper in Phase 1); Tier-1 cut
boundary stated (crossing item included — Claude P2-2); lock drift accepted
explicitly alongside fast-pass drift (Claude P2-3, decision 10); replay-at-word-0
re-feeding θ accepted with bounds (Claude P2-5, decision 10); `compileSession`
purity made an explicit contract for the TODAY preview (Claude P2-6, Phase 1);
"zero module-row actions" tightened to "zero startable-work actions" (Codex
P2-3, Phase 3).

## Unresolved / carried to Open Questions

- Budget-control friction (Open Q6) — ship tamper-visible, revisit on evidence.
- Legacy-path deletion criterion (Open Q7) — Claude's complexity-debt note;
  proposed bar: ~2 weeks of stable real sessions, then delete `SESSION_ON` and
  the legacy home.

Raw reviewer outputs were session artifacts (scratchpad) and are summarized
fully above rather than checked in verbatim.
