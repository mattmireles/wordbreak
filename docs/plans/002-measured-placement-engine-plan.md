# Plan 002 — Measured placement engine (the estimation half)

## Goal

Give Wordbreak a **measured** front door: instead of the static "begin with stage 1"
directory, a single **Continue** button that computes the next unit and drops the kid
straight in. This ships the *estimation* half of the Estimation & Scheduling Engine
spec — a per-error-code ability profile (`P.codes`) that **gates progression, fast-passes
mastered units, and names the frontier** — for **any kid**, cold, with no kid-specific priors. The
spaced-retrieval half (`P.sched`, `scheduleWord`, `dueList`, review mode) already
shipped and is **not** rebuilt here.

## Context

- Product frame and the "feels like a directory" problem this fixes: [README.md](../../README.md) §6, §8
- Diagnosis, the E1–E11 taxonomy, and the human-authored placement router the engine operationalizes: [methodology.md](../../methodology.md) Part I (codes) + Part II ("Placement diagnostic (the router)", lines ~186–222)
- Neighboring plan for local style: [docs/plans/001-pregenerated-kokoro-audio-static-plan.md](001-pregenerated-kokoro-audio-static-plan.md)
- The Estimation & Scheduling Engine v1 spec lives in the design thread and is **not checked in**; its grade function is therefore inlined in Phase 2 below (Design decision 7) so an implementer needs nothing outside this repo.
- **Review provenance:** cross-agent reviewed twice, then by an outside expert. Round 1 (Codex C / Claude C+) surfaced the placement P0; round 2 (Codex C / Claude B), after skip-ahead was pulled into v1 per the user's call, proved the guards were still incomplete (E1-preview → schwa-frontier aliasing) and found a factual error in the unit table, closed with a difficulty-monotone skip rule. **Round 3 (outside expert)** found two bugs the agents missed — a wrong clean-no-aim θ (0.714, not 0.770, at `seen=4`) and a string-sort that mis-orders stage 4 (`"4.10" < "4.2"`) — and independently confirmed that *within-stage* lateral aliasing is unfixable by threshold tuning because codes are error-surface buckets, not skill units. That, plus methodology's "**never skip the machinery**" (Part II, lines 219/243/363), retired unit-skipping altogether: **v1 now uses fast-pass** (a solid-code unit clears on one clean word but is never hidden — decision 8), which dissolves the aliasing class instead of guarding it. Raw findings archived at [docs/notes/plan-002-cross-agent-review.md](../notes/plan-002-cross-agent-review.md).

### What already exists (do NOT rebuild)

Re-reading the live file changed the scope. These spec sections are already implemented:

| Spec section | Status in `wordbreak_v2.html` | Symbol |
|---|---|---|
| §1.1 per-word error code | **Done** — boot-time backfill `w.err = w.err \|\| u.err \|\| "E0"` | `resolveErrCodes()` L771 |
| §5 spaced-repetition due-queue | **Done** — Leitner boxes, not SM-2 | `P.sched`, `scheduleWord()` L774, `dueList()` L787, `BOX_DAYS=[1,3,9,21,45]` L763 |
| §6 review session | **Done** — DUE FOR REVIEW card + review mode | `startReview()`/`reviewNext()`/`finishReview()` L907–912, DUE card L846 |
| Enriched log (`err`) | **Partial** — log carries `{t,unit,word,clean,aim,solve,err}` | `logWord()` L1118, `P.log.push` L1125 |

### What is missing (this plan)

- §1.2 **latency capture** — no `S.tShown` / `S.latency`; log has no `latency`/`tries`/`revealed`.
- §2–3 **measured ability profile** — `ERR_WEIGHT` (L767) is a *static hand-set* weight, not a measurement. There is no `P.codes`, no `gradeEncounter`, no `updateCode`, no decay. The engine currently measures nothing about the kid's per-code ability.
- §4 **placement / front door** — no `placement()`, no prereq gating, no `unitStatus`. Home still hard-codes "begin with stage 1" (L857), still auto-expands stage 1 (`openStage:1`, L810). No Continue button.

