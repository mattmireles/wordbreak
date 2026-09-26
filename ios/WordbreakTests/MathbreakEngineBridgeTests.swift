import Foundation
import XCTest
@testable import Wordbreak

private final class MathMemoryStore: WordbreakStateStore {
    var data: Data?
    var failWrites = false

    init(json: String = "{}") {
        data = Data(json.utf8)
    }

    func readState() throws -> Data? { data }

    func writeStateAtomically(_ data: Data) throws {
        if failWrites { throw CocoaError(.fileWriteOutOfSpace) }
        self.data = data
    }
}

final class MathbreakEngineBridgeTests: XCTestCase {
    @MainActor
    func testNativeBridgeStartsTheUntimedScreener() throws {
        let store = MathMemoryStore()
        let bridge = try MathbreakEngineBridge(
            store: store,
            now: Date(timeIntervalSince1970: 1_790_118_000),
            random: { 0.25 }
        )
        let output = try bridge.dispatch(["type": "session.begin"])

        XCTAssertEqual(output.viewModel["screen"] as? String, "mathPlacement")
        XCTAssertEqual(output.viewModel["stage"] as? String, "screener")
        XCTAssertEqual(output.viewModel["prompt"] as? String, "7 + 6")
        XCTAssertEqual(output.viewModel["total"] as? Int, 24)
    }

    @MainActor
    func testFailedMathWriteLeavesStartExactlyRetryable() throws {
        let store = MathMemoryStore()
        let bridge = try MathbreakEngineBridge(
            store: store,
            now: Date(timeIntervalSince1970: 1_790_118_000),
            random: { 0.25 }
        )
        store.failWrites = true
        XCTAssertThrowsError(try bridge.dispatch(["type": "session.begin"]))
        store.failWrites = false
        let retry = try bridge.dispatch(["type": "session.begin"])

        XCTAssertEqual(retry.semanticEvents.first?["type"] as? String, "math.placement.started")
        XCTAssertEqual(retry.viewModel["position"] as? Int, 1)
    }
}
