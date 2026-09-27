# Native Daily Practice Plan

**Date:** 2026-09-21
**Status:** In-Progress
**Progress model:** Phase task checkboxes only

> **Split on 2026-09-25:** This plan now owns only the learner-facing Wordbreak + Mathbreak iPhone app. Capture, upload, Gemini analysis, coding-agent orchestration, autonomous installation, and the six-session product experiment moved to [Plan 008](008-autonomous-product-feedback-loop-plan.md). The filename remains stable so existing notes and evidence links do not break.

## Executive Summary

Build one dependable iPhone habit for Luca: open a calm mobile-first app, complete a short Wordbreak block and an untimed Mathbreak block, and be done for the day. SwiftUI owns the mobile interface while the exact checked-in Wordbreak engine remains the sole teaching authority. Local notifications and an optional Screen Time opportunity trigger help Luca start; the entire learning path works offline and without the feedback-loop backend.

## Problem Statement

- **Symptom:** Luca is struggling with basic math facts, and Wordbreak plus math practice is not yet a dependable daily habit on the iPhone he already uses.
- **Root Cause:** Wordbreak began as a browser-first application with no native daily shell, Mathbreak curriculum, local notification rhythm, or Screen Time opportunity trigger.
- **Impact:** Practice depends on an adult remembering to initiate it, and the learner experience is not optimized for a phone.

## Goals and Non-Goals

### Goals

- Give Luca one obvious daily action that completes meaningful Wordbreak and Mathbreak production.
- Use a purpose-built SwiftUI interface while executing the same Wordbreak curriculum, selection, grading, scheduling, and state transitions as the web app.
- Diagnose broad math-operation gaps, then teach weak fact families through number-sense strategies without visible timers or speed rewards.
- Use an after-school notification, an evening fallback, and an optional DeviceActivity threshold as three routes to the same unfinished session.
- Persist locally and recover the exact unfinished item after interruption or relaunch.
- Make the app useful when every experimental feature, server, and model is disabled.

### Non-Goals

- Rewriting the Wordbreak engine or curriculum in Swift.
- Building media capture, upload, Gemini analysis, coding-agent orchestration, or autonomous release machinery; [Plan 008](008-autonomous-product-feedback-loop-plan.md) owns those systems.
- Building a general learning-management, classroom, social, streak, leaderboard, or reward-shop product.
- Using timed tests, rewarding rapid answers, or treating speed as fluency.
- Inferring boredom from Screen Time. DeviceActivity is only an opportunity signal while practice remains incomplete.
- Blocking other applications or turning the product into a parental-control system.

## Scope and Constraints

- **Scope:** Shared Wordbreak core, deterministic Mathbreak core, SwiftUI learner shell, local persistence, notifications, optional Family Controls/DeviceActivity trigger, accessibility, and physical-device acceptance.
- **Development device:** Use the connected iPhone 12 Pro for routine development and repeatable physical smoke tests.
- **Acceptance device:** Luca's iPhone SE (iPhone12,8) on iOS 27 remains the final learner-device acceptance target.
- **Offline constraint:** Starting, completing, and saving practice must require no network.
- **Repository constraint:** The web product remains a deployable single-file artifact generated from the same authored core and curriculum.
- **Integration boundary:** Feedback-loop hooks may remain compiled behind independent disabled feature flags, but their failure or incompleteness cannot block this plan.

## Ground Truth Contracts (Do Not Violate)

