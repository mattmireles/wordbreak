# Native Daily Practice and AI Feedback Loop Plan

**Date:** 2026-09-21
**Status:** Planned
**Progress model:** Phase task checkboxes only

## Executive Summary

Build a native iPhone experience for Luca with a new mobile-first SwiftUI
interface over the same deterministic Wordbreak engine, add an untimed
strategy-based Mathbreak loop, and make one short combined practice session a
daily habit. Instrument the complete experience with synchronized screen,
front-camera, microphone, app-audio, and semantic event capture; analyze each
session with Gemini; and let an ensemble of frontier coding agents turn the
evidence into tested, reversible product changes.

The first milestone is not a general education platform. It is a six-session,
single-learner experiment that proves one closed loop from observation to a
tested build on Luca's iPhone and measures a reversible interaction hypothesis
under alternating baseline/candidate conditions.

## Problem Statement

- **Symptom:** Luca is struggling with basic math facts, and Wordbreak plus math
  practice is not yet a dependable daily habit on the device he already uses.
- **Root Cause:** Wordbreak is a browser-first, monolithic HTML application; it
  has no native daily shell, math-fact curriculum, notification rhythm,
  Screen Time opportunity trigger, full-session capture, or evidence-to-code
  product loop.
- **Impact:** Practice depends on an adult remembering to initiate it, product
  friction is observed informally, and improvements are based on recollection
  rather than replayable evidence tied to the exact code and learner state.

## Mode Definitions

| Mode | Behavior | Why it matters |
| --- | --- | --- |
| `OBSERVE` | Record and analyze sessions; agents may diagnose but cannot edit code. | Establishes two clean baseline sessions and calibrates the analysis. |
| `PROPOSE` | The ensemble may create isolated candidate branches and reports, but cannot install a build. | Lets us inspect whether the agents understand the learner and code before autonomous release. |
| `AUTOPILOT` | The ensemble may select, test, build, and install one allowlisted candidate per experiment epoch without per-candidate approval. | Runs the intended closed-loop experiment while keeping each causal test interpretable and reversible. |

Capture, upload, analysis, agent-write, automated installation, notifications,
and Screen Time nudges also have independent kill switches. Mode changes do not
silently turn a disabled capability back on.

## Goals and Non-Goals

### Goals

- Give Luca one obvious daily action that completes both Wordbreak and
  Mathbreak in roughly 8-12 minutes, with no visible timer or speed score.
- Present a purpose-built native mobile interface while executing the exact
  same Wordbreak curriculum, scheduling, grading, and state-transition code as
  the web product.
- Diagnose Luca's initial addition, subtraction, multiplication, and division
  gaps, then practice the weakest fact family through number-sense strategies
  rather than memorization pressure.
- Use an after-school notification, an evening fallback, and an optional
  DeviceActivity threshold as three chances to start the same unfinished daily
  session.
- Capture screen video, front-camera video, microphone audio, app audio, and a
  timestamped event trace for every experiment session.
- Produce schema-valid, timestamped Gemini observations and diagnoses whose
  claims can be checked against the source recording and event trace.
- Have multiple independent coding agents propose or implement an improvement,
  choose one through a separate judge, pass all release gates, and deliver the
  winning build to Luca's iPhone.
- Measure the next sessions against the chosen hypothesis and retain enough
  evidence to confirm or falsify the claimed improvement.

### Non-Goals

- Rewriting Wordbreak in Swift or creating a second interpretation of its
  curriculum and grading rules.
- Building a general-purpose learning management system, classroom product,
  social layer, streak economy, leaderboard, or reward shop.
- Using timed tests, rewarding rapid answers, or treating speed as fluency.
- Asking an AI model to invent canonical spellings, witness words, math facts,
  correct answers, or assessment content.
- Inferring boredom from Screen Time. DeviceActivity is only an opportunity
  signal: selected distracting activity crossed a threshold while today's
  practice remains incomplete.
- Recording outside this app, blocking other apps, or shipping App Store-scale
  account, moderation, or multi-tenant administration in this experiment.
- Folding raw media into the existing parent-reporting D1 pipeline or changing
  the semantics of shipped aggregate reports.
- Making more than one substantive product change in a single experiment epoch.

## Scope and Constraints

- **Scope:** A native iOS app, a shared browser/native Wordbreak core, a new
  Mathbreak core, local scheduling, Screen Time integration, synchronized
  capture, a private upload/analysis backend, an agent ensemble runner, and one
  six-session Luca experiment.
- **Device constraint:** Xcode 27.0 and the iPhoneOS 27.0 SDK are installed, but
  Luca's iPhone currently runs iOS 26.7 and was offline during planning.
  ScreenCaptureKit's iOS capture APIs are therefore unavailable for the initial
  build; ReplayKit plus AVFoundation is the required path unless the phone is
  upgraded.
- **Repository constraint:** The shipped web app remains a deployable single
  `wordbreak_v2.html` artifact. Source extraction may change how that artifact
  is built, but not the public runtime contract.
- **Experiment constraint:** Signing, the physical capture pipeline, the
  Family Controls entitlement, a Google Cloud project, private object storage,
  and Vertex AI access must be proven before the full loop is built around
  them.
- **Hard feasibility gate:** Full synchronized capture is a non-negotiable input
  to this experiment. If Luca's iOS 26.7 device cannot sustain the required
  ReplayKit plus AVFoundation tracks for 15 minutes, implementation stops until
  an iOS 27 ScreenCaptureKit path or a different proven device/OS decision is
  recorded.
- **Network constraint:** Learning must complete locally if upload, Gemini, or
  the coding agents are unavailable. Upload uses a resumable background task.
- **Cost constraint:** Start with one learner and six sessions. Do not add a
  warehouse, generic analytics platform, or continuously running agent service
  until the experiment proves value.
- **Guardrails:** Preserve Wordbreak's rule-first teaching loop, current
  assessment separation, exact-answer behavior, content hashes, pre-generated
  audio contract, and existing aggregate-reporting behavior.
- **Scientific guardrail:** Store the build revision, content version, engine
  version, prompt hashes, schema version, model identifier, settings, and
  artifact checksums for every result. Never overwrite an accepted artifact;
  retry only a missing or malformed stage.

## Ground Truth Contracts (Do Not Violate)

- **Different surface, same Wordbreak engine:** SwiftUI owns presentation and
  interaction. A platform-neutral JavaScript reducer remains the sole
  executable authority for Wordbreak curriculum, selection, scheduling,
  grading, aggregate-reporting mutation, and progress transitions on both web
  and iOS.
- **Opaque canonical state:** `WordbreakCore.create(...)` accepts the full
  canonical JSON state and `dispatch(action)` returns the next canonical JSON,
  view model, effects, and semantic events. Swift may decode typed envelopes but
  must persist the returned state bytes without decoding and re-encoding the
  learner ledger.
- **Commit before effects:** The host atomically writes returned canonical state
  before acknowledging the transition or executing nonessential effects. A
  failed write leaves the same action available and performs neither reporting
  transport nor completion navigation.
- **Golden parity before extraction:** Current behavior from
  `wordbreak_v2.html` is frozen as fixtures before moving code. Identical seed,
  time, prior state, and actions must yield identical prompts, results, and
  persisted state in the old page, extracted core, browser adapter, and
  JavaScriptCore bridge.
- **Curriculum truth stays explicit:** Before extraction, `methodology.md` and
  inline `UNITS` in `wordbreak_v2.html` are current truth. After parity is
  proven, `src/game/wordbreak-content.js` becomes the authored source and the
  HTML contains its generated inline copy. A validator must prove the same 48
  core units/192 words and enabled four-unit/16-word field pack.
- **Production over recognition:** Both subjects require Luca to produce an
  answer. A miss or hesitation opens a reconstruction path and ends with Luca
  producing the answer again; it never degrades into multiple choice.
- **Fluency is not speed:** Mathbreak may measure latency as an observation, but
  it never shows a countdown, ranks fast answers, or promotes speed before
  accurate, flexible reasoning.
- **Hand-authored truth, adaptive routing:** AI may recommend sequencing,
  emphasis, hints, layout, and interaction changes inside validated content. It
  may not silently alter correct answers, word/witness relationships, fact
  equations, frozen assessment forms, or reporting definitions.
