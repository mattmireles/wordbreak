import Foundation
import XCTest
@testable import Wordbreak

final class DailyEventLedgerTests: XCTestCase {
    func testLedgerKeepsMonotonicSequenceAcrossRelaunch() throws {
        let root = FileManager.default.temporaryDirectory
            .appending(path: "wordbreak-ledger-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let url = root.appending(path: "session.jsonl")

        let first = DailyEventLedger(sessionId: "session-1", fileURL: url, contentHash: "content")
        try first.record(subject: .daily, screen: "daily.home", eventType: "sessionStarted")
        let relaunched = DailyEventLedger(sessionId: "session-1", fileURL: url, contentHash: "content")
        try relaunched.record(subject: .wordbreak, screen: "wordbreak.type", eventType: "promptPresented")

        let lines = try String(contentsOf: url, encoding: .utf8)
            .split(separator: "\n")
            .map { Data($0.utf8) }
        XCTAssertEqual(lines.count, 2)
        let events = try lines.map { try JSONSerialization.jsonObject(with: $0) as? [String: Any] }
        XCTAssertEqual(events[0]?["sequence"] as? Int, 0)
        XCTAssertEqual(events[1]?["sequence"] as? Int, 1)
        XCTAssertTrue(events.allSatisfy { $0?["captureSegmentId"] is NSNull })
    }

    func testRawEventFilesArePrunedAfterRetention() throws {
        let root = FileManager.default.temporaryDirectory
            .appending(path: "wordbreak-prune-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let old = root.appending(path: "old.jsonl")
        let recent = root.appending(path: "recent.jsonl")
        let current = root.appending(path: "current.jsonl")
        for url in [old, recent, current] { try Data("{}\n".utf8).write(to: url) }
        let now = Date()
        let stale = now.addingTimeInterval(-Double(DailyEventLedger.retentionDays + 1) * 86_400)
        try FileManager.default.setAttributes([.modificationDate: stale], ofItemAtPath: old.path)
        try FileManager.default.setAttributes([.modificationDate: stale], ofItemAtPath: current.path)

        DailyEventLedger.prune(directory: root, keeping: "current.jsonl", now: now)
        XCTAssertFalse(FileManager.default.fileExists(atPath: old.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: recent.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: current.path), "The active session's file is never pruned")
    }

    func testBundledFlagsKeepTheEventLedgerOff() {
        XCTAssertFalse(ExperimentConfiguration.observationEnabled, "With every Plan 008 evidence flag off, no typed answers are written")
    }
}
