# Autonomous Product Feedback Loop Experiment Plan

**Date:** 2026-09-25
**Status:** In-Progress
**Progress model:** Phase task checkboxes only

## Executive Summary

Build a separate experimental system that observes Luca using the real daily-practice app, turns synchronized screen/front-camera/audio/events into grounded Gemini analysis, and lets two independent coding agents propose improvements for an independent judge. In AUTOPILOT mode, the trusted release lane may install one reversible, fully tested, allowlisted change per epoch. The learner app remains useful and releasable without any part of this system.

This plan begins with a six-session, single-learner experiment. It is not an analytics platform, a general autonomous software factory, or a second practice app.

## Problem Statement

- **Symptom:** Product friction is observed informally and improvements depend on adult recollection rather than replayable evidence tied to exact learner state and code.
- **Root Cause:** The daily app has no complete session artifact, timestamp-grounded model analysis, or controlled evidence-to-code experiment lane.
- **Impact:** We can miss subtle interaction failures, misremember causes, and change the product without knowing whether the change addressed the observed problem.

## Mode Definitions

| Mode | Behavior | Why it matters |
| --- | --- | --- |
| OBSERVE | Capture and analyze sessions; agents cannot edit code. | Establishes a clean baseline and calibrates model claims. |
| PROPOSE | Two coding agents may create isolated candidates; nothing is installed. | Tests whether the system understands the evidence and code. |
| AUTOPILOT | A trusted runner may judge, test, sign, and install one allowlisted winner per epoch. | Runs the intended closed loop while keeping every change reversible. |

Capture, upload, analysis, agent write, and automated installation each have an independent kill switch. Changing mode never enables a disabled capability.

## Goals and Non-Goals

### Goals

- Capture synchronized screen, front-camera, microphone, app-audio, and semantic-event evidence for each experiment session.
- Preserve raw tracks and immutable build, engine, content, prompt, schema, model, and configuration identities.
- Use Gemini to produce literal observations, transcript spans, timestamped tags, and explicit hypotheses whose claims resolve back to source evidence.
- Give two independent coding agents the same bounded evidence packet and base revision.
- Let a separate judge select either candidate or no candidate after policy, test, visual, and complexity review.
- Install at most one reversible, allowlisted winner in an experiment epoch.
- Measure one predeclared proximal product behavior under the sequence A, A, B, B, A, B.

### Non-Goals

- Building or delaying the learner-facing daily app; [Plan 007](007-native-daily-practice-ai-feedback-loop-plan.md) owns that product.
- Creating a second iPhone practice application. Capture occurs inside the real app through a narrow feature-gated seam.
- Building a generic analytics warehouse, session-replay product, dashboard platform, or always-on multi-agent cloud service.
- Asking AI to change canonical spellings, correct answers, fact equations, assessments, reporting definitions, entitlements, credentials, or retention policy.
- Making more than one substantive learner-facing change in an epoch.
- Treating face, voice, pause, or Screen Time signals as known emotion, intent, attention, comprehension, or boredom.
- Claiming population effects or durable learning from six sessions.

## Scope and Constraints

- **Scope:** Native capture adapter, semantic event linkage, immutable local packaging, private upload/finalization service, Gemini workflow in llm-workflows, bounded candidate generation, independent judging, signed installation, rollback, and the six-session experiment.
- **Dependency:** Plan 007 must provide a stable daily flow, deterministic engine/content hashes, atomic state, and a release archive. Plan 008 may observe those contracts but may not redefine them.
- **Development device:** Use the iPhone 12 Pro for routine capture, interruption, upload, and installation development.
- **Acceptance device:** Final experiment sessions and release verification run on Luca's exact iPhone.
- **Capture requirement:** The requested experiment requires screen, front camera, microphone, app audio, and semantic events. Missing required evidence marks a session incomplete but never blocks practice.
- **Network requirement:** Practice finishes locally. Upload, analysis, and agent work happen after or outside the learning path.
- **Provider boundary:** Gemini credentials, files, prompts, retries, structured output, and cleanup live only in llm-workflows.
- **Cost boundary:** One learner, two calibration sessions, and six experiment sessions. No warehouse or persistent agent service.

## Ground Truth Contracts (Do Not Violate)

