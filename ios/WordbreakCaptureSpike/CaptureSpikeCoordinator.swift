import AVFoundation
import Foundation
import ReplayKit
import UIKit

enum CaptureSampleTrack: String, CaseIterable, Sendable {
    case screen
    case frontCamera
    case microphone
    case appAudio
}

struct CaptureTrackMetrics: Codable, Sendable {
    var samples = 0
    var invalidSamples = 0
    var droppedBuffers = 0
    var firstPTS: Double?
    var lastPTS: Double?
    var firstHostNs: UInt64?
    var lastHostNs: UInt64?
    var maximumGapMs: Double = 0

    var mediaDuration: Double { max(0, (lastPTS ?? 0) - (firstPTS ?? 0)) }
    var hostDuration: Double { guard let firstHostNs, let lastHostNs else { return 0 }; return Double(lastHostNs - firstHostNs) / 1_000_000_000 }
    var shortStatus: String { samples == 0 ? "waiting" : "\(samples) samples" }
}

struct CaptureMetricsSnapshot: Codable, Sendable {
    var screen: CaptureTrackMetrics
    var frontCamera: CaptureTrackMetrics
    var microphone: CaptureTrackMetrics
    var appAudio: CaptureTrackMetrics
    var events: [String]
    var errors: [String]

    static let empty = CaptureMetricsSnapshot(screen: .init(), frontCamera: .init(), microphone: .init(), appAudio: .init(), events: [], errors: [])
}

struct CaptureFeasibilityReceipt: Codable, Sendable {
    let schemaVersion: Int
    let startedAt: Date
    let endedAt: Date
    let device: String
    let systemVersion: String
    let bundleIdentifier: String
    let buildNumber: String
    let durationSeconds: Double
    let snapshot: CaptureMetricsSnapshot
    let coverage: [String: Double]
    let droppedFrameRatio: [String: Double]
    let maximumGapMs: [String: Double]
    let maximumPairwiseDriftMs: Double?
    let passesCoverage: Bool
    let passesDroppedFrames: Bool
    let passesContinuity: Bool
    let passesDrift: Bool
    let passesCaptureErrors: Bool

    var passes: Bool { passesCoverage && passesDroppedFrames && passesContinuity && passesDrift && passesCaptureErrors }
}

struct CaptureBudgetEvaluation: Equatable, Sendable {
    let coverage: [String: Double]
    let droppedFrameRatio: [String: Double]
    let maximumGapMs: [String: Double]
    let maximumPairwiseDriftMs: Double?
    let passesCoverage: Bool
    let passesDroppedFrames: Bool
    let passesContinuity: Bool
    let passesDrift: Bool

    var passes: Bool { passesCoverage && passesDroppedFrames && passesContinuity && passesDrift }

