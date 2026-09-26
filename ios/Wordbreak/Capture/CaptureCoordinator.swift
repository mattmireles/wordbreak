import AVFoundation
import CoreMedia
import CryptoKit
import Foundation

struct CapturedObject: Codable, Sendable {
    let name: String
    let track: String
    let segmentId: String
    let contentType: String
    let byteCount: Int64
    let sha256: String
}

struct CapturedSegment: Codable, Sendable {
    let segmentId: String
    let reason: String
    let hostAnchorNs: UInt64
    let firstPresentationTimeMs: Double
    let lastPresentationTimeMs: Double
    let durationMs: Double
    let discontinuities: [[String: String]]
    let thermalStates: [String]
    let objects: [CapturedObject]
    let errors: [String]
}

struct CaptureStart: Sendable {
    let segmentId: String
    let hostAnchorNs: UInt64
}

@MainActor
protocol SessionCaptureCoordinating: AnyObject {
    var activeSegmentId: String? { get }
    func start(sessionId: String, reason: String) async throws -> CaptureStart
    func stop(reason: String) async throws -> CapturedSegment
}

@MainActor
final class CaptureCoordinator: SessionCaptureCoordinating {
    private let mediaWriter: SessionMediaWriter
    private let adapter: CaptureSpikeCoordinator
    private(set) var activeSegmentId: String?

    init() {
        let mediaWriter = SessionMediaWriter()
        self.mediaWriter = mediaWriter
        adapter = CaptureSpikeCoordinator { buffer, track in
            mediaWriter.consume(buffer, track: track)
        }
    }

    func start(sessionId: String, reason: String = "start") async throws -> CaptureStart {
        guard activeSegmentId == nil else { throw CaptureSpikeError.alreadyRunning }
        let segmentId = UUID().uuidString.lowercased()
        _ = try mediaWriter.begin(sessionId: sessionId, segmentId: segmentId, reason: reason)
        do {
            try await adapter.start()
            let hostAnchorNs = await mediaWriter.captureAnchor()
            activeSegmentId = segmentId
            return CaptureStart(segmentId: segmentId, hostAnchorNs: hostAnchorNs)
        } catch {
            _ = await mediaWriter.finish(stopReason: "startFailed")
            throw error
        }
    }

    func stop(reason: String = "completion") async throws -> CapturedSegment {
        guard activeSegmentId != nil else { throw CaptureSpikeError.notRunning }
        do { _ = try await adapter.stop() } catch { /* Seal every valid sample even if ReplayKit reports a stop error. */ }
        let segment = await mediaWriter.finish(stopReason: reason)
        activeSegmentId = nil
        return segment
    }
}

private final class SessionMediaWriter: @unchecked Sendable {
    private let queue = DispatchQueue(label: "wordbreak.capture.media-writer", qos: .userInitiated)
    private var sessionId = ""
    private var segmentId = ""
    private var reason = "start"
    private var root: URL?
    private var hostAnchorNs: UInt64 = 0
    private var thermalStates: [String] = []
    private var writers: [CaptureSampleTrack: RealtimeTrackWriter] = [:]

    func begin(sessionId: String, segmentId: String, reason: String) throws -> UInt64 {
        guard let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.com.mattmireles.wordbreak"
        ) else { throw WordbreakEngineError.stateStoreUnavailable }
        let root = container
            .appending(path: "sessions/\(sessionId)/raw/segments/\(segmentId)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        queue.sync {
            self.sessionId = sessionId
            self.segmentId = segmentId
            self.reason = reason
            self.root = root
            hostAnchorNs = DispatchTime.now().uptimeNanoseconds
            thermalStates = [Self.thermalStateName(ProcessInfo.processInfo.thermalState)]
            writers = [:]
        }
        return queue.sync { hostAnchorNs }
    }

    func consume(_ sampleBuffer: CMSampleBuffer, track: CaptureSampleTrack) {
        queue.async { [self] in
            guard let root else { return }
            let writer = writers[track] ?? {
                let value = RealtimeTrackWriter(
                    track: track,
                    url: root.appending(path: "\(track.rawValue).mov")
                )
                writers[track] = value
                return value
            }()
            writer.append(sampleBuffer, hostNs: DispatchTime.now().uptimeNanoseconds)
        }
    }

    func captureAnchor() async -> UInt64 {
        for _ in 0..<50 {
            if let anchor = queue.sync(execute: { writers[.screen]?.firstHostNs }) {
                queue.sync { hostAnchorNs = anchor }
                return anchor
            }
            try? await Task.sleep(for: .milliseconds(20))
        }
        return queue.sync { hostAnchorNs }
    }

    func finish(stopReason: String) async -> CapturedSegment {
        await withCheckedContinuation { continuation in
            queue.async { [self] in
                let localWriters = writers
                let group = DispatchGroup()
                for writer in localWriters.values {
                    group.enter()
                    writer.finish { group.leave() }
                }
                group.notify(queue: queue) { [self] in
                    var objects: [CapturedObject] = []
                    var errors: [String] = []
                    let completed = localWriters.values.sorted { $0.track.rawValue < $1.track.rawValue }
                    for writer in completed {
                        if let error = writer.errorDescription { errors.append("\(writer.track.rawValue): \(error)") }
                        guard writer.sampleCount > 0,
                              FileManager.default.fileExists(atPath: writer.url.path)
                        else { continue }
                        do {
                            let values = try writer.url.resourceValues(forKeys: [.fileSizeKey])
                            objects.append(CapturedObject(
                                name: "raw/segments/\(segmentId)/\(writer.url.lastPathComponent)",
                                track: writer.track.rawValue,
                                segmentId: segmentId,
                                contentType: "video/quicktime",
                                byteCount: Int64(values.fileSize ?? 0),
                                sha256: try Self.sha256(writer.url)
                            ))
                        } catch { errors.append("\(writer.track.rawValue) seal: \(error.localizedDescription)") }
                    }
                    let firstPTS = completed.compactMap(\.firstPTS).min() ?? 0
                    let lastPTS = completed.compactMap(\.lastPTS).max() ?? firstPTS
                    let durationMs = max(0, lastPTS - firstPTS) * 1000
                    if stopReason != "completion" { errors.append("stopped: \(stopReason)") }
                    let segment = CapturedSegment(
                        segmentId: segmentId,
                        reason: reason,
                        hostAnchorNs: hostAnchorNs,
                        firstPresentationTimeMs: 0,
                        lastPresentationTimeMs: durationMs,
                        durationMs: durationMs,
                        discontinuities: [],
                        thermalStates: thermalStates,
                        objects: objects,
                        errors: errors
                    )
                    continuation.resume(returning: segment)
                    writers = [:]
                    root = nil
                }
            }
        }
    }

    private static func sha256(_ url: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        var hasher = SHA256()
        while true {
            let data = try handle.read(upToCount: 1_048_576) ?? Data()
            if data.isEmpty { break }
            hasher.update(data: data)
        }
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }

    private static func thermalStateName(_ state: ProcessInfo.ThermalState) -> String {
        switch state {
        case .nominal: "nominal"
        case .fair: "fair"
        case .serious: "serious"
        case .critical: "critical"
        @unknown default: "serious"
        }
    }
}

