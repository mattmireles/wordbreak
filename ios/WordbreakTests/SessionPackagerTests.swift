import CryptoKit
import Foundation
import XCTest
@testable import Wordbreak

final class SessionPackagerTests: XCTestCase {
    func testSealVerifiesObjectsAndCreatesImmutableManifest() throws {
        let root = FileManager.default.temporaryDirectory
            .appending(path: "wordbreak-packager-\(UUID().uuidString)", directoryHint: .isDirectory)
        defer { try? FileManager.default.removeItem(at: root) }
        let segmentId = "segment-one"
        let segmentRoot = root.appending(path: "raw/segments/\(segmentId)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: segmentRoot, withIntermediateDirectories: true)
        let tracks = ["screen", "frontCamera", "microphone"]
        let objects = try tracks.map { track -> CapturedObject in
            let data = Data("\(track)-bytes".utf8)
            let url = segmentRoot.appending(path: "\(track).mov")
            try data.write(to: url)
            return CapturedObject(
                name: "raw/segments/\(segmentId)/\(track).mov",
                track: track,
                segmentId: segmentId,
                contentType: "video/quicktime",
                byteCount: Int64(data.count),
                sha256: SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
            )
        }
        let eventsURL = root.deletingLastPathComponent().appending(path: "events-\(UUID().uuidString).jsonl")
        defer { try? FileManager.default.removeItem(at: eventsURL) }
        try Data("{\"sequence\":0}\n".utf8).write(to: eventsURL)
        let segment = CapturedSegment(
            segmentId: segmentId,
            reason: "start",
            hostAnchorNs: 10,
            firstPresentationTimeMs: 0,
            lastPresentationTimeMs: 1_000,
            durationMs: 1_000,
            discontinuities: [],
            thermalStates: ["nominal"],
            objects: objects,
            errors: []
        )

        let url = try SessionPackager().seal(
            sessionId: "session-one",
            segments: [segment],
            eventsURL: eventsURL,
            root: root,
            bundle: .main
        )
        let json = try XCTUnwrap(
            JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any]
        )
        XCTAssertEqual(json["schemaVersion"] as? Int, 1)
        XCTAssertEqual(json["captureComplete"] as? Bool, true)
        XCTAssertEqual((json["objects"] as? [[String: Any]])?.count, 4)
        XCTAssertThrowsError(try SessionPackager().seal(
            sessionId: "session-one",
            segments: [segment],
            eventsURL: eventsURL,
            root: root,
            bundle: .main
        ))
    }

    func testSealRejectsObjectWhoseBytesChanged() throws {
        let root = FileManager.default.temporaryDirectory
            .appending(path: "wordbreak-packager-\(UUID().uuidString)", directoryHint: .isDirectory)
        defer { try? FileManager.default.removeItem(at: root) }
        let file = root.appending(path: "raw/segments/segment-one/screen.mov")
        try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("changed".utf8).write(to: file)
        let eventsURL = root.deletingLastPathComponent().appending(path: "events-\(UUID().uuidString).jsonl")
        defer { try? FileManager.default.removeItem(at: eventsURL) }
        try Data("{}\n".utf8).write(to: eventsURL)
        let object = CapturedObject(
            name: "raw/segments/segment-one/screen.mov",
            track: "screen",
            segmentId: "segment-one",
            contentType: "video/quicktime",
            byteCount: 7,
            sha256: String(repeating: "0", count: 64)
        )
        let segment = CapturedSegment(
            segmentId: "segment-one",
            reason: "start",
            hostAnchorNs: 10,
            firstPresentationTimeMs: 0,
            lastPresentationTimeMs: 1,
            durationMs: 1,
            discontinuities: [],
            thermalStates: ["nominal"],
            objects: [object],
            errors: []
        )
        XCTAssertThrowsError(try SessionPackager().seal(
            sessionId: "session-one",
            segments: [segment],
            eventsURL: eventsURL,
            root: root,
            bundle: .main
        ))
    }
}