- **Different interface, same Wordbreak engine:** SwiftUI renders typed view state and dispatches actions. The platform-neutral JavaScript reducer is the sole executable authority for Wordbreak curriculum, selection, scheduling, grading, reporting mutation, and progress transitions.
- **One curriculum contract:** The inline UNITS data frozen from wordbreak_v2.html remains the authoritative curriculum contract. The extracted src/game/wordbreak-content.js representation and every generated web/native copy must match its verified normalized hash; no duplicate hand-maintained list is allowed.
- **Opaque canonical Wordbreak state:** Native persists the bytes returned by the engine without decoding and reconstructing the learner ledger.
- **Commit before effects:** State is atomically written before navigation, reporting transport, or any nonessential effect.
- **Production over recognition:** Both subjects require Luca to produce answers. A miss ends with reconstruction, re-production, and delayed retrieval.
- **Fluency is not speed:** Latency may be recorded, but the learner sees no countdown, ranking, or speed promotion.
- **Daily means repeatable:** Completing today's session never exhausts tomorrow's practice. Wordbreak supplies at least four production opportunities after the curriculum frontier, and Mathbreak creates a fresh deterministic queue on each local day.
- **One completion:** Wordbreak and Mathbreak contribute their minimum protected work before the shared daily completion state becomes true.
- **Opportunity, not coercion:** Notifications and Screen Time converge on the same unfinished session, never shield applications, and stop after completion.
- **Learning is independent:** Capture, upload, analysis, agent, or backend state from Plan 008 cannot prevent local practice or corrupt saved progress.

## Already Shipped (Do Not Re-Solve)

- **Web learning loop:** The generated wordbreak_v2.html preserves the existing TYPE -> FLAG -> EXECUTE -> FORK/PATCH experience, assessment, audio, progress, and reporting behavior.
- **Shared deterministic core:** src/game/wordbreak-core.js, src/game/wordbreak-content.js, src/game/wordbreak-browser.js, and src/web/wordbreak.template.html now generate the web artifacts.
- **Parity:** Frozen legacy, Node, generated browser, and JavaScriptCore traces match across six behavior boundaries.
- **Mathbreak:** src/game/mathbreak-core.js and src/game/mathbreak-content.json implement validated fact selection, broad-lane screening, strategy reconstruction, correction, and delayed retrieval.
- **Native bridge:** WordbreakEngineBridge.swift hosts the shared reducer through JavaScriptCore with typed Codable envelopes and atomic state commits.
- **Native shell:** The daily shell renders Wordbreak and Mathbreak, persists both engines, restores interrupted input, and provides the post-session completion path.
- **Nudges:** Local 4:00 PM and 7:30 PM notifications and the DeviceActivity monitor extension are implemented.
- **Signing foundation:** Separate app and monitor bundle identifiers, Family Controls entitlements, and the shared App Group are provisioned and codesign-verified.
- **Credential path:** scripts/apple/provision-development.mjs loads the ignored repository .env and uses an App Store Connect API key file. No command needs to reveal an App Store password from Keychain.
- **Feedback prerequisites:** Physical capture feasibility, event schemas, experiment configuration, and dormant capture code already exist, but Plan 008 owns their completion and use.

## Fresh Baseline (2026-09-25)

- npm test passes 67 JavaScript tests plus generated-web, curriculum, assessment, Mathbreak, schema, local-D1, and 516-audio-asset validation.
- iPhone 12 Pro simulator tests pass the native unit/parity suite and one-tap learner UI smoke.
- Luca's iPhone SE has allowed .child Family Controls authorization, persisted a Social-category selection, delivered a real threshold callback through the App Group, displayed the notification proof banner, and survived a signed replacement install.
- The native shared-engine verification passes with recorded Wordbreak engine, curriculum, normalized-content, Mathbreak engine, and Mathbreak-content hashes.
- Open learner-product evidence is limited to the exact worst-case daily duration, complete accessibility pass, unified nudge-ledger edge cases, midnight rollover, authorization revocation, and parent-driven fresh reinstall.

## Solution Overview

~~~text
authored Wordbreak core -----> generated web app
           |
           +---- JavaScriptCore ----> SwiftUI daily shell
                                      | Wordbreak
validated Mathbreak core ------------+ Mathbreak
                                      | atomic local state
                                      | notifications
                                      + optional Screen Time nudge
~~~

The learner flow has four states:

1. Luca opens the app directly or from a nudge.
2. One action starts or resumes today's session.
3. Luca completes compact Wordbreak and Mathbreak production.
4. The app atomically marks today complete, cancels pending nudges, and shows one quiet done screen.

## Build vs Buy and Dependency Cost

- **Shared engine:** Keep the extracted JavaScript reducer and host it with system JavaScriptCore. A Swift rewrite would create a second teaching implementation.
- **Math:** Keep the small checked-in deterministic engine and hand-authored strategy truth. No general tutoring framework is needed.
- **Notifications:** Use UserNotifications.
- **Opportunity trigger:** Use FamilyControls and DeviceActivity; degrade to scheduled notifications if authorization is unavailable.
- **Storage:** Use versioned local files and App Group state. The daily app needs no new backend.
- **Dependency cost:** One Xcode app, one bounded DeviceActivity extension, system frameworks, and generated engine/audio resources. No analytics SDK, provider SDK, or new package is required.

## Implementation Phases

> Execute one phase at a time and verify it before proceeding. Plan 008 may consume stable contracts from this plan, but it cannot add completion gates here.

### Phase 0: Freeze Learning and Device Contracts

**Goal:** Prove the teaching, signing, and device assumptions needed by the daily app.

**Skills:** build-vs-buy, context7-mcp, debug, jony-ive

**Tasks:**

- [x] Record the daily work budget, notification schedule, DeviceActivity threshold, kill switches, and offline requirement in docs/notes/native-daily-practice-contract.md.
- [x] Freeze the original web runtime and generate deterministic Wordbreak behavior fixtures covering seeds, clocks, prior state, correct attempts, misses, corrections, reloads, completion, assessment, and field-pack transitions.
- [x] Define and validate the Mathbreak fact universe, inverse/commutative identities, broad-lane screener, within-lane probes, strategy construction, and delayed retrieval.
- [x] Create and sign the native app and monitor extension with separate bundle IDs, Family Controls, and the shared App Group.
- [x] Verify signed entitlements with codesign and pass all 24 verify:ios:phase0 checks on Luca's connected phone.
- [x] Prove .child authorization, picker persistence, a real DeviceActivity callback, App Group visibility, notification delivery, restart, and signed replacement install on Luca's iPhone.
- [ ] Prove midnight rollover and authorization revocation on Luca's iPhone.
- [ ] Complete a parent-driven fresh reinstall. Remote removal is prohibited by the managed child-device policy and is not equivalent proof.
- [x] Store the App Store Connect API identity in ignored .env configuration and load it noninteractively from scripts/apple/provision-development.mjs.

**Verification:** Content/math validators, golden-fixture generation, signing-shell build, entitlement inspection, real callback receipt, notification receipt, and replacement-install receipt pass. Remaining device lifecycle cases stay visibly open.

---

### Phase 1: Share the Deterministic Wordbreak Engine

**Goal:** Make one Wordbreak implementation callable from the web and native UI without changing teaching behavior.

**Skills:** debug, documentation, context7-mcp

**Tasks:**

- [x] Extract the authored content, platform-neutral reducer, browser adapter, and generated HTML template.
- [x] Implement WordbreakCore.create(...) and dispatch(action) without DOM, storage, audio, network, timers, or undeclared globals.
- [x] Keep the complete wb2 payload opaque and require atomic host commits before effects.
- [x] Preserve aggregate-reporting mutation semantics and keep transport outside the reducer.
- [x] Make build, dev, deploy, and tests fail when generated web artifacts drift.
- [x] Prove independent frozen-legacy, Node, browser, and JavaScriptCore parity.
- [x] Bundle and verify engine/content hashes in the iOS app.
- [x] Guarantee at least four daily reconstruction/production opportunities after the teaching frontier is exhausted.

**Verification:** npm test, npm run check:web, engine verification, independent golden traces, storage-failure fixtures, unknown-field round trips, and curriculum/audio validators pass.

---

### Phase 2: Finish the Native Daily Shell and Mathbreak

