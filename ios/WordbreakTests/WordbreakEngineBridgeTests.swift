import Foundation
import XCTest
@testable import Wordbreak

private enum MemoryStoreError: Error {
    case forcedWriteFailure
}

private final class MemoryStateStore: WordbreakStateStore {
    var data: Data?
    var failWrites = false

    init(json: String) {
        data = Data(json.utf8)
    }

    func readState() throws -> Data? {
        data
    }

    func writeStateAtomically(_ data: Data) throws {
        if failWrites { throw MemoryStoreError.forcedWriteFailure }
        self.data = data
    }
}

final class WordbreakEngineBridgeTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_790_118_000)
    private let timezone = TimeZone(secondsFromGMT: -7 * 60 * 60)!

    private func fixture(_ name: String) throws -> [String: Any] {
        let bundle = Bundle(for: Self.self)
        guard let url = bundle.url(
            forResource: name,
            withExtension: "json",
            subdirectory: "wordbreak-golden"
        ) else {
            XCTFail("Missing frozen fixture \(name).json")
            return [:]
        }
        return try XCTUnwrap(
            try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any]
        )
    }

    @MainActor
    private func bridge(
        state: Any,
        uuid: String = "00000000-0000-4000-8000-000000000001"
    ) throws -> (MemoryStateStore, WordbreakEngineBridge) {
        let stateData = try JSONSerialization.data(withJSONObject: state, options: [.sortedKeys])
        let store = MemoryStateStore(json: String(decoding: stateData, as: UTF8.self))
        let engine = try WordbreakEngineBridge(
            store: store,
            now: now,
            timezone: timezone,
            random: { 17.0 / 256.0 },
            uuid: { uuid }
        )
        return (store, engine)
    }

    private func jsonObject(_ stateJSON: String) throws -> Any {
        try JSONSerialization.jsonObject(with: Data(stateJSON.utf8))
    }

    private func assertJSONEqual(
        _ actual: Any,
        _ expected: Any,
        file: StaticString = #filePath,
        line: UInt = #line
    ) throws {
        let actualData = try JSONSerialization.data(withJSONObject: actual, options: [.sortedKeys])
        let expectedData = try JSONSerialization.data(withJSONObject: expected, options: [.sortedKeys])
        XCTAssertEqual(
            String(decoding: actualData, as: UTF8.self),
            String(decoding: expectedData, as: UTF8.self),
            file: file,
            line: line
        )
    }

    private func assertOutput(
        _ output: WordbreakEngineOutput,
        fixture: [String: Any],
        file: StaticString = #filePath,
        line: UInt = #line
    ) throws {
        try assertJSONEqual(try jsonObject(output.stateJSON), fixture["state"] as Any, file: file, line: line)
        try assertJSONEqual(output.viewModel, fixture["screen"] as Any, file: file, line: line)
    }

    @MainActor
    func testFailedNativeWriteKeepsActionRetryable() throws {
        let store = MemoryStateStore(json: #"{"docs":{"1.1":true}}"#)
        let bridge = try WordbreakEngineBridge(
            store: store,
            now: Date(timeIntervalSince1970: 1_790_118_000),
            timezone: TimeZone(secondsFromGMT: -7 * 60 * 60)!,
            random: { 17.0 / 256.0 },
            uuid: { "00000000-0000-4000-8000-000000000001" }
        )

        let opened = try bridge.dispatch(["type": "unit.openRun", "unitId": "1.1"])
        XCTAssertEqual(opened.viewModel["screen"] as? String, "run")
        let beforeFailure = store.data

        store.failWrites = true
        XCTAssertThrowsError(try bridge.dispatch(["type": "word.commitTyped", "value": "sunset"]))
        XCTAssertEqual(store.data, beforeFailure)

        store.failWrites = false
        let retried = try bridge.dispatch(["type": "word.commitTyped", "value": "sunset"])
        XCTAssertEqual(retried.viewModel["phase"] as? String, "flag")
        XCTAssertEqual(retried.semanticEvents.count, 0)
    }

    @MainActor
    func testJavaScriptCoreCompletesTheFrozenCleanWordPath() throws {
        let expected = try fixture("correct")
        let (_, bridge) = try bridge(state: ["docs": ["1.1": true]])

        _ = try bridge.dispatch(["type": "unit.openRun", "unitId": "1.1"])
        _ = try bridge.dispatch(["type": "word.commitTyped", "value": "sunset"])
        _ = try bridge.dispatch(["type": "word.setFlag", "index": 2])
        _ = try bridge.dispatch(["type": "word.execute"])
        let completed = try bridge.dispatch(["type": "word.confirmDone"])

        try assertOutput(completed, fixture: expected)
    }

    @MainActor
    func testJavaScriptCoreCompletesTheFrozenFaultAndPatchPath() throws {
        let expected = try fixture("miss")
        let (_, bridge) = try bridge(state: ["docs": ["1.1": true]])

        _ = try bridge.dispatch(["type": "unit.openRun", "unitId": "1.1"])
        _ = try bridge.dispatch(["type": "word.commitTyped", "value": "sunsetx"])
        _ = try bridge.dispatch(["type": "word.setFlag", "index": 0])
        _ = try bridge.dispatch(["type": "word.execute"])
        _ = try bridge.dispatch(["type": "word.toPatch"])
        let completed = try bridge.dispatch(["type": "word.commitPatch", "value": "sunset"])

        try assertOutput(completed, fixture: expected)
    }

    @MainActor
    func testJavaScriptCoreStartsTheFrozenAssessment() throws {
        let expected = try fixture("assessmentBoundaries")
        let (_, bridge) = try bridge(
            state: [:],
            uuid: "00000000-0000-4000-8000-000000000002"
        )
        let output = try bridge.dispatch([
            "type": "assessment.start",
            "role": "baseline",
            "device": ["userAgent": "wordbreak-test", "platform": "test"],
        ])

        try assertOutput(output, fixture: expected)
    }

    @MainActor
    func testJavaScriptCorePreservesFrozenReloadState() throws {
        let miss = try fixture("miss")
        let expected = try fixture("reload")
        let (_, bridge) = try bridge(state: try XCTUnwrap(miss["state"]))
        let output = try bridge.dispatch(["type": "state.read"])

        try assertOutput(output, fixture: expected)
    }

    @MainActor
    func testJavaScriptCoreQuarantinesUnknownFieldPackWithoutDataLoss() throws {
        let fixture = try fixture("fieldPackTransitions")
        let (_, bridge) = try bridge(state: [:])
        let baselineOutput = try bridge.dispatch(["type": "state.read"])
        var baseline = try XCTUnwrap(try jsonObject(baselineOutput.stateJSON) as? [String: Any])
        baseline["fieldPack"] = ["version": 99, "unitIds": ["10.1"]]
        var docs = try XCTUnwrap(baseline["docs"] as? [String: Any])
        docs["10.1"] = true
        baseline["docs"] = docs
        var cleared = try XCTUnwrap(baseline["cleared"] as? [String: Any])
        cleared["10.1"] = true
        baseline["cleared"] = cleared
        var schedule = try XCTUnwrap(baseline["sched"] as? [String: Any])
        schedule["10.1|future"] = ["unit": "10.1", "word": "future", "due": 1]
        baseline["sched"] = schedule

        let output = try bridge.dispatch(["type": "progress.import", "state": baseline])
        let expectedResult = try XCTUnwrap(fixture["result"] as? [String: Any])
        try assertJSONEqual(try jsonObject(output.stateJSON), expectedResult["state"] as Any)
        XCTAssertEqual(output.semanticEvents.first?["quarantined"] as? Bool, true)
    }

    @MainActor
    func testJavaScriptCoreCompletesTheFrozenSession() throws {
        let expected = try fixture("sessionCompletion")
        var before = try XCTUnwrap(expected["state"] as? [String: Any])
        var session = try XCTUnwrap(before["session"] as? [String: Any])
        session["done"] = false
        session["status"] = "in_progress"
        session["revision"] = 1
        session.removeValue(forKey: "endedAt")
        before["session"] = session

        var sessions = try XCTUnwrap(before["sessions"] as? [[String: Any]])
        sessions[0]["status"] = "in_progress"
        sessions[0]["revision"] = 1
        sessions[0]["endedAt"] = NSNull()
        before["sessions"] = sessions

        var reporting = try XCTUnwrap(before["reporting"] as? [String: Any])
        var days = try XCTUnwrap(reporting["days"] as? [String: Any])
        let reportDay = try XCTUnwrap(session["startReportDay"] as? String)
        var report = try XCTUnwrap(days[reportDay] as? [String: Any])
        report["sessionsCompleted"] = 0
        report["revision"] = 1
        days[reportDay] = report
        reporting["days"] = days
        reporting["sourceRevision"] = 1
        before["reporting"] = reporting

        var assessment = try XCTUnwrap(before["assessment"] as? [String: Any])
        assessment["nonbonusCompletedTotal"] = 0
        before["assessment"] = assessment

        let (_, bridge) = try bridge(state: before)
        let output = try bridge.dispatch(["type": "session.complete"])

        try assertOutput(output, fixture: expected)
    }

    @MainActor
    func testFileSnapshotRelaunchesAtTheExactWordPhase() throws {
        let root = FileManager.default.temporaryDirectory
            .appending(path: "wordbreak-snapshot-\(UUID().uuidString)", directoryHint: .isDirectory)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = WordbreakFileStateStore(stateURL: root.appending(path: "wb2.json"))
        let first = try WordbreakEngineBridge(
            store: store,
            now: now,
            timezone: timezone,
            random: { 17.0 / 256.0 },
            uuid: { "00000000-0000-4000-8000-000000000001" }
        )
        _ = try first.dispatch(["type": "session.begin", "budgetMin": 1])
        _ = try first.dispatch(["type": "docs.complete"])
        _ = try first.dispatch(["type": "word.commitTyped", "value": "sunset"])

        let relaunched = try WordbreakEngineBridge(
            store: store,
            now: now,
            timezone: timezone,
            random: { 17.0 / 256.0 },
            uuid: { "00000000-0000-4000-8000-000000000001" }
        )
        let restored = try relaunched.dispatch(["type": "state.read"])

        XCTAssertEqual(restored.viewModel["screen"] as? String, "run")
        XCTAssertEqual(restored.viewModel["phase"] as? String, "flag")
        XCTAssertEqual(restored.viewModel["typed"] as? String, "sunset")
    }
}
