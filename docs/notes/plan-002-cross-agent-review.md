# Cross-agent review — Plan 002 (measured placement engine)

_Codex (gpt-5.6) + Claude CLI, run against the saved draft on 2026-07-17. Raw findings, verbatim._

## Codex — grade C
```
codex
Overall grade: C — not implementation-ready without resolving the policy and DAG ambiguities.

No citation mismatches found in the “already exists” table: `resolveErrCodes()` [wordbreak_v2.html:771-773], SRS symbols [774-798], review mode [907-912], `ERR_WEIGHT` [767], `renderHome()` [821], static copy [857], `openStage:1` [810], `commitTyped()` [956-960], and logging [1118-1129] all match.

Findings:

- P1 — The prereq representation is internally inconsistent. `STAGE_PREREQ` contains stage numbers, but `stageReady()` is specified to inspect prerequisite “codes” [plan:84-86]. Define whether readiness recursively evaluates stages or maps stage → `STAGE_CODES`. Also, the proposed stage-code map does not match the actual curriculum: Stage 1 contains E7/E3/E6/E0/E1/E11 [wordbreak_v2.html:202-286], Stage 4 contains substantial E7 before E8 [405-501], Stage 7.5 is E8 [707], and Stage 8.1 is E7 [721].

- P1 — `gradeEncounter()` is underspecified. The plan names `clean`, `aim`, `tries`, `revealed`, latency weights, `medianMPC()`, and thresholds, but gives no exact constants or formula [plan:72,76]. An implementer must invent the score, neutral handling, character normalization, and how latency becomes ms/char.

- P1 — Encounter semantics are missing. The plan says all `logWord()` calls feed `onEncounter()` [plan:74], but does not explicitly define whether review-mode events and module events share the same evidence pool, whether repeated review encounters are weighted identically, or whether an encounter is logged once per word or per commit. Current review and module paths both converge on `logWord()` [wordbreak_v2.html:907-912, 1084-1129].

- P1 — E0 is contradictory. The hard requirements say it is excluded, backfill says skip it, but the plan leaves “E0 handling” as an open question [plan:75,107,124]. Live `resolveErrCodes()` assigns E0 to words whose unit has no code [wordbreak_v2.html:771-773], so `onEncounter()` must explicitly reject E0 or it will create profile state that routing ignores.

- P1 — Backfill correctness is not fully specified. “If `P.codes` is empty” has no migration/version marker, replay deduplication rule, or behavior for partially initialized profiles [plan:75]. The plan also says missing latency is treated neutral, while its verification assumes historical events can seed a meaningful profile [plan:72,75,78].

- P1 — The latency contract is ambiguous around edits/re-commits. `commitTyped()` currently accepts the first non-empty trimmed submission and immediately moves to flagging [wordbreak_v2.html:956-960]. Define whether latency ends at that first submit, whether time spent revising after a render counts, and whether `tries` includes only patch attempts or any initial typing attempts [plan:61-62].

- P2 — The “~15 min” ramp and “escape Stage 1 within ~1–2 units” claims are unsupported by the checked-in docs or current code [plan:49,91]. They should be explicit hypotheses/acceptance targets, not presented as settled behavior.

- P2 — The plan intentionally simplifies away documented router behavior: Stage 6 can open while Stage 4 is merely underway, E9 floats after Stage 3, and E10/E11 can be side queues from intake [methodology.md:210-215]. That is acceptable scope-wise, but the plan should state that its linear lowest-frontier rule is a deliberate v1 divergence, not an implementation of the full router.

- P2 — Phase placement is otherwise sound. Phase 1 enriches existing logging; Phase 2 adds shadow estimation; Phase 3 owns the new front door; Phase 4 owns observer presentation. It does not duplicate shipped SRS behavior.

Cold-start conclusion: under the stated “unmeasured does not block” rule, the intended result is indeed `1.1`: all stages are initially eligible, and lowest stage/ID wins [plan:84-86]. That conclusion is only valid after the stage-vs-code readiness semantics are made precise.
tokens used
```