- **Evidence is immutable:** Raw tracks, event traces, manifests, model outputs,
  agent outputs, diffs, test receipts, and release receipts are append-only
  within an experiment run.
- **Observation is not diagnosis:** Face, voice, and pause signals may support a
  hypothesis with a confidence score. They are not presented as known emotion,
  intent, or internal state.
- **One intervention per epoch:** The ensemble can explore many candidates, but
  only one substantive hypothesis reaches Luca's phone before the next
  measurement window.
- **Learning survives instrumentation failure:** A capture, upload, analysis,
  or agent failure marks the observation incomplete but never blocks or erases
  the daily practice session.
- **One aggregate-reporting authority:** If private reporting is active during
  the experiment, native becomes its only authoritative learner device, keeps
  the same aggregate-only revision/checkpoint semantics, and requires explicit
  re-pairing. The browser credential is deactivated. Raw media, transcripts,
  and event traces never enter D1 or weekly email.

## Already Shipped (Do Not Re-Solve)

- **Wordbreak learning loop:** `wordbreak_v2.html` implements the TYPE -> FLAG
  -> EXECUTE -> FORK/PATCH interaction, progress storage, spaced review, session
  compilation, assessment, and current mobile-capable web experience.
- **Validated curriculum:** `scripts/curriculum/validate-content.mjs` verifies
  48 core units/192 words plus the enabled four-unit/16-word field pack.
- **Deterministic assessment:** `scripts/assessment/validate-bank.mjs` and the
  assessment tests preserve two frozen 24-item forms outside teaching content.
- **Runtime extraction seam:** `scripts/runtime-data.mjs` already evaluates the
  inline runtime with browser shims and exposes data/helpers to Node tests.
- **Static audio corpus:** The repository contains 516 verified MP3 assets and
  a manifest checked by `scripts/audio/verify-assets.mjs`.
- **Aggregate reporting code:** `src/worker.js`, reporting modules, migrations,
  and local integration tests exist. This plan does not assume that every
  deployment/pairing task in Plan 004 is complete, and it does not route raw
  experiment media through reporting.
- **Cloudflare web deployment:** The existing Worker/static-assets path and
  `wordbreak.fun` web experience remain the fallback if the native experiment
  is stopped.

## Fresh Baseline (Current State)

- **Repository:** `main` at `a70a701`, seven commits ahead of and two behind
  `origin/main` at planning time. Unrelated local edits and untracked files were
  present and must not be absorbed into this work.
- **Architecture:** Wordbreak's source of behavior and curriculum is still
  intertwined with DOM/UI code in one HTML file. There is no Xcode project,
  native engine bridge, math engine, media pipeline, or agent orchestrator.
- **Automated baseline:** `npm test` passed on 2026-09-21, including 43 Node
  tests, curriculum and assessment validation, real local-D1 Worker smoke,
  local migrations, and all 516 audio assets.
- **Device baseline:** `xcrun xctrace list devices` found Luca's iPhone on iOS
  26.7, offline. No physical capture or Family Controls proof exists yet.
- **Product baseline:** Wordbreak can run today, but starting it is externally
  prompted; basic math practice and a combined daily completion state do not
  exist.
- **Evidence baseline:** Existing reporting deliberately contains aggregate
  learning metrics. There is no session-level screen/camera/audio record or
  event-to-build provenance bundle.

## Solution Overview

The native app is a presentation and device-capability shell. It does not fork
Wordbreak's rules. Both the browser and SwiftUI call the same checked-in core;
Mathbreak is a second deterministic core with its own validated content. The
native shell records the session and uploads an immutable bundle. Gemini turns
that bundle into grounded structured observations. Independent coding agents
then examine the same evidence and repository revision, create competing
candidates, and a separate judge selects at most one releasable change.

```text
                         same checked-in JavaScript core
                    +------------------------------------+
                    |                                    |
wordbreak_v2.html <--+--> browser adapter   JSCore bridge +--> SwiftUI daily shell
                                                               | Wordbreak
                                                               | Mathbreak
                                                               | event trace
                                                               | screen/camera/audio
                                                               v
                                                     private GCS session bundle
                                                               |
                                                        Gemini analysis
                                                               |
                                  +----------------------------+------------------+
                                  |                            |                  |
                          learning critic               product critic      code mapper
                                  +----------------------------+------------------+
                                                               |
                                                    candidate worktrees
                                                               |
                                                  independent judge + tests
                                                               |
                                                   one reversible iPhone build
```

The mobile interaction is intentionally narrow:

1. A notification or Luca opens the app.
2. One `Start today's practice` action begins observation and the daily session.
3. Luca completes a compact Wordbreak block and a compact Mathbreak block.
4. One quiet completion screen confirms that today is done.
5. Upload and analysis happen off the critical learning path.

## Build vs Buy and Dependency Cost

- **Native capture:** Wrap `RPScreenRecorder.startCapture` for screen, app-audio,
  and microphone buffers plus a separate video-only AVFoundation front-camera
  capture. ScreenCaptureKit becomes an optional iOS 27 adapter only after the
  device upgrades and parity is proven. Simultaneous capture on iOS 26.7 is a
  hard physical feasibility question, not an assumed fallback.
- **Replay analytics vendors considered:** PostHog Session Replay, Sentry
  Session Replay, and UXCam. Reject them for this experiment: they reconstruct
  interaction or omit microphone/full synchronized camera capture and therefore
  do not produce the source artifact this hypothesis requires.
- **Behavioral analytics:** Build a small typed JSONL event ledger rather than
  adding a general analytics SDK. It aligns exact engine transitions with media
  and is sufficient for one learner.
- **Media storage and analysis:** Use a private Google Cloud Storage bucket, a
  thin Cloud Run upload/finalization service, a Cloud Run analysis job, and
  Vertex AI Gemini. This lets Gemini consume `gs://` media without copying large
  videos through the existing Cloudflare Worker.
- **Coding-agent ensemble:** Wrap the installed Codex and Claude CLIs with a
  checked-in Node orchestrator. Do not create a new always-on multi-agent cloud
  platform for a six-session experiment.
- **Shared engine:** Extract and wrap the existing JavaScript instead of buying
  an embedded web-game framework or rewriting it in Swift.
- **Dependency cost:** This adds an Xcode project, Apple entitlements, media
  composition, background upload, a Google Cloud deployment, Gemini usage, and
  local agent-runtime cost. The cost is justified only if Phase 7 demonstrates
  a full evidence-to-improvement loop; otherwise the native app remains useful
  and the experimental backend can be deleted independently.

## Implementation Phases

> Execute one phase at a time and verify it before proceeding. Use a dedicated
> `codex/` branch or worktree and preserve all unrelated local changes.

### Phase 0: Freeze Contracts and Prove Physical Feasibility

**Goal:** Convert assumptions into versioned experiment contracts and prove the
device capabilities that could invalidate the architecture.

**Skills:** `build-vs-buy`, `context7-mcp`, `debug`, `jony-ive`

**Tasks:**

- [ ] Create `docs/notes/native-daily-practice-contract.md` with the daily
  session budget, initial 4:00 PM and 7:30 PM local notification schedule,
  initial 15-minute DeviceActivity threshold after 3:00 PM, experiment modes,
  independent kill switches, and the six-session protocol.
- [ ] Add `experiment/config/experiment.v1.json` with immutable version IDs,
  feature flags, model placeholder, prompt/schema hashes, media requirements,
  agent allowlist, and release gates; validate it with
  `scripts/experiment/validate-config.mjs`.
- [ ] Define `experiment/schemas/event.schema.json`,
  `capture-manifest.schema.json`, `session-manifest.schema.json`, the complete
  state/action/event taxonomy, segment-clock model, and post-session Luca
  check-in contract before native instrumentation begins.
- [ ] Freeze `wordbreak_v2.html` as
  `test/fixtures/wordbreak-legacy-v2.html` with its SHA-256, then generate golden
  behavior fixtures in
  `test/fixtures/wordbreak-golden/` using injected seeds, clocks, prior learner
  states, correct attempts, misses, corrections, reloads, session completion,
  assessment boundaries, and field-pack transitions.