- **Daily app independence:** Plan 007 ships, starts, completes, and saves with every Plan 008 feature flag disabled.
- **Same observed product:** Plan 008 instruments the real daily app rather than a special replica.
- **Immutable evidence:** Raw tracks, events, manifests, model outputs, agent outputs, diffs, tests, archives, installation receipts, and results are append-only within a run.
- **Events anchor exact state:** The typed event ledger is authoritative for engine transitions and taps that video sampling may miss.
- **Observation is not diagnosis:** Literal observation and transcript fields contain no inferred mental state. Diagnosis is a separate hypothesis with alternatives, confidence, and falsification criteria.
- **First-person authority:** Emotion, intent, attention, or comprehension claims require Luca's own check-in citation.
- **llm-workflows is the only Gemini boundary:** Wordbreak contains no Gemini/Vertex SDK, endpoint, provider credential, prompt implementation, or provider-file lifecycle.
- **One versioned cross-repo contract:** Every run records workflow/client IDs, versions, prompt/schema hashes, model/settings identity, and accepted result hash.
- **One intervention per epoch:** Many ideas may be generated; only one substantive change reaches the phone before the next measurement window.
- **Trusted release control:** Candidate code never controls policy, credentials, signing, tests, installation, or rollback.
- **Canonical teaching truth is closed:** Automated candidates cannot modify Wordbreak/Mathbreak answers, curriculum truth, frozen assessments, or aggregate-report definitions.
- **Failure is nonblocking:** Capture, upload, model, agent, backend, or installation failure cannot erase or invalidate locally completed practice.

## Already Shipped (Do Not Re-Solve)

- **Physical capture feasibility:** ReplayKit sample-buffer capture plus a separate AVFoundation front-camera path has passed more than 15 minutes on the iPhone 12 Pro and Luca's iOS 27 iPhone within declared coverage, drift, drop, and thermal budgets.
- **Capture implementation:** CaptureCoordinator starts with practice, retains separate available tracks, and closes/resumes segments across background/foreground transitions.
- **Packaging:** SessionPackager atomically seals a client-authored capture manifest and refuses overwrite.
- **Event ledger:** DailyEventLedger writes hash-bound schema-shaped JSONL with a monotonic sequence across relaunch and records prompts, committed actions, screens, navigation, engine transitions, lifecycle, and check-in events.
- **Experiment contracts:** experiment/config and experiment/schemas contain versioned feature flags, mode/release gates, event taxonomy, capture/session manifests, and receipt shapes.
- **Cloud decision:** Private GCS, a thin Cloud Run ingest/composition service, and the gist-is-backend project are documented in experiment/infra/README.md.
- **Workflow handoff:** The exact wordbreak_session_analysis_v1 staging client/workflow allowlist passed missing, wrong, cross-workflow, and valid-token cases. A provider-free staging run completed at zero provider cost.
- **Feature isolation:** Capture, upload, analysis, agent writing, and automated installation default off independently.

## Fresh Baseline (2026-09-25)

- Capture feasibility is proven, but production interruption/relaunch evidence is still open because physical XCUITest automation timed out while enabling automation mode.
- Background/foreground transitions produce multiple in-memory capture segments, but process-kill persistence of the segment inventory is not complete.
- Packaging unit tests cover required-track completeness, checksums, event inclusion, and immutable sealing.
- No production ingest service, resumable upload, composite video, Gemini call, real agent candidate, autonomous installation, or six-session result exists.
- The current installed learner build has capture, upload, analysis, agent writing, and automated installation disabled.

## Solution Overview

~~~text
Plan 007 daily app
  | screen + front camera + microphone + app audio + events
  v
immutable segmented session package
  |
  v
private ingest / GCS / verified session manifest
  |
  v
llm-workflows: Gemini observation + diagnosis
  |
  +----> candidate A in isolated worktree
  +----> candidate B in isolated worktree
                    |
                    v
          independent judge + trusted tests
                    |
                    v
       zero or one signed reversible install
                    |
                    v
        next session + predeclared metric
~~~

The minimum ensemble is deliberate:

1. Gemini observes and structures the full session.
2. Two independent coding agents create competing implementations from the same bounded evidence.
3. One independent judge selects A, B, or no candidate.
4. A trusted non-candidate runner enforces policy, tests, signing, installation, and rollback.

Do not add three standing critic agents, a message bus, or a general orchestrator until this minimum loop fails for a measured reason.

## Build vs Buy and Dependency Cost