## Claude — grade C+
```
Review complete — verified against the live code and docs. Full report saved at `~/.claude/plans/cross-agent-review-of-a-glistening-anchor.md`. Summary:

**1. Factual accuracy: PASS.** Every cited symbol and line number checks out — `resolveErrCodes` (:771), `scheduleWord` (:774), `dueList` (:787), `BOX_DAYS` (:763), `ERR_WEIGHT` (:767), `logWord` (:1118) / `P.log.push` fields (:1125, exact match), `renderHome` (:821), "begin with stage 1" (:857), `commitTyped` (:956), `startWord` (:913), `openStage:1` (:810), review trio (:907–912), DUE card (:846), `renderDebrief` (:1150). The already-exists/missing table is accurate; `nEff`≈12.5 is right. Only nit: `resolveErrCodes` is a boot-time mutation, not "read-time" (P2).

**Findings:**

- **P0 — `unitStatus` undefined where it matters; per-code θ collides across stages.** E7 tags units in stages 1, 2, 3, 4, and 8 (1.1, 2.1, 3.1–3.3, 4.1–4.7, 8.1, plus per-word overrides :557/:579). If status derives from the unit's `err` θ, mastering E7 on 1.1's compounds marks stages 3–4 solid and Continue skips them; E7 faults on 1.1 drag stage 4 down. Phase 3's "advances to the measured frontier" verification is unachievable as written — the implementer must invent the central mapping (θ blended with `P.cleared`, or per-unit evidence). Same aliasing for E1, E3, E8, E11.
- **P1 — the E0 trap is a real unit, not just a fallback.** Unit 1.5 is hand-tagged `err:"E0"` (:250). Exclude E0 from the profile (plan L124) and 1.5 is unmeasurable forever — Continue parks on it once 1.1–1.4 go solid. Needs explicit policy.
- **P1 — STAGE_CODES is the router's *tripwire* column, not what stages emit.** Actual stage 1 = {E7,E3,E6,E0,E1,E11}, not ["E11"]; **E4 exists nowhere in the file** (unmeasurable); stage 4 is 7×E7 + 6×E8, not ["E8"]; stage 7 includes E8 (7.5). So stage-2 readiness ignores a kid drowning in E3, while stage-1 E3 faults block stage 3.
- **P1 — "~15 min ramp" is fake certainty.** 16 units × (docs-gated 4-panel lesson + quiz + typed ketsu + 4 words each; `openRun` requires `P.docs`, :905) ≈ 45–75 min, understating decision 3's cost 3–4×.
- **P1 — `gradeEncounter` can't be implemented from this repo** (spec lives in an un-checked-in thread), and the Phase 2 verification margin is 0.006: four s=1.0 updates at λ=0.92 give θ≈0.856 vs THETA_HI=0.85. Any sub-perfect grade and one unit no longer clears its code — the constants are silently coupled.
- **P1 — `STAGE_PREREQ` 8:[5,6] gates all of stage 8**, but methodology:210–215 makes 8.2/8.3 side queues from intake; only 8.1 requires 4+5+6.
- **P2** — the "first commit" latency guard is moot (`commitTyped` fires once; phase moves to flag, no re-commit path). The real gap: latency isn't comparable across prompt kinds — "say" words require ▶-clicks first, "build" prompts show the parts on screen. Also: review and module encounters feed `onEncounter` identically (the shared-`logWord` claim is correct) with no evidential weighting; cold DAG is inert (nothing is ever locked until a code measures *low*, so the cold map tints stage 8 like stage 1); no policy for `recommend === null`.

**Phasing:** correct — nothing duplicates the shipped SRS; shadow-first ordering is right; decisions 5 (monotonic `seen`) and 6 (backfill never touches `scheduleWord`) are verified sound against `LOG_CAP` roll and `Date.now()`-based `due`.

**Cold start (#5):** holds — all-unmeasured → every stage ready → lowest id = 1.1, conditional on the (implied, unstated) rule that unmeasured units in a ready stage count as measuring.

**Grade: C+.** Phases 1–2 are A-grade and could ship as written. Phase 3 — the payoff — has an undefined core (unitStatus under cross-stage code sharing), a guaranteed sticking point (unit 1.5/E0), and a DAG built from the wrong column of the methodology table. Fix the P0 and the E0/STAGE_CODES P1s in the plan text and this becomes an A−.
```

