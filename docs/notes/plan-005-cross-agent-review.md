# Plan 005 cross-agent review

Fresh Codex and Claude Code reviews ran read-only on 2026-08-05 before
implementation of [Plan 005](../plans/005-before-after-spelling-assessment-plan.md).

## First review

Codex graded the original draft Architecture D, Correctness risk F, and
Complexity debt D and blocked implementation. Its central finding was valid:
two hand-matched 24-item forms cannot support a Wilson interval, an estimate of
improvement, or diagnostic mechanism bands. It also found an incomplete state
machine, underspecified save rollback, an import/credential ownership leak, no
durable assessment transport in the daily-bucket protocol, undefined late
weekly-email inclusion, and a second audio manifest that contradicted the
existing union verifier.

The plan was simplified rather than patched around those issues:

- v1 is local-only; assessment data does not enter D1, sync, or email;
- results are exact descriptive counts on named forms, with unknown form
  difficulty stated beside the difference;
- E-codes remain predeclared item tripwires, not inferred diagnoses or bands;
- there is exactly one A/B pair, a complete run ledger, durable nonbonus count,
  and one atomic response-write authority with rollback;
- static assessment audio joins the existing worklist and manifest;
- export discloses private contents and import clears the reporting credential;
- the administration contract disables writing assistance where the browser
  allows it and names the limits of a parent-observed probe.

## Revised review

Claude graded the simplified shape Architecture A−, Correctness risk C+, and
Complexity debt B+ and returned a conditional go. It identified four remaining
release blockers:

1. Ordinary interruption could permanently poison the only A/B pair.
2. A double-submit was incorrectly treated as corruption.
3. Smart punctuation could make correct apostrophe/hyphen answers fail exact
   comparison.
4. Later content could teach a reserved follow-up target.

The final plan resolves all four. Interruptions are recorded but do not
automatically disqualify; identical duplicate submission is idempotent;
apostrophe/hyphen targets are prohibited; and Plan 006 must fail validation on
any overlap with assessment targets. The ledger phases and restart semantics
are now explicit. Implementation may begin behind `ASSESSMENT_ON=false`.

## Post-implementation bank verification

A fresh independent 48-item pass found one accepted-variant defect:
`guaranty` can legitimately replace the verb `guarantee` in the original
`A-E11-02` sentence. The item was replaced with the independently rechecked
`questionnaire`, the bank version advanced to 2, and only its two new Kokoro
clips were generated after Botnet health and live-TTS preflight. Full details
are in [the item-bank verification note](plan-005-item-bank-verification.md).

The v2 bank was deployed as Cloudflare Worker version
`270aa46a-bbe1-48d5-847c-ceb8ae6f83b7`. Live HTML names assessment version 2
and `questionnaire`; both new MP3s return `audio/mpeg`; the obsolete key falls
through as HTML and is absent from the runtime audio manifest. Remote reporting
remains fail-closed with ingestion and email disabled, zero learners, and zero
active credentials.

## Raw artifacts

Raw output is gitignored under
`tmp/cross-agent-audits/plan-005-rev2-20260805/`. The first Claude invocation
was abandoned after a CLI/tool-selection stall; the successful revised review
used a no-tools brief of the complete revised contract.