- **Capture:** Keep the physically proven ReplayKit sample-buffer plus AVFoundation adapter. ScreenCaptureKit is optional future work, not a prerequisite.
- **Session replay vendors:** PostHog, Sentry Replay, and UXCam do not provide the required synchronized camera/microphone/app-audio source artifact. Do not add them.
- **Behavior events:** Keep the small typed JSONL ledger; a general analytics SDK adds cost without solving alignment.
- **Media and analysis:** Use private GCS and a thin Cloud Run ingest/composition service. Extend the existing llm-workflows provider lifecycle instead of adding a provider client to Wordbreak.
- **Agents:** Invoke the installed Codex and Claude CLIs in isolated worktrees. Do not build an always-on multi-agent cloud platform.
- **Reporting:** Generate one local static review/report artifact. Do not build a dashboard.
- **Dependency cost:** Native media I/O, bounded background upload, one private service, one versioned llm-workflows workflow, provider usage, and local agent runtime. Delete the system if the six-session experiment produces no useful product change.

## Credential Boundaries

- **Apple operator credential:** Wordbreak's ignored .env contains ASC_KEY_ID, ASC_ISSUER_ID, and ASC_KEY_PATH. The private p8 file remains permission-protected outside Git. No workflow reads an App Store password from Keychain.
- **Google/provider credentials:** They remain in the operator or llm-workflows environment that owns them. Do not copy provider credentials into the Wordbreak app or candidate worktrees.
- **Device upload credential:** Phase 1 creates one random revocable credential through parent/operator setup, stores it in the iPhone Keychain, and stores only a server-side hash.
- **Agent credentials:** Each candidate receives only its dedicated model authentication and one writable worktree. It receives no Apple signing, Google Cloud, raw-media, or unrelated repository credentials.
- **Logs and receipts:** Record credential identity/version where useful, never secret values.

## Implementation Phases

> Plan 007 completion is the learner-product gate. Within this plan, each later phase depends on the verified artifact produced by the previous phase.

### Phase 0: Freeze the Integration Boundary

**Goal:** Re-home existing experimental work under this plan and make the daily-app boundary executable.

**Skills:** elon-musk, debug, documentation

**Tasks:**

- [x] Split the learner app into Plan 007 and move capture, analysis, agents, autonomous installation, and the six-session experiment into this plan.
- [x] Preserve independent kill switches for capture, upload, analysis, agent writing, and automated installation.
- [x] Define versioned event, capture-manifest, session-manifest, experiment-config, and receipt schemas.
- [x] Prove the physical capture adapter and the llm-workflows authentication/allowlist handoff.
- [x] Document private GCS, Cloud Run identity, region, lifecycle, and operator environment without committing secrets.
- [x] Record the product owner's decision to skip the optional Google Cloud budget alert; the upload kill switch remains the operative control.
- [ ] Add a static boundary test that fails if Wordbreak imports provider SDKs, names provider credentials in executable code, or calls Gemini/Vertex endpoints.
- [ ] Add a Plan 007 release smoke that runs with every Plan 008 flag disabled and no network.
- [ ] Persist capture-segment inventory across process death without changing canonical learner state.

**Verification:** Schema/config validators pass; the daily app completes offline with all experiment features disabled; capture proof resolves to physical-device receipts; and executable boundary tests keep provider code out of Wordbreak.

---

### Phase 1: Complete Capture, Packaging, and Private Upload

**Goal:** Produce an immutable, synchronized, resumable session bundle without delaying completion.

**Skills:** context7-mcp, debug, documentation

**Tasks:**

- [ ] Implement the minimal experiment/service ingest subset: device provisioning, session creation, exact-size signed segment upload, missing-object renewal, finalization, status, and authorized artifact retrieval. Analysis remains off.
- [ ] Provision one random revocable per-device credential through parent/operator setup, store it in iPhone Keychain, and store only its hash server-side.
- [x] Capture separate screen/app-audio, front-camera, and microphone tracks when the platform exposes them.
- [x] Start capture with today's practice and stop after completion or explicit exit while showing a quiet recording indicator and no self-view.
- [ ] Persist every restart under raw/segments/<segment-id>/ with independently playable tracks, reason, clocks, PTS bounds, discontinuities, byte count, checksum, and completeness.
- [ ] Record hostMonotonicNs, captureSegmentId or null, and segmentMediaTimeMs or null on each semantic event.
- [ ] Validate PTS monotonicity, ordered/nonoverlapping anchors, eligible foreground time, and exactly one segment resolution for every media-linked event.
- [x] Seal an immutable client-authored capture manifest with expected objects, segment inventory, sizes, checksums, coverage, and event identity.
- [ ] Upload bounded segment files through background URLSession tasks using exact-size short-lived signed PUT targets. Renew only absent objects.
- [ ] Finalize only after verifying GCS generations, sizes, and streamed SHA-256 values. Create the authoritative session manifest conditionally and idempotently.
- [ ] Retain the two calibration and six experiment sessions through closeout, with parent-only export and deletion controls.