- [ ] Create the minimal `ios/Wordbreak.xcodeproj` signing shell with deployment
  target iOS 26 and resolve the bundle identifier, development team, Luca's
  physical device pairing, and required camera/microphone/photo-library usage
  strings without starting the product UI.
- [ ] Build `ios/WordbreakCaptureSpike/` and prove a 15-minute adapter on Luca's
  exact signed iPhone using `RPScreenRecorder.startCapture` for screen,
  app-audio, and microphone buffers plus a video-only `AVCaptureSession` and
  `AVCaptureVideoDataOutput` for the front camera. Do not simultaneously enable
  ReplayKit's camera path.
- [ ] Measure first/last sample coverage, dropped buffers, thermal state,
  audio-route changes, interruption/relaunch behavior, and pairwise drift for
  every raw track. If the declared coverage/drift budgets fail on iOS 26.7,
  stop; manual composition does not manufacture a missing capture source.
- [ ] Choose and record Family Controls `.child` or `.individual` authorization,
  including Apple ID/Family Sharing prerequisites and who authorizes it.
  Register separate bundle IDs for the app and monitor extension, enable Family
  Controls and the shared App Group on both, and record development versus
  managed-distribution provisioning.
- [ ] Verify signed app/extension entitlements with `codesign`, then physically
  prove authorization, picker persistence, a real DeviceActivity threshold
  callback, App Group visibility, notification delivery, restart, midnight
  rollover, revocation, and reinstall. An entitlement denial activates the
  notification-only degradation path; it does not count as Screen Time proof.
- [ ] Resolve the Google Cloud project, region, billing, private bucket, Cloud
  Run service identity, Vertex AI access, lifecycle policy, and local operator
  credentials in `experiment/infra/README.md`; keep credentials out of Git.
- [ ] Define the math universe in `src/game/mathbreak-content.json`: addition and
  subtraction within 20; multiplication and integer-inverse division through
  12; no zero divisors; explicit commutative/inverse duplicate identities.
- [ ] Draft an untimed 24-item broad-lane screener plus separate hand-authored
  within-lane probes, strategy-construction actions, held-out fact-family
  probes, delayed-retrieval intervals, and strategy catalog. Validate every
  equation, decomposition, duplicate relation, and inverse relation with
  `scripts/math/validate-content.mjs`.

**Verification:** `npm test`, the golden-fixture generator's repeatability
check, schema/config validation, and `xcodebuild` for the signing shell pass. A
reviewed 15-minute physical capture receipt meets the later 98% coverage and
250 ms drift budgets. A real DeviceActivity callback proves Screen Time; if the
entitlement is unavailable, the degraded notification-only outcome is recorded
without claiming that gate passed.

---

### Phase 1: Extract the Shared Deterministic Wordbreak Engine

**Goal:** Make one Wordbreak implementation callable from the web and native UI
without changing shipped behavior.

**Skills:** `debug`, `documentation`, `context7-mcp`

**Tasks:**

- [ ] Create `src/game/wordbreak-content.js`,
  `src/game/wordbreak-core.js`, `src/game/wordbreak-browser.js`, and
  `src/web/wordbreak.template.html` as the only authored browser inputs;
  `wordbreak_v2.html` and `public/index.html` become checked generated outputs.
- [ ] Implement `WordbreakCore.create({stateJson, content, nowMs,
  timezoneOffsetMinutes, random, uuid})` and `dispatch(action) -> {stateJson,
  viewModel, effects, semanticEvents}`. The core may not access DOM, storage,
  audio, network, timers, or undeclared host globals.
- [ ] Keep the complete `wb2` payload as opaque canonical JSON owned by
  JavaScript. Hosts decode typed action/view/effect/event envelopes but persist
  the returned state bytes without reshaping the learner ledger or dropping
  unknown/quarantined fields.
- [ ] Require each host to atomically commit returned state before acknowledging
  the action or performing nonessential effects. Add browser/native
  storage-failure fixtures proving the item/action remains retryable and neither
  reporting transport nor completion navigation executes after a failed write.
- [ ] Preserve the current same-write relationship among progress, scheduler,
  session cursor, assessment, and aggregate-only `P.reporting`; keep transport
  outside the reducer and idempotent by existing revision/checkpoint contracts.
- [ ] Move browser-only rendering, DOM events, localStorage, reporting transport,
  and audio playback into `src/game/wordbreak-browser.js` without changing
  visible behavior.
- [ ] Add `scripts/build-web.mjs`, `npm run build:web`, and a non-writing
  `npm run check:web`. The check regenerates in memory and fails unless both
  `wordbreak_v2.html` and `public/index.html` are byte-identical to output.
- [ ] Make `sync:public`, `dev`, `deploy`, and `npm test` run `check:web`; no path
  may copy or deploy an unchecked artifact.
- [ ] Extend `scripts/runtime-data.mjs` and create
  `src/game/wordbreak-parity.test.js` to replay every Phase 0 trace independently
  against the frozen legacy HTML, Node core, newly generated browser artifact,
  and later JavaScriptCore bridge. Expected and actual output must not be
  derived from the same generated file.
- [ ] Add content and engine hashes to the runtime export; fail if the browser
  artifact, Node tests, or later iOS bundle contain different bytes or
  normalized curriculum data.
- [ ] Preserve unknown-field round trips and existing `wb2` progress imports;
  do not require a progress migration for a semantic-only extraction.

**Verification:** `npm test` and `npm run check:web` pass; two consecutive web
builds are byte-stable; all independent golden traces are equal at every
transition; storage-failure and unknown-field fixtures pass; curriculum remains
48/192 plus 4/16; and the generated web app passes the existing local browser
smoke with no visible or reporting regression.

---

### Phase 2: Build the Native Daily Shell and Mathbreak

**Goal:** Deliver one calm mobile flow that completes both subjects and persists
correctly through interruption, relaunch, and offline use.

**Skills:** `steve-jobs`, `jony-ive`, `context7-mcp`, `documentation`

**Tasks:**

- [ ] Create the SwiftUI application under `ios/Wordbreak/` with feature folders
  for `Daily`, `Wordbreak`, `Mathbreak`, `Capture`, `Notifications`, and
  `ScreenTime`; keep the learner path sequential and thumb-reachable.
- [ ] Bundle the exact `src/game/wordbreak-core.js` bytes and verified audio
  assets as generated Xcode resources; add a build phase that fails on engine,
  curriculum, manifest, or audio-hash drift.
- [ ] Implement `ios/Wordbreak/Engine/WordbreakEngineBridge.swift` using
  JavaScriptCore and typed Codable envelopes. SwiftUI sends learner actions and
  renders returned view state; it never reimplements selection or grading.
- [ ] Add a JavaScriptCore XCTest harness that replays the shared golden traces
  and compares every result with Node/browser output.
- [ ] Implement `src/game/mathbreak-core.js` with deterministic fact selection,
  progress, delayed retrieval, and strategy transitions for make-ten,
  doubles/near-doubles, inverse fact families, commutativity, 2/5/10 anchors,
  doubling/halving, and distributive decomposition.
- [ ] Use the 24-item screener only to choose a broad operation lane, then run
  the fixed within-lane probe before assigning a fact-family/strategy path.
  Correctness, revision, and latency are descriptive; record strategy only when
  Luca explicitly constructs or selects a mathematically equivalent
  decomposition. Allow a parent-only override outside the daily learner UI.
- [ ] Implement the Mathbreak interaction as `attempt -> strategy bridge ->
  explain/construct -> retype -> delayed retrieval`; use age-appropriate tool
  language and manipulable number structure without cartoon rewards.
- [ ] Implement `DailySessionController` with one start action and a
  deterministic minimum-work contract: both subjects receive a predeclared
  minimum number of production/reconstruction opportunities before either gets
  optional work. Twelve minutes is a soft target; an atomic Wordbreak module or
  active Mathbreak correction finishes and the event report records overshoot.
- [ ] Add a synthetic worst-case session fixture containing an unread,
  non-fast-pass Wordbreak module plus Mathbreak corrections. Set any user-facing
  duration claim only after measuring that path on Luca's physical device.
- [ ] Store native progress in versioned files protected by atomic writes. Add
  an explicit import of the current web `wb2` state only after a preview and
  hash validation; never silently merge divergent histories.
