import Foundation
import SwiftUI

/// The daily minimum-work and soft-budget contract (docs/notes/native-daily-practice-contract.md).
///
/// Wordbreak receives a 6-minute block of the 12-minute soft target; its engine still plans at
/// least four production opportunities and never splits a started module. Mathbreak runs one
/// deterministic queue whose every item forces attempt -> strategy construction -> retype.
/// src/daily-session-budget.test.js pins the synthetic worst case (17 minutes on an ordinary day,
/// about 25 on the placement day), so the learner surface never promises a duration.
enum DailySessionContract {
    static let wordbreakBudgetMinutes = 6
}

/// Injectable dependencies so the whole offline day can be driven in unit tests.
struct DailySessionEnvironment {
    var now: () -> Date = Date.init
    var calendar: Calendar = .current
    var wordStore: () throws -> WordbreakStateStore = { try WordbreakFileStateStore.appGroup() }
    var mathStore: () throws -> WordbreakStateStore = {
        try WordbreakFileStateStore.appGroup(filename: "mathbreak.v1.json")
    }
    var coordination: () throws -> DailyCoordinationStore = { try DailyCoordinationStore.shared() }
    var ledger: (String) throws -> DailyEventLedger = { try DailyEventLedger(sessionId: $0) }
    /// Plan 008's post-session check-in is experiment evidence, so it rides the capture flag.
    var checkInEnabled: Bool = ExperimentConfiguration.captureEnabled
    /// Nonessential effect run only after completion is durably committed.
    var afterCompletion: @MainActor () -> Void = {
        Task { try? await NotificationScheduler().refresh() }
    }
}

@MainActor
final class DailySessionController: ObservableObject {
    enum Stage: Equatable {
        case home
        case wordbreak
        case mathbreak
        case checkIn
        case done
    }

    @Published private(set) var stage: Stage = .home
    @Published private(set) var wordView: [String: Any] = [:]
    @Published private(set) var mathView: [String: Any] = [:]
    @Published private(set) var errorMessage: String?
    @Published private(set) var isCapturing = false

    private var wordEngine: WordbreakEngineBridge?
    private var mathEngine: MathbreakEngineBridge?
    private var ledger: DailyEventLedger?
    private var sessionId: String?
    /// Local day credited on completion: the day this launch started or resumed practice.
    private var sessionDay: String?
    private var capturedSegments: [CapturedSegment] = []
    private var captureTransitionTask: Task<Void, Never>?
    private let capture: SessionCaptureCoordinating
    private let environment: DailySessionEnvironment

    init(capture: SessionCaptureCoordinating? = nil, environment: DailySessionEnvironment = DailySessionEnvironment()) {
        self.capture = capture ?? CaptureCoordinator()
        self.environment = environment
        refreshDay()
    }

    private var today: String {
        DailyNudgePolicy.dayKey(environment.now(), calendar: environment.calendar)
    }

    private var completedToday: Bool {
        (try? environment.coordination().read().completedDay) == today
    }

    /// Re-derives the resting screen after launch, foregrounding, or a clock change. A finished
    /// day returns home once the local day rolls over. A run is never cut off mid-item: only when
    /// the app comes back to the foreground (`releaseStaleRun`) is a run started on an earlier day
    /// released, so the next start rebuilds on today's clock. The engine then abandons the stale
    /// Wordbreak session, and credit goes to the day the work is actually finished.
    func refreshDay(releaseStaleRun: Bool = false) {
        switch stage {
        case .home, .done:
            stage = completedToday ? .done : .home
        case .wordbreak, .mathbreak, .checkIn:
            if releaseStaleRun, sessionDay != today { releaseRun(); stage = .home }
        }
    }

    private func releaseRun() {
        stopCaptureSegment(reason: "rollover", seal: false)
        // Queued after the stop, which captured this run's ledger, so nothing leaks forward.
        enqueueCaptureTransition { self.capturedSegments.removeAll() }
        wordEngine = nil
        mathEngine = nil
        ledger = nil
        sessionId = nil
        sessionDay = nil
    }