**Goal:** Deliver one calm offline flow that completes both subjects and resumes correctly.

**Skills:** steve-jobs, jony-ive, context7-mcp, documentation

**Tasks:**

- [x] Bundle the exact Wordbreak core, content, Mathbreak core/content, and verified audio resources.
- [x] Implement the JavaScriptCore bridge and native parity harness.
- [x] Implement Mathbreak screening, deterministic selection, make-ten, doubles/near-doubles, inverse families, commutativity, 2/5/10 anchors, doubling/halving, and distributive reconstruction.
- [x] Implement the learner path attempt -> strategy bridge -> construct/explain -> retype -> delayed retrieval without speed pressure or cartoon rewards.
- [x] Define DailySessionContract (6-minute Wordbreak block inside the 12-minute soft target) and commit the one daily completion only after both subjects finish, before any effect.
- [x] Add a synthetic worst-case session (unread, non-fast-pass Wordbreak module plus corrected Mathbreak items) that pins the engine-estimated duration: 8 minutes of Wordbreak, about 17 minutes on an ordinary day and 25 on the placement day. The learner surface promises no duration; Luca-device timing is a Phase 4 acceptance task.
- [x] Persist daily completion and the nudge ledger in one atomic, versioned App Group file shared with the monitor extension, and import web progress only through an explicit parent preview and the engine's own progress.import action.
- [x] Scale learner text with Dynamic Type (scrolling instead of clipping), add VoiceOver labels, headers and selected traits, keep Check reachable above the number pad, honor Reduce Motion, and raise muted-text contrast. The app renders dark only; the system accessibility audit passes on home, lesson, and typing screens.
- [x] Remove the parent gear and the experiment check-in from the learner path. Parent setup opens only from a hidden long press; the check-in stays dormant behind Plan 008's capture flag.
- [x] Pause Plan 004 aggregate reporting for native: parent setup states that iPhone practice is not reported, rather than reporting zeros.

**Verification:** Native unit/UI tests pass; an offline controller test completes both subjects once through the real engines; kill/relaunch restores the exact item; a run left open across midnight is released and credited to the finishing day; the worst-case duration is pinned by test; reporting is explicitly paused; no visible timer appears; and Luca encounters no parent or experiment controls.

---

### Phase 3: Finish Notifications and the Screen Time Opportunity Trigger

**Goal:** Establish a reliable daily start rhythm without notification fatigue or coercion.

**Skills:** jony-ive, context7-mcp, debug

**Tasks:**

- [x] Schedule local notifications at 4:00 PM and 7:30 PM in the device time zone and reschedule across clock changes.
- [x] Deep-link every nudge to the same unfinished session and cancel the fallback after completion.
- [x] Add FamilyControls selection and the bounded DeviceActivity monitor extension.
- [x] Gate the selected-usage threshold to the 3:00-4:00 PM opportunity window, suppress completed/already-nudged days, remove the still-pending 4:00 PM reminder, and keep the 7:30 PM fallback.
- [ ] Create the parent-only setup screen for notification authorization, selected times, and Screen Time selection.
- [ ] Unify notification and Screen Time deduplication in one daily nudge ledger.
- [ ] Prove late completion, time-zone/DST changes, disabled permissions, restart, midnight rollover, authorization revocation, and reinstall on the applicable physical device.

**Verification:** Calendar and DeviceActivity tests pass; physical receipts show correct deep linking/cancellation; at most one Screen Time nudge fires per day; and permission denial leaves ordinary launch and practice fully functional.

---

### Phase 4: Validate and Release the Daily App

**Goal:** Ship a dependable learner product before making feedback infrastructure part of its operational surface.

**Skills:** audit, documentation, markdown, git-push

**Tasks:**

