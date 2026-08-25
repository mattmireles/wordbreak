# Plan 005 — Before/after spelling probe

## Goal

Give Luca's parent a useful baseline and follow-up description of independent
spelling—not curriculum completion—without pretending two small hand-built
forms are a standardized test, turning Wordbreak into a testing product, or
teaching answers during measurement.

## Product shape

- The observer starts a probe from the observer screen. It never appears in
  Luca's map, session queue, streak, or placement recommendation.
- Luca sees a calm `calibration` flow: one spoken word in a short disambiguating
  sentence, one text box, `submit`, then the next item. There is no score,
  correctness flash, answer reveal, timer, flagging, patch, or retry.
- A frozen form has 24 transfer items sampled across existing E-code tripwires.
  Six minutes is a design estimate; there is no countdown or time-based score.
- After completion, the observer sees exact-spelling total, descriptive
  tripwire counts, administration conditions, and the private item responses.

## Measurement contract

### Matched forms, with an explicit validity boundary

Create two frozen forms, A and B, with no target used in the taught curriculum
and no target shared between forms. Match each A/B pair on:

- primary E-code tripwire;
- syllable count and approximate frequency band;
- morphological structure and inflectional burden;
- number/location of plausible ambiguity points;
- age appropriateness and sentence-context clarity.

Human matching does not establish empirical equivalence or representative
sampling. The first run randomly and durably assigns A or B before showing an
item; follow-up uses the other form. V1 supports exactly one baseline and one
follow-up. Further cycles require new unexposed forms and another plan.

The comparison says `Form B minus Form A` (or reverse) and states that unknown
form difficulty is part of the difference. It never calls the difference an
improvement, learning effect, diagnosis, norm, grade level, or proof of cause.

### Existing tripwire groups

Items retain E1–E11 from `methodology.md`. E1/E2, E7/E10, E8/E9, and E11 remain
distinct. E0 is not an error type and is excluded. E4 may appear as a
methodology tripwire even though no live unit owns it. Every item has one
primary code; secondary codes are notes only and never scored.

An exact response cannot identify the cognitive cause of a miss. Code rows
therefore read, for example, `items selected as E5 tripwires: 1/2`—never weak,
solid, band, mastery, or prescription.

### Scoring

- `exact`: NFC-normalized, trimmed, lowercase response exactly equals target.
  Internal whitespace, apostrophes, hyphens, missing letters, and added letters
  remain significant.
- `groups`: correct/attempted counts for predeclared primary codes only. An item
  contributes once.
- `total`: exact correct / 24, described as a score on the named form.
- `difference`: follow-up exact count minus baseline exact count plus matched
  code rows, always beside the form-difficulty caveat.
- `practice context`: elapsed days and durable completed nonbonus-session count
  between forms.
- `conditions`: interruptions, replay excess, and device/setting differences are
  recorded and disclosed. Restart, static-audio failure, or observer timing
  override makes the pair `noncomparable`; the raw form counts remain visible.

No interval, partial credit, edit-distance inference, or post-hoc E-code
diagnosis enters the result.

## Item and audio contract

Add frozen `ASSESSMENT_FORMS` beside authoritative inline `UNITS`; do not add a
second runtime curriculum source. Each item contains:

```js
{
  id: "A-E5-01",
  form: "A",
  target: "...",
  audioText: "...",
  sentenceBefore: "...",
  sentenceAfter: "...",
  primaryCode: "E5",
  secondaryCodes: [],
  syllables: 4,
  frequencyBand: "school",
  ambiguity: [2, 3],
  sourceNote: "dictionary spelling/pronunciation and derivation checked"
}
```

The visible sentence contains a blank. Audio says the target, then the complete
sentence. Extend the existing extractor and single runtime audio manifest with
assessment clips. If exact static audio cannot play, pause and mark the run
noncomparable; browser speech is not a measurement fallback.

Homophones require context. Proper nouns, apostrophe/hyphen-bearing words,
dialect-dependent targets, offensive terms, and accepted spelling variants are
prohibited. This avoids smart-punctuation differences under exact matching. The
validator compares targets against a derived taught corpus: every
`UNITS[].words[].a`, lesson
`ty`, and methodology placement/tripwire example. It also fails on duplicate
targets, cross-form overlap, missing fields, pair-metadata mismatch, answer
leakage into the blank sentence, or missing static audio.

## Local state and atomicity

`P.assessment = {version, assignment, runs, nonbonusCompletedTotal}` is a local
ledger. Its derived phase is `unstarted`, `baseline_in_progress`,
`baseline_complete`, `followup_in_progress`, or `complete`. Runs have immutable
IDs and statuses `in_progress`, `completed`, `abandoned_noncomparable`, or
`corrupt_noncomparable`.

```text
unstarted -> baseline_in_progress -> baseline_complete
baseline_in_progress -> abandoned_noncomparable -> baseline_in_progress
baseline_complete -> followup_in_progress -> complete
followup_in_progress -> abandoned_noncomparable -> followup_in_progress
invalid persisted shape -> corrupt_noncomparable
```

Form assignment occurs once at baseline-run creation, before the first item.
Follow-up eligibility is derived at render from baseline completion time and the
durable monotonic nonbonus completion total—not the capped `P.sessions` ring.

`submitAssessmentResponse()` is the sole response-write authority:

1. Validate the run, cursor, current item, and normalized response.
2. Clone `P.assessment`.
3. Append one immutable `{itemId,response}`, advance the cursor, and freeze the
   result if this is the final item.
4. Call `saveP()` and render only after success.
5. On failure restore the clone and keep the same item/action available.

An identical duplicate submit for the already-committed item is an idempotent
no-op. A conflicting item/cursor or invalid persisted shape marks corruption
rather than skipping. Reload resumes the next unanswered item; the completed
result screen is side-effect-free.

Inputs use `spellcheck=false`, `autocorrect=off`, and `autocomplete=off`; paste
and drop are blocked. Copy asks for the same device/headphones, a quiet sitting,
and no outside help on both forms. Each item permits one replay. `pagehide` or a
reload while a run is active increments interruptions; `visibilitychange` alone
does not. Interruptions are disclosed but do not automatically disqualify a
run. Differing conditions remain visible beside the comparison. OS/browser
writing assistance cannot be proven absent, so this is a parent-observed probe,
not a secure exam.

## Privacy, export, and reporting boundary

Targets and responses remain in `wb2` and are not automatically synced or
emailed in v1. A deliberate progress export contains private word-level history
and assessment responses; its confirmation says so. Import clears the separate
reporting credential and quarantines sync until explicit re-pairing, preventing
imported state from using a different learner's stream.

Remote aggregate assessment reporting requires a later additive plan after the
forms are piloted. It is not added to Plan 004's daily-bucket checkpoint by
calling a point-in-time field an outbox.

## Eligibility and controls

- Baseline can start before Plan 006 content is deployed or assigned.
- Follow-up eligibility requires 28 calendar days and 12 completed nonbonus
  sessions after baseline. An observer override is allowed but makes the run
  noncomparable and records the reason.
- Abandon requires confirmation. Restart retains the abandoned run and assigned
  form, and is permanently labeled noncomparable.
- After a restarted baseline, the completed restart's timestamp and durable
  session total start the eligibility interval. A later comparison still
  renders raw counts but leads with `noncomparable: baseline was restarted`.
- Export/import includes assessment version validation. A local assessment
  reset requires a typed confirmation and preserves ordinary progress.
- Reporting is not required; the entire probe works offline after audio cache.

## Phases

### Phase 1 — Frozen bank and union audio contract

- [x] Draft 48 transfer items and match A/B pairs across existing tripwires.
- [x] Independently verify spelling, pronunciation, morphology, sentence sense,
      accepted variants, age appropriateness, and curriculum non-overlap.
- [x] Add `scripts/assessment/validate-bank.mjs`; fail on every item-contract or
      overlap violation and print only item IDs/reason codes.
- [x] Make Plan 006's content validator fail on any target overlap with
      `ASSESSMENT_FORMS`, so follow-up transfer words cannot become taught words.
- [x] Extend `scripts/audio/extract-worklist.mjs`, the documented manifest,
      runtime manifest, and `scripts/audio/verify-assets.mjs` as one union contract;
      generate through Botnet without changing gameplay audio keys.

### Phase 2 — State machine and restrained interface

- [x] Add `ASSESSMENT_ON=false`, inline forms, `P.assessment`, and a durable
      monotonic nonbonus-session completion total.
- [x] Add observer start/eligibility/comparison/reset controls and learner-neutral
      calibration screens.
- [x] Implement assignment, seeded order, atomic submit/rollback, resume,
      abandon/restart/corruption, assistance-disabled input, and static-audio gate.
- [x] Implement exact scoring, descriptive tripwire rows, condition labels, and
      named-form difference rendering.
- [x] Keep probe attempts out of SRS, placement, code profile, module clears,
      daily practice counters, and session completion.
- [x] Make export disclose private contents; make import clear the reporting
      credential and require re-pairing.

### Phase 3 — Verification and rollout

- [x] Add `src/assessment.test.js` golden tests for bank validation, assignment,
      every transition/reload boundary, duplicate submit, storage rollback,
      normalization, scoring, conditions, corrupt imports, and metric isolation.
- [ ] Run desktop/mobile keyboard, screen-reader, reduced-motion, audio-failure,
      offline, export/import, and full ordinary-session browser smokes.
- [x] Run `npm test`, inline-JS parse, 48-unit/192-word curriculum assertions,
      union MP3 verification, and Wrangler dry-run.
- [x] Deploy with `ASSESSMENT_ON=false` and verify current gameplay/reporting
      live; then enable it, redeploy, and rerun the clean browser smoke.
- [ ] Take Luca's real baseline before Plan 006 execution.

## Release gates

- Forms are matched transfer probes, not empirically equated tests or repeated
  curriculum targets.
- No instructional feedback appears before a run is frozen.
- Reload/save failure cannot reveal, skip, duplicate, or change an answer.
- Probe work never affects teaching progression or practice/report counters.
- No assessment data enters server payloads or email in v1.
- Code rows are descriptive tripwire counts, not inferred skill estimates.
- Difference copy names both forms and unknown form difficulty.
- The real baseline occurs before Plan 006 adds content.
- Plan 006 is prohibited from adding any assessment target to taught content.

## Rollback

`ASSESSMENT_ON=false` hides new-start controls but preserves completed local runs
and export. Existing gameplay, reporting, static audio, and cleanup continue.
