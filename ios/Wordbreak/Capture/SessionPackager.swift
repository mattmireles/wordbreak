import CryptoKit
import Foundation

struct CaptureManifest: Codable {
    struct Build: Codable {
        let gitSha: String
        let bundleId: String
        let buildNumber: String
        let engineHash: String
        let contentHash: String
    }

    struct Segment: Codable {
        let segmentId: String
        let reason: String
        let hostAnchorNs: UInt64
        let firstPresentationTimeMs: Double
        let lastPresentationTimeMs: Double
        let durationMs: Double
        let discontinuities: [[String: String]]
        let thermalStates: [String]
    }

    struct Object: Codable {
        let name: String
        let track: String
        let segmentId: String?
        let contentType: String
        let byteCount: Int64
        let sha256: String
    }

    let schemaVersion: Int
    let sessionId: String
    let createdAt: String
    let build: Build
    let eligibleDurationMs: Int
    let segments: [Segment]
    let objects: [Object]
    let coverage: [String: Double]
    let captureComplete: Bool
}

struct SessionPackager {
    func seal(
        sessionId: String,
        segments: [CapturedSegment],
        eventsURL: URL,
        bundle: Bundle = .main
    ) throws -> URL {
        guard let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.com.mattmireles.wordbreak"
        ) else { throw WordbreakEngineError.stateStoreUnavailable }
        return try seal(
            sessionId: sessionId,
            segments: segments,
            eventsURL: eventsURL,
            root: container.appending(path: "sessions/\(sessionId)", directoryHint: .isDirectory),
            bundle: bundle
        )
    }

    func seal(
        sessionId: String,
        segments: [CapturedSegment],
        eventsURL: URL,
        root: URL,
        bundle: Bundle
    ) throws -> URL {
        let rawRoot = root.appending(path: "raw/segments", directoryHint: .isDirectory)
        let manifestRoot = root.appending(path: "manifest", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: rawRoot, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: manifestRoot, withIntermediateDirectories: true)

        let eventsDestination = rawRoot.appending(path: "events.jsonl")
        guard !FileManager.default.fileExists(atPath: eventsDestination.path) else {
            throw CocoaError(.fileWriteFileExists)
        }
        try FileManager.default.copyItem(at: eventsURL, to: eventsDestination)

        for object in segments.flatMap(\.objects) {
            let url = root.appending(path: object.name)
            let values = try url.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey])
            guard values.isRegularFile == true,
                  Int64(values.fileSize ?? -1) == object.byteCount,
                  try Self.sha256(url) == object.sha256
            else { throw CocoaError(.fileReadCorruptFile) }
        }
        var objects = segments.flatMap(\.objects).map {
            CaptureManifest.Object(
                name: $0.name,
                track: $0.track,
                segmentId: $0.segmentId,
                contentType: $0.contentType,
                byteCount: $0.byteCount,
                sha256: $0.sha256
            )
        }
        let eventValues = try eventsDestination.resourceValues(forKeys: [.fileSizeKey])
        objects.append(CaptureManifest.Object(
            name: "raw/segments/events.jsonl",
            track: "events",
            segmentId: nil,
            contentType: "application/x-ndjson",
            byteCount: Int64(eventValues.fileSize ?? 0),
            sha256: try Self.sha256(eventsDestination)
        ))

        let eligibleDurationMs = max(0, Int(segments.reduce(0) { $0 + $1.durationMs }.rounded()))
        var coverage: [String: Double] = [:]
        for track in CaptureSampleTrack.allCases {
            let covered = segments.reduce(0.0) { sum, segment in
                segment.objects.contains(where: { $0.track == track.rawValue })
                    ? sum + segment.durationMs
                    : sum
            }
            coverage[track.rawValue] = eligibleDurationMs > 0
                ? min(1, covered / Double(eligibleDurationMs))
                : 0
        }
        let required = Set(["screen", "frontCamera", "microphone"])
        let present = Set(objects.map(\.track))
        let captureComplete = required.isSubset(of: present)
            && segments.allSatisfy { $0.errors.isEmpty }

        let manifest = CaptureManifest(
            schemaVersion: 1,
            sessionId: sessionId,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            build: try Self.build(bundle: bundle),
            eligibleDurationMs: eligibleDurationMs,
            segments: segments.map {
                CaptureManifest.Segment(
                    segmentId: $0.segmentId,
                    reason: $0.reason,
                    hostAnchorNs: $0.hostAnchorNs,
                    firstPresentationTimeMs: $0.firstPresentationTimeMs,
                    lastPresentationTimeMs: $0.lastPresentationTimeMs,
                    durationMs: $0.durationMs,
                    discontinuities: $0.discontinuities,
                    thermalStates: $0.thermalStates
                )
            },
            objects: objects,
            coverage: coverage,
            captureComplete: captureComplete
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        let url = manifestRoot.appending(path: "capture-manifest.json")
        guard !FileManager.default.fileExists(atPath: url.path) else {
            throw CocoaError(.fileWriteFileExists)
        }
        let temporaryURL = manifestRoot.appending(path: ".capture-manifest-\(UUID().uuidString).tmp")
        do {
            try encoder.encode(manifest).write(
                to: temporaryURL,
                options: [.atomic, .completeFileProtection]
            )
            try FileManager.default.moveItem(at: temporaryURL, to: url)
        } catch {
            try? FileManager.default.removeItem(at: temporaryURL)
            throw error
        }
        return url
    }

    private static func build(bundle: Bundle) throws -> CaptureManifest.Build {
        let engineHash = try hashResources([
            ("wordbreak-core", "js"),
            ("mathbreak-core", "js"),
        ], bundle: bundle)
        let contentHash = try hashResources([
            ("wordbreak-content", "js"),
            ("mathbreak-content", "json"),
        ], bundle: bundle)
        return CaptureManifest.Build(
            gitSha: bundle.object(forInfoDictionaryKey: "WordbreakGitSHA") as? String ?? "working-tree",
            bundleId: bundle.bundleIdentifier ?? "com.mattmireles.wordbreak",
            buildNumber: bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "unknown",
            engineHash: engineHash,
            contentHash: contentHash
        )
    }

    private static func hashResources(_ names: [(String, String)], bundle: Bundle) throws -> String {
        var hasher = SHA256()
        for (name, extensionName) in names {
            guard let url = bundle.url(forResource: name, withExtension: extensionName) else {
                throw WordbreakEngineError.missingResource("\(name).\(extensionName)")
            }
            hasher.update(data: try Data(contentsOf: url))
        }
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
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
}