---

## Round 2 — confirming re-review (skip-ahead in v1)

### Codex — grade C
```
Overall grade: C — not implementation-ready without one more plan revision.

P0

- Skip-ahead still reintroduces aliasing fragility. `codeSolid(u.err)` is code-wide, so mastering E1 in 1.6 can skip later E1 units across Stage 6 before those units are attempted. The plan explicitly acknowledges this unresolved case. [002-measured-placement-engine-plan.md:100-105,183]
- The claimed “three guards” do not prevent this: they exclude Stage 8 and `UNIT_PREREQ`, but not easy-vs-hard units within stages ≤7. [002-measured-placement-engine-plan.md:101-104,145]

P1

- A unit can be both locked and skippable. Example: E8 is solid while its E7 prerequisite is broken. `unitLocked()` is true, while `unitSkippable()` is also true. Placement happens to exclude both, but the plan does not define precedence or forbid this contradictory state. [002-measured-placement-engine-plan.md:93-99,143-146]
- A unit can be skipped before that unit itself has been measured. Code-level evidence is required, but evidence from another unit with the same code suffices. This is intentional for drill repeats, but the plan does not state that distinction clearly enough. [002-measured-placement-engine-plan.md:100-105]
- The grade math is internally inconsistent. The `+0.10` bonus applies to clean+aim encounters too, making the stated `s=0.92` actually `s=1.0` for `tries <= 1 && !revealed`. Four such encounters yield θ≈0.856, not ≈0.80. Three clean plus one `s=.08` fault yields roughly θ=.67–.71 depending on order, not ≈.72. [002-measured-placement-engine-plan.md:77-89,133-135]
- `gradeEncounter` is mostly implementable, but `clamp()` is referenced without definition, and the exact `theta()`, `nEff()`, `variance()`, and `codeProfile()` formulas are not specified. [002-measured-placement-engine-plan.md:82-88,127-131]

P2

- `recommend===null` handling is underspecified: `{ recommend }` has no representation for “recommend review” versus “all clear/free play.” [002-measured-placement-engine-plan.md:146-148]
- Decision 7 says skip thresholds are robust, while Open Questions says they are uncalibrated and may need changing. That is acceptable as a hypothesis, but the plan should label the threshold as provisional consistently. [002-measured-placement-engine-plan.md:74-89,183]
- The ramp claim is correctly softened from fake certainty to a hypothesis; this prior finding is closed. [002-measured-placement-engine-plan.md:187]

Prior findings

- (a) Unit-status/code-alias P0: partially closed. Explicit predicates replace the undefined `unitStatus`, but aliasing remains for E1 and other shared codes.
- (b) Latency-off never solid: closed mathematically; clean evidence crosses 0.75.
- (c) Wrong `STAGE_CODES` / nonexistent E4: closed. Runtime derivation excludes E0 and does not hardcode E4. [002-measured-placement-engine-plan.md:106,172]
- (d) E0 parks Continue: closed in the plan; cleared-based advancement moves past 1.5. [002-measured-placement-engine-plan.md:107,146]
- (e) `gradeEncounter` unspecified: closed in principle, but its stated boundary numbers are wrong and helper formulas remain unspecified.
- (f) Stage-8 prerequisite over-gating 8.2/8.3: closed. Only 8.1 has `UNIT_PREREQ`; methodology confirms 8.2/8.3 are early side queues. [002-measured-placement-engine-plan.md:95-98; methodology.md:210-215,350-368]
- (g) “~15 min ramp” certainty: closed; it is now explicitly a hypothesis to measure. [002-measured-placement-engine-plan.md:187]

Cold start and null handling

- Cold start resolves to 1.1 by the stated placement sort and empty profile. [002-measured-placement-engine-plan.md:105,146]
- `recommend===null` is acknowledged and will not crash, but the UI/state contract for review versus all-clear needs tightening.

The clean+aim math does cross `THETA_HI=0.75` within four encounters under `LAMBDA=.92`; the remaining blocker is incorrect stated arithmetic plus unresolved within-stage code aliasing.
Overall grade: C — not implementation-ready without one more plan revision.

P0

- Skip-ahead still reintroduces aliasing fragility. `codeSolid(u.err)` is code-wide, so mastering E1 in 1.6 can skip later E1 units across Stage 6 before those units are attempted. The plan explicitly acknowledges this unresolved case. [002-measured-placement-engine-plan.md:100-105,183]
- The claimed “three guards” do not prevent this: they exclude Stage 8 and `UNIT_PREREQ`, but not easy-vs-hard units within stages ≤7. [002-measured-placement-engine-plan.md:101-104,145]

P1

- A unit can be both locked and skippable. Example: E8 is solid while its E7 prerequisite is broken. `unitLocked()` is true, while `unitSkippable()` is also true. Placement happens to exclude both, but the plan does not define precedence or forbid this contradictory state. [002-measured-placement-engine-plan.md:93-99,143-146]
- A unit can be skipped before that unit itself has been measured. Code-level evidence is required, but evidence from another unit with the same code suffices. This is intentional for drill repeats, but the plan does not state that distinction clearly enough. [002-measured-placement-engine-plan.md:100-105]
- The grade math is internally inconsistent. The `+0.10` bonus applies to clean+aim encounters too, making the stated `s=0.92` actually `s=1.0` for `tries <= 1 && !revealed`. Four such encounters yield θ≈0.856, not ≈0.80. Three clean plus one `s=.08` fault yields roughly θ=.67–.71 depending on order, not ≈.72. [002-measured-placement-engine-plan.md:77-89,133-135]
- `gradeEncounter` is mostly implementable, but `clamp()` is referenced without definition, and the exact `theta()`, `nEff()`, `variance()`, and `codeProfile()` formulas are not specified. [002-measured-placement-engine-plan.md:82-88,127-131]

P2

- `recommend===null` handling is underspecified: `{ recommend }` has no representation for “recommend review” versus “all clear/free play.” [002-measured-placement-engine-plan.md:146-148]
- Decision 7 says skip thresholds are robust, while Open Questions says they are uncalibrated and may need changing. That is acceptable as a hypothesis, but the plan should label the threshold as provisional consistently. [002-measured-placement-engine-plan.md:74-89,183]
- The ramp claim is correctly softened from fake certainty to a hypothesis; this prior finding is closed. [002-measured-placement-engine-plan.md:187]

Prior findings

- (a) Unit-status/code-alias P0: partially closed. Explicit predicates replace the undefined `unitStatus`, but aliasing remains for E1 and other shared codes.
- (b) Latency-off never solid: closed mathematically; clean evidence crosses 0.75.
```

