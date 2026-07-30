# Plan 003 — Budgeted session compiler (one CTA: start)

## Goal

Collapse Wordbreak's front door to a **single verb**. Today the home screen exposes
four pressable surfaces (DUE card, Continue card, per-module `learn`, per-module
`practice`); a kid who skips everything optional treats "finished the lesson" as
"done." This plan replaces all of it with **one session**: press `▶ start`, and a
compiler assembles a **time-budgeted, frozen queue** of the highest-value work —
one frontier module first, then a small budget-bounded review dose, then any additional
frontier modules that fit, with
the lesson stitched seamlessly into the run, then a named-but-empty synthesis slot
— ending in the **only** screen in the product that says *done*. The budget
(default 10 min) is set by the observer and never shown to the kid as a clock.

## Context

- Product frame, anti-patterns (no timer theater, no points), observer role:
  [README.md](../../README.md) §3, §7, §8
- Spacing/interleaving mandate and the core loop the session must not disturb:
  [methodology.md](../../methodology.md) Part I ("The core loop", "What the
  research actually requires"), Part III (Phase 3 — Scheduler)
- The shipped machinery this plan **consumes but does not rebuild**: the Leitner
  due queue (`P.sched`, `scheduleWord`, `dueList`, `BOX_DAYS`), the measured
  profile (`P.codes`, θ, `codeSolid`/`codeBroken`), placement (`placement()`,
  `unitLocked`, `fastPass`, `idKey` ordering) — all from
  [docs/plans/002-measured-placement-engine-plan.md](002-measured-placement-engine-plan.md)
- Design conversation (this plan's origin): the two-CTA row (`learn`/`practice`)
  fails because it presents a sequence as a choice, and the target kid treats
  lesson-complete as done. The parent explicitly wants a short daily session and a
  **one-way-in** system. Requirements settled there: one entry point, budget as a
  parent-side parameter, module-before-review, module lessons flowing into runs with
  no boundary, session completion as the single "done," no padding when real work
  runs out (a short session is honest; theater is not).
- `curriculum.md` does not exist as a separate file — methodology.md Part II *is*
  the curriculum. (Noted so no implementer goes looking for it.)
- **Review provenance:** cross-agent reviewed by fresh Codex (`codex exec`,
  read-only) and Claude Code (`claude -p`, plan-mode) threads on the first draft.
  Codex C/D/C (2 P0, 7 P1); Claude A-/B-/B+ (1 P0, 4 P1). Every P0/P1 was
  verified against the live file and integrated below: the UTC session-day bug
  (both reviewers), the "uncapped" wording contradiction (Codex P0-1 → decision
  2's explicit contract), the non-atomic cursor/ledger replay hazard (Codex P0-2
  → decision 11), bonus-state and `P.sessions` lifecycle (both → decisions 7,
  Phase 4), the fast-pass strip divergence (Claude → decision 5), the missing
  run-screen quit control (Codex → Phase 2), `S`-flag lifecycle (Codex → Phase
  2), first-pass-rate data source (both → `P.session.stats`, decision 3), and
  the kid-reachable budget control (Claude → decision 8). Raw findings archived
  at [docs/notes/plan-003-cross-agent-review.md](../notes/plan-003-cross-agent-review.md).

### What already exists (do NOT rebuild)

| Piece | Status in `wordbreak_v2.html` | Symbol |
|---|---|---|
| Due queue + intervals | **Done** — Leitner, most-overdue-first, same-day guard | `scheduleWord()`, `dueList()`, `BOX_DAYS` |
| Review run mode | **Done** — borrowed-unit review flow | `startReview()`, `S.mode==="review"`, `cw()` |
| Placement + order | **Done** — cleared-based, numeric `idKey`, locks | `placement()`, `unitLocked()`, `cmpUnits()` |
| Fast-pass | **Done** — solid code ⇒ one clean word clears the unit | `fastPass()`, `S.fastPass` snapshot, `logWord()` |
| Lesson gate | **Done** — docs end in a typed commit; run requires `P.docs[id]` | `ketsuType()`, `openRun()` guard |
| Observer debrief | **Done** — log table + θ profile + watch-for list | `renderDebrief()` |

### What is missing (this plan)

- A **session object**: nothing today groups review + modules into one unit of
  work with one completion.
- A **budget**: `REVIEW_CAP=12` and the one-module Continue are hard-coded shapes;
  no parent-set time parameter exists.
- **Seam removal**: docs end at "✓ lesson learned. practice is open" +
  `start practice →` — a false finish line; per-module debrief after every run is
  another one.
- A **single completion state**: today "done" appears per-review-batch, per-module,
  and implicitly at lesson-end.
- **One-door home**: four pressable surfaces where one should be.
- A **quit affordance on the run screen**: `renderRun` exposes no home/pause
  control today (only the lesson screen has one) — the session's quit/resume
  contract needs it.

### Constraints that survive a "why"

- **One HTML file, vanilla JS, no build, no deps, no network after load** (README §9).
- **Additive to `P` only.** This plan adds `P.cfg`, `P.session`, `P.sessions`; it
  never rewrites `P.docs` / `P.cleared` / `P.log` / `P.sched` / `P.codes`.
  localStorage key stays `wb2`. Deleting the three new keys resets session state
  only, with zero loss to progress, schedule, or profile.
- **The SRS is untouched.** `scheduleWord` stays `firstClean`-driven; `dueList`
  keeps its ordering and return shape `{u,w,e}`; the same-day massed-repetition
  guard stays. The compiler is a *consumer* of `dueList()`, never a modifier of
  intervals.
- **The four-beat word loop is untouched.** TYPE → FLAG → EXECUTE → FORK/PATCH
  runs identically inside a session block (methodology core loop; README §3).
- **No clock, no minutes, no countdown anywhere the kid can see** (README §7 —
  speed rewards train the exact bug this tool exists to fix). The budget shapes
  what gets *compiled*; the kid sees only blocks. Minutes appear on observer
  surfaces only.
- **No padding.** When real work (due + frontier + synthesis) runs short of the
  budget, the session compiles short and says so honestly. Same-day re-drilling
  to fill a clock is prohibited — the interval guard already refuses to credit it,
  so it would be pure theater.
- **A module is atomic.** The compiler never schedules half a module. The last
  module may overshoot the budget estimate; overshoot is acceptable, truncation
  is not.

### Design decisions (settled)

1. **One unit of startable work: the session.** The home screen has exactly one
   primary action. Review, lessons, and runs are not startable on their own
   (kill-switch aside). "Complete" exists only at session scope.

2. **Compiler order — a visible win first.**
   `compileSession()` assembles blocks:
   - **First — one frontier module.** Append the `idKey`-lowest uncleared,
     unlocked unit. It may cross the budget because it is atomic: every session
     with frontier work visibly advances the map.
   - **Second — due reviews, maximum four.** Entries from `dueList()` keep their
     existing order (most-overdue-first, then error weight), but stop at either
     the budget or four blocks. A long absence is therefore resumable instead of
     becoming an assignment made entirely of old work; remaining entries carry
     to the next session.
   - **Third — additional frontier modules.** Append later units in
     `cmpUnits` order only when each fits the remaining observer-selected
     budget. Locks are respected at compile time; fast-pass-eligible units are
     estimated at their short length.
   - **Tier 3 — synthesis: a named, empty slot.** The compiler has the tier
     (`synthBlocks()` returns `[]` in v1) so the shape is real, but v1 ships no
     synthesis content — inventing transfer drills is its own design problem
     (Open questions). Until it ships, a kid past the frontier with a light
     queue gets a **short session**, not filler.

3. **Block model: work items plus display metadata, ledgers stay the truth.**
   `blocks: [{k:"rev", key, cells:1} | {k:"mod", id, cells}]` where `key` is a
   `P.sched` key built by a shared helper `schedKey(u,w) = u.id+"|"+w.a.toLowerCase()`
   (the exact construction `scheduleWord` uses — extracted so the compiler never
   duplicates it and `dueList`'s return shape stays untouched), and `cells` is a
   **compile-time display snapshot** (decision 5). Outcomes live in the durable
   ledgers exactly as today (`logWord` → `P.log`/`P.sched`/`P.codes`;
   `P.docs`/`P.cleared` on lesson/run completion). `P.session` holds
   `{day, budgetMin, blocks, idx, done, bonus, baseDone, stats:{words,clean}}` —
   a plan, a cursor, and a session-scoped tally; never a second source of truth
   for word outcomes. `stats` is incremented in `logWord` on the session path
   (words++, clean += firstClean) — it survives reloads, which neither `S.log`
   (reset by every `openRun`/`startReview`) nor a `P.log` tail-slice (capped,
   no session ids) can do; it exists because the session debrief needs a
   first-pass rate and those two sources cannot supply one.

4. **Frozen, and scoped to the local calendar day — not the SRS's UTC day.**
   The live `today()` is a UTC-day integer; UTC midnight lands mid-afternoon US
   time, which is fine for days-coarse intervals but would discard a paused
   session (or re-arm a completed one) at ~4–5pm local — prime homework hours.
   So: sessions are scoped by a new `localDay()` (day count from *local*
   midnight, e.g. `Math.floor((Date.now()-new Date().getTimezoneOffset()*60000)/DAY)`),
   used **only** for `P.session`/`P.sessions` scoping; `P.sched`/`scheduleWord`/
   `dueList` keep `today()` untouched. Rollover is enforced at the two entry
   points — home render and `startSession()` — never mid-block: a session open
   across local midnight finishes normally (its ledger writes are valid
   regardless), and the *next* return to home sees the stale day and recompiles.
   Compiled once at press-time; the queue never grows mid-session (a word missed
   today is *rescheduled for tomorrow* by the existing demotion, not
   re-appended). Same local day + `!done` ⇒ `▶ resume` re-enters at `idx`. A new
   local day discards any unfinished session and recompiles — safe because
   ledgers carry all durable state; an interrupted module run restarts at word
   0, exactly like quitting mid-run today. **Stale-block rule on entry** (a
   compiled block no longer actionable): skip and advance when — `rev`: the
   sched entry is missing, resolves to no unit/word, **or is no longer due**
   (`e.due > today()`, the case that actually occurs, since `scheduleWord`
   updates entries in place and never deletes); `mod`: the unit is already
   cleared.

5. **Seam removal — the load-bearing UX change.** In session flow, a `mod` block
   is docs (only if `!P.docs[id]`) flowing directly into the run:
   - `ketsuType()` success keeps setting `P.docs[id]`, but the advance button
     becomes a plain `next →` into the run — delete the `start practice →` label
     and the "✓ … practice is open" verdict line. Lesson-end must not read as a
     finish line.
   - Between session blocks there is **no per-module debrief**: `renderDone`'s
     session-mode CTA reads `next ▶` (or `session complete ▶` on the final
     block) and navigates to the already-advanced cursor (decision 11).
     `closeModule`'s debrief-per-module remains only on the legacy path.
   - One **session progress strip** spans the whole session, sized from the
     compile-time `cells` snapshot: a `rev` block is 1 cell; a `mod` block is
     unread-panel count + expected word count (1 word if `fastPass(u)` held at
     compile, else `u.words.length`). **The strip never changes length
     mid-session**, even when reality diverges — a fast-pass module that faults
     its first word runs the full set behind its allotted cells (the block's
     cells simply fill on completion), and a lesson read outside the session
     leaves its panel cells to fill with the run. Divergence changes pace, not
     length: the frozen presentation is the point, and the estimate error is
     minutes at worst. Cursor stays block-granular; cells are display only.

6. **One completion state.** The final block advances into a **session debrief**:
   "session complete" + blocks done, session first-pass rate (from
   `P.session.stats`), and what returns when (next due day from `P.sched`). This
   is the only kid-facing screen that says done. `P.session.done=true`; home
   then shows a completed state with the next return named (e.g. "next bytes
   return thu"), plus the bonus valve (decision 7).

7. **Bonus round — appetite valve with an explicit state model.** After
   completion, if an uncleared unlocked unit remains, the completed card offers
   a quiet secondary `one more module ▶`: `compileSession` with `{bonus:true}`
   returns a session of exactly one frontier module with `bonus:true,
   baseDone:true`, and it **replaces `P.session`**. The day's "complete" status
   never regresses: home treats the day as complete when `P.session.day ===
   localDay() && (P.session.done || P.session.baseDone)` — a bonus in flight or
   abandoned still renders the completed card (with `▶ resume` pointing into the
   bonus). Bonus sessions append `P.sessions` rows flagged `bonus:true`, and
   every Phase 4 metric (starts/week, completion rate) is computed over
   **non-bonus rows only** — the alarm instrument never counts appetite. Due
   words can't reappear in a bonus (already rescheduled) and the same-day guard
   keeps repeats from inflating intervals. No third surface, no extension of the
   current session.

8. **Budget is observer-owned config — tamper-visible, not gated.** `P.cfg =
   {budgetMin: 10, v:3}` (default 10), set from the
   observer debrief (10 / 20 / 30 / 45 presets), never rendered on any kid-facing
   screen. Named honestly: the debrief is reachable from the kid's home (the
   existing ghost link), and this plan adds no lock — in a localStorage app any
   gate is theater (DevTools is one keystroke away). The real mechanism is
   **tamper visibility**: every `P.sessions` row records its `budgetMin`, so a
   kid quietly turning the dial to 10 shows up in the observer history as
   shrunken sessions. If real use proves this insufficient, add friction then
   (Open questions) — don't build fake auth now. The time model is a handful of
   tunables in one commented block — `SEC_REV=60, SEC_PANEL=30, SEC_WORD=90`
   (fast-pass module = unread panels + 1 word) — deliberately crude estimates
   whose only job is sizing the compile; calibration targets, not promises
   (Open questions).

9. **Home demotion — the map becomes a map.** The stage browser stays expandable
   but **read-only for work**: module name, description, CLEARED status; the
   `learn` / `practice` buttons, the LEARNED half-state chip, the DUE card, and
   the Continue card are all removed from the session-mode home. One small
   exception: a ghost `docs` link on modules whose lesson has been read opens the
   lesson **read-only** (`S.docsReadOnly=true`: no run hand-off at the end) —
   re-reading a reference is legitimate "pull the source" behavior and completes
   nothing. The map therefore has zero *startable-work* actions (the docs link
   starts nothing).
   **This consciously supersedes plan 002's "map stays openable / placement never
   gates" constraint.** That constraint assumed self-directed navigation was a
   value; the user's observed reality ("he skips everything not required") is
   that open navigation *is the exploit*. One way in is the product decision,
   made explicitly by the user. The kill switch preserves the old contract.

10. **Mid-session profile drift — fast-pass and locks — is accepted.** Review
    blocks feed `onEncounter`, so by the time a compiled `mod` block opens, its
    unit may newly qualify for fast-pass (or stop qualifying), or its code may
    have flipped `codeBroken` (which would have locked it at compile). The
    session is frozen: the block plays anyway (`openRun` has no lock check —
    unchanged), the clear bar keeps consulting the open-time snapshot
    (`S.fastPass`, unchanged), and the compile-time estimate may be off by a few
    minutes. Harmless — the budget is a sizing heuristic, not a contract, and a
    lock exists to steer *compilation*, not to eject work mid-session. Related
    acceptance: an interrupted module resumes at word 0, so its already-played
    words re-feed `onEncounter` on replay — bounded (≤3 words), damped by the
    decayed Beta, and `P.sched` is protected by the same-day guard; accepted.

11. **Persistence atomicity: the cursor advances in the same write as the
    ledgers.** `logWord` already persists `P.log`/`P.sched`/`P.codes` in one
    `saveP()` before any CTA renders. On the session path, block completion
    (review word done; module cleared via last word or fast-clear) increments
    `P.session.idx` — and sets `done` when past the end — **inside that same
    `logWord` call, before its `saveP()`**. The done-screen CTA becomes pure
    navigation into the already-advanced cursor. Consequences: a reload from
    the done screen resumes at the *next* block (no replay of a completed
    review, no double-feed of the profile); and because all of `P` serializes
    in one `setItem`, a storage failure loses the word's ledger writes and its
    cursor advance *together* — the app degrades to "replay one unrecorded
    word," never to a cursor/ledger split. (`saveP`'s existing silent-quota
    fallback is unchanged; `P.sessions` stores per-session scalars, not block
    arrays, precisely to keep this write small — Phase 4.)

12. **`S.session` / `S.docsReadOnly` have one owner each.** `S.session` is set
    `true` only by the session runner's block entry and cleared by `goHome()`,
    by session-debrief close, and by every legacy entry point (`openDocs`/
    `openRun` called from the map path, `openDebrief`). `S.docsReadOnly` is set
    only by the map's ghost docs link and cleared in the same places plus
    `openDocs`'s normal path. Both live in the `S` initializer. No screen may
    consult either flag without this lifecycle — the read-only lesson must not
    leak into a later session flow.

13. **Kill switch is a full-path revert.** `SESSION_ON=true` const. `false` ⇒
    the entire pre-plan home and flows return (DUE card, Continue, learn/practice
    buttons, per-module debrief, `REVIEW_CAP`) and `P.cfg`/`P.session`/
    `P.sessions` sit inert. Legacy functions (`startReview`, `continueGo`,
    `openRun`-from-map) are kept, not deleted, until the session path has
    survived real use (deletion criterion: Open questions).

14. **Copy stays in-skin.** New strings (TODAY card, resume, completed card,
    session debrief) follow the legacy-code/compiler voice already in the file —
    lowercase, terminal-flavored, no cheerleading, no exclamation marks. The
    session debrief reports facts ("what returns when"), never praise-confetti.

## Execution workflow (skills)

Per [docs/skills/plan-workflow-skills-guide.md](../skills/plan-workflow-skills-guide.md):
**`execute-plan`** drives the whole plan (one phase at a time, commit per phase
via **`git-commit`**, push once at the end via **`git-push`**); **`phase-audit`**
runs before every phase commit and itself invokes **`elon-musk`** for
architecture/complexity scrutiny — neither is repeated in the per-phase lists
below. **`debug`** on any blocking surprise; **`write-notes`** to capture
anything durable learned during execution. Per-phase skills name what the
*work* of that phase is:

### Phase 1 — Compiler + config (shadow) — ✅ COMPLETE

Pure logic, no UI change. **`compileSession` is pure — it reads `P` and writes
nothing**; only `startSession()` (Phase 2) persists its result. The TODAY-card
preview later depends on this purity (it dry-runs the compiler at render time).

*Done: `P.cfg`/`P.session`/`P.sessions` inits, `localDay()`, `schedKey()`
extraction, `SEC_*`/`SESSION_ON` tunables, `modCells`/`estMod`/`synthBlocks`/
`frontierUnits`/`compileSession`/`blockStale`/`nextLiveIdx`/`sessionValid`.
Verified via console harness (seeded 5/20-due + all-clear + bonus workloads):
crossing-item-included, review-order preserved, ≥1-module guarantee,
monotone-non-decreasing under fixed workload, byte-identical localStorage
(purity), stale-skip. No load-time console errors; legacy UI unchanged.
phase-audit: no P0/P1; one comment reworded.*

**Skills:** `documentation` — the new state (`P.cfg`/`P.session`/`P.sessions`
shapes, `localDay()` vs `today()` split, tunables rationale, the purity
contract) is exactly the non-greppable cross-file knowledge that skill exists
to pin down in comments. No UI skills; nothing kid-visible ships here.

- [x] Init `P.cfg=P.cfg||{budgetMin:30};`, `P.session=P.session||null;`,
  `P.sessions=P.sessions||[];` beside the other `P.*` initializers (anchor: the
  `P.docs=P.docs||{}` block).
- [x] Tunables block beside the SRS constants: `SEC_REV=60`, `SEC_PANEL=30`,
  `SEC_WORD=90`, `SESSION_ON=true`; add `localDay()` (decision 4) next to
  `today()`.
- [x] Extract `schedKey(u,w)` and use it inside `scheduleWord` (pure refactor —
  same string, one construction site).
- [x] `estMod(u)`: `(P.docs[u.id]?0:u.docs.length*SEC_PANEL) +
  (fastPass(u)?1:u.words.length)*SEC_WORD`; cells snapshot per decision 5.
- [x] `compileSession(budgetMin, opts)`: one frontier module first; up to four
  due reviews while within budget; then later unlocked units in `cmpUnits` order
  only when they fit; Tier 3 `synthBlocks()` → `[]`. Returns
  `{v:2, day:localDay(), budgetMin, blocks, idx:0, done:false, bonus:false,
  baseDone:false, stats:{words:0,clean:0}}`. `opts={bonus:true}` → one frontier
  module, `bonus:true, baseDone:true` (decision 7).
- [x] `sessionValid(s)`: `s && s.v===2 && s.day===localDay() && !s.done` and blocks
  non-empty after the decision-4 stale-skip.

**Verification (console, seeded workloads):** seed `P.sched` with 20 due entries
→ `compileSession(30).blocks` starts with a module and contains at most four
reviews; re-seed with 5 due → module + up to four reviews; empty sched + open
frontier → one module at the 10-minute default; all-cleared + nothing due →
empty blocks. On the 20-due seed,
assert `compileSession(10).blocks.length ≤ compileSession(45).blocks.length`
and that the 45-min compile's estimate is ≥ the 10-min compile's (monotone
non-decreasing under a fixed workload — not universal strict inequality, which
atomic modules and empty workloads both break). Call `compileSession` twice and
diff `localStorage` — byte-identical (purity). No UI change anywhere.

### Phase 2 — Session runner — ✅ COMPLETE

The one flow. Reuses the existing run/docs screens; changes what wraps them.

*Done: `startSession`/`enterBlock`/`advanceSession` over the compiled queue; atomic
cursor advance inside `logWord` (decision 11); seam removal in `renderDocs`
(session `next →` into the run, no "practice is open"); `sessionStrip` +
`sessionView` (display lags the durable cursor by one on run done-screens) + ghost
`⏸ pause`; `renderSessionDone` (single completion, backlog-aware return line);
flag lifecycle owned by `openDocs`/`openRun`/`goHome`/`openDebrief` (decision 12).
Verified: seam flow, strip monotonicity + block-boundary labels, atomic
advance/no-replay, quit-resume-at-word-0, local-day rollover discard, both
completion paths, legacy path intact, zero console errors.
Cross-agent (Codex) phase review — 1 P0 + 2 P1, all fixed: fast-clear now
requires a clean **word-0** (a first-word fault falls back to the full set — also
fixes latent plan-002 behavior); strip no longer lights the next block's panels
on a done screen; session-done surfaces due-now backlog instead of only a future
return (weekday dropped for an unambiguous "in N days").*

**Skills:** `jony-ive` — the seam removal, the session strip, and the pause
control are interaction design (mid-lesson must never read as a finish line;
motion across block boundaries carries the "one continuous session" claim);
`documentation` — decision 11's atomicity and decision 12's flag lifecycle are
constraints the code can't show on its own; `david-ogilvy` — the small set of
new in-flow strings (`next →`, `session complete ▶`, the session debrief
lines).

- [x] `startSession()`: `P.session = sessionValid(P.session) ? P.session :
  compileSession(P.cfg.budgetMin)`; save; enter the block at `idx`.
- [x] `enterBlock()`: apply the decision-4 stale-skip (advancing `idx` past dead
  blocks, save once); `rev` → set up the single-word review the way
  `startReview` does for one item (resolve the block's `key` to `{u,w,e}`;
  borrowed unit via the existing `cw()` machinery); `mod` → `openDocs(id)` if
  unread else `openRun(id)`; set `S.session=true` per decision 12.
- [x] **Atomic advance (decision 11):** in `logWord`, when the current session
  block completes (review word logged; module cleared via last word or
  fast-clear), increment `P.session.idx`, set `done` if past the end, and bump
  `P.session.stats` — all before the existing `saveP()`. `renderDone`'s
  session-mode CTA (`next ▶` / `session complete ▶`) only navigates.
- [x] Seam removal in `renderDocs` (session mode): final-panel success advances
  with `next →` (auto into the run); delete the `start practice →` button and
  the "practice is open" line on the session path.
- [x] Session header + strip on run/docs screens: one titlebar path
  (`~/wordbreak/session`), the compile-time micro-cell strip (decision 5)
  replacing the separate REVIEW//PRACTICE//LEARN headers in session mode — plus
  a quiet ghost `⏸ pause` control that calls `goHome()` (**new**: `renderRun`
  has no home control today; the quit/resume contract needs one).
- [x] `renderSessionDone()`: blocks done, first-pass rate from
  `P.session.stats`, next return day from `P.sched`; single `close ▶` to home
  (clears `S.session`).
- [x] Flag lifecycle per decision 12 (`S.session`, `S.docsReadOnly` set/cleared
  only at their named owners).

**Verification (manual):** fresh profile → start → lesson panels flow into the
run with no "practice is open" moment; full session runs a module followed by
reviews; strip advances across block boundaries without returning home and
never changes length; **pause** appears on the run screen, quits to home, home
offers `▶ resume`, resume re-enters that module at word 0 with prior blocks
still ticked; **reload from a review word's done screen → resume lands on the
next block, and that word's `P.sched` entry / `P.codes` are updated exactly
once** (the decision-11 check); finishing the last block lands on the session
debrief showing a rate consistent with play; reload after `done` → home shows
completed state. DevTools: `P.session.idx` and `stats` persist;
`P.sched`/`P.codes` semantics identical to the legacy paths.

### Phase 3 — The one-door home — ✅ COMPLETE

**Skills:** `jony-ive` — this is the plan's core design statement (one primary
CTA, map demoted to a read-only map, hierarchy: TODAY → map → observer link);
`david-ogilvy` — decision 14's copy pass owns every new user-facing string
(TODAY preview, resume, completed, all-clear) in the legacy-code voice.

*Done: `todayCard` (four states — fresh/resume/completed+bonus/all-clear —
resolved by `completedToday` taking precedence over `resumable`), `describeBlocks`
preview from a pure dry compile, read-only `mapRows` (CLEARED status +
learned-only `docs` link, no learn/practice buttons, no LEARNED chip), DUE +
Continue cards removed from the session home. `renderHome` branches on
`SESSION_ON`; `renderHomeLegacy` preserves the pre-plan home byte-identical.
Verified: all four states + bonus-in-flight, read-only docs (close not run
hand-off, no flag leak), budget-driven preview (3-min → 3 revs, 30-min → 5 revs
+ 4 mods), kill-switch flip restores the legacy home (DUE/Continue/learn/practice)
and flips back clean; JS parses; zero console errors.*

- [x] `renderHome()` session mode: **TODAY card** — content preview from a dry
  `compileSession` (purity, Phase 1) — "7 bytes due · then 4.2 duc.family", or
  review-only / module-only variants; single `▶ start` / `▶ resume`; completed
  state per decision 7's day-complete rule ("session complete — next bytes
  return thu") with `one more module ▶` when a frontier remains; all-clear
  state naming the next return day when nothing compiles.
- [x] Demote the map: stage rows stay expandable; module rows show id, name,
  description, CLEARED — **no** learn/practice buttons, no LEARNED chip, plus
  the ghost read-only `docs` link (decision 9; `S.docsReadOnly` hides the run
  hand-off in `renderDocs`).
- [x] Remove the DUE card and Continue card from the session-mode home (their
  logic lives in the compiler now).
- [x] Kill switch: every change in this phase branches on `SESSION_ON`; `false`
  renders the exact pre-plan home and flows.
- [x] Copy pass on all new strings in the existing voice (decision 14).

**Verification (manual):** session-mode home has exactly one primary button and
**zero startable-work actions** on module rows (the read-only docs link is the
sole, non-startable exception); `docs` ghost link opens a read-only lesson that
ends with a close, not a run, and a session started immediately after behaves
normally (flag-leak check, decision 12); all four TODAY states (fresh / resume
/ completed / all-clear) reachable and correct; completed state survives a
bonus being started and abandoned (decision 7); local-midnight rollover
(simulate by editing `P.session.day`) discards a stale session at home render,
never mid-block; flip `SESSION_ON=false` + reload → the old home (DUE card,
Continue, learn/practice) returns and legacy flows work; flip back → session
state resumes unharmed.

### Phase 4 — Observer surfaces — ✅ COMPLETE

**Skills:** `jony-ive` — the observer panel must stay quiet and parent-legible
(budget presets, history rows, the alarm number) without leaking anything onto
kid surfaces; `david-ogilvy` — observer-facing labels and the rewritten
watch-for item; `documentation` — the `P.sessions` row lifecycle
(`endedAt:null` = abandoned-by-design) is a contract worth a comment block.

*Done: `recordSessionStart`/`recordBlockDone`/`recordSessionEnd` fill the
history-row lifecycle (one row per session, appended at start after the
empty-session guard, `doneBlocks` on each block completion, `endedAt` on
completion, abandoned = `endedAt:null`; resume reuses via the `reuse` refactor);
`sessionObsCard` on the debrief — budget presets (10/20/30/45m, tamper-visible),
starts-this-week + completion-rate over non-bonus rows + due backlog + per-row
budget·run; watch-for item swapped to "does he press start unprompted?".
Verified: full lifecycle (start/abandon/resume/complete/bonus), metrics filter
bonus out (3 starts, 67% of 3), setBudget writes cfg, observer-only (no
minutes/budget leak to kid home), SESSION_ON-gated; JS parses; zero console
errors.*

- [x] Budget control on the observer debrief: `session budget: 10 / 20 / 30 /
  45 min` presets writing `P.cfg.budgetMin`; labelled as observer-only
  (tamper-visible model per decision 8).
- [x] `P.sessions` — **explicit row lifecycle:** exactly one row per session,
  **appended at `startSession()`** as `{day, bonus, budgetMin, blocksTotal,
  doneBlocks:0, startedAt, endedAt:null}` (scalars only — never block arrays;
  keeps every `saveP` small, decision 11); the active session's row is the last
  row (single active session by construction); `doneBlocks` mutated in place on
  each block completion, `endedAt` stamped at session completion. **An
  abandoned session is a row with `endedAt:null`** — honestly visible, which is
  the point: completion rate must read *worst* exactly when the habit is
  failing. Ring-capped at ~30 rows.
- [x] Observer panel: **sessions started per week** and completion rate over
  **non-bonus rows** (decision 7) — the alarm instrument (if starts slip, the
  budget is too expensive; turn it down before the habit dies) — plus current
  due-backlog size (`dueList().length`) and per-row `budgetMin` (tamper
  visibility).
- [x] Extend the observer watch-for list: replace the stale "does he clear the
  DUE card" item with "does he press start unprompted?" — the queue is now
  inside the session, so the judge is session starts.

**Verification:** change budget → next dry compile visibly resizes (console:
`compileSession(P.cfg.budgetMin).blocks.length`); play two sessions across two
(simulated) local days → two rows with real durations; abandon one mid-way →
its row shows `endedAt:null` and completion rate drops; run a bonus → its row
is flagged and excluded from starts/completion; backlog count matches
`dueList().length`. Nothing in Phase 4 renders on any kid-facing screen.

## Hard requirements

- Additive to `P`; `wb2` unchanged; deleting `P.cfg`+`P.session`+`P.sessions`
  resets session state only — progress, schedule, profile intact.
- SRS semantics byte-identical: `scheduleWord` (modulo the pure `schedKey`
  extraction), `dueList` ordering and return shape, `BOX_DAYS`, and the
  same-day massed-repetition guard are consumed, never modified. `today()`
  stays UTC-based for the SRS; `localDay()` scopes sessions only.
- The four-beat word loop (TYPE→FLAG→EXECUTE→FORK/PATCH) is unchanged inside
  session blocks.
- No kid-facing clock, minutes, countdown, or speed cue anywhere. Budget and
  durations render on observer surfaces only. Session length is expressed to
  the kid only as blocks.
- No padding: when real work < budget, the session is short; nothing re-drills
  same-day words to fill time.
- Modules are atomic in the compile; the session queue and its cell strip are
  frozen at compile time and never grow mid-session; missed words return via
  the scheduler (tomorrow), never via same-session re-append.
- Session-cursor advancement is atomic with the word's ledger writes (one
  `saveP`, decision 11): no reachable state replays a completed review or
  splits cursor from ledger.