    static func evaluate(snapshot: CaptureMetricsSnapshot, duration: TimeInterval) -> Self {
        let tracks = [
            "screen": snapshot.screen,
            "frontCamera": snapshot.frontCamera,
            "microphone": snapshot.microphone,
            "appAudio": snapshot.appAudio,
        ]
        let coverage = tracks.mapValues { duration > 0 ? min(1, $0.mediaDuration / duration) : 0 }
        let videoTracks = ["screen": snapshot.screen, "frontCamera": snapshot.frontCamera]
        let droppedFrameRatio = videoTracks.mapValues { track in
            let dropped = track.invalidSamples + track.droppedBuffers
            let total = track.samples + dropped
            return total > 0 ? Double(dropped) / Double(total) : 1
        }
        let maximumGapMs = tracks.mapValues(\.maximumGapMs)
        let clockAnchors = tracks.values.compactMap { track -> (start: Double, end: Double, rate: Double)? in
            guard let firstPTS = track.firstPTS,
                  let lastPTS = track.lastPTS,
                  let firstHostNs = track.firstHostNs,
                  let lastHostNs = track.lastHostNs else { return nil }
            let firstHostSeconds = Double(firstHostNs) / 1_000_000_000
            let lastHostSeconds = Double(lastHostNs) / 1_000_000_000
            return (
                start: (firstPTS - firstHostSeconds) * 1000,
                end: (lastPTS - lastHostSeconds) * 1000,
                rate: (track.mediaDuration - track.hostDuration) * 1000
            )
        }
        let maximumPairwiseDriftMs: Double?
        if clockAnchors.count == tracks.count {
            maximumPairwiseDriftMs = max(
                Self.spread(clockAnchors.map(\.start)),
                Self.spread(clockAnchors.map(\.end)),
                Self.spread(clockAnchors.map(\.rate))
            )
        } else {
            maximumPairwiseDriftMs = nil
        }
        return Self(
            coverage: coverage,
            droppedFrameRatio: droppedFrameRatio,
            maximumGapMs: maximumGapMs,
            maximumPairwiseDriftMs: maximumPairwiseDriftMs,
            passesCoverage: coverage.values.allSatisfy { $0 >= 0.98 },
            passesDroppedFrames: droppedFrameRatio.values.allSatisfy { $0 <= 0.01 },
            passesContinuity: maximumGapMs.values.allSatisfy { $0 <= 2_000 },
            passesDrift: maximumPairwiseDriftMs.map { $0 <= 250 } ?? false
        )
    }

    private static func spread(_ values: [Double]) -> Double {
        guard let minimum = values.min(), let maximum = values.max() else { return 0 }
        return maximum - minimum
    }
}

struct CaptureStopResult: Sendable {
    let snapshot: CaptureMetricsSnapshot
    let receipt: CaptureFeasibilityReceipt
    let receiptURL: URL
}

enum CaptureSpikeError: LocalizedError {
    case cameraDenied
    case cameraUnavailable
    case cannotConfigureCamera
    case alreadyRunning
    case notRunning

    var errorDescription: String? {
        switch self {
        case .cameraDenied: "Camera permission is required for the physical capture check."
        case .cameraUnavailable: "The front camera is unavailable on this device."
        case .cannotConfigureCamera: "The front-camera capture pipeline could not be configured."
        case .alreadyRunning: "A capture check is already running."
        case .notRunning: "No capture check is running."
        }
    }
}

final class CaptureMetricsStore: @unchecked Sendable {
    private let lock = NSLock()
    private var value = CaptureMetricsSnapshot.empty

    func append(_ buffer: CMSampleBuffer, to keyPath: WritableKeyPath<CaptureMetricsSnapshot, CaptureTrackMetrics>) {
        let host = DispatchTime.now().uptimeNanoseconds
        let pts = CMSampleBufferGetPresentationTimeStamp(buffer).seconds
        lock.lock(); defer { lock.unlock() }
        var track = value[keyPath: keyPath]
        if !CMSampleBufferIsValid(buffer) || !CMSampleBufferDataIsReady(buffer) {
            track.invalidSamples += 1
            value[keyPath: keyPath] = track
            return
        }
        if let last = track.lastPTS {
            let gap = max(0, pts - last)
            track.maximumGapMs = max(track.maximumGapMs, gap * 1000)
        }
        track.samples += 1
        track.firstPTS = track.firstPTS ?? pts
        track.lastPTS = pts
        track.firstHostNs = track.firstHostNs ?? host
        track.lastHostNs = host
        value[keyPath: keyPath] = track
    }

    func droppedBuffer(on keyPath: WritableKeyPath<CaptureMetricsSnapshot, CaptureTrackMetrics>) {
        lock.lock(); defer { lock.unlock() }
        value[keyPath: keyPath].droppedBuffers += 1
    }

    func event(_ text: String) {
        lock.lock(); defer { lock.unlock() }
        value.events.append("\(Date().ISO8601Format()) \(text)")
    }

    func error(_ text: String) {
        lock.lock(); defer { lock.unlock() }
        value.errors.append(text)
        value.events.append("\(Date().ISO8601Format()) error: \(text)")
    }

