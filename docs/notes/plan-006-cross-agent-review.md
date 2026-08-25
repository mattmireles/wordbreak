# Plan 006 cross-agent review

## Scope

Fresh Codex and Claude Code reviews tested
`docs/plans/006-luca-targeted-curriculum-expansion-plan.md` against the shipped
session compiler, assessment boundary, reporting validator, import/export state,
and audio pipeline. Raw CLI artifacts remain gitignored under
`tmp/cross-agent-audits/`.

## Review progression

The first draft proposed 12 personalized modules. Review rejected it because:

- prefixed module IDs would terminally reject a reporting day;
- the evidence sources had unequal exposure and no deterministic ranking;
- one small matched form could not justify code-level diagnosis or causal claims;
- rollback did not cover scheduled work and active sessions;
- the content volume preceded proof that more levels were useful.

The plan was reduced to four modules and then simplified again: Plan 005 is now
only an uncontaminated before measurement. It does not select content. The pack
is fixed in advance as E1 Anchor, E2 Restore, E5 Arithmetic, and E8 Family coat,
using numeric IDs `9.1`–`9.4`.

Later review rounds required and received explicit policy for:

- one pack identity predicate versus one enabledness predicate;
- derived core completion, pack ordering, global due-review ordering, and no
  pack fast-pass/prerequisite lock;
- known/unknown import versions, bounded lossless quarantine, and descriptor
  creation timing;
- terminalizing mixed active sessions exactly once when the feature is disabled
  or an imported version is unknown;
- assessment-target scanning across normalized learner-visible teaching fields
  while deliberately retaining assessment audio;
- word-only teaching playback, runtime-derived manifest parity, and two human
  listening passes;
- reporting-on `9.x` contract coverage and explicit state-machine fixtures;
- presentation-only copy corrections versus semantic/versioned migrations.

## Result

The final Claude review graded Architecture A, Correctness risk B, and Complexity
debt B, with a conditional go after five small state/phase policies were frozen.
All five are now explicit in the plan. The final Codex pass's three high-risk
findings—mixed-session lifecycle, representable import quarantine, and audio
contract—are likewise resolved without expanding the product surface.

Implementation remains held at the Plan 005 baseline. No Plan 006 teaching
target, lesson, hint, or audio may be drafted or exposed before the observer
confirms Luca completed it.

## Phase 0 evidence

The allowed pre-baseline seams are deployed with `FIELD_PACK_ON=false`:

- runtime identity/enabledness and known/unknown import normalization exist,
  but no pack unit, target, lesson, audio, map group, or `P.fieldPack` state does;
- 26 tests cover the 48-module/192-word core, lossless future-version
  quarantine, cap rejection, assessment contamination surfaces, and numeric
  `9.x` reporting monotonicity;
- asset verification now rebuilds the expected union worklist in memory and
  fails if either checked-in manifest is stale;
- the production browser showed the same 48-module learner map, intact
  reporting/assessment observer controls, no field-pack surface, and no console
  warning after deployment `dc6da3db-976b-463f-ad99-cbe86e1250c1`.

## Phase 1 content review — 2026-08-07 — resolved

**Summary:** The post-baseline pack is fixed at four modules and sixteen
spelling targets. It uses no baseline responses, school-writing samples, or
other private learner evidence.

**Review:** Every target was checked against the frozen assessment bank and
existing core targets by the runtime validator. The teaching claims deliberately
stay modest: family anchors for unstressed vowels, restoring written syllables
in compressed speech, historically assimilated prefixes, and learned `-ion`
family coats. Each unit has one honest conditional fork rather than pretending
that a broad sound rule decides the spelling.

**Sources:** Dictionary definitions, pronunciations, and available word-history
entries were checked during authoring. The committed units keep source notes
generic and do not embed private assessment evidence or copied source text.

**Verification:** `node scripts/curriculum/validate-content.mjs` accepts the
48-core/4-pack/16-target shape and reports no assessment leakage; the frozen
assessment-bank validator remains green.