- `compileSession` is pure; only `startSession` persists.
- Exactly one kid-facing completion state (the session debrief). Lesson-end and
  module-end must not read as finish lines on the session path. A completed
  day never regresses to incomplete (bonus included, decision 7).
- The session-mode home has exactly one primary CTA. Map has zero
  startable-work actions (read-only docs link excepted). This supersedes plan
  002's open-map constraint by explicit user decision; the kill switch
  preserves the old contract.
- `SESSION_ON=false` restores the complete pre-plan experience with no data
  migration.
- No new reward surfaces: no streaks, points, or praise copy in the session
  debrief (README §7 stands).

## Rollback / kill switch

- Flip `SESSION_ON=false` → legacy home + flows exactly as shipped today;
  `P.cfg`/`P.session`/`P.sessions` sit inert (delete them to clean up; nothing
  else is touched).
- Phase 1 is invisible; Phase 2 is reachable only via `startSession()`; the
  user-visible cutover is Phase 3 alone, so the plan can ship and sit at any
  phase boundary.
- If the one-door model proves wrong in real use (starts collapse), the revert
  is one const + one reload, and all progress/schedule data is unaffected.

## Open questions

1. **Time-model calibration (do first after ship).** `SEC_REV/SEC_PANEL/SEC_WORD`
   are guesses. `P.sessions` rows carry real start/end times; after a week of
   real play, fit the constants so each observer-selected budget lands near its
   target. Until then bias the constants high (compile slightly short) — an
   honest under-fill beats an overshooting session that teaches dread.