- [ ] Run the full web, core, Mathbreak, iOS, notification, Screen Time, accessibility, offline, interruption, and migration matrix from a clean checkout.
- [ ] Run routine physical development smokes on the iPhone 12 Pro and final acceptance on Luca's iPhone SE.
- [ ] Time the synthetic worst-case day and one real day on Luca's iPhone SE, and complete a manual VoiceOver pass through both subjects, before promising Luca any duration.
- [ ] Verify the release archive embeds the tested engine/content hashes, expected entitlements, bundle identifiers, signing identity, and build number.
- [ ] Prove the app starts, completes, and persists when all Plan 008 feature flags and all network access are disabled.
- [ ] Run the repository audit skill over Plan 007 paths, fix findings, and rerun the applicable tests.
- [ ] Update product documentation and remove spike UI or dead scaffolding visible to the learner.
- [ ] Commit and push only scoped work after all gates pass.

**Verification:** Luca completes the installed app without assistance; the daily recurrence works on the following local day; notifications converge on one session; the web and native engine/content hashes match; and disabling Plan 008 changes no learning behavior.

## Executable Memory

- Full regression: npm test
- Generated web integrity: npm run check:web
- Curriculum validation: node scripts/curriculum/validate-content.mjs
- Assessment separation: node scripts/assessment/validate-bank.mjs
- Wordbreak parity: node --test src/game/wordbreak-parity.test.js
- Math truth: node scripts/math/validate-content.mjs
- Native resource identity: npm run verify:ios:engine -- --app=<built-app>
- Signed entitlement proof: npm run verify:ios:phase0 -- --app=<signed-app>
- iOS suite: xcodebuild -project ios/Wordbreak.xcodeproj -scheme Wordbreak -destination 'platform=iOS Simulator,name=TalkTastic iPhone 12 Pro' test
- App Store Connect provisioning: node scripts/apple/provision-development.mjs
- Midnight, revocation, reinstall, and Luca acceptance require timestamped physical-device receipts; simulator success is not equivalent.

## Success Criteria

### Hard Requirements (Must Pass)

- The iPhone uses a mobile-specific SwiftUI interface and the same checked-in Wordbreak core bytes and normalized curriculum as the web build.
- Golden traces remain identical across the frozen legacy snapshot, Node core, generated browser artifact, and JavaScriptCore bridge.
- Every day provides meaningful Wordbreak and Mathbreak production; neither subject can be silently skipped or replaced with recognition.
- Mathbreak teaches number-sense reconstruction without visible timing pressure.
- Practice completes and persists offline when capture, upload, analysis, agent writing, and automated installation are disabled.
- Notifications and the Screen Time opportunity trigger converge on one unfinished daily session and stop after completion.
- Interruption or relaunch resumes the exact committed item without duplication or loss.
- Routine development is reproducible on the iPhone 12 Pro and final behavior is accepted on Luca's exact phone.

### Definition of Done

Phases 0-4 are complete; automated and physical-device gates pass; Luca and the parent accept the daily flow; the web fallback remains valid; Plan 008 is not on the critical learning path; scoped work is reviewed, committed, pushed, and documented.

## Open Questions

### Resolved

- **Q:** Should the iPhone reuse the web UI?
- **A:** No. SwiftUI owns the mobile interface; the same JavaScript core owns teaching behavior.
- **Q:** Should the Wordbreak engine be rewritten in Swift?
- **A:** No. JavaScriptCore hosts the exact reducer, and parity/hashes prevent drift.
- **Q:** Is Screen Time evidence of boredom?
- **A:** No. It is only an opportunity trigger while practice is unfinished.
- **Q:** Does the daily app require the AI feedback system?
- **A:** No. Plan 008 is a removable observer and release system. The learner app must be complete with it disabled.
- **Q:** Is private aggregate reporting active for native use?
- **A:** Paused. The iPhone sends no reports and parent setup says so; re-pairing native as the sole authority is a later, explicit decision.
- **Q:** Which device is used for development?
- **A:** The iPhone 12 Pro is the routine development target; Luca's iPhone SE is the final acceptance target.

### Unresolved

- **Q:** Which Mathbreak lane should lead after onboarding?
- **Options:** The fixed screener selects addition/subtraction within 20 or multiplication/division through 12, with a parent-only override.

