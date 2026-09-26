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
}