- [ ] Emit typed semantic events for every prompt, touch, submission, latency,
  correction, strategy reveal, hint, navigation, pause/resume, engine
  transition, and completion into a monotonic local JSONL ledger.
- [ ] Implement the Phase 0 post-session check-in—`confusing`, `annoying`, `too
  easy`, or `okay`, plus optional speech—as first-person calibration evidence.
- [ ] If private aggregate reporting is active, make native the sole
  authoritative device, implement Plan 004's existing revision/checkpoint
  transport in Swift, keep its credential in Keychain, explicitly re-pair after
  import, and deactivate the browser credential. If reporting is not active,
  mark coverage visibly paused for the experiment rather than reporting zeros.
- [ ] Add parity fixtures proving a native action produces the same aggregate
  bucket mutation as the browser and that importing state cannot reuse another
  device's reporting credential.
- [ ] Add accessibility labels, Dynamic Type, VoiceOver order, keyboard and
  numeric keypad behavior, reduced-motion handling, and dark/light contrast.

**Verification:** Node and JavaScriptCore golden traces match; native unit/UI
tests pass; the app completes both subjects offline; kill/relaunch resumes the
exact item once; the worst-case duration is measured; reporting authority is
explicit; no visible timer or speed reward appears; and Luca can finish a device
smoke without encountering parent or experiment controls.

---

### Phase 3: Add Notifications and the Screen Time Opportunity Trigger

**Goal:** Create a reliable daily start rhythm without turning practice into an
annoying notification stream or pretending device use proves boredom.

**Skills:** `jony-ive`, `context7-mcp`, `debug`

**Tasks:**

- [ ] Implement `NotificationScheduler.swift` with local calendar notifications
  at 4:00 PM and 7:30 PM in the device time zone; reschedule on time-zone and
  daylight-saving changes.
- [ ] Deep-link every nudge to the single unfinished daily session, cancel the
  evening fallback immediately after completion, and never notify again that
  day once both subjects are complete.
- [ ] Create a parent-only setup screen for notification authorization and
  selected times; explain the exact behavior before requesting permission.
- [ ] Add `FamilyControls` selection and a `DeviceActivityMonitor` extension
  under `ios/WordbreakScreenTimeMonitor/`, sharing only today's completion state
  and schedule through an App Group.
- [ ] Keep the extension callback bounded to reading the App Group completion
  and nudge ledger and scheduling one local notification. It performs no
  network request, media work, model call, or analysis.
- [ ] When a selected app/category/web-domain threshold reaches 15 minutes after
  3:00 PM and today's session is incomplete, schedule one opportunity nudge.
  Do not shield, block, or launch over another app.
- [ ] Deduplicate notification and Screen Time triggers through a single daily
  nudge ledger and test late completion, clock changes, disabled permissions,
  device restart, midnight rollover, authorization revocation, and reinstall.
  Candidate agents may not change app/extension entitlements, bundle IDs,
  provisioning, or App Group identifiers.

**Verification:** Calendar and DeviceActivity tests pass; on-device notification
receipts show correct deep linking and cancellation; at most one Screen Time
nudge fires per day; and denial of either permission leaves ordinary app launch
and practice fully functional.

---

### Phase 4: Capture and Upload the Complete Session

**Goal:** Produce a synchronized, replayable record of what Luca saw, did, said,
and expressed, aligned to exact software events and build state.

**Skills:** `context7-mcp`, `debug`, `documentation`

**Tasks:**

- [ ] Implement the ingest subset of `experiment/service/` before physical
  upload testing: device provisioning, session creation, exact-size signed
  segment upload, missing-object renewal, finalization, status, and artifact
  retrieval. Analysis remains out of this phase.
- [ ] Provision one revocable per-device random credential through a
  parent/operator setup flow, store it in Keychain, and store only its hash
  server-side. Never embed a Google service-account key or require a phone to
  mint Cloud Run service-to-service credentials.
- [ ] Implement `CaptureCoordinator.swift` behind a protocol, using the ReplayKit
  adapter selected in Phase 0 and retaining separate screen/app-audio,
  front-camera, and microphone tracks whenever the platform exposes them.
- [ ] Start capture when Luca starts today's practice and stop it only after the
  completion transition or explicit exit. Show a quiet persistent recording
  indicator, but no distracting self-view during practice.
- [ ] Store every capture restart under
  `raw/segments/<segment-id>/` with separate playable tracks. Record segment ID,
  host-clock anchor, first/last presentation timestamps, duration,
  discontinuities, byte count, checksum, capture reason, and completeness.
- [ ] Record `hostMonotonicNs`, `captureSegmentId|null`, and
  `segmentMediaTimeMs|null` on each event. Preserve valid events during capture
  gaps with null media linkage and map each segment's host clock to media PTS.
- [ ] Define eligible session time as foreground learning after required capture
  readiness and before completion, excluding only manifest-declared
  interruption intervals. Add a validator for PTS monotonicity inside segments,
  ordered/nonoverlapping anchors, and exactly one segment resolution for every
  media-linked event.
- [ ] Create `SessionPackager.swift` to close files atomically, calculate
  SHA-256 checksums, and seal an immutable client-authored
  `capture-manifest.json` containing expected object names, segment inventory,
  byte counts, coverage, and capture metadata—but no cloud generations.
- [ ] Upload each independently playable, bounded segment file from disk with a
  background `URLSession` task and an exact-size, short-lived signed PUT URL.
  Persist task IDs; renew only absent objects. A retry may restart one bounded
  segment, never an entire practice-length recording.
- [ ] At finalization, verify every object generation and size, stream or
  compose data to verify each SHA-256, and conditionally create the authoritative
  `session-manifest.json` with `ifGenerationMatch=0`. It includes the capture
  manifest hash and all GCS generations; duplicate finalization is idempotent.
- [ ] Keep the six experiment sessions and derived artifacts until formal
  closeout; provide parent-only export and deletion controls after the evidence
  bundle is finalized.

**Verification:** Three physical-device sessions—normal completion, forced
interruption/relaunch, and network loss/resume—produce schema-valid immutable
segmented bundles through the deployed ingest service. Each required track
covers at least 98% of eligible session time, audio/video drift is at most 250
ms, every media-linked event resolves to exactly one segment, checksums and GCS
generations match after download, partial segment retry is demonstrated, and
practice succeeds when capture or upload is deliberately disabled.

---

### Phase 5: Build the Gemini Observation and Diagnosis Pipeline

**Goal:** Turn each session bundle into grounded, inspectable evidence without
collapsing visible behavior and inferred mental state into the same claim.

**Skills:** `ilya-sutskever`, `context7-mcp`, `documentation`

**Tasks:**

- [ ] Add proxy composition and the Cloud Run analysis job to the Phase 4 ingest
  service. Create a Gemini-ready video with readable screen content,
  front-camera picture-in-picture, mixed app/microphone audio, burned-in
  session/segment/time IDs, and retained raw tracks.
- [ ] Require the Vertex project and private media bucket to be the same project
  unless a separately proven service-access path is recorded.
- [ ] Define `analysisKey = SHA256(finalManifestGeneration + proxyHash +
  promptHash + responseSchemaHash + modelId + settingsHash +
  analyzerCodeVersion)`. Attempts are append-only; `ifGenerationMatch=0`
  creates at most one accepted result, and duplicate jobs exit when it exists.
- [ ] Create versioned prompts in `experiment/prompts/observer.md`,
  `learning-diagnostician.md`, and `product-synthesizer.md`. Include the exact
  task, source hierarchy, allowed inferences, timestamp requirements, confidence
  rubric, and output schema in each prompt.
- [ ] Define `experiment/schemas/observation.schema.json` for factual moments and
  `diagnosis.schema.json` for hypotheses. Observation is restricted to screen
  state, authoritative event IDs, visible action, literal transcript spans,
  closed-list observable face/body/voice signals, and source/time confidence.
  It contains no inferred emotion, intent, attention, or comprehension field.
- [ ] Allow diagnosis to express a product/teaching hypothesis, alternatives,
  confidence, and falsifying test. Emotion, intent, attention, or comprehension
  claims require an explicit citation to Luca's first-person check-in.
- [ ] Feed Gemini the composite video, raw audio where useful, semantic event
  trace, recent local learning summary, exact curriculum slice, build revision,
  and experiment history. Treat the event trace as authoritative for exact taps
  and engine state.
