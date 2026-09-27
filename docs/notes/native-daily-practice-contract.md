# Native daily practice experiment contract

## Daily recurrence after completion — 2026-09-25 — resolved

**Summary:** Completing either subject no longer makes future daily practice a
permanent no-op. Mathbreak starts a fresh deterministic practice queue on each
new local day, and a learner who has cleared the Wordbreak curriculum still
receives four reconstruction opportunities.

**Symptom:** A completed Mathbreak `practice` object continued returning
`mathDone` on every later day. Wordbreak could compile an empty session when no
frontier module or formally due review existed.

**Repro:** Persist a completed Mathbreak practice, advance the injected clock by
one local day, and dispatch `session.begin`; the old engine remained done. For
Wordbreak, clear the available unit, schedule its learned words beyond today,
and dispatch `session.begin`; the old queue was empty.

**Root cause:** Mathbreak completion had no local-day identity or restart rule.
Wordbreak treated the spaced-repetition due date as an absolute exclusion even
when that violated the product's minimum daily-work contract.

**Fix / status:** Mathbreak practice now stores its local day and restarts only
after that day changes. Wordbreak still prioritizes formally due reviews, then
adds the best scheduled early reviews until four production/reconstruction
opportunities are planned. Same-day duplicate completion remains suppressed.

**Verification:** proven — the full 67-test JavaScript suite passes, including
next-day Mathbreak restart, same-day suppression, fully taught Wordbreak with
future-due items, generated-browser parity, and frozen legacy traces. The exact
authored engine bytes were also verified in the iPhone 12 Pro simulator app.

**Related:** [Phase 2 plan](../plans/007-native-daily-practice-ai-feedback-loop-plan.md)

**Version:** 1
**Date:** 2026-09-21
**Learner:** Luca
**Minimum OS:** iOS 26.0

## Learner promise

The app presents one quiet doorway: `Start today's practice`. A completed day
contains meaningful production in both Wordbreak and Mathbreak. There is no
countdown, speed score, streak currency, leaderboard, mascot, or experiment
console in the learner path.

The first session budget is a soft 12 minutes, with a 6-minute Wordbreak block.
Each subject receives at least four production opportunities. A started
Wordbreak module and an active Mathbreak correction remain atomic, so the
session may finish beyond 12 minutes rather than cutting off instruction.

`src/daily-session-budget.test.js` pins the synthetic worst case from the real
engines: every curriculum unit is 4 lesson panels plus 4 words, so an unread,
non-fast-pass module is 8 engine-estimated minutes. Mathbreak has no duration
constant; charging an assumed 15 s per placement answer and 90 s per corrected
practice item gives about 17 minutes on an ordinary day and about 25 on the
placement day (24 screener + 6 probe answers before the 6-item queue). These are
planning estimates. The app promises Luca no duration until his phone has timed
a real day.

## Daily coordination and day credit

Daily completion and the nudge ledger live in one versioned App Group file,
`state/daily.v1.json`, written atomically under `NSFileCoordinator` by both the
app and the DeviceActivity monitor. It is not complete-file-protected, because
the monitor must read it while the phone is locked. Unreadable or future-version
bytes are moved aside, never overwritten. Completion is committed only after
both subjects finish and before navigation or notification effects.

A run left open across local midnight is released when the app returns to the
foreground. The next start rebuilds the engines on today's clock. The shared
engine abandons an unfinished Wordbreak session from an earlier day (like the
legacy web runner), and completion credits the day the work actually finishes.

## Engine clock and review days — 2026-09-27 — resolved

**Symptom:** Native Wordbreak recorded zero word latency and one timestamp for a
whole run, and a review's due day depended on whether practice happened before
or after about 5 PM in California.

**Root cause:** The shared cores captured `nowMs` once in `create()`, and the
native app keeps one engine per run. The SRS used `Math.floor(nowMs / DAY_MS)`,
a UTC day, inherited from the legacy runner; UTC midnight falls inside the
afternoon practice window.

**Fix / status:** Hosts stamp `nowMs` on every action (`JavaScriptEngineHost`);
the cores stay pure functions of state plus action, and replays without
`nowMs` keep the creation clock, so golden parity is unchanged. Review days now
use the local calendar day in both the core (`dayNumber`) and the browser
(`today()`). Stored `due`/`last` values are not rewritten: west of UTC they read
as at most one day late, never early. Mathbreak keeps its practice day fixed at
creation so a queue never flips days mid-run.

**Verification:** proven — core tests for local review days and per-action
clocks, a native bridge test with real latency across one long-lived bridge, and
unchanged golden fixtures.

## Configuration ownership

The daily schedule and session budget live in exactly one place each: reminder
times in the coordination ledger (defaults 4:00 PM and 7:30 PM, parent-editable),
the 15-minute threshold in `ScreenTimeOpportunityScheduler`, and the Wordbreak
block in `DailySessionContract`. `experiment.v1.json` carries only Plan 008
flags and versions. Plan 008's semantic event ledger records typed answers, so
it is written only while `capture`, `upload`, or `analysis` is on, and raw event
files are pruned after 30 days (sealed packages keep their own copy).