**Verification:** Three physical sessions on the iPhone 12 Pro—normal completion, forced interruption/relaunch, and network loss/resume—produce schema-valid immutable bundles through the deployed ingest service. Required tracks cover at least 98% of eligible time, pairwise drift is at most 250 ms, linked events resolve exactly once, checksums/generations match after download, partial upload resumes, and practice succeeds when capture/upload is disabled.

---

### Phase 2: Build the Gemini Observation and Diagnosis Workflow

**Goal:** Convert a verified session into grounded, inspectable observations and hypotheses.

**Skills:** ilya-sutskever, context7-mcp, documentation

**Tasks:**

- [ ] Compose an analysis proxy with readable screen video, front-camera picture-in-picture, mixed app/microphone audio, burned-in session/segment/time identity, and retained raw tracks. The ingest service makes no provider call.
- [ ] Implement and register wordbreak_session_analysis_v1 in llm-workflows for one dedicated client and active-run cap.
- [ ] Extend llm-workflows media staging: fetch only the authenticated short-lived reference, verify size/hash/type, upload or reference through the selected Gemini transport, wait for readiness, execute, and delete provider files on every terminal path.
- [ ] Define the append-only analysis identity from final manifest generation, proxy hash, prompt/schema hashes, model/settings identity, and workflow version.
- [ ] Create the sole prompt and response-schema sources beside the llm-workflows workflow.
- [ ] Keep observation limited to screen state, authoritative events, visible action, literal transcript, closed-list visible/audible signals, and source/time confidence.
- [ ] Keep diagnosis separate with hypothesis, alternatives, confidence, and falsifying test. Inferred internal state requires a first-person check-in citation.
- [ ] Send the composite, useful raw audio, event trace, local learning summary, exact curriculum slice, build revision, and experiment history. Events are authoritative for exact taps and engine state.
- [ ] Use one whole-session pass plus higher-FPS event-anchored clips only where needed. Pin API version, model, settings, FPS, resolution, input order, and audio policy.
- [ ] Record two calibration sessions and freeze positive moments, negative/no-event windows, and fast transitions before model comparison.
- [ ] Compare one high-capability video model with one faster candidate under identical inputs and human review; pin the winner rather than a moving latest alias.
- [ ] Submit and poll through the existing authenticated llm-workflows run API with stable idempotency and correlation identities.
- [ ] Build a local review artifact that opens observations beside linked timestamps and collects blinded supported, unsupported, mistimed, or missed labels.

**Verification:** A real staging run traverses the dedicated client, registered workflow, provider-file lifecycle, Gemini call, structured result, cleanup, and replay-safe idempotency. Every accepted claim opens its source moment. On at least 30 blinded positive and negative windows, report precision, recall, timestamp error, unsupported-claim rate, and coverage; no unsupported high-confidence claim enters a product brief.

---

### Phase 3: Build the Minimal Candidate and Release Lane

**Goal:** Turn one evidence-backed hypothesis into two competing candidates and install at most one trusted winner.

**Skills:** ilya-sutskever, second-opinion, audit, git-commit

**Tasks:**