private final class RealtimeTrackWriter {
    let track: CaptureSampleTrack
    let url: URL
    private var writer: AVAssetWriter?
    private var input: AVAssetWriterInput?
    private(set) var firstPTS: Double?
    private(set) var lastPTS: Double?
    private(set) var sampleCount = 0
    private(set) var firstHostNs: UInt64?
    private(set) var errorDescription: String?

    init(track: CaptureSampleTrack, url: URL) {
        self.track = track
        self.url = url
    }

    func append(_ sampleBuffer: CMSampleBuffer, hostNs: UInt64) {
        guard CMSampleBufferIsValid(sampleBuffer), CMSampleBufferDataIsReady(sampleBuffer) else { return }
        do {
            if writer == nil { try configure(using: sampleBuffer) }
            guard let writer, let input else { return }
            let pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
            if writer.status == .unknown {
                guard writer.startWriting() else { throw writer.error ?? CocoaError(.fileWriteUnknown) }
                writer.startSession(atSourceTime: pts)
            }
            guard writer.status == .writing else { throw writer.error ?? CocoaError(.fileWriteUnknown) }
            guard input.isReadyForMoreMediaData else { return }
            guard input.append(sampleBuffer) else { throw writer.error ?? CocoaError(.fileWriteUnknown) }
            sampleCount += 1
            firstHostNs = firstHostNs ?? hostNs
            firstPTS = firstPTS ?? pts.seconds
            lastPTS = pts.seconds
        } catch {
            errorDescription = error.localizedDescription
        }
    }

    func finish(completion: @escaping () -> Void) {
        guard let writer, let input else { completion(); return }
        guard writer.status == .writing else {
            errorDescription = errorDescription ?? writer.error?.localizedDescription
            completion()
            return
        }
        input.markAsFinished()
        writer.finishWriting { [weak self] in
            if writer.status != .completed {
                self?.errorDescription = writer.error?.localizedDescription ?? "Track did not finish."
            }
            completion()
        }
    }

    private func configure(using sampleBuffer: CMSampleBuffer) throws {
        guard let format = CMSampleBufferGetFormatDescription(sampleBuffer) else {
            throw CocoaError(.fileWriteUnknown)
        }
        let writer = try AVAssetWriter(outputURL: url, fileType: .mov)
        let mediaType: AVMediaType
        let settings: [String: Any]
        switch track {
        case .screen, .frontCamera:
            let dimensions = CMVideoFormatDescriptionGetDimensions(format)
            mediaType = .video
            settings = [
                AVVideoCodecKey: AVVideoCodecType.h264,
                AVVideoWidthKey: max(1, Int(dimensions.width)),
                AVVideoHeightKey: max(1, Int(dimensions.height)),
                AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 2_500_000],
            ]
        case .microphone, .appAudio:
            let description = CMAudioFormatDescriptionGetStreamBasicDescription(format)?.pointee
            mediaType = .audio
            settings = [
                AVFormatIDKey: kAudioFormatMPEG4AAC,
                AVSampleRateKey: max(8_000, description?.mSampleRate ?? 44_100),
                AVNumberOfChannelsKey: max(1, Int(description?.mChannelsPerFrame ?? 1)),
                AVEncoderBitRateKey: 64_000,
            ]
        }
        let input = AVAssetWriterInput(mediaType: mediaType, outputSettings: settings)
        input.expectsMediaDataInRealTime = true
        guard writer.canAdd(input) else { throw CocoaError(.fileWriteUnknown) }
        writer.add(input)
        self.writer = writer
        self.input = input
    }
}
