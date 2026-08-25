# Plan 006 — Luca-targeted curriculum pilot

## Goal

Add the smallest useful body of instruction after Luca's baseline: four
hand-authored modules (16 new teaching targets) across Wordbreak's four most
generative advanced moves. This is a pilot of whether more Wordbreak content
remains useful after the existing game—not a diagnosis, an assessment-derived
prescription, or a promise that 16 words make someone a great speller.

The educational aim is durable production of the taught patterns and a more
reliable second-check habit. Plan 005's later matched-form difference remains a
descriptive broad transfer signal; it is not a code-level mastery score or a
causal estimate of this pack.

## Dependencies and hard hold

- [Plan 005](005-before-after-spelling-assessment-plan.md) must be deployed and
  Luca's baseline must be completed on the authoritative device before any new
  target, lesson, hint, or audio from this plan is exposed to him.
- Phase 0 validators and empty test seams may land before the baseline. Content
  drafting, runtime literals, audio, and learner-visible teaching may not.
- If the observer has not confirmed a completed baseline, stop. The baseline
  establishes an uncontaminated before measurement; its answers do not select
  this pack.

## Product shape

Keep the existing eight-stage map as the core curriculum. Add one restrained
`NEXT FIELD PACK` group with four modules. Luca still sees one `TODAY` button
and the same learn → produce → flag → source → patch loop. There is no second
game mode, content picker, grade, points layer, or generated runtime lesson.

The first pack is deliberately only four modules. More contrast or transfer
modules require retention evidence from this pilot and a new plan.

## Frozen theme order and measurement boundary

The pack order is fixed before seeing the baseline:

1. `9.1` — E1 Anchor: use a stressed relative to recover a schwa vowel;
2. `9.2` — E2 Restore: recover a swallowed syllable;
3. `9.3` — E5 Arithmetic: compute assimilated prefix/root seams;
4. `9.4` — E8 Family coat: preserve or explain a root's spelling variant.

These are the methodology's high-leverage generative moves, not Luca's four
measured weaknesses. Plan 005 answers, code counts, and school writing do not
enter target selection, prompts, fixtures, source review, Git, or agent context.
The observer may use those private artifacts later to interpret whether the
fixed pack was useful, but no implementation decision reads them.

## Content contract

Author one four-target module for each frozen theme. The four targets should
form a compact sequence: two core/contrast applications and two harder
school-writing applications.

Each new unit adds validation-only metadata beside the compact runtime fields:

```js
meta: {
  packVersion: 1,
  morphemes: [{ form: "...", meaning: "...", layer: "Latin" }],
  rule: "...",
  etymologyHook: "...",
  tiers: { core: ["..."], transfer: ["..."] },
  completionMeaning: "one completed teaching pass; not mastery",
  dictationFrames: ["..."],
  sourceNotes: ["dictionary and morphology references checked"]
}
```

`meta` is used by validators and human review, not duplicated into a new
runtime or rendered as an extra lesson. The actual rule, source story,
correction, verification beat, and sentence context must still be present in
the existing `docs`, `words`, prompt, hot-byte, and fork fields.

`CLEARED` continues to mean the module was completed once; it does not mean
mastery. This pilot adds no mastery ledger, private evidence API, or automated
educational success gate. Existing review events remain ordinary practice
history, and later interpretation stays descriptive.

Every target must:

- be useful in writing by an advanced 14-year-old, not merely difficult;
- have one defensible primary E-code and at least one genuinely live hot byte;
- be absent from current teaching targets/typed answers, both assessment
  forms, and every other pack target;
- use a sentence that fixes meaning where pronunciation alone is ambiguous;
- use a rule fork, source lineup, or honest memory fork already supported by
  the engine;
- have spelling, pronunciation, morphology, accepted variants, and source
  story independently checked before audio generation.

Assessment targets are permanently reserved. Related families may be taught
after baseline because transfer is the point, but neither form's exact target
may appear in teaching, hints, prompts, visible examples, or audio.

For this exclusion only, recursively collect the pack's learner-visible
teaching fields (`docs`, typed answers, word targets/prompts/forks, witnesses,
distractors, and teaching audio text), strip HTML/decode entities, normalize
NFC/lowercase, and tokenize on Unicode letter runs. Fail when a reserved target
is an exact token. Assessment clips in the union manifest are intentionally
excluded from this teaching scan; they must contain their own reserved target.

Teaching playback remains the current word-only contract: `say` speaks `w.a`
at normal/slow speed, while the existing visible clue/dictation frame supplies
meaning. Do not add sentence audio or a second playback path for the pack.

## IDs, feature flag, and one pack predicate