Native reporting is paused. Parent setup says iPhone practice is not in the
weekly email; it is never reported as zero.

## Daily rhythm

- Primary local notification: 4:00 PM in the current device time zone.
- Evening fallback: 7:30 PM, cancelled immediately when both subjects finish.
- Optional opportunity nudge: once per local day after 3:00 PM when selected
  Screen Time activity crosses 15 minutes and practice is unfinished.
- All three entry points deep-link to the same unfinished session.
- The parent may move both reminder times in parent setup; the evening time
  must follow the afternoon one, and the Screen Time window is always the hour
  before the afternoon reminder.
- Parent setup is hidden behind a long press on the home screen, not locked.
- Screen Time monitoring stops when the kill switch is off or authorization is
  explicitly denied. A cold-start `.notDetermined` read never disables it.
- Screen Time is an opportunity signal, never a claim that Luca is bored.

## Experiment modes

- `OBSERVE`: capture and analysis may run; agents cannot write code.
- `PROPOSE`: agents may create isolated candidates; no candidate is installed.
- `AUTOPILOT`: one allowlisted candidate may be judged, tested, archived, and
  installed without per-candidate approval.

The independent kill switches are `capture`, `upload`, `analysis`,
`agentWrite`, `automatedInstall`, `notifications`, and `screenTime`. Changing
mode never enables a disabled switch.

## Six-session protocol

Phase 5 calibration sessions are not experiment sessions. After calibration,
sessions run in the immutable order `A, A, B, B, A, B`. A is one tested
baseline archive and B is one tested candidate archive. Exactly one
substantive, reversible interaction hypothesis may differ. The metric and
predicted direction are frozen before B is installed. Results are reported as
`directionally consistent`, `directionally inconsistent`, or `inconclusive`.

## Capture contract

An experiment-quality session requires separate screen, front-camera,
microphone, app-audio, and semantic-event evidence. Every media-linked event
maps host monotonic time to exactly one segment presentation timestamp. The
required physical-device gate is a 15-minute run with at least 98 percent
eligible-time coverage for every required track, less than 1 percent dropped
screen buffers, no unexpected per-track sample gap over 2 seconds, and no more
than 250 milliseconds pairwise drift. ReplayKit does not expose an equivalent
to AVFoundation's per-frame `didDrop` callback, so its drop ratio is the share
of delivered buffers that are invalid or not data-ready plus any handler error;
the continuously changing diagnostic screen makes the separate continuity
ceiling meaningful. The front-camera ratio uses AVFoundation's explicit
`didDrop` callback plus invalid buffers. Presentation-time gaps are not treated
as dropped ReplayKit frames because its screen stream has an adaptive cadence.

ReplayKit captures screen/app-audio/microphone sample buffers. A separate,
video-only AVFoundation session captures the front camera; ReplayKit's camera
path stays disabled. Luca's exact iPhone SE now runs iOS 27.0, but the clean
physical gate still uses the already exercised ReplayKit/AVFoundation adapter
so the OS is the only changed variable. If that combination cannot sustain the
declared budgets, the full observation experiment stops until an iOS 27
ScreenCaptureKit adapter or another device/OS path passes the same gate.
Learning remains usable with capture disabled.

## Family Controls decision

The first device attempt requests `.child` authorization because Luca is 14 and
the intended control belongs to a parent in the same Family Sharing group. The
parent must be present to authenticate. If the device account is not a child
account in the required Family Sharing group, the operator records that fact
and may test `.individual` only as an explicit revised authorization decision.
Denial or unavailable managed entitlements activates notification-only mode;
it does not count as a Screen Time pass.

The app and monitor extension use separate bundle identifiers and one shared
App Group. Development signing and managed distribution are separate gates.
The App Store Connect API can register both bundle identifiers and enable their
App Groups, but its `bundleIdCapabilities` endpoint does not accept Family
Controls. Apple requires the Account Holder to submit a separate **Family
Controls (Distribution)** capability request for the app and the Device
Activity monitor extension in Certificates, Identifiers & Profiles. Approval
and a regenerated signed profile remain unproven until those requests show
`Assigned` and `codesign` confirms the entitlement on both binaries.

## Post-session first-person check-in

The learner chooses exactly one of `confusing`, `annoying`, `too_easy`, or
`okay`, with optional speech. This is calibration evidence, not a score. Models
may describe visible or audible signals as observations, but emotion,
attention, intent, or comprehension claims require this first-person evidence.

## Reporting and failure behavior

If aggregate parent reporting is active, native becomes the sole authoritative
learner device after explicit re-pairing and browser credential deactivation.
If it is inactive, coverage is visibly paused rather than reported as zero.
Raw media, transcripts, and semantic events never enter D1 or weekly email.

Capture, upload, analysis, agent, or notification failure never blocks or
erases locally committed practice. Canonical state is atomically committed
before nonessential effects.