- [ ] Materialize one read-only evidence packet with accepted Gemini output, selected event excerpts/stills/clips, exact base SHA, methodology, prior hypothesis, and predeclared metric.
- [ ] Run all orchestration, policy checks, archives, signing, and installation from a sealed trusted baseline checkout.
- [ ] Give Codex and Claude separate sanitized homes, dedicated authentication, identical read-only evidence, one writable worktree each, and the same base SHA.
- [ ] Allow changes only to UI, sequencing, hints, instrumentation, performance, and noncanonical personalization surfaces. Deny curriculum truth, answers, assessments, entitlements, auth, backend, retention, reporting definitions, and the allowlist.
- [ ] Pin CLI versions and invocation/exit contracts. Require each candidate to commit its change and receipt.
- [ ] Enforce path allowlists, canonical hashes, schema/fixture validators, and a semantic-diff policy before build.
- [ ] Give an independent judge both diffs, evidence, test results, UI screenshots, accessibility output, complexity delta, and predicted metric. A no-candidate result is valid.
- [ ] Require npm test, JavaScriptCore parity, Xcode unit/UI tests, capture smoke, schema validation, secret scanning, and scoped audit before release.
- [ ] Record base/candidate SHAs, prompts, outputs, winner rationale, files, tests, archive hash, signing identity, entitlements, build number, install time, and rollback reference.
- [ ] In AUTOPILOT, install only the selected exact archive when every gate passes. Query the connected unlocked device independently for the installed bundle/build identity.
- [ ] Preserve the tested baseline archive and compatible state snapshot before installation.

**Verification:** Deterministic stub candidates exercise winner A, winner B, no candidate, allowlist denial, secret denial, test failure, and rollback. Real candidates remain isolated and credential-free. A no-op candidate can produce a complete dry-run receipt without touching main or the phone.

---

### Phase 4: Run the Six-Session Luca Experiment

**Goal:** Observe one real interaction problem, change the software once, and test the predicted proximal effect on the same learner.

**Skills:** steve-jobs, ilya-sutskever, audit

**Tasks:**

- [ ] Freeze the experiment config, install the tested baseline archive, set OBSERVE, and record sessions 1-2 under unchanged condition A.
- [ ] Human-review baseline recordings and Gemini output; rerun only missing or malformed analysis stages.
- [ ] Predeclare one reversible interaction behavior and metric, such as repeated rule reopening, accidental submission, strategy-panel abandonment, or dead time before the next action. Treat learning outcomes as guardrails.
- [ ] Run PROPOSE and inspect the complete evidence/candidate packet before enabling AUTOPILOT.
- [ ] Let the minimal ensemble create, judge, test, and install at most one candidate without bundling unrelated polish.
- [ ] Run sessions 3-4 under B, reinstall the same tested A archive for session 5, and reinstall the same tested B archive for session 6.
- [ ] Keep configuration, curriculum, prompts, model, metric, and both archives unchanged through A, A, B, B, A, B.
- [ ] Compare the predeclared proximal event, completion, repair behavior, first-person check-ins, and guardrails by condition and sequence.
- [ ] Classify the result as directionally consistent, directionally inconsistent, or inconclusive. Restore A immediately if B regresses a guardrail.
- [ ] Review the resulting daily experience with Luca without exposing experiment controls.

**Verification:** Six valid bundles exist in the exact A, A, B, B, A, B order; A and B each resolve to one tested immutable archive; exactly one substantive hypothesis differs; every analysis and release artifact resolves to immutable inputs; and the result uses the predeclared directional classification.

---

### Phase 5: Validate, Export, and Close

**Goal:** Leave reproducible evidence, explicit retention, and no orphaned experimental infrastructure.

**Skills:** audit, documentation, markdown, git-push

**Tasks:**

- [ ] Run the complete schema, capture, upload, backend, llm-workflows, agent, release, rollback, and physical-device matrix from recorded clean SHAs.
- [ ] Run the repository audit skill on Plan 008 paths and repair all correctness, architecture, and unjustified-complexity findings.
- [ ] Exercise capture-off, upload-off, analysis-off, agent-write-off, automated-install-off, and candidate rollback.
- [ ] Export manifests, prompts, schemas, settings, analyses, labels, agent transcripts, diffs, tests, archives, release receipts, and the metric report; verify the export independently.
- [ ] Use the parent-only control to delete or deliberately retain raw calibration/experiment bundles and record the decision and result.
- [ ] Remove spike-only code, unused vendor experiments, orphaned worktrees, and unreferenced cloud resources while preserving regression fixtures.
- [ ] Update documentation, commit, and push only scoped work.

**Verification:** The export opens independently; kill switches and rollback work; the chosen retention action is verified; Plan 007 still completes with this entire system disabled; and no temporary infrastructure or candidate worktree remains.

## Executable Memory