- Use numeric IDs `9.1`–`9.4`, which satisfy the reporting contract
  `^\d+\.\d+$`. Add a `NEXT FIELD PACK` display group; do not rewrite the
  conceptual eight-stage core.
- Add `FIELD_PACK_VERSION = 1`, `FIELD_PACK_ON = false`, and one
  `isPackUnit(unit)` identity predicate plus one `isEnabledUnit(unit)` policy
  predicate. The map, frontier, due queue, bonus
  compilation, `nextDueInDays`, placement, session-validity/stale-block
  handling, and counters use enabledness. Import validation uses pack identity,
  never the current flag value.
- Pack units are ineligible until every derived core unit
  (`UNITS.filter(unit => !isPackUnit(unit))`) is cleared. The existing
  session tier keeps all due reviews (core and enabled pack, globally sorted by
  overdue/error weight/lapses) ahead of new frontier modules; it does not add a
  second core-versus-pack review priority.
- Pack units are exempt from `CODE_PREREQ` locking and fast-pass: completing all
  core modules is their prerequisite, and the pack deliberately revisits its
  four generative moves. Their internal order is exactly numeric `9.1` → `9.4`.
- When the flag is false, pack map rows, frontier work, due pack reviews, and
  resumable pack blocks disappear. Existing pack clears/schedules remain
  untouched for re-enable.
- Import recognizes pack IDs independently of enabledness and preserves valid
  pack clears/schedules while the flag is off. Unknown pack versions/IDs are
  quarantined from compilation without deleting the rest of imported progress.
- If the flag is disabled while a pack block is active, the next initialization
  abandons the entire mixed session: current state and its single history row
  receive the same terminal status, `endedAt`, and local reason
  `feature_disabled`; active time is flushed and the ordinary aggregate
  abandonment transition emits exactly once. No block in that frozen session
  resumes. The next press of `TODAY` compiles a new core-only session with a new
  ID; existing clears and schedules are unchanged.
- On the first initialization with `FIELD_PACK_ON=true`, before rendering or
  compiling pack work, persist
  `P.fieldPack={version:1,unitIds:["9.1","9.2","9.3","9.4"]}`. Export includes
  it. Import validates the bounded numeric `unitIds` list. A known v1 descriptor
  is preserved even while disabled. An unknown version moves exactly those
  IDs' `docs`, `cleared`, schedule entries, and active-session blocks into
  `P.quarantine.fieldPacks[]` with version/unit IDs/time, capped at four entries;
  it excludes them from compilation and reporting snapshots without altering
  core state. It does not guess unknown pack identity from current `UNITS`.
- If an unknown-version import contains an active session with one of those
  unit IDs, import normalization terminalizes that session and its matching
  history row as `abandoned` with `endedAt=import time` and local reason
  `unknown_pack_version`, then quarantines all its blocks. No imported core
  block resumes and no reporting daily counter is emitted during normalization
  (import has already cleared the reporting credential). If adding the unknown
  descriptor would exceed four quarantine entries, reject the entire import
  before replacing `wb2`; never evict or drop an older entry.
- Frozen targets, schedule keys, audio text, and instructional semantics are
  immutable for a given version/IDs. A maintainer may correct presentation-only
  copy in place under a checked review note and full validation when it changes
  none of those fields. Any other correction requires a new plan, version bump,
  new module IDs, and an explicit progress migration or coexistence decision.
- Reporting remains aggregate-only. Add Worker validation tests for `9.1`–
  `9.4` and prove a pack clear cannot reject or dead-letter the rest of a daily
  bucket.

## Phase 0 — Pre-baseline test seams only

- [x] Add empty pack identity/enabledness helpers, import normalization schema,
      curriculum-validator scaffolding, and test-harness exports without adding
      target words, lesson copy, pack audio, or a visible map group.
- [x] Prove the disabled build is byte-for-byte unchanged on learner-facing
      routes and does not create `P.fieldPack`.

## Phase 1 — Baseline and content freeze

- [x] Confirm Luca's Plan 005 baseline is complete before exposing content;
      do not inspect its answers to author this fixed pack.
- [x] Draft four modules/16 targets using the content contract.
- [x] Independently review every teaching claim and target for correctness,
      age fit, usefulness, ambiguity, accepted variants, and honest fork type.
- [x] Record only generic content/source review in a checked-in note; no
      baseline export or school-writing sample enters the workflow.

Verification: frozen E1/E2/E5/E8 order, one module per theme, four targets per
module; no private evidence in the worktree or review artifacts.

## Phase 2 — Validator, compiler, and reporting contract

- [x] Add `scripts/curriculum/validate-content.mjs` using
      `scripts/runtime-data.mjs` as the single extractor and wire it into
      `npm test`.