2. **Backlog policy after long gaps.** The four-review dose means a two-week
   backlog drains over several days (most-overdue-first). Acceptable v1
   behavior; the open question is whether the observer should get a "vacation
   catch-up" control (temporary budget bump) or whether silence is better.
   Decide from real data, not upfront.
3. **Synthesis tier content (separate plan).** Transfer drills — build unseen
   words from owned morphemes, decompose novel words, interleaved discrimination
   — are the honest way to fill a 30-min budget once the frontier is cleared
   (~7 weeks at one module/day, faster at 30 min). Needs its own design work
   under the generation constraint (README §10: only ever more examples of a
   verified pattern; never unsupervised witnesses/etymologies). The compiler's
   Tier 3 slot is the interface it must fill.
4. **Bonus-round shape.** v1: one module per press, repeatable. If real use
   shows him chaining bonus modules (a good problem), consider whether the
   review-debt argument (each module ≈ five future returns per word) needs a
   soft ceiling. Instrument first (`P.sessions` will show it), don't pre-guard.
5. **Read-only docs link — keep or cut.** Kept in v1 on the "pull the source is
   reference behavior" argument. If observation shows it functioning as an
   avoidance surface instead, cut it; the session path never depends on it.
6. **Budget-control friction.** Decision 8 ships tamper-visible, ungated. If
   history shows the dial being turned down by the wrong hands, add deliberate
   friction then (e.g. the control hidden behind a typed observer word) —
   knowing it remains theater against DevTools.
7. **Legacy-path deletion criterion.** The `SESSION_ON` dual-path period is
   consciously temporary but currently open-ended (Claude reviewer's complexity
   note). Proposed bar: after ~2 weeks of real sessions with no revert and
   stable starts/week, delete the legacy home, `REVIEW_CAP`, per-module
   debrief, and the flag itself in a follow-up commit.
