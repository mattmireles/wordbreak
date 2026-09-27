import Foundation
import XCTest
@testable import Wordbreak

final class DailyCoordinationTests: XCTestCase {
    private var calendar: Calendar {
        var value = Calendar(identifier: .gregorian)
        value.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        return value
    }

    private func date(day: Int, hour: Int, minute: Int = 0) -> Date {
        calendar.date(from: DateComponents(year: 2026, month: 9, day: day, hour: hour, minute: minute))!
    }

    private func temporaryStore() throws -> DailyCoordinationStore {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        addTeardownBlock { try? FileManager.default.removeItem(at: directory) }
        return DailyCoordinationStore(url: directory.appending(path: "state/daily.v1.json"))
    }

    func testOpportunityOnlySpeaksInTheHourBeforeTheAfternoonReminder() {
        let state = DailyCoordinationState()
        XCTAssertFalse(DailyNudgePolicy.shouldDeliverOpportunity(now: date(day: 25, hour: 14, minute: 59), state: state, calendar: calendar))
        XCTAssertTrue(DailyNudgePolicy.shouldDeliverOpportunity(now: date(day: 25, hour: 15, minute: 15), state: state, calendar: calendar))
        XCTAssertFalse(DailyNudgePolicy.shouldDeliverOpportunity(now: date(day: 25, hour: 16), state: state, calendar: calendar))

        var moved = state
        moved.afternoon = .init(hour: 17, minute: 30)
        XCTAssertFalse(DailyNudgePolicy.shouldDeliverOpportunity(now: date(day: 25, hour: 15, minute: 15), state: moved, calendar: calendar))
        XCTAssertTrue(DailyNudgePolicy.shouldDeliverOpportunity(now: date(day: 25, hour: 16, minute: 45), state: moved, calendar: calendar))
    }

    func testOneLedgerSuppressesCompletedAndAlreadyNudgedDays() {
        let now = date(day: 25, hour: 15, minute: 15)
        var completed = DailyCoordinationState()
        completed.completedDay = "2026-09-25"
        XCTAssertFalse(DailyNudgePolicy.shouldDeliverOpportunity(now: now, state: completed, calendar: calendar))
        XCTAssertFalse(DailyNudgePolicy.shouldSchedule(.afternoon, day: "2026-09-25", state: completed))
        XCTAssertFalse(DailyNudgePolicy.shouldSchedule(.evening, day: "2026-09-25", state: completed))

        var nudged = DailyCoordinationState()
        nudged.days["2026-09-25"] = .init(opportunityDelivered: true)
        XCTAssertFalse(DailyNudgePolicy.shouldDeliverOpportunity(now: now, state: nudged, calendar: calendar))
        XCTAssertFalse(DailyNudgePolicy.shouldSchedule(.afternoon, day: "2026-09-25", state: nudged))
        XCTAssertTrue(DailyNudgePolicy.shouldSchedule(.evening, day: "2026-09-25", state: nudged), "The evening fallback survives the opportunity nudge")
    }

    func testPriorDayMarkersDoNotSuppressTheNextDay() {
        var state = DailyCoordinationState()
        state.completedDay = "2026-09-25"
        state.days["2026-09-25"] = .init(opportunityDelivered: true)
        XCTAssertTrue(DailyNudgePolicy.shouldDeliverOpportunity(now: date(day: 26, hour: 15, minute: 15), state: state, calendar: calendar))
        XCTAssertTrue(DailyNudgePolicy.shouldSchedule(.afternoon, day: "2026-09-26", state: state))
    }

    func testLateCompletionCancelsOnlyTheRemainingReminderForThatDay() {
        var state = DailyCoordinationState()
        let afterAfternoon = date(day: 25, hour: 18)
        XCTAssertEqual(
            NotificationScheduler.reminders(now: afterAfternoon, state: state, days: 2, calendar: calendar).map(\.slot),
            [.evening, .afternoon, .evening]
        )
        state.completedDay = "2026-09-25"
        let remaining = NotificationScheduler.reminders(now: afterAfternoon, state: state, days: 2, calendar: calendar)
        XCTAssertEqual(remaining.map(\.day), ["2026-09-26", "2026-09-26"])
    }

    func testStoreRoundTripsAtomicallyAndPrunesOldDays() throws {
        let store = try temporaryStore()
        XCTAssertEqual(store.read(), DailyCoordinationState(), "A missing file reads as the default schedule")
        try store.update {
            $0.completedDay = "2026-09-25"
            $0.days["2026-09-01"] = .init(opportunityDelivered: true)
            $0.days["2026-09-25"] = .init(opportunityDelivered: true)
            $0.evening = .init(hour: 20, minute: 15)
        }
        let pruned = try store.update { $0.prune(keepingFrom: "2026-09-20") }
        XCTAssertEqual(Array(pruned.days.keys), ["2026-09-25"])
        XCTAssertEqual(store.read(), pruned)
        XCTAssertEqual(store.read().evening, .init(hour: 20, minute: 15))
    }

    func testUnreadableLedgerIsSetAsideInsteadOfOverwritten() throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        addTeardownBlock { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appending(path: "daily.v1.json")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try Data("{\"version\":9}".utf8).write(to: url)
        let store = DailyCoordinationStore(url: url)
        try store.update { $0.completedDay = "2026-09-25" }
        let names = try FileManager.default.contentsOfDirectory(atPath: directory.path)
        XCTAssertTrue(names.contains { $0.hasPrefix("daily.v1.unreadable-") })
        XCTAssertEqual(store.read().completedDay, "2026-09-25")
    }

    func testEveningReminderMustFollowAnAfternoonThatLeavesAnOpportunityHour() {
        XCTAssertTrue(DailyNudgePolicy.validReminderTimes(afternoon: .init(hour: 16, minute: 0), evening: .init(hour: 19, minute: 30)))
        XCTAssertFalse(DailyNudgePolicy.validReminderTimes(afternoon: .init(hour: 19, minute: 30), evening: .init(hour: 19, minute: 30)))
        XCTAssertFalse(DailyNudgePolicy.validReminderTimes(afternoon: .init(hour: 20, minute: 0), evening: .init(hour: 19, minute: 30)))
        XCTAssertFalse(DailyNudgePolicy.validReminderTimes(afternoon: .init(hour: 0, minute: 30), evening: .init(hour: 19, minute: 30)))
    }
}
