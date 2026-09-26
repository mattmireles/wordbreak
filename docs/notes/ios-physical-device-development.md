# iOS Physical-Device Development Notes

## Production segmented capture interruption proof — 2026-09-25 — open

**Summary:** The production daily controller now closes capture to an
independently playable segment when the app backgrounds, serializes the close
before a foreground restart, records pause/resume and segment clock linkage,
and seals every in-memory segment at completion. Capture, upload, analysis, and
agent-write remain disabled in the bundled experiment configuration.

**Symptom:** The debug production-capture smoke could be built, signed,
installed, and launched on Luca's iPhone, but the physical XCTest runner timed
out while enabling iOS automation mode before the test entered the app. This is
not evidence that production capture failed.

**Repro:** Run `ProductionCapturePhysicalTests` with
`WORDBREAK_RUN_PHYSICAL_CAPTURE=1` against Luca's connected phone. The blocked
attempt produced
`/tmp/wordbreak-device/Logs/Test/Test-Wordbreak-2026.09.25_21-13-22--0700.xcresult`
and reported `Timed out while enabling automation mode`.

**Root cause:** TBD. The failure occurred at the iOS XCTest automation boundary,
before Wordbreak launched its smoke route. Reconfirm the phone is unlocked and
**Settings > Developer > Enable UI Automation** is on before retrying.

**Fix / status:** Source-side interruption behavior is implemented and the
production app keeps raw tracks under
`sessions/<session-id>/raw/segments/<segment-id>/`. The next unlocked-device
window must run the debug-only eight-second smoke, then a background/foreground
interruption run. A process-kill/relaunch path remains separate because the
current segment inventory is held in memory until final sealing.

**Verification:** partially proven — `npm test` passes 67 JavaScript tests; all
25 iOS unit tests and the native one-tap UI test pass on the iOS 26.5 iPhone 12
Pro simulator. Exact bundled hashes are `1be0330c...` for Wordbreak and
`b3b5eb14...` for Mathbreak. Production-target screen/camera/microphone output
after interruption remains unverified on physical hardware.

**Related:** [Plan 008 Phase 1](../plans/008-autonomous-product-feedback-loop-plan.md)

## Luca iPhone SE clean iOS 27 capture — 2026-09-25 — resolved

**Summary:** The schema-v3 capture lab completed an uninterrupted physical run
on Luca's exact iPhone SE (`iPhone12,8`) running iOS 27.0 build `24A437`. Every
declared budget passed.

**Symptom:** The earlier iOS 26.7 receipt proved interruption detection but
failed continuity because Settings backgrounded the app three times. A clean
exact-device receipt was still required after the OS upgrade.

**Repro:** Install the signed schema-v3 `WordbreakCaptureLab`, leave it
foregrounded, approve Apple's `Record Screen & Microphone` sheet, and allow its
automatic 15-minute stop to write the receipt.

**Root cause:** Not applicable; this was the remaining physical feasibility
gate. During the run the thermal state improved from raw state `1` to `0`, the
only audio-route event was teardown reason `3` at stop, and no capture errors or
background transitions occurred.

**Fix / status:** Proven on the target device. The 942.239-second run delivered
99.996% screen coverage, 100% front-camera coverage, 100% microphone coverage,
99.998% app-audio coverage, zero invalid/dropped buffers, a 53.330 ms maximum
sample gap, and 174.985 ms maximum pairwise drift. The receipt is preserved at
`docs/notes/evidence/phase0/luca-iphone-se-ios27-clean-capture-2026-09-25.json`;
its SHA-256 is
`bb11bde3297e20a5661be957933fc04e13d4a2352c1039373f65a35c4283e9a0`.

**Verification:** proven — receipt schema 3 reports every pass flag true. A
subsequent 10.697-second relaunch smoke also passed every budget with 98.698 ms
pairwise drift. Its receipt is
`docs/notes/evidence/phase0/luca-iphone-se-ios27-relaunch-smoke-2026-09-25.json`
with SHA-256
`64396c037824f61c1bff554e2c92a11b460c7cf314c11e234fbced4efb26c47f`.