    func snapshot() -> CaptureMetricsSnapshot { lock.lock(); defer { lock.unlock() }; return value }
    func reset() { lock.lock(); value = .empty; lock.unlock() }
}

final class FrontCameraProbe: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate, @unchecked Sendable {
    private let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "wordbreak.capture.front-camera", qos: .userInitiated)
    private let metrics: CaptureMetricsStore
    private let sampleHandler: (@Sendable (CMSampleBuffer, CaptureSampleTrack) -> Void)?

    init(
        metrics: CaptureMetricsStore,
        sampleHandler: (@Sendable (CMSampleBuffer, CaptureSampleTrack) -> Void)? = nil
    ) {
        self.metrics = metrics
        self.sampleHandler = sampleHandler
    }

    func start() async throws {
        let granted = await AVCaptureDevice.requestAccess(for: .video)
        guard granted else { throw CaptureSpikeError.cameraDenied }
        try await withCheckedThrowingContinuation { continuation in
            queue.async {
                do {
                    guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front) else { throw CaptureSpikeError.cameraUnavailable }
                    let input = try AVCaptureDeviceInput(device: camera)
                    let output = AVCaptureVideoDataOutput()
                    output.alwaysDiscardsLateVideoFrames = false
                    output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarFullRange]
                    output.setSampleBufferDelegate(self, queue: self.queue)
                    self.session.beginConfiguration()
                    do {
                        self.session.sessionPreset = .medium
                        guard self.session.canAddInput(input), self.session.canAddOutput(output) else {
                            throw CaptureSpikeError.cannotConfigureCamera
                        }
                        self.session.addInput(input)
                        self.session.addOutput(output)
                        self.session.commitConfiguration()
                    } catch {
                        self.session.commitConfiguration()
                        throw error
                    }
                    self.session.startRunning()
                    continuation.resume()
                } catch { continuation.resume(throwing: error) }
            }
        }
    }

    func stop() async {
        await withCheckedContinuation { continuation in
            queue.async {
                self.session.stopRunning()
                self.session.beginConfiguration()
                self.session.inputs.forEach(self.session.removeInput)
                self.session.outputs.forEach(self.session.removeOutput)
                self.session.commitConfiguration()
                continuation.resume()
            }
        }
    }

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        metrics.append(sampleBuffer, to: \.frontCamera)
        sampleHandler?(sampleBuffer, .frontCamera)
    }

    func captureOutput(_ output: AVCaptureOutput, didDrop sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        metrics.droppedBuffer(on: \.frontCamera)
    }
}

@MainActor
final class CaptureSpikeCoordinator: @unchecked Sendable {
    private let metrics = CaptureMetricsStore()
    private let sampleHandler: (@Sendable (CMSampleBuffer, CaptureSampleTrack) -> Void)?
    private lazy var frontCamera = FrontCameraProbe(metrics: metrics, sampleHandler: sampleHandler)
    private let recorder = RPScreenRecorder.shared()
    private var startedAt: Date?
    private var observers: [NSObjectProtocol] = []

    init(sampleHandler: (@Sendable (CMSampleBuffer, CaptureSampleTrack) -> Void)? = nil) {
        self.sampleHandler = sampleHandler
    }

    func start() async throws {
        guard startedAt == nil else { throw CaptureSpikeError.alreadyRunning }
        metrics.reset()
        installObservers()
        do {
            try await frontCamera.start()
            recorder.isCameraEnabled = false
            recorder.isMicrophoneEnabled = true
            let sampleHandler = sampleHandler
            try await recorder.startCapture { [metrics, sampleHandler] buffer, type, error in
                if let error { metrics.error("ReplayKit: \(error.localizedDescription)"); return }
                switch type {
                case .video:
                    metrics.append(buffer, to: \.screen)
                    sampleHandler?(buffer, .screen)
                case .audioApp:
                    metrics.append(buffer, to: \.appAudio)
                    sampleHandler?(buffer, .appAudio)
                case .audioMic:
                    metrics.append(buffer, to: \.microphone)
                    sampleHandler?(buffer, .microphone)
                @unknown default: metrics.event("Unknown ReplayKit sample type")
                }
            }
            startedAt = Date()
            metrics.event("thermal state at start: \(ProcessInfo.processInfo.thermalState.rawValue)")
            metrics.event("audio route at start: \(AVAudioSession.sharedInstance().currentRoute)")
            metrics.event("capture started")
        } catch {
            await frontCamera.stop()
            startedAt = nil
            removeObservers()
            throw error
        }
    }