- [ ] Split analysis into a whole-session pass and event-anchored, higher-FPS
  clips for candidate moments. Pin API version, processing mode, FPS, media
  resolution, input ordering, and audio inputs; do not duplicate mixed and raw
  audio without a recorded ablation.
- [ ] Compile the provider response schema from the supported repository schema
  subset, set the required JSON response MIME type, and pass a live API dry run
  before model selection.
- [ ] Record two non-experiment calibration sessions after capture/ingest are
  stable. Freeze blinded positive moments, negative/no-event windows, and fast
  UI transitions before comparing the currently available high-capability video
  model with a current agentic/fast alternative under identical settings.
- [ ] Pin the winning model identifier and settings in a new immutable
  experiment config revision. Never let a moving `latest` alias silently change
  an active experiment.
- [ ] Create `scripts/experiment/review-analysis.mjs` to render observations
  beside linked timestamps and collect human labels for supported, unsupported,
  mistimed, or missed claims. Collect labels blind to the producing model.

**Verification:** Every accepted output validates against both the repository
schema and a live provider request, and every citation opens the media moment.
On at least 30 blinded human-reviewed positive and negative windows, report
precision, recall, timestamp-error distribution, unsupported-claim rate, and
coverage with denominators. Timestamped event precision reaches 90%, no
unsupported high-confidence claim enters a product brief, and failed/malformed
stages retry without overwriting accepted outputs.

---

### Phase 6: Build the Coding-Agent Ensemble and Release Lane

**Goal:** Convert the same evidence into competing implementation candidates,
select one independently, and release it automatically only inside a narrow,
tested change envelope.

**Skills:** `ilya-sutskever`, `second-opinion`, `audit`, `git-commit`

**Tasks:**

- [ ] Create `scripts/experiment/run-ensemble.mjs` to materialize a read-only
  evidence packet containing the immutable session artifacts, Gemini results,
  exact repository SHA, current plan, relevant methodology, prior hypothesis,
  and predeclared success metric.
- [ ] Run orchestration, policy checks, archive, and installation from a trusted
  baseline checkout whose SHA and orchestrator hashes are sealed before
  candidate generation. Never execute trusted release policy from a candidate
  worktree.
- [ ] Give each candidate a sanitized temporary home with only dedicated model
  authentication, a minimized read-only evidence packet, and one writable
  worktree. Deny GCloud credentials, Apple signing assets, raw GCS URIs,
  unrelated repository paths, and unapproved network destinations.
- [ ] Give diagnostic agents the structured Gemini output, event excerpts, and
  explicitly selected stills/clips needed to inspect the behavior. Gemini is the
  full-video observer; record exactly which derived evidence each downstream
  provider receives.
- [ ] Run three independent read-only roles: a learning-science critic, a
  product/interaction critic, and a code-path mapper. Preserve complete prompts,
  model/settings metadata, stdout/stderr, and exit status for each.
- [ ] Run a synthesis role that ranks issues by evidence strength, learner
  impact, reversibility, and measurement clarity, then selects exactly one
  hypothesis for the next epoch.
- [ ] Give Codex and Claude separate clean worktrees at the same base SHA to
  create independent candidates for that hypothesis. Prevent access to raw
  credentials and prohibit changes outside the allowlisted UI, sequencing,
  hints, instrumentation, and noncanonical personalization surfaces.
- [ ] Pin noninteractive CLI versions and invocation/exit contracts. Require
  each candidate to produce a commit, then enforce path allowlists, canonical
  hashes, schema/fixture validators, and an executable semantic-diff policy
  before build.
- [ ] Run an independent judge over both diffs, evidence, test results, UI
  screenshots, accessibility output, complexity delta, and predicted metric;
  allow `no candidate` as a first-class result.
- [ ] Require `npm test`, JavaScriptCore parity, Xcode unit/UI tests, capture
  smoke, schema validation, secret scanning, and a scoped repository audit on
  the selected candidate before it can be marked releasable.
- [ ] Record the base SHA, candidate SHAs, reviewer outputs, winner rationale,
  files changed, test receipts, signed app build identifier, installation time,
  and rollback reference in an immutable `release-receipt.json`.
- [ ] In `AUTOPILOT`, install the selected signed build to Luca's connected
  iPhone with no per-candidate approval only when every allowlist and test gate
  passes. A curriculum, correct-answer, assessment, entitlement, backend-auth,
  or reporting change must stop before installation and enter manual review.
- [ ] Test and archive the exact selected candidate commit. Record archive hash,
  embedded engine/content hashes, signing identity, entitlements, bundle ID,
  build number, and candidate SHA; install that archive with `devicectl`, then
  independently query the connected, trusted, unlocked, Developer Mode-enabled
  iPhone for installed bundle/build identity and run the physical smoke.
- [ ] Preserve the tested baseline archive and compatible preinstall state
  snapshot before any candidate installation.
- [ ] Refuse release if the candidate bundles a different Wordbreak core/content
  hash than the tested web artifact or if more than one substantive hypothesis
  is present.

**Verification:** Deterministic stub agents drive the full orchestration twice
with byte-identical receipts; real frontier agents retain complete provenance
and gate-equivalent outcomes rather than a false byte-reproducibility promise.
Both candidate worktrees remain isolated; the judge can select either candidate
or neither; credential/path/semantic-policy and failed-test fixtures block
installation; and an allowlisted no-op candidate produces a complete dry-run
release receipt without touching `main`.

---

### Phase 7: Run the Six-Session Luca Experiment

**Goal:** Prove that the loop can observe a real problem, change the software,
and test the predicted improvement on the same learner.

**Skills:** `steve-jobs`, `ilya-sutskever`, `audit`

**Tasks:**

- [ ] Freeze the experiment config, install the baseline build, set `OBSERVE`,
  and record two complete sessions without changing prompts, curriculum, model,
  or product behavior between them. These are experiment sessions 1-2 in
  condition A; Phase 5 calibration sessions are explicitly excluded.
- [ ] Human-review the baseline recordings and Gemini outputs, resolve any
  capture or tagging defects, and rerun only missing/malformed analysis stages.
- [ ] Predeclare one proximal, reversible interaction behavior and metric from
  the evidence—for example, repeated rule reopening, accidental submission,
  strategy-panel abandonment, or dead time before the next action—and record
  the predicted direction. Treat spelling/math learning as a guardrail, not a
  six-session causal outcome.
- [ ] Run `PROPOSE`, inspect the diagnosis/candidate packet for evidence linkage,
  then enable `AUTOPILOT` for the already-defined allowlist and release gates.
- [ ] Let the ensemble create, judge, test, and install one candidate. Do not
  bundle unrelated polish or another learning hypothesis into the build.
- [ ] Run sessions 3-4 under candidate condition B, reinstall the already-tested
  baseline archive for session 5 under A, then reinstall the same tested
  candidate archive for session 6 under B. Do not change config, content,
  prompts, model, metric, or either archive during `A, A, B, B, A, B`.
- [ ] Compare the predeclared proximal event rate, completion, repair behavior,
  Luca's first-person check-ins, and guardrails by condition and sequence. Report
  learning observations descriptively and the tiny sample as within-Luca
  directional evidence, never a population claim.
- [ ] Classify the interaction result as `directionally consistent`,
  `directionally inconsistent`, or `inconclusive`. Do not use `caused`,
  `falsified`, or a durable-learning claim. If B regresses a guardrail, restore
  the tested A archive immediately; otherwise preserve both archives and write
  any next hypothesis as a separate epoch.
- [ ] Review the final experience with Luca on the physical device and record
  whether the daily start, both subject loops, and completion feel coherent
  without exposing the machinery behind them.

**Verification:** Six valid experiment bundles exist in the exact
`A, A, B, B, A, B` order; A and B each resolve to one tested immutable archive;
exactly one substantive hypothesis differs; all analysis and release artifacts
resolve to immutable inputs; and the predeclared proximal metric and guardrails
are reported as directionally consistent, directionally inconsistent, or
inconclusive.

---

### Phase 8: Validate, Document, and Close the Experiment

**Goal:** Leave a reproducible native product, a truthful experiment record, and
clean rollback/deletion paths rather than a one-off demo.