**Related:** [Plan 008 Phase 0](../plans/008-autonomous-product-feedback-loop-plan.md)

## Capture drift evaluator — 2026-09-25 — resolved

**Summary:** Receipt schema v3 measures synchronization from the maximum of
pairwise start-anchor offset, end-anchor offset, and per-track clock-rate drift.
It fails the drift gate when any required track lacks complete PTS and host-time
anchors.

**Symptom:** Schema v2 compared only each track's media duration with its host
duration. Two tracks with equal durations but a constant start/end offset could
therefore pass the nominal pairwise-drift gate.

**Repro:** Give the camera and ReplayKit tracks equal 899-second spans but shift
both camera PTS endpoints by 400 milliseconds. The old calculation returned
zero; the schema-v3 evaluator returns 400 milliseconds and fails the 250 ms
budget.

**Root cause:** Clock-rate agreement and track alignment are separate
properties. Comparing spans tests rate drift but not a constant offset.

**Fix / status:** `CaptureBudgetEvaluation` now compares start offsets, end
offsets, and rate errors in the shared host clock. Missing anchors omit the
optional drift measurement and fail the drift gate rather than writing a
non-finite JSON number.

**Verification:** proven — seven `WordbreakCaptureLabTests` pass on the iOS 26.5
simulator runtime using the iOS 27 SDK, including constant-offset and
missing-anchor cases. The clean physical iOS 27 schema-v3 receipt above also
passes the revised evaluator on Luca's exact phone.

**Related:** [Plan 008 Phase 0](../plans/008-autonomous-product-feedback-loop-plan.md)

## Luca phone Developer Mode — 2026-09-25 — resolved

**Summary:** Luca's iPhone SE (`iPhone12,8`) was upgraded from iOS 26.7 to iOS
27.0 build `24A437` on 2026-09-25. It remains connected by USB, paired with this
Mac, visible in Xcode 27 Device Hub, and has Developer Mode enabled.

**Symptom:** The Developer Mode switch was not initially visible on the phone.

**Repro:** `xcrun devicectl device info details --device
00008030-001C65E43A85802E` reports a wired, paired, booted device and
`Developer Mode Status: Disabled`. Opening the device in Device Hub displays
`Settings > Privacy & Security > Developer Mode` as the required next step.

**Root cause:** iOS only exposes Developer Mode after device pairing is
initiated. Family Sharing alone is not evidence of an additional blocker; a
supervision or MDM restriction remains possible only if the switch stays
absent after refreshing Settings and restarting the paired phone.

**Fix / status:** Pairing exposed the switch. Developer Mode was enabled under
Privacy & Security, followed by the required restart, physical confirmation,
and device-passcode entry.

**Verification:** proven — after the iOS 27 reboot, CoreDevice reports the same
UDID, wired connection, paired state, booted state, iOS 27.0 build `24A437`, and
Developer Mode enabled. Device Hub advertises the new `View Device Screen`
capability. The first post-reboot passcode unlock is still required before the
developer disk image can mount and app-level validation can resume.

**Related:** [Phase 0 plan](../plans/007-native-daily-practice-ai-feedback-loop-plan.md)

## Development device

- Use the paired iPhone 12 Pro named `Webcam` for ordinary physical-device
  development and capture-spike iteration.
- Luca's iPhone remains the final acceptance device because its iPhone SE
  hardware and installed iOS build are part of the Phase 0 feasibility claim.
- `WordbreakCaptureLab` is a development-only target. It intentionally omits
  the Screen Time extension and managed entitlements so ReplayKit and front
  camera work can proceed while Apple provisioning is unresolved. It is not a
  shippable degradation path. It opens the capture check and starts the run on
  launch so only Apple's first-use permission confirmations require physical
  input; later runs can be restarted with `devicectl`.

## Xcode 27 Device Hub constraint — resolved for Luca's phone

This Mac's Device Hub can install, launch, inspect, and capture screenshots from
the iPhone 12 Pro on iOS 26.5.2, but interactive screen sharing requires the
phone to run iOS 27 or later. Luca's phone now runs iOS 27.0 and advertises the
screen-viewing capability. The first post-reboot passcode unlock remains an
intentional physical security boundary; it is not an app failure.