### Claude — grade B
```
Re-review complete. I verified the revised plan against the working tree, HEAD, methodology.md, and the archived cross-agent findings, and hand-computed the θ trajectories. Full write-up saved to the plan file; here it is.

## Skip-ahead math — decision 7 holds, with one untested path

Under `a=a·0.92+s, b=b·0.92+(1−s)`, prior `{a:1,b:1}`, θ=a/(a+b):

- **clean+aim (s=0.92):** θ = 0.648 → 0.723 → **0.769** → **0.799**. Crosses 0.75 at encounter 3; margin ≈0.05 at N_SKIP=4. The plan's claims (plan:89, plan:135) are **arithmetically correct**.
- **3 clean + 1 stumble:** θ ≈ 0.70–0.72 regardless of order → does not trip skip. Correct.
- **4 fault+reveal (s=0.08):** θ=0.20, below THETA_LO by encounter 2. Correct.
- **Untested: clean-without-aim (s=0.80)** → θ=**0.770** at 4 encounters — margin **0.02**, the same knife-edge the revision claims eliminated, resurrected on the no-aim path. The Phase 2 verification (plan:135) only tests clean+aim.

## Findings

**P0 — none.**

**P1-1 — plan:49 — the "Ground truth" table is wrong for stage 2, hiding a live misfire.** It says stage 2 = "E7, E6, E6"; actual (`wordbreak_v2.html:339–409`, same at HEAD) is 2.1 E7, 2.2 E6, **2.3a E3**, 2.3b/2.3c/2.4 E6 — six units. Consequence the plan never sees: clean stage-1 E3 play (1.2 + 1.3 = 8 encounters) makes **2.3a — the 1-1-1 doubling rule, a different and harder skill** — skippable. This is the exact class of "verified table is wrong" error rev 1 was graded down for.

**P1-2 — plan:101 vs plan:183 — the aliasing contradiction; E1 misfire is live.** Decision 8 claims "three guards neutralize the aliasing hazard"; the open-questions section admits they don't, naming the E1 case itself. Concretely: 4 clean+aim words on **1.6** (bird/turn/fern/curl — the easy /er/ *preview*, `wordbreak_v2.html:313`) → codeSolid(E1) → **6.1, 6.2, 6.4, 6.5 skippable** — nearly the whole schwa cure kit, the core curriculum for the target kid, waived off four preview words. Only st≤7 guards exist; none applies. Fix is one decision: preview units don't feed codeSolid, or skip only within stages ≤ where the code was measured, or add stage 6 to never-skip.

**P1-3 — plan:70/101 — "drill repeats" mischaracterizes the E7 skip.** Clean 1.1 (sunset/anthill) skips 2.1, 3.1–3.3, 4.1–4.7 — 11 units including 2.1, which the curriculum itself calls "the single most important idea in the system" (`wordbreak_v2.html:341`), plus the seam-rule and Latin-root *lessons* (skip is unit-level, so docs are skipped too). Codes are ordered easy→hard, so θ is always measured on the easiest exemplar of what it waives. Skip-ahead is your settled call and the map stays open — but the plan should state that trade honestly, not label these repeats. (8.1 guard verified correct; 8.2/8.3 are safe via st≤7.)

**P2s:** clean-no-aim boundary untested (above); `theta()/nEff()/variance()` formulas never inlined at plan:128 (θ=a/(a+b) only recoverable from the worked numbers — one line each closes it, matters since the spec is un-checked-in); `UNIT_PREREQ["8.1"]=["E5","E1","E2"]` contradicts its own "needs 4+5+6" comment and methodology.md:217 — no stage-4 code, so E8-broken never locks 8.1; **all line refs match HEAD but the staged plan-001 audio work adds 51 lines before L763, so every citation goes stale on commit**; "≈6–8 units" ramp is ~10 before stage 8 even under the plan's own mechanics (labeled hypothesis, so tolerable).

## Prior findings a–g

(a) **closed in text** — the full predicate stack is specified at plan:143–146; residual is P1-2/P1-3. (b) **closed** — verified numerically. (c) **closed** — CODE_PREREQ covers all 11 real codes, E4 confirmed absent everywhere, STAGE_CODES derived and observer-only. (d) **closed** — decision 10 plus an explicit never-parks-on-1.5 verification. (e) **closed modulo the theta one-liners** (P2). (f) **closed** — only 8.1 gated, matching methodology.md:214–217, with the P2 comment/list mismatch. (g) **closed** — hypothesis + acceptance test.

Direct answers: cold start resolves to 1.1 (both predicates require `P.codes[c]` to exist); `recommend===null` handled at plan:146; a unit *can* be locked-and-skippable simultaneously (6.1 with E8 broken + E1 solid) but placement excludes both — benign; a unit can be skipped without its own words ever being played, which is precisely the aliasing findings.

## Grade: **B**

This is a genuine revision, not a claim-wash — the math checks out, four of seven priors are cleanly closed, phases 1–2 remain A-grade. What blocks A−: a new factual error in the very table labeled "Verified from UNITS" (concealing the E3 misfire), and a decision-8 "neutralized" claim the plan's own open questions contradict, with two live cases. All three P1s are plan-text-sized fixes — one table row, one guard decision, one honest paragraph. Fix those and it's implementation-ready at A−.
```