    /// The single entry point for the home button, notifications, and the Screen Time nudge.
    func startToday() {
        guard stage == .home || stage == .done else { return }
        if completedToday {
            stage = .done
            return
        }
        do {
            errorMessage = nil
            let now = environment.now()
            let wordEngine = try WordbreakEngineBridge(store: environment.wordStore(), now: now, timezone: environment.calendar.timeZone)
            let mathEngine = try MathbreakEngineBridge(store: environment.mathStore(), now: now, timezone: environment.calendar.timeZone)
            self.wordEngine = wordEngine
            self.mathEngine = mathEngine
            sessionDay = today
            let output = try wordEngine.dispatch([
                "type": "session.begin",
                "budgetMin": DailySessionContract.wordbreakBudgetMinutes,
            ])
            let state = try JSONSerialization.jsonObject(with: Data(output.stateJSON.utf8)) as? [String: Any]
            let session = state?["session"] as? [String: Any]
            let sessionId = session?["id"] as? String ?? "daily-\(UUID().uuidString.lowercased())"
            self.sessionId = sessionId
            ledger = try? environment.ledger(sessionId)
            wordView = output.viewModel
            observe {
                try $0.record(
                    subject: .daily,
                    screen: "daily.preparing",
                    eventType: "sessionStarted",
                    payload: ["entry": "startDaily"]
                )
            }
            recordOutput(output, subject: .wordbreak)
            stage = .wordbreak
            if !Self.isWordPractice(output.viewModel) { startMath() }
            beginCapture(sessionId: sessionId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func sendWord(_ action: [String: Any]) {
        do {
            guard let wordEngine else { return }
            let output = try wordEngine.dispatch(action)
            wordView = output.viewModel
            recordAction(action, subject: .wordbreak, output: output)
            if !Self.isWordPractice(output.viewModel) { startMath() }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func sendMath(_ action: [String: Any]) {
        do {
            guard let mathEngine else { return }
            let output = try mathEngine.dispatch(action)
            mathView = output.viewModel
            recordAction(action, subject: .mathbreak, output: output)
            if output.viewModel["screen"] as? String == "mathDone" { finishSubjects() }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func dismissError() {
        errorMessage = nil
    }

    func handleScenePhase(_ phase: ScenePhase) {
        if phase == .active { refreshDay(releaseStaleRun: true) }
        guard stage != .home, stage != .done else { return }
        switch phase {
        case .active:
            try? ledger?.record(
                subject: .system,
                screen: "daily.lifecycle",
                eventType: "sessionResumed"
            )
            startCaptureSegment(reason: "resume")
        case .background:
            try? ledger?.record(
                subject: .system,
                screen: "daily.lifecycle",
                eventType: "sessionPaused"
            )
            stopCaptureSegment(reason: "background", seal: false)
        case .inactive:
            break
        @unknown default:
            break
        }
    }

    private func startMath() {
        do {
            guard let mathEngine else { return }
            let output = try mathEngine.dispatch(["type": "session.begin"])
            mathView = output.viewModel
            observe {
                try $0.record(
                    subject: .daily,
                    screen: "mathbreak.attempt",
                    eventType: "navigation",
                    payload: ["from": "wordbreak", "to": "mathbreak"]
                )
            }
            recordOutput(output, subject: .mathbreak)
            stage = .mathbreak
            if output.viewModel["screen"] as? String == "mathDone" { finishSubjects() }
        } catch {
            recoverAtHome(error)
        }
    }

    /// Only lesson and run screens are Wordbreak work. `sessionDone`, and any neutral engine
    /// screen (an empty compile, an imported state with nothing due), hands off to math instead
    /// of stranding the learner on a screen the native view does not draw.
    private static func isWordPractice(_ view: [String: Any]) -> Bool {
        ["docs", "run"].contains(view["screen"] as? String ?? "")
    }

    /// Both subjects have committed their protected work.
    private func finishSubjects() {
        if environment.checkInEnabled {
            stage = .checkIn
        } else {
            completeDay()
        }
    }

    func submitCheckIn(choice: String, voiceNote: URL?) {
        observe {
            try $0.record(
                subject: .checkIn,
                screen: "checkIn.prompt",
                eventType: "checkInSubmitted",
                payload: [
                    "choice": choice,
                    "voiceNote": voiceNote?.lastPathComponent as Any? ?? NSNull(),
                ]
            )
        }
        completeDay()
    }

    /// Plan 008 observation is best-effort: an event-ledger failure never blocks learning.
    private func observe(_ write: (DailyEventLedger) throws -> Void) {
        guard let ledger else { return }
        try? write(ledger)
    }

    /// A failed transition between subjects returns to the doorway. Both engines committed their
    /// progress, so the next start resumes exactly where the learner stopped.
    private func recoverAtHome(_ error: Error) {
        errorMessage = error.localizedDescription
        releaseRun()
        stage = .home
    }

    /// Commits the one shared daily completion before any effect: navigation, notification
    /// cancellation, and capture sealing all follow the durable write.
    private func completeDay() {
        do {
            let day = sessionDay ?? today
            try environment.coordination().update { $0.completedDay = day }
            observe { try $0.record(subject: .daily, screen: "daily.complete", eventType: "sessionCompleted") }
            stage = .done
            finishCapture()
            environment.afterCompletion()
        } catch {
            recoverAtHome(error)
        }
    }

    private func beginCapture(sessionId: String) {
        guard ExperimentConfiguration.captureEnabled else {
            try? ledger?.record(
                subject: .system,
                screen: "daily.capture",
                eventType: "captureDisabled"
            )
            return
        }
        #if targetEnvironment(simulator)
            try? ledger?.record(
                subject: .system,
                screen: "daily.capture",
                eventType: "captureUnavailable",
                payload: ["reason": "simulator"]
            )
        #else
            startCaptureSegment(reason: "start")
        #endif
    }

    private func finishCapture() {
        stopCaptureSegment(reason: "completion", seal: true)
    }

    private func startCaptureSegment(reason: String) {
        guard ExperimentConfiguration.captureEnabled,
              let sessionId
        else { return }
        enqueueCaptureTransition {
            guard self.capture.activeSegmentId == nil, self.stage != .done else { return }
            do {
                let start = try await self.capture.start(sessionId: sessionId, reason: reason)
                self.ledger?.beginCapture(segmentId: start.segmentId, hostAnchorNs: start.hostAnchorNs)
                self.isCapturing = true
                try self.ledger?.record(
                    subject: .system,
                    screen: "daily.capture",
                    eventType: "captureStarted",
                    payload: ["segmentId": start.segmentId, "reason": reason]
                )
            } catch {
                try? self.ledger?.record(
                    subject: .system,
                    screen: "daily.capture",
                    eventType: "captureUnavailable",
                    payload: ["reason": error.localizedDescription]
                )
            }
        }
    }

    private func stopCaptureSegment(reason: String, seal: Bool) {
        let ledger = ledger
        let sessionId = sessionId
        enqueueCaptureTransition {
            if self.capture.activeSegmentId != nil {
                do {
                    let segment = try await self.capture.stop(reason: reason)
                    self.capturedSegments.append(segment)
                    try ledger?.record(
                        subject: .system,
                        screen: "daily.capture",
                        eventType: "captureStopped",
                        payload: [
                            "segmentId": segment.segmentId,
                            "durationMs": segment.durationMs,
                            "objects": segment.objects.map(\.name),
                            "errors": segment.errors,
                            "reason": reason,
                        ]
                    )
                } catch {
                    try? ledger?.record(
                        subject: .system,
                        screen: "daily.capture",
                        eventType: "captureFailed",
                        payload: ["reason": error.localizedDescription]
                    )
                }
                ledger?.endCapture()
                self.isCapturing = false
            }
            guard seal, !self.capturedSegments.isEmpty else { return }
            do {
                try ledger?.record(
                    subject: .system,
                    screen: "daily.capture",
                    eventType: "capturePackaging",
                    payload: ["manifest": "capture-manifest.json"]
                )
                if let sessionId, let eventsURL = ledger?.url {
                    _ = try SessionPackager().seal(
                        sessionId: sessionId,
                        segments: self.capturedSegments,
                        eventsURL: eventsURL
                    )
                }
            } catch {
                try? ledger?.record(
                    subject: .system,
                    screen: "daily.capture",
                    eventType: "captureFailed",
                    payload: ["reason": error.localizedDescription]
                )
            }
        }
    }

    private func enqueueCaptureTransition(_ operation: @escaping @MainActor () async -> Void) {
        let previous = captureTransitionTask
        captureTransitionTask = Task { @MainActor in
            await previous?.value
            await operation()
        }
    }

    private func recordAction(
        _ action: [String: Any],
        subject: DailyEventLedger.Subject,
        output: WordbreakEngineOutput
    ) {
        let actionType = action["type"] as? String ?? "unknown"
        let eventType: String
        if actionType.contains("submit") || actionType.contains("commit") || actionType == "word.execute" {
            eventType = "submission"
        } else if actionType.contains("strategy") {
            eventType = "strategyConstructed"
        } else {
            eventType = "touch"
        }
        observe {
            try $0.record(
                subject: subject,
                screen: screenName(output.viewModel, subject: subject),
                eventType: eventType,
                payload: ["action": action]
            )
        }
        recordOutput(output, subject: subject)
    }

    private func recordOutput(
        _ output: WordbreakEngineOutput,
        subject: DailyEventLedger.Subject
    ) {
        let screen = screenName(output.viewModel, subject: subject)
        observe { ledger in
            try ledger.record(subject: subject, screen: screen, eventType: "screenPresented")
            if output.viewModel["prompt"] != nil || output.viewModel["unit"] != nil {
                try ledger.record(
                    subject: subject,
                    screen: screen,
                    eventType: "promptPresented",
                    payload: ["prompt": output.viewModel["prompt"] ?? NSNull()]
                )
            }
            for event in output.semanticEvents {
                try ledger.record(subject: subject, screen: screen, eventType: "engineTransition", payload: event)
            }
        }
    }

    private func screenName(
        _ viewModel: [String: Any],
        subject: DailyEventLedger.Subject
    ) -> String {
        let screen = viewModel["screen"] as? String ?? "unknown"
        let phase = viewModel["phase"] as? String
        return "\(subject.rawValue).\(phase ?? screen)"
    }
}