**Skills:** `audit`, `documentation`, `markdown`, `git-push`

**Tasks:**

- [ ] Run the complete web, core, math, iOS, schema, backend, media, agent, and
  physical-device test matrix from a clean checkout at the recorded release
  SHA.
- [ ] Run the repository `audit` skill over all plan-touched paths, fix findings,
  and rerun until no correctness, architecture, or unjustified complexity issue
  remains.
- [ ] Exercise every kill switch and rollback path, including web fallback,
  native capture-off learning, upload pause/resume, analysis disablement,
  agent-write disablement, automated-install disablement, and candidate revert.
- [ ] Update `README.md`, `methodology.md` only if learning doctrine changed,
  `docs/plans/README.md`, and `experiment/README.md` with current architecture,
  setup, commands, costs, artifact lifecycle, and experiment result.
- [ ] Generate a final export with manifests, prompts, schemas, model settings,
  analyses, agent transcripts, diffs, tests, release receipts, and metric report;
  verify it independently from the working storage paths.
- [ ] Use the parent-only control to delete the six experiment bundles and two
  calibration bundles after the accepted export if the experiment is closed,
  and verify deletion; keep only the explicitly chosen derived evidence and
  result summary.
- [ ] Remove spike-only code, unused vendor experiments, temporary entitlements,
  orphaned worktrees, and unreferenced cloud resources. Preserve fixtures and
  regression tests that defend shipped behavior.
- [ ] Commit and push only the scoped implementation after all gates pass; do
  not stage the unrelated files that were already dirty at planning time.

**Verification:** All commands in Executable Memory pass from a clean checkout;
the app is installed and visually accepted on Luca's iPhone; the web app still
deploys as one file with the same engine/content hash; the final export opens;
the selected retention action is verified; and the repository contains no
temporary experiment debris or unrelated staged changes.

## Executable Memory

- Full existing regression: `npm test`
- Generated web integrity: `npm run check:web`
- Curriculum truth: `node scripts/curriculum/validate-content.mjs`
- Assessment separation: `node scripts/assessment/validate-bank.mjs`
- Deterministic parity: `node --test src/game/wordbreak-parity.test.js`
- Math truth: `node scripts/math/validate-content.mjs`
- Experiment configuration:
  `node scripts/experiment/validate-config.mjs experiment/config/experiment.v1.json`
- Session bundle:
  `node scripts/experiment/validate-session.mjs --session <session-id>`
- Analysis schemas:
  `node scripts/experiment/validate-analysis.mjs --session <session-id>`
- Ensemble dry run:
  `node scripts/experiment/run-ensemble.mjs --fixture synthetic --mode PROPOSE`
- iOS unit/parity tests:
  `xcodebuild -project ios/Wordbreak.xcodeproj -scheme Wordbreak -destination 'platform=iOS Simulator,name=iPhone 17' test`
- Clean iOS archive:
  `xcodebuild -project ios/Wordbreak.xcodeproj -scheme Wordbreak -configuration Release archive`
- Physical capture and Family Controls behavior are not adequately provable by
  simulator commands; retain timestamped device recordings, manifests,
  `xctrace` device identity, and signed-build receipts as the manual proof.
- Agent installation is not adequately provable by a branch diff; retain the
  exact install command result, device/build identity, and rollback receipt.

## Success Criteria

### Hard Requirements (Must Pass)

- The iPhone uses a mobile-specific SwiftUI interface and the same checked-in
  Wordbreak core bytes and curriculum hash as the web build.
- Golden traces remain identical across the legacy snapshot, extracted Node
  core, generated browser artifact, and JavaScriptCore bridge.
- One daily completion requires meaningful Wordbreak and Mathbreak production;
  neither lane can be silently skipped or substituted with recognition tasks.
- Mathbreak validates every equation and teaches at least one number-sense
  reconstruction strategy for each selected weak fact family without visible
  timing pressure.
- Notifications and the optional Screen Time trigger converge on the same
  unfinished daily session and stop after completion.
- Every accepted experiment session contains segmented screen, front-camera,
  microphone, app-audio, and semantic-event evidence with at least 98%
  eligible-duration coverage, no more than 250 ms measured drift, and explicit
  host-clock-to-media-PTS mappings.
- Gemini outputs are schema-valid, timestamp-grounded, model/prompt/version
  pinned, and meet the baseline human-review threshold before they can influence
  a code candidate.
- Independent frontier coding agents produce competing candidates, a separate
  judge may reject all of them, and only one allowlisted, fully tested change is
  installed per epoch.
- A failed capture, upload, model call, agent, or backend never prevents Luca
  from finishing and saving practice locally.
- The `A, A, B, B, A, B` result distinguishes observed facts, model inference,
  human interpretation, and directional evidence, and makes no durable-learning
  or population causal claim.

### Definition of Done

All nine phases are complete; all automated and physical-device gates pass;
the baseline and post-change bundles plus release receipt are reproducible; one
AI-proposed change has been automatically installed under the declared gates;
the predeclared proximal product effect has been evaluated directionally; Luca
and the parent
accept the final on-device flow; rollback and kill switches are proven; scoped
work is reviewed, committed, pushed, and documented; and raw experiment media
has either been deliberately retained for the next epoch or deleted with a
verified closeout receipt.

## Open Questions

### Resolved

- **Q:** Should the iPhone reuse the existing webpage UI?
- **A:** No. It gets a purpose-built SwiftUI interface, but it executes the same
  extracted Wordbreak core and verified curriculum as the web app.
- **Q:** Should the Wordbreak engine be rewritten in Swift?
- **A:** No. JavaScriptCore hosts the exact platform-neutral JavaScript core;
  golden traces and byte/content hashes prevent behavioral drift.
- **Q:** Should capture use ScreenCaptureKit?
- **A:** Not for Luca's current iOS 26.7 device. Start with ReplayKit and
  AVFoundation; add an iOS 27 ScreenCaptureKit adapter only after an upgrade and
  physical parity proof.
- **Q:** Should a generic session-replay/analytics SDK be added?
- **A:** No. The requested source evidence requires real synchronized screen,
  camera, microphone, app audio, and semantic events, so a small native capture
  and event pipeline is the simpler honest fit.
- **Q:** Where should large media and Gemini analysis run?
- **A:** Private GCS plus Cloud Run and Vertex AI, isolated from the existing
  Cloudflare aggregate-reporting path.
- **Q:** Is Screen Time evidence of boredom?
- **A:** No. It is only an opportunity trigger when selected usage crosses a
  threshold and practice is unfinished.
- **Q:** How autonomous is the coding loop?
- **A:** After two baseline sessions and an inspected `PROPOSE` run, `AUTOPILOT`
  may install an allowlisted, fully tested winner without per-change approval.
  Canonical learning truth and infrastructure/auth changes remain outside that
  envelope.
- **Q:** How many changes should the first experiment make?
- **A:** One substantive candidate, measured in `A, A, B, B, A, B` order using
  the same tested A and B archives. Independent variables matter more than the
  appearance of velocity.
- **Q:** Which device owns aggregate parent reporting during native use?
- **A:** Native is the sole authority when reporting is enabled and requires
  explicit re-pairing; the browser credential is deactivated. If reporting is
  not active, coverage is visibly paused rather than silently recording zeros.

### Unresolved

- **Q:** Does Luca's exact device/signing setup allow the Family Controls
  entitlement and reliable ReplayKit camera/microphone composition?
- **Options:** Phase 0 proves the primary path; notifications replace a denied
  Family Controls capability, and manual track composition replaces an
  incomplete ReplayKit recording.
- **Q:** Which math lane should lead after onboarding?
- **Options:** Addition/subtraction within 20 or multiplication/division through
  12; the fixed baseline selects the weaker supported lane, with a parent-only
  override.
- **Q:** Which current Gemini video model should be pinned?
- **Options:** The best currently available high-capability model versus a
  current agentic/fast model; the frozen baseline bakeoff and human rubric decide.
- **Q:** What Google Cloud project, region, budget ceiling, and retention date
  will own the experiment?
- **Options:** Reuse an approved private project or create a dedicated project;
  Phase 0 must record the decision before any real upload.
- **Q:** Should Luca's phone be upgraded to iOS 27 during the experiment?
- **Options:** Stay on iOS 26.7 for the first epoch to avoid changing platform
  and product simultaneously, or run a separate capture-adapter parity epoch
  after the six-session result.