## Round 3 — outside expert (human), on the difficulty-monotone skip revision

Reviewed the skip-ahead revision. Praised the shape (re-read the live file, additive-to-`P` with a kill switch, 48-literal verification catching the `2.3a` gap, cold uniform priors, and the monotone rule as a non-obvious fix). Two concrete bugs the cross-agent rounds missed, plus one conceptual limitation to state.

**Bug 1 — clean-no-aim θ is wrong, and it breaks a verification step.** Decision 7 claimed `s=0.80` reaches θ≈0.770 at `seen=4` (margin +0.02). Actual recurrence `a=a·0.92+s, b=b·0.92+(1−s)` from `a=b=1`:
```
seen1: a=1.720 b=1.120 θ=0.606
seen2: a=2.382 b=1.230 θ=0.659
seen3: a=2.992 b=1.332 θ=0.692
seen4: a=3.552 b=1.425 θ=0.714   ← not 0.770
```
θ→0.80 asymptotically; crosses THETA_HI=0.75 only ~`seen=8`. Margin is −0.036, not +0.02; Phase 2's third verification ("solidifies with margin by seen=5") fails as written. The `s=0.92` and fault numbers re-trace correct. Fix strengthens the thesis: bare-correct should ramp slower than aimed-correct.

**Bug 2 — string-sorting ids mis-orders stage 4.** "Compare `[st, id]`" with `id` a string: lexically `"4.10" < "4.11" < "4.12" < "4.13" < "4.2"`, so after 4.1 clears, `recommend` points at 4.10 and skips 4.2–4.9. The letter-suffix case was flagged but not the double-digit one — same "don't string-sort ids" root, in the biggest stage. Key must be `[st, parseInt(minor), suffix]`.