- [ ] Validate stable IDs, 4×4 panels/targets, metadata schema, fork shapes,
      live hot bytes, code ownership, unique normalized targets, and exact
      assessment-target exclusion across visible text, target words, lineup
      witnesses/distractors, and teaching audio using the normalization contract
      above.
- [x] Add a read-only manifest check that derives expected audio from runtime
      data and compares it with both checked-in manifests; `npm test` must fail
      if extraction was not rerun.
- [x] Update the extractor's core/pack/word/witness assertions before appending
      units, so no intermediate implementation state relies on stale `48/192`
      constants.
- [x] Expose `compileSession`, `frontierUnits`, `dueList`, `blockStale`,
      `sessionValid`, `nextDueInDays`, placement/fast-pass, initialization
      normalization, import normalization, and both pack predicates through the
      test harness.
- [ ] Add explicit fixtures for all-core-clear, due-first, bonus, mid-core
      progress, mixed core/pack disablement, once-only abandonment across two
      reloads, known-v1 import while off, unknown-version quarantine, reporting
      exclusion, and preserved clears/schedules.
- [x] Add contamination-validator negative fixtures for HTML/entities, Unicode
      normalization, typed answers, prompts, forks, witnesses/distractors, and
      teaching audio, plus a positive fixture proving assessment clips remain.
- [ ] Extend reporting tests with numeric pack module IDs, monotonic daily
      replacement, and an assertion that valid pack clears cannot reject other
      daily aggregate fields. Include a reporting-on local sync fixture whose
      daily bucket contains a `9.x` clear.
- [x] Append the frozen descriptor and four reviewed units only after the
      baseline hold is satisfied.

Verification: core remains exactly 48 modules/192 targets; enabled pack is
4/16; all 52/208 assertions, collision checks, compiler cases, and reporting
contract tests pass.

## Phase 3 — Restrained interface

- [x] Derive map/footer counts; label the existing map `CORE · 8 stages` and
      append one collapsible `NEXT FIELD PACK` group.
- [x] Add an observer explanation naming the four fixed themes and the
      fixed generative rationale, explicitly stating that baseline results did
      not select them.
- [x] Keep Luca's home focused on the same single `TODAY` action. No pack
      selector, difficulty control, score, badge, or completion theater.
- [x] Ensure placement/fast-pass never clears pack modules; each requires its
      brief and production loop.
- [ ] Preserve reduced motion, keyboard operation, narrow viewport behavior,
      static-audio failure handling, and offline resume.

Verification: desktop/mobile browser smoke; an all-core-cleared fixture previews
`9.1`; a due-review fixture previews review before `9.1`; a mid-core fixture is
visually unchanged; the disabled flag hides and de-queues every pack surface.

## Phase 4 — Union audio and rollout

- [x] Extend the existing union extractor; never create a pack-only manifest.
- [x] Generate only missing normal/slow clips through Botnet after fresh worker
      health and validate status, `audio/mpeg`, and MP3 bytes.
- [ ] Have two human passes listen to every new clip against its manifest text
      (normal and slow where generated), checking the word, stress, truncation,
      and pronunciation. Regenerate any failed clip with a new
      idempotency attempt and retain only the approved bytes.
- [x] Run `npm test`, inline-JS parse, D1 local migrations, Wrangler dry-run,
      ordinary-session regression, assessment regression, and reporting-off
      regression.
- [x] Deploy with `FIELD_PACK_ON=false`, verify canonical and redirect origins,
      then enable and redeploy. Reporting collection/email switches remain
      independent and unchanged.

## Pilot decision after use

This plan's implementation success is mechanical: the four modules are correct,
privacy-preserving, integrated, and usable. Educational evidence is reported
separately:

- session starts/completion do not collapse after the pack appears;
- available local review events may describe exact recall and live aim on
  _taught_ targets, but the capped log is labeled incomplete and never promoted
  to a mastery or novel-transfer measure;
- the later Plan 005 follow-up is reported only as an overall matched-form
  difference with unknown form difficulty;
- Luca and his parent give a brief qualitative judgment about whether spelling
  interrupts authentic writing less often.

Only a new plan may add the next modules. It should use pilot retention,
engagement, follow-up, and authentic-writing observations together; none alone
is a causal proof or automated expansion trigger.

## Rollback

`FIELD_PACK_ON=false` removes the pack from the map, frontier, due queue, bonus
work, and resumable sessions while preserving stable local records for later
re-enable. The original 48 modules, assessment ledger, reporting aggregates,
audio cache, and imported progress remain valid. Existing MP3s are never
regenerated unless their spoken text changes.