Physical input or XCTest UI automation is required on iOS 26. XCTest automation
also requires the device's **Settings > Developer > Enable UI Automation**
switch. The checked-in UI test runs the full 15-minute proof after that switch
is enabled.

## Repeatable commands

Regenerate the project from `ios/`:

```sh
xcodegen generate --spec project.yml
```

Build the unit-test bundle without requiring an installed simulator runtime:

```sh
xcodebuild -project Wordbreak.xcodeproj \
  -scheme Wordbreak \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build-for-testing
```

Run the capture proof on the iPhone 12 Pro after UI Automation is enabled:

```sh
xcodebuild -project Wordbreak.xcodeproj \
  -scheme WordbreakCaptureLab \
  -destination 'id=00008101-001134561A0A001E' \
  test
```

Run the production-target readiness check from the repository root:

```sh
npm run verify:ios:phase0
```

That check must remain red until Luca's exact phone is connected **and** an
installed or archived `Wordbreak.app` is passed with
`--app=/absolute/path/Wordbreak.app` to verify the signed app and extension
entitlements.

## iPhone 12 Pro capture evidence — 2026-09-22

The development-only capture lab completed one uninterrupted physical run on
the paired iPhone 12 Pro (`iPhone13,3`) running iOS 26.5.2. A semantically
unchanged copy of the raw JSON receipt is checked in at
`docs/notes/evidence/phase0/iphone12pro-capture-2026-09-22.json`; its canonical
sorted-JSON SHA-256 is
`b1e3a26c2f4bd290710fc7a79c090ec6fbb996299a579b6ba454aa7c79a374df`.

| Measurement | Result | Budget |
| --- | ---: | ---: |
| Eligible duration | 935.360 s | at least 900 s |
| Screen coverage | 99.889% | at least 98% |
| Front-camera coverage | 100% | at least 98% |
| Microphone coverage | 100% | at least 98% |
| App-audio coverage | 99.991% | at least 98% |
| Maximum pairwise drift | 86.090 ms | at most 250 ms |
| Maximum screen sample gap | 1,073.650 ms | at most 2,000 ms |
| Maximum camera sample gap | 33.482 ms | at most 2,000 ms |
| Invalid buffers / capture errors | 0 / 0 | 0 |
| Thermal changes | none; start state nominal | no serious/critical state |

The schema-v1 receipt says `passesDroppedFrames: false` only because that
binary incorrectly assumed ReplayKit emitted a fixed 30 fps stream and treated
its adaptive presentation-time gaps as missing frames. The raw screen stream
delivered 1,382 valid buffers, spanned 99.889% of eligible time, and never had a
gap over 1.074 seconds. Apple exposes an explicit `didDrop` callback for the
separate AVFoundation camera stream but no equivalent callback on ReplayKit's
`startCapture` handler. The checked-in schema-v2 evaluator therefore uses
invalid/error callbacks for ReplayKit, AVFoundation's explicit drop callback
for the camera, and the independent two-second continuity ceiling for every
track. It does not manufacture dropped screen frames from adaptive cadence.

This receipt proves the adapter architecture on the iPhone 12 Pro development
device. It does not satisfy the plan's hard acceptance gate for Luca's exact
iPhone SE on iOS 26.7, and it does not prove interruption or relaunch behavior.

## Luca iPhone SE interruption evidence — 2026-09-25

The capture lab completed a 979.749-second run on Luca's exact iPhone SE
(`iPhone12,8`) running iOS 26.7. Coverage passed for screen (99.892%), front
camera (100%), microphone (99.9998%), and app audio (99.9992%); maximum
pairwise drift was 74.019 ms; no invalid samples, capture errors, or explicit
camera drops were recorded.

The receipt correctly failed continuity because the app entered the background
three times while Settings was used. The longest gaps were 24.085 seconds for
screen, 22.691 seconds for camera, 23.697 seconds for microphone, and 23.710
seconds for app audio, all above the two-second ceiling. This is interruption
evidence, not a clean feasibility pass. The raw receipt is preserved at
`docs/notes/evidence/phase0/luca-iphone-se-capture-interruption-2026-09-25.json`.
The clean uninterrupted requirement was subsequently satisfied by the iOS 27
schema-v3 receipt documented at the top of this note.