## References

### Internal

- [Wordbreak README](../../README.md)
- [Learning Methodology](../../methodology.md)
- [Plans Index](README.md)
- [Autonomous Product Feedback Loop Plan](008-autonomous-product-feedback-loop-plan.md)
- [Budgeted Session Compiler Plan](003-budgeted-session-compiler-plan.md)
- [Private Parent Reporting Plan](004-private-parent-reporting-plan.md)
- [Before/After Assessment Plan](005-before-after-spelling-assessment-plan.md)
- [Targeted Curriculum Expansion Plan](006-luca-targeted-curriculum-expansion-plan.md)
- [Native Daily Practice Contract](../notes/native-daily-practice-contract.md)
- [iOS Physical Device Development Notes](../notes/ios-physical-device-development.md)

### External

- [Apple UserNotifications](https://developer.apple.com/documentation/usernotifications)
- [Apple Family Controls](https://developer.apple.com/documentation/familycontrols)
- [Apple DeviceActivity](https://developer.apple.com/documentation/deviceactivity)
- [Fluency Without Fear](https://www.youcubed.org/evidence/fluency-without-fear/)

## Modules

### State Boundaries

Native versioned state is separated into Wordbreak progress, Mathbreak progress, daily coordination, notification/nudge state, and optional Plan 008 state. Plan 008 may read versioned snapshots and semantic events through explicit interfaces, but it cannot mutate canonical learner state or redefine completion.

### Error Handling and Degradation

| Scenario | Learner behavior | Recovery |
| --- | --- | --- |
| App killed mid-item | Last committed progress remains valid. | Resume the exact item once. |
| Notifications denied | Direct launch remains available. | Explain remediation only in parent setup. |
| Family Controls unavailable | Scheduled notifications remain. | Disable only the opportunity trigger. |
| Network unavailable | Practice continues normally. | Sync optional reporting later. |
| Plan 008 disabled or broken | No experiment UI or error appears. | Continue local learning unchanged. |
| Engine/content hash mismatch | Refuse the invalid build at verification. | Rebuild from the authored core/content. |

### Files Likely to Change

| File or directory | Change type | Purpose |
| --- | --- | --- |
| src/game/wordbreak-core.js | Modify | Shared deterministic Wordbreak behavior. |
| src/game/wordbreak-content.js | Modify | Authored runtime curriculum. |
| src/game/mathbreak-core.js | Modify | Deterministic math practice. |
| src/game/mathbreak-content.json | Modify | Validated fact and strategy truth. |
| src/web/wordbreak.template.html | Modify | Generated web presentation source. |
| ios/Wordbreak/ | Modify | SwiftUI shell, bridges, storage, notifications, accessibility. |
| ios/WordbreakScreenTimeMonitor/ | Modify | Bounded DeviceActivity callback. |
| scripts/apple/ | Modify | Provisioning and signed-build verification. |
| docs/notes/ | Modify | Durable physical-device and product contracts. |

### Risks and Mitigations

- **Engine extraction changes teaching semantics:** Require frozen transition parity and content hashes on every surface.
- **Mathbreak becomes a timed drill:** Keep speed invisible and require strategy reconstruction plus delayed retrieval.
- **Notification fatigue:** Cancel after completion, cap the opportunity trigger, and keep one evening fallback.
- **Screen Time becomes a control system:** Never shield, block, infer boredom, or launch over another app.
- **Feedback machinery leaks into the learner product:** Keep Plan 008 flags independent and require a fully offline capture-off release smoke.
- **Simulator success is mistaken for learner proof:** Separate simulator, iPhone 12 Pro development, and Luca-device acceptance receipts.

## Critical Reminder

> Delete every dependency that does not help Luca complete correct Wordbreak and Mathbreak practice today. The product is one quiet doorway, two focused learning loops, and a clear finish. The feedback experiment may observe that product, but it does not get to become the product.
