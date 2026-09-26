import AVFoundation
import Combine
import Foundation
import ReplayKit
import UIKit

@MainActor
final class CaptureSpikeModel: ObservableObject {
    @Published private(set) var isRunning = false
    @Published private(set) var isBusy = false
    @Published private(set) var elapsed: TimeInterval = 0
    @Published private(set) var message: String?
    @Published private(set) var hasError = false
    @Published private(set) var verdict: String?
    @Published private(set) var snapshot = CaptureMetricsSnapshot.empty

    private let capture = CaptureSpikeCoordinator()
    private var clockTask: Task<Void, Never>?
    private var startedUptime: TimeInterval?
    private let targetDuration: TimeInterval

    init() {
        #if CAPTURE_LAB
            let override = ProcessInfo.processInfo.environment["WORDBREAK_CAPTURE_TARGET_SECONDS"]
                .flatMap(TimeInterval.init)
            targetDuration = max(5, override ?? 15 * 60)
        #else
            targetDuration = 15 * 60
        #endif
    }

    var progress: Double { min(elapsed / targetDuration, 1) }
    var elapsedLabel: String { String(format: "%02d:%02d", Int(elapsed) / 60, Int(elapsed) % 60) }
    var targetDurationLabel: String { String(format: "%02d:%02d", Int(targetDuration) / 60, Int(targetDuration) % 60) }
    var screenStatus: String { snapshot.screen.shortStatus }
    var cameraStatus: String { snapshot.frontCamera.shortStatus }
    var microphoneStatus: String { snapshot.microphone.shortStatus }
    var appAudioStatus: String { snapshot.appAudio.shortStatus }

    func start() {
        guard !isRunning, !isBusy else { return }
        isBusy = true
        hasError = false
        verdict = nil
        message = "Requesting camera and microphone access…"
        Task {
            do {
                try await capture.start()
                isRunning = true
                isBusy = false
                elapsed = 0
                startedUptime = ProcessInfo.processInfo.systemUptime
                message = "Recording locally. Keep Wordbreak in the foreground and use the phone normally."
                startClock()
            } catch {
                isBusy = false
                hasError = true
                message = error.localizedDescription
            }
        }
    }

    func stop() {
        guard isRunning, !isBusy else { return }
        isBusy = true
        clockTask?.cancel()
        Task {
            do {
                let result = try await capture.stop()
                snapshot = result.snapshot
                let receipt = result.receipt
                verdict = receipt.passes ? "PASS" : "NEEDS WORK"
                message = receipt.passes
                    ? "All capture budgets passed. Receipt: \(result.receiptURL.lastPathComponent)"
                    : "Receipt saved, but one or more capture budgets failed. Review it before continuing."
                hasError = !receipt.passes
            } catch {
                message = error.localizedDescription
                hasError = true
            }
            isRunning = false
            isBusy = false
            startedUptime = nil
        }
    }

    private func startClock() {
        clockTask?.cancel()
        guard let startedUptime else { return }
        clockTask = Task { [weak self] in
            while let self, !Task.isCancelled, self.isRunning {
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled else { return }
                self.elapsed = max(0, ProcessInfo.processInfo.systemUptime - startedUptime)
                self.snapshot = self.capture.snapshot()
                if self.elapsed >= self.targetDuration { self.stop(); return }
            }
        }
    }
}