- Daily-app regression: npm test
- Experiment configuration: node scripts/experiment/validate-config.mjs experiment/config/experiment.v1.json
- Session bundle: node scripts/experiment/validate-session.mjs --session <session-id>
- Analysis schemas: node scripts/experiment/validate-analysis.mjs --session <session-id>
- Provider boundary: node scripts/experiment/validate-llm-workflows-boundary.mjs
- llm-workflows suite: cd /Users/mm/Documents/GitHub/llm-workflows && pnpm run check && pnpm run lint && pnpm run test:unit
- Ensemble dry run: node scripts/experiment/run-ensemble.mjs --fixture synthetic --mode PROPOSE
- Native test suite: xcodebuild -project ios/Wordbreak.xcodeproj -scheme Wordbreak -destination 'platform=iOS Simulator,name=TalkTastic iPhone 12 Pro' test
- Physical capture, interruption, upload-resume, signing, installation, and rollback require timestamped device/manifests/receipts. Simulator output is not equivalent proof.

## Success Criteria

### Hard Requirements (Must Pass)

- Plan 007 remains fully functional offline with every Plan 008 capability disabled.
- Every accepted session has segmented screen, front-camera, microphone, app-audio, and event evidence with at least 98% eligible-time coverage and at most 250 ms measured drift.
- Every media-linked event resolves to one segment and every accepted claim resolves to a source moment.
- Gemini output is schema-valid, timestamp-grounded, model/prompt/version pinned, and human-calibrated before it influences code.
- All provider operations run through the registered llm-workflows workflow; Wordbreak contains no provider credential or implementation.
- Two independent coding agents produce isolated candidates from the same base/evidence; the judge may reject both.
- Only one allowlisted, fully tested change may be installed per epoch, and the exact prior archive can be restored.
- The six-session report separates recorded facts, model inference, human interpretation, and directional evidence.
- A failure in any experimental stage never blocks or erases practice.

### Definition of Done

Phases 0-5 are complete; the six valid sessions and immutable A/B archives are reproducible; one candidate or an explicit no-candidate outcome passes the declared gates; the predeclared proximal effect is reported honestly; rollback is proven; retention is resolved; and Plan 007 remains cleanly independent.

## Open Questions

### Resolved

- **Q:** Is this a separate app?
- **A:** No. It is a separate plan, backend/workflow, and release lane connected to the real daily app through disabled-by-default interfaces.
- **Q:** Should we build a generic analytics platform?
- **A:** No. Typed events plus the requested synchronized raw media are sufficient for this one-learner experiment.
- **Q:** How many coding agents are required initially?
- **A:** Two independent candidates plus one independent judge. Add more roles only after a measured failure shows they are needed.
- **Q:** Where does Gemini run?
- **A:** Only through the versioned llm-workflows boundary.
- **Q:** Can AUTOPILOT change curriculum or infrastructure?
- **A:** No. It is restricted to a narrow reversible learner-interface envelope.
- **Q:** Is the optional Google Cloud budget alert a gate?
- **A:** No. The product owner waived it on 2026-09-25. Explicit feature flags control spend-producing stages but do not impose an automatic spend cap.

### Unresolved

- **Q:** Which current Gemini video model should be pinned?
- **Options:** Compare one current high-capability video model with one faster candidate on the same frozen calibration set.
- **Q:** Which first interaction metric should the experiment target?
- **Options:** Select only after sessions 1-2 and human review, then freeze it before candidate generation.

## References

### Internal

- [Native Daily Practice Plan](007-native-daily-practice-ai-feedback-loop-plan.md)
- [Native Daily Practice Contract](../notes/native-daily-practice-contract.md)
- [iOS Physical Device Development Notes](../notes/ios-physical-device-development.md)
- [Experiment Infrastructure](../../experiment/infra/README.md)
- [Wordbreak README](../../README.md)
- [Learning Methodology](../../methodology.md)
- [llm-workflows Runtime README](../../../llm-workflows/README.md)
- [llm-workflows Gemini Video Guide](../../../llm-workflows/README/guides/gemini/Gemini-video-analysis-guide.md)

### External