### Ground truth: how units are actually tagged (the reviewers' central finding)

Codes are **not stage-exclusive**, so any hardcoded stage→code map is both wrong and fragile. Verified from all **48** unit literals (including letter-suffixed ids like `2.3a`, which a naive `id:"N.N"` grep misses — the error that made the first draft's stage-2 row wrong):

| Stage | Units → `u.err` |
|---|---|
| 1 | 1.1 E7 · 1.2 E3 · 1.3 E3 · 1.4 E6 · **1.5 E0** · 1.6 E1 · 1.7 E11 |
| 2 | 2.1 E7 · 2.2 E6 · **2.3a E3** · 2.3b E6 · 2.3c E6 · 2.4 E6 |
| 3 | 3.1–3.3 E7 |
| 4 | 4.1–4.7 E7 · 4.8–4.13 E8 |
| 5 | 5.1–5.6 E5 |
| 6 | 6.1 E1 · 6.2 E1 · 6.3 E2 · 6.4 E1 · 6.5 E1 |
| 7 | 7.1–7.4 E9 · **7.5 E8** |
| 8 | 8.1 E7 · 8.2 E11 · 8.3 E10 |

Consequences that shape the design: codes **alias across difficulty tiers** — E7 spans stages 1–4 + 8 (easy compounds → monster words), E3 spans 1 → 2 (letter names → the 1-1-1 doubling rule), E1 spans 1 → 6 (the easy /er/ *preview* → the schwa cure kit that is the whole point of the tool). The aliasing is worse *within* a stage than across it: one θ per code is shared by units that are genuinely different skills — 5.1 (assimilation *concept*) vs 5.6 (boss-words `accommodate/embarrass`); 2.2 (plurals) vs 2.4 (`-ed`); 6.2 (the schwa *anchor* move) vs 6.4/6.5 (`-able/-ible`, `-er/-or/-ar`). Because codes are **error-surface buckets, not skill units**, no threshold tuning separates these — so any unit-skipping scheme has an irreducible mis-skip. **E4 exists in no unit** (never measurable — must not appear in any map); **E0 is a real unit** (1.5), not just a fallback. This is why v1 uses **fast-pass**, not skip (decision 8): a mastered-looking unit clears fast but is never hidden, so the aliasing simply cannot cause a missed lesson. The "stage → representative code" model is abandoned.

### Constraints that survive a "why"

- **One HTML file, vanilla JS, no build, no deps, no network after load** (README §9). The engine stays in-file.
- **Additive to `P` only.** Never rewrite `P.docs` / `P.cleared` / `P.log` / `P.sched`. localStorage key stays `wb2`. This plan only *adds* `P.codes` (and, if used, `P.speed`). Deleting those keys must reset cleanly to a cold profile with zero loss to existing progress.
- **Do not destabilize the shipped SRS.** v1 leaves `scheduleWord` (driven by the `firstClean` boolean) and `dueList`'s static `ERR_WEIGHT` ordering untouched. The new continuous score `s` feeds the *profile* only, not the review interval. Blending `s` into the SRS is explicitly v2.
- **Placement highlights, never gates the map.** Every stage stays openable from the browse view. A wrong recommendation costs one tap, not a locked door. (Prereq "locking" below governs only what *Continue auto-recommends*, never what the kid can manually open.)
- **No timer, no points, no score shown to the kid** (README §7). Latency is an internal signal; θ bars live on the *observer* screen only. The kid sees CLEARED/LEARNED and the Continue button — never a number rating them.

### Design decisions (settled)

1. **Any kid, not one named kid.** The tool greets an unknown kid; the frontier is genuinely unknown, so it must be *measured*, not assumed.
2. **Cold uniform priors. No kid-priors.** No seeding "this kid is past stage 1–3." The only structural prior is the **prerequisite graph** (a fact about English, not about the kid).
3. **Cold start ⇒ Continue = 1.1; advancement is cleared-based, with *fast-pass* (never skip) for mastered codes.** No kid-prior + no cold-start probe ⇒ everyone begins at 1.1. Continue always points at the lowest uncleared, unlocked unit in order — it never hides one. When a unit's code is already measured solid, that unit **fast-passes**: it clears on a single clean word instead of its full set (decision 8), so a strong speller blows through mastered content without grinding, yet still sees every lesson and types at least one word of every unit. This honors methodology's "fast pass if clean; **never skip the machinery**" (Part II, line 219) and Stage 2 being "mandatory for everyone" (line 243). Expected ramp is therefore measured in *words played* (~1 per solid unit), not units skipped; the number is a hypothesis to instrument against a real kid (Open questions), not a promise. The one skip methodology *does* sanction — whole-Stage-1 when decoding is above grade level — needs an intake decoding probe v1 deliberately lacks (decision 2), so it stays v2.
4. **Latency down-weighted to zero in v1, and reframed as a *targeted* signal, not a general one.** It is the noisiest signal here — attention-variable kids, and (Claude) it isn't even comparable across prompt kinds (`"say"` words need ▶-clicks first; `"build"` prompts show the parts on screen). Deeper (outside expert): latency was the *only* signal that separated fluent from grind-to-correct — the original Luca-specific rationale — and compensation-detection barely matters for the median kid but matters enormously for a known grinder. So latency does not belong on the general "any kid" path at all; its grade weight is literally `0` in v1, and its proper future home is a **separate opt-in "grinder diagnostic" mode** with per-prompt-kind baselines (Open questions), not a term folded into everyone's θ. `clean`/`aim`/`tries`/`revealed` carry the v1 score. Latency is still captured in Phase 1 so that mode can be built later. Note that `aim` already does *partial* fluency-separation that survives latency being off: a kid who flags the right byte before executing scores high, one who patches after a reveal scores low — see decision 7's aim/no-aim split, and the known-limitation in decision 11 for what `aim` still cannot catch.
5. **`seen` from a monotonic counter, not a log scan.** `P.log` rolls at `LOG_CAP=500`; counting encounters by scanning it lets `seen` *decrease* and flip a unit's status for no reason the kid caused. Keep the count in `P.codes[code].seen`.
6. **Backfill feeds `updateCode` only.** Replaying `P.log` to warm the profile must NOT call `scheduleWord` (SRS already ran; replay would poison `due` timestamps off `Date.now()`). Gate it behind a one-time `P.codesV` version marker so it runs exactly once. Missing `latency` on old events is a non-issue in v1 (latency weight is 0).
7. **The grade function is inlined and tuned so it works with latency OFF (resolves the coupling the reviewers found).** With latency zeroed, the spec's "clean base 0.70" asymptotes θ→0.70 and never crosses `THETA_HI`, so nothing would ever measure "solid." v1 therefore uses these constants, chosen so clean play lands well above `THETA_LO` and sustained faults land below it — the only two boundaries v1 relies on:

   ```
   const clamp = (x) => Math.max(0, Math.min(1, x));
   function gradeEncounter(e){          // e = enriched log event
     if (e.clean) return e.aim ? 0.92 : 0.80;   // clean build: no patch ever occurred, so
                                                //   the tries/reveal bonuses below cannot apply
     let s = e.aim ? 0.30 : 0.15;               // faulted build:
     if (e.aim && e.tries <= 1 && !e.revealed) s += 0.10;  // self-patched in one
     if (e.revealed)                           s -= 0.07;  // needed the answer shown
     return clamp(s);
     // latency term DISABLED in v1 (LAT_W=0). When enabled it nudges ±LAT_W among CLEAN builds only.
   }
   // read-models on P.codes[c] = {a,b,seen}:
   const theta    = (c) => P.codes[c].a / (P.codes[c].a + P.codes[c].b);
   const nEff     = (c) => P.codes[c].a + P.codes[c].b;
   const variance = (c) => { const a=P.codes[c].a, b=P.codes[c].b, n=a+b; return (a*b)/(n*n*(n+1)); };
   ```
   The early `return` for clean builds makes the `+0.10`/`−0.07` bonuses unambiguously fault-only (a clean build has no patch, so they never applied — the first draft's indentation left this misreadable).
   Constants block: `LAMBDA=0.92`, `THETA_LO=0.40`, `THETA_HI=0.75`, `N_GATE=3`, `N_SOLID=4`, `LAT_W=0`. (`N_SOLID` is the encounter floor for `codeSolid`, which gates fast-pass — renamed from `N_SKIP` now that nothing is skipped.)
   `THETA_HI=0.75` (not the spec's 0.85) gives a workable margin. **Traced numerically** (`a=a·0.92+s, b=b·0.92+(1−s)` from `a=b=1`):
   - **clean+aim (`s=0.92`):** θ = 0.648 → 0.723 → 0.769 → **0.799** at `seen=4` (b converges to exactly 1.0; margin ≈0.05). Fast-passes at 4 encounters.
   - **clean-no-aim (`s=0.80`):** θ = 0.606 → 0.659 → 0.692 → **0.714** at `seen=4` — **below** `THETA_HI`; it crosses 0.75 only at ~`seen=8` (fixed point 0.80, approached slowly). *This corrects the round-2 caveat, which wrongly claimed θ≈0.770 at `seen=4`.*
   - **one stumble in a clean run:** θ ≈ 0.67–0.72, `codeSolid` false.

   The corrected no-aim curve is **on-thesis, not a defect**: fast-pass should lean on *demonstrated aim* (the core skill), so a bare-correct kid fast-passes at ~8 encounters while a fluent one does at 4 — the estimator naturally throttles fast-pass for grinders even with latency off. Phase 2 verifies both curves at their real values. These thresholds are provisional pending real-play calibration; per the expert, **ship the fast-pass trigger in shadow and bias conservative** (see Open questions).

8. **Placement model = cleared-based advancement + measured prerequisite gating + measured fast-pass.** Continue never hides a unit; the profile only changes *where* the frontier is (locking) and *how fast* a mastered unit clears (fast-pass). Three layers:
   - **Advancement (what Continue points at):** the lowest-stage, lowest-id *uncleared, unlocked* unit. `P.cleared` drives order; there is **no "skippable" term**. **Sort ids numerically, never as strings** — the key is `[u.st, parseInt(minor,10), suffix]` where `minor`/`suffix` split the part after the dot (`"4.10"→10,""`; `"2.3a"→3,"a"`). String compare gives `"4.10" < "4.2"`, which would route Continue past 4.2–4.9 after 4.1 clears (round-3 bug); the numeric key fixes both the double-digit and the letter-suffix cases.
   - **Gating (lock — measured-low):** a unit is **locked** iff its code's *prerequisite code* measures broken (`seen ≥ N_GATE && θ < THETA_LO`). Prereqs are **code-level**, from methodology's entry rules — not a stage grab-bag (which would let a schwa fault in stage 1 lock stage 2):
     ```
     CODE_PREREQ = { E8:["E7"], E5:["E8"], E1:["E8"], E2:["E8"], E9:["E7"] }
     UNIT_PREREQ = { "8.1":["E8","E5","E1","E2"] }  // monster decomp needs stages 4+5+6 —
                                                    // E8 is stage 4's hard code (E7 alone is too easy)
     // codes with no entry (E7,E3,E6,E10,E11,E0) have no prerequisite
     ```
     A locked unit is never the Continue target, whatever its own θ. A kid who breaks E7 can't be auto-routed into E8/E5/schwa units. Locking is conservative — it bites only on *measured-low* evidence, never on absence.
   - **Fast-pass (measured-high) — the aliasing-proof replacement for skip.** Skip was retired because one θ per code aliases across *and within* difficulty tiers, and codes are error-surface buckets, not skill units (Ground truth; round-3 expert): no rule cleanly decides which same-code unit is safe to *hide* (clearing 5.1 must not waive 5.6 boss-words; solid-on-6.2-anchor must not waive 6.4/6.5). Fast-pass sidesteps the question entirely by **never hiding a unit** — it only lowers the clear bar:
     ```
     codeSolid(c) = P.codes[c] && P.codes[c].seen >= N_SOLID && theta(c) >= THETA_HI
     fastPass(u)  = !P.cleared[u.id] && !unitLocked(u) && u.err !== "E0" && codeSolid(u.err)
     ```
     When Continue opens a `fastPass` unit, its run clears on **one clean word** instead of the full set; the docs/lesson and ≥1 word are always shown. Worst case (a mis-measured "solid" code) is one easy word the kid can see is trivial — a *visible, cheap* error, never the invisible missed-lesson that skip risked. Fast-pass is a **run-flow modifier, not a placement filter**: `placement()` stays simple (lowest uncleared unlocked unit); only the clear-condition inside the run consults `fastPass`. No `maxClearedStage`, no `unitSkippable`, no new persisted state.
   - **Cold profile → nothing cleared, nothing solid → nothing locked, nothing fast-passes → Continue = 1.1, full clear bar everywhere.**
9. **`STAGE_CODES` is derived from `UNITS` at runtime, never hardcoded** (`unique u.err per stage, excluding E0`). This keeps E4 out (it exists nowhere) and survives curriculum edits. Used only for the observer view and v2; v1 routing uses `CODE_PREREQ`/`UNIT_PREREQ` above.
10. **E0 is excluded from the θ profile but its units still advance via `P.cleared`.** E0 (unit 1.5) never enters `P.codes`, so it can never be "solid" (and never fast-passes) — but because advancement is cleared-based (decision 8), Continue lands on 1.5, the kid plays it once, `P.cleared["1.5"]` is set, and Continue moves on. No permanent park (the failure Claude flagged).
11. **Known limitation, stated consciously: v1 has no compensation-detection; one-θ-per-code is the ceiling.** Zeroing latency (decision 4) removes the only signal that separated *fluent* from *grind-to-correct* — the original Luca-specific rationale. `aim` recovers part of it (flag-the-right-byte vs patch-after-reveal), and the corrected no-aim curve (decision 7) makes a bare-correct kid fast-pass slower — but a kid who **aims correctly yet grinds slowly** still scores like a fluent one, so for that kid the profile over-measures and fast-passes a touch eagerly. Fast-pass makes even that cheap (one visible easy word, never a hidden gap). This is an accepted v1 boundary for the "any kid" reframe; the honest fix is the opt-in grinder-diagnostic mode (decision 4, Open questions), not a v1 tweak.

## Phases

### Phase 1 — Latency capture + enriched log

Small, silent, no behavior change. Prerequisite for the profile. **A-grade as drafted per both reviewers.**

- [ ] `startWord()` (L913): add `S.tShown = Date.now(); S.latency = null;`
- [ ] `commitTyped()` (L956): `if(S.latency==null) S.latency = Date.now() - S.tShown;` (the TYPE→FLAG submit; there is no re-commit path, so "first commit" is unambiguous).
- [ ] `logWord()` (L1125): extend the `P.log.push({...})` object with `latency:S.latency, tries:S.patchTries, revealed:S.reveal`. (`err` already present.)
- [ ] Add `tShown`/`latency` to the `S={...}` initializer (L810).

**Verification:** play 3–4 words; in DevTools inspect `P.log.slice(-4)` — every event has numeric `latency`, integer `tries`, boolean `revealed`, real `err`. No visible UI change.

### Phase 2 — The measured ability profile (`P.codes`), shadow

Add the estimator. Nothing in the UI depends on it yet — verifiable in isolation. **A-grade as drafted, with the tuned constants from decision 7.**

- [ ] Init: `P.codes = P.codes || {};` and `P.codesV = P.codesV || 0;` near the other `P.*` initializers (~L183). Codes created lazily at `{a:1,b:1,seen:0}` on first encounter (uniform prior, monotonic `seen` — decision 5).
- [ ] `gradeEncounter(e)`: exactly the inlined function in decision 7 (latency weight 0).
- [ ] `updateCode(code, s)`: decayed Beta — `a=a*LAMBDA+s; b=b*LAMBDA+(1−s); seen++`. `theta`/`nEff`/`variance`/`clamp` are inlined in decision 7; `codeProfile()` = map over `P.codes` → `{code, theta, nEff, seen, band}` where `band` is `measuring` (`seen<N_GATE`) / `weak` (`θ<THETA_LO`) / `solid` (`θ≥THETA_HI`) / `frontier` (else).
- [ ] `onEncounter(e)`: `if(e.err==="E0")return;` then `gradeEncounter → updateCode → saveP`. Called from the end of `logWord()`, after `scheduleWord(...)`. **Review-mode and module encounters both flow through `logWord`, so both feed the profile — this is intended: it is the §7 closure (a review lapse re-enters the profile and can re-open a stage).**
- [ ] One-time **backfill** on load: `if(P.codesV < 1){ replay P.log through updateCode only (skip E0/unresolvable); P.codesV = 1; }` (decision 6).
- [ ] All tunables in one commented block (decision 7 constants).

**Verification (both boundaries, both clean paths, the decoupling check):** console harness —
- **Lock boundary:** 4 fault+reveal (`s≈0.08`) → `theta()` ≈0.20, **below `THETA_LO=0.40`** (arms lock).
- **Fast-pass boundary (aim):** 4 clean+aim (`s=0.92`) → `theta()≈0.799 ≥ THETA_HI=0.75`, `seen==4` → `codeSolid` true (unit fast-passes at 4 encounters).
- **Fast-pass boundary (no aim):** 4 clean-no-aim (`s=0.80`) → `theta()≈0.714` — **below** `THETA_HI`, so `codeSolid` **false** at `seen=4`; confirm θ rises monotonically toward its 0.80 fixed point and crosses 0.75 only at ~`seen=8`. Intended: bare-correct fast-passes later than aimed-correct (decision 7).
- **Decoupling:** 3 clean+aim + 1 fault → `theta()≈0.67–0.72 < 0.75` → `codeSolid` **false** (a single stumble must not trip fast-pass).
- **Saturation:** `nEff()` saturates ≈12.5, never hits 0.
- **Backfill:** reload with a non-empty `P.log` → profile seeds once (`P.codesV==1`) without touching `P.sched`.

### Phase 3 — Placement + the Continue button (the front door)

The visible payoff. Cleared-based advancement + measured prereq gating + fast-pass (decision 8); demote the directory. **This phase carries the reviewers' P0 fix — build it exactly to decision 8.**

- [ ] Implement `CODE_PREREQ` + `UNIT_PREREQ` (decision 8), `codeBroken(c) = P.codes[c] && P.codes[c].seen>=N_GATE && theta(c)<THETA_LO`, and `codeSolid(c) = P.codes[c] && P.codes[c].seen>=N_SOLID && theta(c)>=THETA_HI`.
- [ ] `unitLocked(u)`: `false` if `u.err==="E0"`; else any prereq code (from `UNIT_PREREQ[u.id]` ?? `CODE_PREREQ[u.err]` ?? `[]`) is `codeBroken` → `true`.
- [ ] `idKey(u) = [u.st, parseInt(u.id.split(".")[1],10), u.id.split(".")[1].replace(/^\d+/,"")]`. **Sort/compare units by `idKey`, never by the raw id string** (else `"4.10" < "4.2"` mis-routes stage 4 — round-3 bug); handles both double-digit minors (4.10–4.13) and letter suffixes (2.3a).
- [ ] `placement()` → `{ recommend, mode }` where `mode ∈ {"unit","review","allclear"}`. `recommend` = the `idKey`-lowest unit with `!P.cleared[u.id] && !unitLocked(u)` → `mode:"unit"`. Cold ⇒ `1.1`. If none uncleared/unlocked: `dueList().length>0` → `{recommend:null, mode:"review"}`; else `{recommend:null, mode:"allclear"}`. **No skippable term — placement never hides a unit.**
- [ ] **Fast-pass lives in the run flow, not in `placement`:** read the existing clear logic (the `S.firstClean` / `P.cleared[id]=…` path through run→debrief) and gate it so that if `fastPass(u)` held **when the unit opened**, one clean word sets `P.cleared[u.id]`; otherwise the full-set bar as today. `fastPass(u) = !P.cleared[u.id] && !unitLocked(u) && u.err!=="E0" && codeSolid(u.err)` (decision 8). Snapshot `fastPass` at open (e.g. `S.fastPass`) so a mid-run profile change can't move the bar under the kid.
- [ ] `renderHome()` (L821): add a prominent **Continue** button opening `placement().recommend` (→ `openDocs` if `!P.docs[id]`, else `openRun`), labelled with the target, e.g. `▶ Continue — 4.1 · latin roots · learn`. Handle the `null` state.
- [ ] Replace the static START HERE copy (L857) with the Continue block. Keep the DUE FOR REVIEW card **above** it (review beats new — retention is the bottleneck, spec §6).
- [ ] Demote the 8-stage list to a collapsed "browse all stages" section; flip `openStage` default `1 → null` (L810). The map stays fully openable (constraint: highlight-never-gates). Optional: tint locked units, but keep them clickable.

**Verification:** (a) fresh `localStorage` → Continue = `1.1`, directory collapsed. (b) Clear 1.1–1.5 (incl. the E0 unit 1.5) → Continue advances to 1.6, **never parks on 1.5**. (c) *Id sort:* clear **4.1** → Continue = **4.2** (not 4.10); clear through 4.9 → **4.10** before 4.11/4.13; `2.3` sorts before `2.3a`. (d) *Lock:* force `P.codes.E7` low (`seen≥3, θ<0.40`) → E7-prereq units (4.8, 5.1, 6.1…) become `unitLocked`, Continue stays on the E7 frontier; raise E7 → unlock. (e) *Fast-pass:* force `P.codes.E7` solid, open **4.2** → one clean word clears it (Continue → 4.3); with E7 not solid, 4.2 needs its full set. (f) *No hidden units (the aliasing check):* force `P.codes.E1` solid, clear only 1.6 → Continue **still routes through 6.1, 6.2, 6.4, 6.5** (each fast-passes but is shown — none skipped); same for E5-solid not hiding **5.6**. (g) Every unit and every stage still opens from the map. (h) All-cleared → Continue shows `review`/`allclear`, not a crash.

### Phase 4 — Observer panel: surface the profile (auditability)

Make the measurement inspectable. Observer-only.

- [ ] In `renderDebrief()` (L1150): add a per-code block from `codeProfile()` — θ bar + `measuring`/`weak`/`solid` band (thin-evidence codes shown honestly as `measuring`). Group by derived `STAGE_CODES` (decision 9) or by θ.
- [ ] Label as the *observer's* dashboard (README §8); never on the kid's run/done flow, never as points/score.

**Verification:** open the session log after a few runs → per-code θ bars render, honest "measuring" on thin evidence, numbers move with play. Nothing new on kid-facing run screens.

## Hard requirements

- Additive to `P`; `wb2` unchanged; deleting `P.codes`+`P.codesV` resets to cold with existing progress intact.
- Shipped SRS untouched: `scheduleWord` stays `firstClean`-driven; `dueList` keeps `ERR_WEIGHT`; `s` feeds the profile only.
- Continue **recommends**; it never disables the map. Prereq locking constrains only the auto-recommendation; fast-pass changes only the clear bar — both leave every unit visible and manually openable.
- Cold uniform priors; no kid-priors; `CODE_PREREQ`/`UNIT_PREREQ` are the only structural prior.
- **Fast-pass never hides a unit.** A solid-code unit clears on one clean word, but its lesson (docs) and ≥1 word are always shown; nothing is skipped. No `maxClearedStage`/`unitSkippable`; `fastPass` snapshotted at unit open.
- Units ordered by numeric `idKey` `[st, parseInt(minor), suffix]`, **never string-sorted** (`"4.10" < "4.2"` would mis-route stage 4).
- Latency captured but weight 0 on the general path; never surfaced to the kid; reserved for a separate opt-in grinder-diagnostic mode (v2), not folded into everyone's θ.
- `seen` monotonic (in `P.codes`), not a log scan. Backfill runs once via `P.codesV`, `updateCode` only.
- E0 excluded from the profile; E0 units advance via `P.cleared` and never fast-pass.
- No hardcoded stage→code map; `STAGE_CODES` derived from `UNITS`; E4 never referenced.
- Profile is observer-only; kid surfaces show CLEARED/LEARNED + Continue.
- **Line numbers in this plan are as-of-current-HEAD and will drift** (e.g. executing plan 001 inserts lines before L763). Anchor edits on the named symbols (`startWord`, `commitTyped`, `logWord`, `renderHome`, `renderDebrief`, the `P.*` init block), not the cited line numbers.

## Rollback / kill switch

- Guard the recommendation behind `const PLACEMENT_ON` (default `true`). `false` → Continue falls back to "lowest uncleared, already-learned unit" (pure `P.cleared`, no θ), **fast-pass off** (full clear bar everywhere), and the old START HERE copy returns; map behavior unchanged. No data migration.
- The profile drives only the Continue target, the fast-pass clear bar, and the observer panel — never the SRS interval. Delete `P.codes`/`P.codesV` to reset the estimator cold; `P.docs`/`P.cleared`/`P.sched`/`P.log` untouched.
- Phases 1–2 are invisible to the kid and can ship and sit before Phase 3 flips the front door.

## Open questions

Ordered by when to work them (outside-expert's priority).

1. **Fast-pass trigger — calibrate in shadow, biased conservative (do first).** `THETA_HI=0.75` / `N_SOLID=4` were chosen for decoupling (decision 7), not calibrated — and guessing re-introduces the "assume from sparse data" failure this whole design rejects. Apply the plan's own placement discipline to its own trigger: **log when `fastPass` *would* fire without acting on it**, watch a few real sessions, then decide. Bias hard toward **under-triggering** — the cost is asymmetric: over-trigger is a too-easy replay the kid can *see* and self-corrects, while the invisible-gap failure is already gone (fast-pass never hides a unit). Set `THETA_HI`/`N_SOLID` higher than feels necessary until data says loosen.
2. **Review-priority blend — highest-value v2 item, ahead of latency; ordering only.** Sort `dueList()` by measured `theta(code)` ascending so the queue surfaces the *measured*-weakest code first. Strictly better than the hand-set `ERR_WEIGHT`, and low-risk **iff it touches only which item shows first, never the interval** (interval stays `firstClean`-driven — that coupling remains out of scope). Gate on the profile having accumulated real trajectories (i.e. after Phase 2 has run on real play).
3. **Latency activation — a targeted mode, not the general path.** Compensation-detection barely matters for the median kid and enormously for a known grinder, so don't fold latency into everyone's θ. Build it as a **separate opt-in "grinder diagnostic" mode** with per-prompt-kind baselines (separate ms/char medians for `"say"` vs `"build"`, compared only within-kind). Until then `LAT_W=0`. This is the honest home for the one signal that was always Luca-specific (decisions 4, 11).
4. **Strong-speller ramp — instrument both paths, don't defend a number.** After Phases 1–3, script a clean-fast run and *measure* words-played and where fast-pass engages — and measure the **clean-no-aim path separately**, since (decision 7) a bare-correct speller fast-passes ~4 encounters later per code and so plays meaningfully more. Confirm fast-pass never hides a unit (6.4/6.5 and 5.6 always appear in the Continue path).
5. **Router richness — defer hardest.** methodology's parallel/floating tracks (schwa Stage 6 once Stage 4 is underway; E9 after Stage 3; E10/E11 side queues from intake) are driven by intake diagnosis that v1 omits by design, and only become meaningful once θ names the dominant cluster — so they structurally follow Phase 2. When built, model floating codes (E9/E10/E11) as a **per-code flag**, not a rewrite. The one piece worth pulling forward: surface **E10/E11 as optional side-quests earlier than 8.2/8.3** (a kid throwing *their/there* errors shouldn't wait until stage 8) — a curriculum-sequencing call, not an engine one.
