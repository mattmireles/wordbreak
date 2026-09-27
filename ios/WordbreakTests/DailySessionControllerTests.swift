import Foundation
import SwiftUI
import XCTest
@testable import Wordbreak

@MainActor
private final class NoCapture: SessionCaptureCoordinating {
    var activeSegmentId: String? { nil }
    func start(sessionId: String, reason: String) async throws -> CaptureStart { throw CancellationError() }
    func stop(reason: String) async throws -> CapturedSegment { throw CancellationError() }
}

/// Drives the whole offline day through the real bundled engines with file-backed state in a
/// temporary directory. No network, capture, or Plan 008 feature is involved.
@MainActor
final class DailySessionControllerTests: XCTestCase {
    private var directory: URL!
    private var clock = Date(timeIntervalSince1970: 1_790_118_000)
    private var completions = 0

    override func setUp() async throws {
        directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        completions = 0
    }

    override func tearDown() async throws {
        try? FileManager.default.removeItem(at: directory)
    }

    private func makeController(checkIn: Bool = false) -> DailySessionController {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        let root = directory!
        var environment = DailySessionEnvironment()
        environment.now = { [unowned self] in clock }
        environment.calendar = calendar
        environment.wordStore = { WordbreakFileStateStore(stateURL: root.appending(path: "state/wb2.json")) }
        environment.mathStore = { WordbreakFileStateStore(stateURL: root.appending(path: "state/mathbreak.v1.json")) }
        environment.coordination = { DailyCoordinationStore(url: root.appending(path: "state/daily.v1.json")) }
        environment.ledger = { DailyEventLedger(sessionId: $0, fileURL: root.appending(path: "\($0).jsonl"), contentHash: "test") }
        environment.checkInEnabled = checkIn
        environment.afterCompletion = { [unowned self] in completions += 1 }
        return DailySessionController(capture: NoCapture(), environment: environment)
    }

    private func finishWordbreak(_ controller: DailySessionController) throws {
        var steps = 0
        while controller.stage == .wordbreak {
            steps += 1
            XCTAssertLessThan(steps, 400, "Wordbreak did not finish")
            if steps >= 400 { return }
            let view = controller.wordView
            if view["screen"] as? String == "docs" {
                controller.sendWord(["type": "docs.complete"])
                continue
            }
            let unit = view["unit"] as? [String: Any] ?? [:]
            let words = unit["words"] as? [[String: Any]] ?? []
            let index = view["wordIdx"] as? Int ?? 0
            let answer = words.indices.contains(index) ? words[index]["a"] as? String ?? "" : ""
            switch view["phase"] as? String {
            case "type": controller.sendWord(["type": "word.commitTyped", "value": answer])
            case "patch": controller.sendWord(["type": "word.commitPatch", "value": answer])
            case "flag":
                controller.sendWord(["type": "word.setFlag", "index": 0])
                controller.sendWord(["type": "word.execute"])
            case "fork":
                controller.sendWord(["type": (view["firstClean"] as? Bool) == true ? "word.confirmDone" : "word.toPatch"])
            case "done": controller.sendWord(["type": "word.advance"])
            default: XCTFail("Unexpected Wordbreak view \(view)"); return
            }
            XCTAssertNil(controller.errorMessage)
        }
    }

    private func finishMathbreak(_ controller: DailySessionController) {
        var steps = 0
        while controller.stage == .mathbreak {
            steps += 1
            XCTAssertLessThan(steps, 400, "Mathbreak did not finish")
            if steps >= 400 { return }
            let view = controller.mathView
            let answer = (view["item"] as? [String: Any])?["answer"] as? Int ?? 0
            switch view["phase"] as? String {
            case "bridge":
                for choice in view["strategyChoices"] as? [[String: Any]] ?? [] {
                    controller.sendMath(["type": "strategy.select", "choiceId": choice["id"] as? String ?? ""])
                    if controller.mathView["phase"] as? String != "bridge" { break }
                }
            case "retype": controller.sendMath(["type": "answer.retype", "answer": answer])
            default: controller.sendMath(["type": "answer.submit", "answer": answer, "latencyMs": 0])
            }
            XCTAssertNil(controller.errorMessage)
        }
    }

    func testOfflineDayCompletesBothSubjectsOnceAndRollsOverAtMidnight() throws {
        let controller = makeController()
        XCTAssertEqual(controller.stage, .home)
        controller.startToday()
        XCTAssertEqual(controller.stage, .wordbreak)
        try finishWordbreak(controller)
        XCTAssertEqual(controller.stage, .mathbreak, "Math must follow Words; neither subject may be skipped")
        finishMathbreak(controller)
        XCTAssertEqual(controller.stage, .done)
        XCTAssertEqual(completions, 1)

        // Relaunch the same day: the finished day stays finished and never re-runs a subject.
        let relaunched = makeController()
        XCTAssertEqual(relaunched.stage, .done)
        relaunched.startToday()
        XCTAssertEqual(relaunched.stage, .done)
        XCTAssertEqual(completions, 1)

        // Crossing local midnight while the done screen is open returns to a fresh doorway.
        clock = clock.addingTimeInterval(86_400)
        relaunched.handleScenePhase(.active)
        XCTAssertEqual(relaunched.stage, .home)
        relaunched.startToday()
        XCTAssertEqual(relaunched.stage, .wordbreak, "Tomorrow provides new Wordbreak practice")
    }

