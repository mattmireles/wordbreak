import Foundation
import SwiftUI

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
    private var capturedSegments: [CapturedSegment] = []
    private var captureTransitionTask: Task<Void, Never>?
    private let capture: SessionCaptureCoordinating

    init(capture: SessionCaptureCoordinating? = nil) {
        self.capture = capture ?? CaptureCoordinator()
    }

    func startToday() {
        do {
            errorMessage = nil
            let wordEngine = try WordbreakEngineBridge(store: WordbreakFileStateStore.appGroup())
            let mathEngine = try MathbreakEngineBridge(
                store: WordbreakFileStateStore.appGroup(filename: "mathbreak.v1.json")
            )
            self.wordEngine = wordEngine
            self.mathEngine = mathEngine
            let output = try wordEngine.dispatch(["type": "session.begin", "budgetMin": 6])
            let state = try JSONSerialization.jsonObject(with: Data(output.stateJSON.utf8)) as? [String: Any]
            let session = state?["session"] as? [String: Any]
            let sessionId = session?["id"] as? String ?? "daily-\(UUID().uuidString.lowercased())"
            self.sessionId = sessionId
            ledger = try DailyEventLedger(sessionId: sessionId)
            wordView = output.viewModel
            try ledger?.record(
                subject: .daily,
                screen: "daily.preparing",
                eventType: "sessionStarted",
                payload: ["entry": "startDaily"]
            )
            try recordOutput(output, subject: .wordbreak)
            stage = output.viewModel["screen"] as? String == "sessionDone" ? .mathbreak : .wordbreak
            if stage == .mathbreak { startMath() }
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
            try recordAction(action, subject: .wordbreak, output: output)
            if output.viewModel["screen"] as? String == "sessionDone" {
                startMath()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func sendMath(_ action: [String: Any]) {
        do {
            guard let mathEngine else { return }
            let output = try mathEngine.dispatch(action)
            mathView = output.viewModel
            try recordAction(action, subject: .mathbreak, output: output)
            stage = output.viewModel["screen"] as? String == "mathDone" ? .checkIn : .mathbreak
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func dismissError() {
        errorMessage = nil
    }

    func handleScenePhase(_ phase: ScenePhase) {
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
            try ledger?.record(
                subject: .daily,
                screen: "mathbreak.attempt",
                eventType: "navigation",
                payload: ["from": "wordbreak", "to": "mathbreak"]
            )
            try recordOutput(output, subject: .mathbreak)
            stage = output.viewModel["screen"] as? String == "mathDone" ? .checkIn : .mathbreak
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func submitCheckIn(choice: String, voiceNote: URL?) {
        do {
            try ledger?.record(
                subject: .checkIn,
                screen: "checkIn.prompt",
                eventType: "checkInSubmitted",
                payload: [
                    "choice": choice,
                    "voiceNote": voiceNote?.lastPathComponent as Any? ?? NSNull(),
                ]
            )
            try ledger?.record(
                subject: .daily,
                screen: "daily.complete",
                eventType: "sessionCompleted"
            )
            stage = .done
            finishCapture()
            Task { try? await NotificationScheduler().markTodayComplete() }
        } catch {
            errorMessage = error.localizedDescription
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
        enqueueCaptureTransition {
            if self.capture.activeSegmentId != nil {
                do {
                    let segment = try await self.capture.stop(reason: reason)
                    self.capturedSegments.append(segment)
                    try self.ledger?.record(
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
                    try? self.ledger?.record(
                        subject: .system,
                        screen: "daily.capture",
                        eventType: "captureFailed",
                        payload: ["reason": error.localizedDescription]
                    )
                }
                self.ledger?.endCapture()
                self.isCapturing = false
            }
            guard seal, !self.capturedSegments.isEmpty else { return }
            do {
                try self.ledger?.record(
                    subject: .system,
                    screen: "daily.capture",
                    eventType: "capturePackaging",
                    payload: ["manifest": "capture-manifest.json"]
                )
                if let sessionId = self.sessionId, let eventsURL = self.ledger?.url {
                    _ = try SessionPackager().seal(
                        sessionId: sessionId,
                        segments: self.capturedSegments,
                        eventsURL: eventsURL
                    )
                }
            } catch {
                try? self.ledger?.record(
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
    ) throws {
        let actionType = action["type"] as? String ?? "unknown"
        let eventType: String
        if actionType.contains("submit") || actionType.contains("commit") || actionType == "word.execute" {
            eventType = "submission"
        } else if actionType.contains("strategy") {
            eventType = "strategyConstructed"
        } else {
            eventType = "touch"
        }
        try ledger?.record(
            subject: subject,
            screen: screenName(output.viewModel, subject: subject),
            eventType: eventType,
            payload: ["action": action]
        )
        try recordOutput(output, subject: subject)
    }

    private func recordOutput(
        _ output: WordbreakEngineOutput,
        subject: DailyEventLedger.Subject
    ) throws {
        let screen = screenName(output.viewModel, subject: subject)
        try ledger?.record(subject: subject, screen: screen, eventType: "screenPresented")
        if output.viewModel["prompt"] != nil || output.viewModel["unit"] != nil {
            try ledger?.record(
                subject: subject,
                screen: screen,
                eventType: "promptPresented",
                payload: ["prompt": output.viewModel["prompt"] ?? NSNull()]
            )
        }
        for event in output.semanticEvents {
            try ledger?.record(
                subject: subject,
                screen: screen,
                eventType: "engineTransition",
                payload: event
            )
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