    func stop() async throws -> CaptureStopResult {
        guard let startedAt else { throw CaptureSpikeError.notRunning }
        defer {
            self.startedAt = nil
            removeObservers()
        }
        let endedAt = Date()
        var stopError: Error?
        do {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                recorder.stopCapture { error in
                    if let error { continuation.resume(throwing: error) }
                    else { continuation.resume() }
                }
            }
        } catch {
            stopError = error
            metrics.error("ReplayKit stop: \(error.localizedDescription)")
        }
        await frontCamera.stop()
        metrics.event("capture stopped")
        let snapshot = metrics.snapshot()
        let duration = endedAt.timeIntervalSince(startedAt)
        let evaluation = CaptureBudgetEvaluation.evaluate(snapshot: snapshot, duration: duration)
        let receipt = CaptureFeasibilityReceipt(
            schemaVersion: 3, startedAt: startedAt, endedAt: endedAt,
            device: Self.hardwareModelIdentifier(), systemVersion: UIDevice.current.systemVersion,
            bundleIdentifier: Bundle.main.bundleIdentifier ?? "unknown",
            buildNumber: Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "unknown",
            durationSeconds: duration, snapshot: snapshot, coverage: evaluation.coverage,
            droppedFrameRatio: evaluation.droppedFrameRatio,
            maximumGapMs: evaluation.maximumGapMs,
            maximumPairwiseDriftMs: evaluation.maximumPairwiseDriftMs,
            passesCoverage: evaluation.passesCoverage,
            passesDroppedFrames: evaluation.passesDroppedFrames,
            passesContinuity: evaluation.passesContinuity,
            passesDrift: evaluation.passesDrift,
            passesCaptureErrors: snapshot.errors.isEmpty
        )
        let directory = try FileManager.default.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            .appending(path: "CaptureReceipts", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime]
        let url = directory.appending(path: "capture-\(formatter.string(from: endedAt).replacingOccurrences(of: ":", with: "-" )).json")
        let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]; encoder.dateEncodingStrategy = .iso8601
        try encoder.encode(receipt).write(to: url, options: .atomic)
        if let stopError { throw stopError }
        return CaptureStopResult(snapshot: snapshot, receipt: receipt, receiptURL: url)
    }

    func snapshot() -> CaptureMetricsSnapshot { metrics.snapshot() }

    private func installObservers() {
        let center = NotificationCenter.default
        observers = [
            center.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: nil) { [metrics] note in metrics.event("audio route changed: \(note.userInfo ?? [:])") },
            center.addObserver(forName: ProcessInfo.thermalStateDidChangeNotification, object: nil, queue: nil) { [metrics] _ in metrics.event("thermal state: \(ProcessInfo.processInfo.thermalState.rawValue)") },
            center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: nil) { [metrics] _ in metrics.event("app entered background") },
            center.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: nil) { [metrics] _ in metrics.event("app entered foreground") }
        ]
    }

    private func removeObservers() {
        let center = NotificationCenter.default
        observers.forEach(center.removeObserver)
        observers.removeAll()
    }

    private static func hardwareModelIdentifier() -> String {
        var system = utsname()
        uname(&system)
        return withUnsafePointer(to: &system.machine) { pointer in
            pointer.withMemoryRebound(to: CChar.self, capacity: 1) { String(cString: $0) }
        }
    }
}