    func testRelaunchResumesTheExactCommittedWordItem() throws {
        let first = makeController()
        first.startToday()
        first.sendWord(["type": "docs.complete"])
        let answer = ((first.wordView["unit"] as? [String: Any])?["words"] as? [[String: Any]])?.first?["a"] as? String ?? ""
        first.sendWord(["type": "word.commitTyped", "value": answer])
        XCTAssertEqual(first.wordView["phase"] as? String, "flag")

        let relaunched = makeController()
        XCTAssertEqual(relaunched.stage, .home)
        relaunched.startToday()
        XCTAssertEqual(relaunched.stage, .wordbreak)
        XCTAssertEqual(relaunched.wordView["phase"] as? String, "flag")
        XCTAssertEqual(relaunched.wordView["typed"] as? String, answer)
    }

    func testRepeatedNudgeDuringPracticeDoesNotRestartTheSession() throws {
        let controller = makeController()
        controller.startToday()
        controller.sendWord(["type": "docs.complete"])
        let before = controller.wordView["screen"] as? String
        controller.startToday()
        XCTAssertEqual(controller.stage, .wordbreak)
        XCTAssertEqual(controller.wordView["screen"] as? String, before)
    }

    func testCheckInStaysDormantUnlessItsExperimentFlagIsOn() throws {
        let controller = makeController(checkIn: true)
        controller.startToday()
        try finishWordbreak(controller)
        finishMathbreak(controller)
        XCTAssertEqual(controller.stage, .checkIn)
        XCTAssertEqual(completions, 0, "Completion is not committed until the check-in resolves")
        controller.submitCheckIn(choice: "okay", voiceNote: nil)
        XCTAssertEqual(controller.stage, .done)
        XCTAssertEqual(completions, 1)
    }

    func testWebImportIsNormalizedByTheEngineAndLeavesMathUntouched() throws {
        XCTAssertThrowsError(try WebProgressImport.prepare("{\"hello\":1}"))
        XCTAssertThrowsError(try WebProgressImport.prepare("not json"))

        let mathURL = directory.appending(path: "state/mathbreak.v1.json")
        try FileManager.default.createDirectory(at: mathURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("{\"keep\":true}".utf8).write(to: mathURL)

        let web = #"{"docs":{"1.1":true},"cleared":{"1.1":true},"sched":{},"sessions":[],"futureField":{"kept":1}}"#
        let prepared = try WebProgressImport.prepare(web)
        XCTAssertEqual(prepared.summary.modulesRead, 1)
        XCTAssertEqual(prepared.summary.modulesCleared, 1)
        let store = WordbreakFileStateStore(stateURL: directory.appending(path: "state/wb2.json"))
        try WebProgressImport.commit(prepared, to: store)

        let stored = try XCTUnwrap(store.readState())
        XCTAssertEqual(stored, prepared.state, "Native stores exactly the engine-normalized bytes")
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: stored) as? [String: Any])
        XCTAssertNotNil(object["futureField"], "Unknown web fields round-trip")
        XCTAssertEqual(try Data(contentsOf: mathURL), Data("{\"keep\":true}".utf8))
    }

    func testImportedUnfinishedWebSessionResumesAtItsCurrentBlock() throws {
        // A web session left partway has no native view model; start must still land on work.
        let web = makeController()
        web.startToday()
        let unfinished = try XCTUnwrap(WordbreakFileStateStore(stateURL: directory.appending(path: "state/wb2.json")).readState())
        try FileManager.default.removeItem(at: directory.appending(path: "state"))

        let prepared = try WebProgressImport.prepare(String(decoding: unfinished, as: UTF8.self))
        try WebProgressImport.commit(prepared, to: WordbreakFileStateStore(stateURL: directory.appending(path: "state/wb2.json")))
        let controller = makeController()
        controller.startToday()
        XCTAssertEqual(controller.stage, .wordbreak)
        XCTAssertEqual(controller.wordView["screen"] as? String, "docs")
    }

    func testRunLeftOpenAcrossMidnightIsReleasedAndCreditedToTheFinishingDay() throws {
        let controller = makeController()
        controller.startToday()
        XCTAssertEqual(controller.stage, .wordbreak)
        clock = clock.addingTimeInterval(86_400)
        controller.handleScenePhase(.active)
        XCTAssertEqual(controller.stage, .home, "A stale-clock run is released at the doorway")
        controller.startToday()
        try finishWordbreak(controller)
        finishMathbreak(controller)
        XCTAssertEqual(controller.stage, .done)
        let completed = DailyCoordinationStore(url: directory.appending(path: "state/daily.v1.json")).read().completedDay
        XCTAssertEqual(completed, DailyNudgePolicy.dayKey(clock, calendar: {
            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = TimeZone(identifier: "America/Los_Angeles")!
            return calendar
        }()))
    }
}
