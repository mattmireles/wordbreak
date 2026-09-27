import CryptoKit
import Foundation

final class DailyEventLedger {
    enum Subject: String {
        case daily
        case wordbreak
        case mathbreak
        case system
        case checkIn
    }

    private let sessionId: String
    private let fileURL: URL
    private let engineVersion = "wordbreak-2+mathbreak-1"
    private let contentHash: String
    private var sequence: Int
    private var captureSegmentId: String?
    private var captureHostAnchorNs: UInt64?

    init(sessionId: String, bundle: Bundle = .main) throws {
        guard let root = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: DailyCoordinationStore.appGroup
        ) else {
            throw WordbreakEngineError.stateStoreUnavailable
        }
        let directory = root.appending(path: "events", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        Self.prune(directory: directory, keeping: "\(sessionId).jsonl")
        self.sessionId = sessionId
        fileURL = directory.appending(path: "\(sessionId).jsonl")
        contentHash = try Self.hashResources(bundle: bundle)
        sequence = Self.nextSequence(fileURL: fileURL)
    }

    init(sessionId: String, fileURL: URL, contentHash: String) {
        self.sessionId = sessionId
        self.fileURL = fileURL
        self.contentHash = contentHash
        sequence = Self.nextSequence(fileURL: fileURL)
    }

    func record(
        subject: Subject,
        screen: String,
        eventType: String,
        payload: [String: Any] = [:]
    ) throws {
        let hostMonotonicNs = DispatchTime.now().uptimeNanoseconds
        let segmentMediaTimeMs = captureHostAnchorNs.map {
            Double(hostMonotonicNs >= $0 ? hostMonotonicNs - $0 : 0) / 1_000_000
        }
        let event: [String: Any] = [
            "schemaVersion": 1,
            "sessionId": sessionId,
            "sequence": sequence,
            "hostMonotonicNs": Int64(clamping: hostMonotonicNs),
            "captureSegmentId": (captureSegmentId as Any?) ?? NSNull(),
            "segmentMediaTimeMs": (segmentMediaTimeMs as Any?) ?? NSNull(),
            "subject": subject.rawValue,
            "screen": screen,
            "engineVersion": engineVersion,
            "contentHash": contentHash,
            "eventType": eventType,
            "payload": payload,
        ]
        var line = try JSONSerialization.data(withJSONObject: event, options: [.sortedKeys])
        line.append(0x0A)
        if !FileManager.default.fileExists(atPath: fileURL.path) {
            try line.write(to: fileURL, options: [.atomic, .completeFileProtection])
        } else {
            let handle = try FileHandle(forWritingTo: fileURL)
            defer { try? handle.close() }
            try handle.seekToEnd()
            try handle.write(contentsOf: line)
            try handle.synchronize()
        }
        sequence += 1
    }

    func beginCapture(segmentId: String, hostAnchorNs: UInt64) {
        captureSegmentId = segmentId
        captureHostAnchorNs = hostAnchorNs
    }

    func endCapture() {
        captureSegmentId = nil
        captureHostAnchorNs = nil
    }

    var url: URL { fileURL }

    /// Raw event files hold typed answers. Sealed session packages keep their own copy, so raw
    /// files are kept only for `retentionDays`.
    static let retentionDays = 30

    static func prune(directory: URL, keeping current: String, now: Date = Date()) {
        let cutoff = now.addingTimeInterval(-Double(retentionDays) * 86_400)
        let files = (try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.contentModificationDateKey]
        )) ?? []
        for file in files where file.pathExtension == "jsonl" && file.lastPathComponent != current {
            let modified = (try? file.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate
            if let modified, modified < cutoff { try? FileManager.default.removeItem(at: file) }
        }
    }

    private static func nextSequence(fileURL: URL) -> Int {
        guard let data = try? Data(contentsOf: fileURL), !data.isEmpty else { return 0 }
        return data.reduce(0) { $1 == 0x0A ? $0 + 1 : $0 }
    }

    private static func hashResources(bundle: Bundle) throws -> String {
        let names = [
            ("wordbreak-content", "js"),
            ("mathbreak-content", "json"),
        ]
        var digestInput = Data()
        for (name, fileExtension) in names {
            guard let url = bundle.url(forResource: name, withExtension: fileExtension) else {
                throw WordbreakEngineError.missingResource("\(name).\(fileExtension)")
            }
            digestInput.append(try Data(contentsOf: url))
        }
        return SHA256.hash(data: digestInput).map { String(format: "%02x", $0) }.joined()
    }
}