**Conceptual (state, don't fix in v1).** No compensation-detection; one-θ-per-code is the ceiling. Zeroing latency removes the only signal separating fluent from grind-to-correct (the Luca rationale) — acceptable under the "any kid" reframe but should be conscious: v1 scores grind-to-correct with correct aim like fluent, so the profile over-measures for a compensating kid. And E1 bundles three skills; the monotone rule protects across stages but **not within one** — solid-on-6.2-anchor can get 6.4/6.5 skipped. *"No threshold tuning fixes it — the codes are error-surface buckets, not skill units."* Within-stage lateral skip is where real mis-skips come from.

**Open-questions guidance (worked in priority order):** (1) skip thresholds — don't tune abstractly; ship in shadow (log would-fire), bias hard toward under-skip (asymmetric cost: over-skip = invisible gap, under-skip = visible self-correcting replay). (2) review-priority blend — do early, ordering only (sort due by θ ascending), never the interval; highest-value v2 item, ahead of latency. (3) latency — not a general signal; make it a separate opt-in diagnostic mode for known grinders, per-prompt-kind baselines. (4) ramp — instrument, measure the no-aim path separately (per bug 1 it plays more). (5) router — defer hardest; floating codes as a per-code flag; pull forward only surfacing E10/E11 as early side-quests.

**Resolution in the plan (this revision).** Both bugs fixed (θ trace corrected + `N_SKIP`→`N_SOLID`; numeric `idKey` sort). The conceptual limitation is decisive: because within-stage lateral aliasing is unfixable by tuning, and methodology says "**never skip the machinery**" (Part II 219/243/363), **unit-skipping is retired entirely — v1 uses fast-pass** (a solid-code unit clears on one clean word but is never hidden). That dissolves the aliasing class rather than guarding it, and turns the whole skip-threshold question into a low-stakes fast-pass-trigger calibration (shadow + conservative, per guidance 1). The expert's guidance 2–5 are folded into the reprioritized Open questions. Not yet re-reviewed as fast-pass.