## References

### Internal

- [Wordbreak README](../../README.md)
- [Learning Methodology](../../methodology.md)
- [Plans Index](README.md)
- [Budgeted Session Compiler Plan](003-budgeted-session-compiler-plan.md)
- [Private Parent Reporting Plan](004-private-parent-reporting-plan.md)
- [Before/After Assessment Plan](005-before-after-spelling-assessment-plan.md)
- [Targeted Curriculum Expansion Plan](006-luca-targeted-curriculum-expansion-plan.md)
- [Plan Workflow Skills Guide](../skills/plan-workflow-skills-guide.md)

### External

- [Apple ReplayKit](https://developer.apple.com/documentation/replaykit)
- [Apple RPScreenRecorder](https://developer.apple.com/documentation/replaykit/rpscreenrecorder)
- [Apple ScreenCaptureKit](https://developer.apple.com/documentation/screencapturekit)
- [Apple UserNotifications](https://developer.apple.com/documentation/usernotifications)
- [Apple Family Controls](https://developer.apple.com/documentation/familycontrols)
- [Apple DeviceActivity](https://developer.apple.com/documentation/deviceactivity)
- [Gemini video understanding](https://ai.google.dev/gemini-api/docs/video-understanding)
- [Gemini audio understanding](https://ai.google.dev/gemini-api/docs/audio)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Vertex AI video input](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/video-understanding)
- [Fluency Without Fear](https://www.youcubed.org/evidence/fluency-without-fear/)

## Modules

### Daily User Flow

1. At 4:00 PM, or after the configured DeviceActivity threshold, Luca receives
   one invitation to finish today's practice.
2. `Start today's practice` establishes the session ID, event clock, and capture
   state, then opens the first learning block.
3. Wordbreak and Mathbreak each receive a protected work budget. The order may
   adapt between days, but both must contribute work before completion.
4. A miss opens the subject's reconstruction path, then asks Luca to produce the
   answer again and schedules delayed retrieval.
5. The completion transition persists both engines atomically, cancels pending
   nudges, closes and packages media, and returns immediately to a simple done
   screen.
6. Upload, Gemini analysis, and agent work continue outside the learning path.
7. A later epoch may install one tested improvement; the next session looks like
   the same product, not an experiment console.

### Data Model and Artifact Layout

```text
gs://<private-bucket>/experiments/<experiment-id>/
  config/<config-hash>.json
  sessions/<session-id>/
    raw/segments/<segment-id>/screen.mov
    raw/segments/<segment-id>/front-camera.mov
    raw/segments/<segment-id>/microphone.m4a
    raw/segments/<segment-id>/app-audio.m4a
    events/events.jsonl
    derived/gemini-proxy.mp4
    manifest/capture-manifest.json
    manifest/session-manifest.json
    analysis/<analysis-key>/observation.json
    analysis/<analysis-key>/diagnosis.json
  epochs/<epoch-id>/
    evidence-packet.json
    agents/<role>/<run-id>/
    candidates/<candidate-id>/candidate-receipt.json
    release/release-receipt.json
    result/metric-report.json
```

Native versioned state is separated into daily coordination, Wordbreak progress,
Mathbreak progress, notification/nudge state, capture queue, and experiment
configuration. The current web `wb2` payload remains independently importable
and exportable; it is not overwritten by an incomplete native import.

### API Contracts

The Cloud Run service exposes only the experiment operations the app and local
operator need:

- `POST /v1/sessions` creates an immutable session identity and returns
  short-lived resumable upload targets.
- `POST /v1/sessions/{id}/renew-uploads` renews only missing object targets.
- `POST /v1/sessions/{id}/finalize` verifies declared generations/checksums and
  starts the idempotent analysis job.
- `GET /v1/sessions/{id}` returns upload and analysis stage status.
- `GET /v1/sessions/{id}/artifacts` returns signed downloads for the authorized
  local operator.
- `POST /v1/sessions/{id}/delete` performs the parent-authorized closeout and
  returns a deletion receipt.

Authentication uses a revocable random per-device credential provisioned by the
parent/operator and held in Keychain; only its hash is stored server-side.
Signed object URLs are narrow in path, content type, exact size, and lifetime.
The service never exposes raw objects publicly. `capture-manifest.json` is the
immutable client claim; `session-manifest.json` is conditionally created by the
server only after object generations and hashes are verified.

### Event and Analysis Contract

Each event contains `sessionId`, `sequence`, `hostMonotonicNs`,
`captureSegmentId|null`, `segmentMediaTimeMs|null`, `subject`, `screen`,
`engineVersion`, `contentHash`, `eventType`, and a typed payload. Each segment
records the explicit host-clock-to-media-PTS mapping. Events during capture gaps
remain valid with null media linkage. The trace records exact learner inputs
because video sampling may miss fast UI transitions.

Each observed moment contains:

```json
{
  "momentId": "m-0042",
  "startMs": 124000,
  "endMs": 131500,
  "screenState": "math.strategy.distributive",
  "observedAction": "Learner closes the strategy and reopens it.",
  "transcript": "I don't get this split.",
  "faceVoiceSignals": ["looks away", "audible sigh"],
  "signalConfidence": 0.92,
  "eventIds": ["e-188", "e-189"],
  "checkInCitation": null
}
```

The observation schema contains no inferred-state field. The diagnosis layer
may connect moments into a hypothesis and list alternative explanations, but it
cannot erase the distinction between recorded fact and interpretation. Emotion,
intent, attention, or comprehension requires Luca's first-person check-in.
Product briefs link to moment IDs and name plausible code paths.

### Agent Change Envelope

`AUTOPILOT` may modify SwiftUI layout/copy/motion, accessible controls,
noncanonical hint presentation, daily ordering, validated item-selection
weights, event instrumentation, and performance fixes. It may not modify
canonical spelling/math truth, frozen assessments, media/auth access controls,
cloud retention, reporting definitions, deployment credentials, or the
allowlist itself. Generated changes never commit directly to `main`. A trusted
baseline runner—not candidate code—enforces policy, builds the exact candidate
commit, hashes the archive, installs it, and verifies the installed identity.
Candidate processes run with sanitized homes and cannot access cloud/signing
credentials or the raw session corpus.

The judge optimizes in this order: evidence support, likely learner benefit,
preservation of teaching doctrine, simplicity, reversibility, test coverage,
and polish. Code volume and novelty are not positive signals.

### Performance and Cost Budgets

| Operation | Target |
| --- | --- |
| Native launch to ready state | p95 under 1.0 second on Luca's iPhone |
| Learner action to UI response | p95 under 100 ms excluding intentional audio |
| Engine bridge round trip | p95 under 20 ms |
| Event append | p95 under 10 ms and never block rendering |
| Capture dropped frames | Under 1% during the 15-minute feasibility run |
| Post-session packaging | Under 60 seconds, off the completion screen |
| Resumable upload | No restart from byte zero after ordinary interruption |
| Gemini result | Available within 20 minutes of complete upload |
| Agent candidate packet | Available within 60 minutes of accepted analysis |
| Experiment cloud/model spend | Phase 0 sets a hard budget ceiling before upload |

### Error Handling and Edge Cases

| Scenario | Behavior | Fallback |
| --- | --- | --- |
| Camera or microphone denied | Record declared available tracks; mark manifest incomplete. | Continue learning and show parent-only remediation later. |
| ReplayKit interrupted | Close valid fragments and record exact gap. | Continue event trace and practice; no false complete label. |
| App killed mid-item | Atomic progress remains at the last committed transition. | Resume the exact unfinished item and start a new media segment. |
| Upload expires or network disappears | Preserve local package and bytes uploaded. | Renew missing targets and resume in background. |
| Gemini output is invalid | Preserve raw response and mark stage malformed. | Retry that stage with identical frozen inputs. |
| Gemini claim lacks evidence | Reject it from synthesis. | Human label becomes evaluation data. |
| One coding agent fails | Preserve failure receipt. | Judge remaining candidates or selects none. |
| Candidate crosses allowlist | Mark unreleasable before build. | Stay on current installed build. |
| Candidate tests fail | Preserve logs and reject candidate. | Stay on current installed build. |
| Family Controls unavailable | Disable opportunity trigger. | Keep scheduled notifications and direct launch. |
| Backend unavailable | Queue package locally. | Practice and native progress continue offline. |

### Degradation and Rollback

- **Capture off:** The native learning experience and event-free local progress
  continue normally.
- **Upload off:** Immutable packages remain queued on device with visible
  parent-only status.
- **Analysis off:** Uploaded sessions remain available; no model job is started.
- **Agent-write off:** Gemini may analyze, but agents are read-only.
- **Automated install off:** Candidates and receipts may be produced, but the
  installed build does not change.
- **Notifications or Screen Time off:** Luca can open the same daily session
  directly.
- **Native rollback:** Reinstall the signed baseline archive named in the active
  release receipt and restore the compatible versioned state snapshot.
- **Product fallback:** Open `wordbreak.fun`; the existing web engine and
  aggregate reporting remain independent of the experiment backend.
- **Cloud teardown:** Disable service identity, revoke device credentials,
  export accepted evidence, delete experiment objects/resources, and verify the
  deletion receipt.

### Rollout and Gates

The rollout is Luca-only and physical-device-first. Phase 0 capture and
entitlement proofs gate architecture. Phase 1 parity gates native Wordbreak.
Native learning quality gates instrumentation. Two unchanged `OBSERVE` sessions
gate the first `PROPOSE` run. An inspected proposal and successful synthetic
release drill gate `AUTOPILOT`. Every later epoch retains the same one-change
rule and can independently disable observation or autonomous release.

### Monitoring and Observability

Track session start/completion, subject completion, interruption, active time,
correction loops, hint/strategy opens, repeated actions, delayed-retrieval
outcomes, capture completeness, track drift, upload retries, analysis latency,
schema failures, unsupported-claim rate, agent failures, candidate rejection,
test failures, build installation, rollback, and cloud/model cost.

The experiment report must pair each metric with its coverage. Missing media or
events are reported as missing, never converted to zero behavior. A small local
HTML report generated by `scripts/experiment/render-report.mjs` is sufficient;
do not build a dashboard before the loop proves useful.

### Testing and Validation

- **Core:** Golden traces, content hashes, migration/import fixtures, seed/time
  determinism, error-code behavior, field-pack boundaries, and browser parity.
- **Math:** Equation truth, inverse families, strategy equivalence, baseline
  balance, delayed retrieval, untimed behavior, and interruption recovery.
- **Native:** JavaScriptCore bridge, Codable envelopes, atomic persistence,
  daily budgets, UI navigation, accessibility, background/foreground, and
  notification deep links.
- **Capture:** Track presence, clock alignment, interruption, route changes,
  dropped frames, packaging, checksum, resumable upload, and physical playback.
- **Backend:** Authentication, signed-target scope, idempotent finalization,
  generation/checksum mismatch, job retry, artifact immutability, and deletion.
- **AI:** Frozen fixtures, schema compliance, timestamp links, adversarial
  unsupported claims, prompt/model versioning, and human-review agreement.
- **Agents:** Identical base SHA, worktree isolation, prompt provenance,
  allowlist denial, secret denial, failed-test rejection, `no candidate`, release
  receipt, and rollback.
- **End to end:** Notification -> daily practice -> complete capture -> upload ->
  Gemini -> ensemble -> candidate -> tests -> signed installation -> next
  session -> predeclared metric report.

### Phase Dependencies

```text
Phase 0 physical/API proof
        |
        v
Phase 1 shared Wordbreak core
        |
        v
Phase 2 native daily shell + Mathbreak
        |
        +--------------------+
        v                    v
Phase 3 notifications   Phase 4 capture/upload
                             |
                             v
                       Phase 5 Gemini pipeline
                             |
                             v
                       Phase 6 agent ensemble
                              \             /
                               +-----------+
                                     |
                                     v
                         Phase 7 six-session experiment
                                     |
                                     v
                         Phase 8 validation/closeout
```

### Files Likely to Change

| File or directory | Change type | Purpose |
| --- | --- | --- |
| `package.json` | Modify | Add generated-web build/check gates to test, dev, and deploy. |
| `wordbreak_v2.html` | Generated/modify | Preserve single-file web artifact over extracted core. |
| `src/web/wordbreak.template.html` | Create | Authored HTML shell for the generated web artifact. |
| `src/game/wordbreak-core.js` | Create | Shared deterministic Wordbreak engine. |
| `src/game/wordbreak-browser.js` | Create | Browser-only UI/storage/reporting adapter. |
| `src/game/mathbreak-core.js` | Create | Deterministic math-fact learning engine. |
| `src/game/mathbreak-content.json` | Create | Validated fact and strategy truth. |
| `scripts/build-web.mjs` | Create | Rebuild the single-file browser artifact. |
| `scripts/runtime-data.mjs` | Modify | Expose extracted core and parity helpers. |
| `scripts/math/` | Create | Math content and equivalence validation. |
| `test/fixtures/wordbreak-golden/` | Create | Pre-extraction behavior fixtures. |
| `ios/Wordbreak.xcodeproj` | Create | Native application and extensions. |
| `ios/Wordbreak/` | Create | SwiftUI app, engine bridge, storage, capture, and nudges. |
| `ios/WordbreakScreenTimeMonitor/` | Create | DeviceActivity callback extension. |
| `experiment/config/` | Create | Versioned immutable experiment configurations. |
| `experiment/schemas/` | Create | Event, manifest, observation, diagnosis, and receipt schemas. |
| `experiment/prompts/` | Create | Versioned Gemini and agent prompts. |
| `experiment/service/` | Create | Cloud Run upload/finalization and analysis job. |
| `scripts/experiment/` | Create | Validation, review, ensemble, and report tooling. |
| `README.md` | Modify | Native/experiment setup and current product paths. |
| `docs/plans/README.md` | Modify | Register this plan and final status. |

### Risks and Mitigations

- **ReplayKit does not yield the assumed composite:** The experiment cannot see
  all required signals. Prove it first on Luca's device and fall back to sample
  buffers plus AVFoundation composition.
- **Capture changes behavior or drops frames:** The evidence becomes
  self-distorting. Benchmark enabled versus disabled builds and keep rendering,
  event writing, and packaging off one another's critical path.
- **Engine extraction changes teaching semantics:** Native/web results diverge.
  Freeze pre-extraction traces and require transition-by-transition parity plus
  content hashes before any native learner session.
- **The model tells a persuasive but unsupported story:** Agents optimize a
  fiction. Separate observation from diagnosis, require timestamp/event links,
  calibrate on human labels, and block unsupported high-confidence claims.
- **The ensemble overfits one difficult session:** Product quality oscillates.
  Use frozen A/B archives in `A, A, B, B, A, B` order, one intervention,
  guardrails, and a judge that may select no candidate.
- **Autonomous edits corrupt canonical learning truth:** A correct-answer or
  curriculum regression reaches Luca. Enforce path/semantic allowlists, content
  hashes, validators, parity, and manual review for any canonical change.
- **The experiment becomes infrastructure work:** The learning product stalls.
  Use managed storage/jobs, local CLI agents, one generated report, and the
  six-session stop condition; delete the backend if it does not improve a real
  interaction.
- **Notification fatigue:** Luca learns to dismiss the app. Cancel after
  completion, cap the Screen Time trigger, keep one evening fallback, and treat
  dismissal patterns as product evidence.
- **Tiny-sample causal overclaim:** A good or bad week is mistaken for proof.
  Predeclare the metric, preserve config, report uncertainty, and state only a
  within-Luca result.
- **Sensitive session media escapes intended scope:** The experiment is damaged
  operationally and personally. Keep objects private, scope credentials, avoid
  media in Git/logs, and prove export/deletion controls without reducing the
  requested observation fidelity.

## Critical Reminder

> The product Luca experiences is one quiet daily doorway, two focused learning
> loops, and a clear finish. The cameras, traces, models, agents, branches, and
> infrastructure exist behind that experience to make it better. If Luca can
> feel the machinery, the product design has failed. If the web and native paths
> can disagree about what Wordbreak teaches, the architecture has failed. If the
> experiment cannot point from a claim to a moment and from a change to a result,
> the research has failed. Simpler is better—but the full loop must be real.