## Apple signing boundary — resolved 2026-09-25

Resolved for development signing on 2026-09-25 after the Apple developer
account was added to Xcode. Xcode generated explicit development profiles for
the app and monitor extension, and a physical-device build succeeded. `codesign`
confirmed that both embedded binaries contain Family Controls and the shared
App Group. `npm run verify:ios:phase0 --
--app=/tmp/wordbreak-luca-production-derived/Build/Products/Debug-iphoneos/Wordbreak.app`
then passed all 24 checks. Managed distribution approval and the runtime
DeviceActivity behavior remain separate gates.

The Apple Developer team knows Luca's registered device and both explicit
bundle identifiers. The App Store Connect API confirms that the app and monitor
extension both have the shared App Group capability enabled. The same API does
not accept Family Controls as a `bundleIdCapabilities` type; Apple documents it
as a managed capability whose distribution request must be submitted by the
Account Holder separately for the app and every Screen Time API extension.

Before the Apple developer account was added to Xcode, the local wildcard
development profile contained neither App Groups nor Family Controls and the
production target correctly failed closed. That historical provisioning block
is resolved. The remaining Apple gate is runtime proof on Luca's exact phone:
authorization, picker persistence, the real DeviceActivity threshold callback,
App Group delivery, notification delivery, restart, midnight rollover,
revocation, and reinstall.

ReplayKit also displayed its system screen-capture consent sheet again after
the capture-lab app was reinstalled. That consent cannot be automated away and
must remain a visible, learner-initiated boundary in the product. The lab has a
`CAPTURE_LAB`-only `WORDBREAK_CAPTURE_TARGET_SECONDS` launch environment
override for short restart checks. After the system consent was accepted, the
10.697-second physical relaunch smoke documented above passed every budget.

## Child authorization and threshold proof — 2026-09-25

**Summary:** A parent completed Apple's native approval flow. The signed app
then reported Family Controls `.child` authorization as **Allowed** on Luca's
exact iPhone SE (`iPhone12,8`) running iOS 27.0.

**Verification:** The physical `ScreenTimePhysicalTests` flow selected the
Social category in Apple's `FamilyActivityPicker`, returned to Wordbreak with
`1 chosen`, and started the one-minute `DeviceActivity` monitor. Discord then
remained foreground for more than one minute. The follow-up
`testSelectionAndCallbackPersistAcrossRestart` test passed on the phone with
both `1 chosen` and `Check received`. This proves authorization, picker
persistence, restart, the real threshold callback, and the monitor extension's
write through `group.com.mattmireles.wordbreak`.

The machine-readable receipt is
`docs/notes/evidence/phase0/luca-iphone-se-screentime-runtime-2026-09-25.json`.
Its canonical sorted-JSON SHA-256 after the replacement-install check is
`b0168186fe647844a9e29d219837c5067ebeafd2385952254af1b2a3e41c5d6e`.

After the user allowed notifications, the five-second foreground proof visibly
presented a `Wordbreak device check` banner with `Notifications are ready.` on
the same phone.

An explicit `devicectl` uninstall then returned `Uninstall prohibited`, which
is the managed child-device policy rather than an application error. Installing
the same signed app in place succeeded. The physical restart/callback test
passed again at 20:31 with `1 chosen` and `Check received`, proving that Screen
Time selection and the extension callback survive a signed replacement install.
A true removal and fresh reinstall still requires a parent action on the phone;
it is not claimed as passed. Midnight rollover and revocation also remain
unproven. These stay grouped under the open Phase 0 physical-runtime item rather
than being inferred from adjacent checks.

**Boundary:** Parent Apple credentials were never stored in Wordbreak, the
repository, build logs, receipts, or automation. The parent completed Apple's
system-owned screen directly on the device.

**Related:** [Phase 0 plan](../plans/007-native-daily-practice-ai-feedback-loop-plan.md)