- [Apple ReplayKit](https://developer.apple.com/documentation/replaykit)
- [Apple RPScreenRecorder](https://developer.apple.com/documentation/replaykit/rpscreenrecorder)
- [Gemini video understanding](https://ai.google.dev/gemini-api/docs/video-understanding)
- [Gemini audio understanding](https://ai.google.dev/gemini-api/docs/audio-understanding)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)

## Modules

### Artifact Layout

~~~text
experiments/<experiment-id>/
  config/<config-hash>.json
  sessions/<session-id>/
    raw/segments/<segment-id>/
    events/events.jsonl
    derived/gemini-proxy.mp4
    manifest/capture-manifest.json
    manifest/session-manifest.json
    analysis/<analysis-key>/
  epochs/<epoch-id>/
    evidence-packet.json
    candidates/<candidate-id>/
    release/release-receipt.json
    result/metric-report.json
~~~

### Error Handling and Degradation

| Scenario | Behavior | Recovery |
| --- | --- | --- |
| Camera or microphone denied | Practice continues; manifest is incomplete. | Parent-only remediation before another valid experiment session. |
| ReplayKit interrupted | Close the valid segment and record the gap. | Resume a new segment; never fabricate coverage. |
| App killed | Canonical learning state remains at last commit. | Relaunch practice and restore persisted segment inventory. |
| Network disappears | Keep local package and completed upload state. | Renew only missing targets and resume. |
| Gemini output is malformed | Preserve attempt and mark it rejected. | Retry the identical frozen stage. |
| Gemini claim lacks evidence | Exclude it from synthesis. | Record human label. |
| Candidate crosses policy | Reject before build. | Stay on the current archive. |
| Candidate tests fail | Preserve logs and reject it. | Judge the remaining candidate or choose none. |
| Installation fails | Installed baseline remains authoritative. | Verify identity and explicitly reinstall the tested baseline if needed. |

### Agent Change Envelope

Allowed surfaces are learner UI layout/copy/motion, accessible controls, noncanonical hint presentation, daily ordering, validated selection weights, event instrumentation, and performance fixes. Forbidden surfaces are canonical curriculum/answers, assessments, entitlements, bundle IDs, App Groups, backend/auth, credentials, retention, aggregate-report semantics, deployment policy, and the allowlist itself.

The judge ranks evidence support, likely learner benefit, teaching correctness, simplicity, reversibility, tests, and polish—in that order. Code volume and novelty are not benefits.

### Performance and Cost Budgets

| Operation | Target |
| --- | --- |
| Learner action overhead from instrumentation | No measurable p95 regression beyond 16 ms frame budget |
| Event append | p95 under 10 ms and never blocks rendering |
| Capture dropped frames | Under 1% in the 15-minute physical run |
| Required-track coverage | At least 98% of eligible foreground time |
| Pairwise media drift | At most 250 ms |
| Post-session packaging | Under 60 seconds and off the completion screen |
| Resumable upload | Never restart the full session after an ordinary interruption |
| Gemini result | Within 20 minutes of complete verified upload |
| Candidate packet | Within 60 minutes of accepted analysis |

### Files Likely to Change

| File or directory | Change type | Purpose |
| --- | --- | --- |
| ios/Wordbreak/Capture/ | Modify | Production segmented capture and persistence. |
| ios/Wordbreak/Daily/ | Modify | Feature-gated event/capture integration only. |
| experiment/config/ | Modify | Immutable experiment revisions and kill switches. |
| experiment/schemas/ | Modify | Session, analysis, candidate, and release contracts. |
| experiment/service/ | Create | Private upload, verification, composition, finalization. |
| scripts/experiment/ | Modify | Validation, review, candidate, release, and reporting tools. |
| llm-workflows workflow/prompt paths | Create/Modify | Sole Gemini implementation and schema ownership. |

### Risks and Mitigations

- **Instrumentation changes behavior:** Benchmark enabled versus disabled and keep media/event work off the rendering path.
- **Model generates a persuasive fiction:** Separate observation/diagnosis, require timestamp/event citations, calibrate against blinded human labels, and reject unsupported claims.
- **Agents overfit one session:** Use two baseline sessions, one intervention, immutable A/B archives, an independent judge, and a no-candidate option.
- **Autonomous edits corrupt teaching truth:** Enforce closed paths, hashes, validators, parity, and a trusted release runner.
- **The experiment becomes infrastructure work:** Keep the minimum ensemble, one static report, six-session stop condition, and delete the backend if it fails to improve a real interaction.
- **Sensitive media or credentials leak:** Keep objects private, isolate credentials, deny candidate access, exclude secrets/media from Git and logs, and prove export/deletion.
- **Tiny sample is overclaimed:** Predeclare one proximal metric and report only within-Luca directional evidence.

## Critical Reminder

> This system has one job: find one real point of friction, make one small reversible improvement, and determine whether the next sessions move in the predicted direction. Anything that does not tighten that loop is complexity to delete.
