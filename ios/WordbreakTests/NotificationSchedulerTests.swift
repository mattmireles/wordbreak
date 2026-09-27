import Foundation
import XCTest
@testable import Wordbreak

final class NotificationSchedulerTests: XCTestCase {
    private func calendar(_ identifier: String) throws -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: identifier))
        return calendar
    }

    func testReminderWallClockTimesSurviveDaylightSavingChange() throws {
        let calendar = try calendar("America/Los_Angeles")
        let now = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 10, day: 31, hour: 20)))
        let dates = NotificationScheduler.reminders(now: now, state: DailyCoordinationState(), days: 3, calendar: calendar)

        XCTAssertEqual(dates.count, 4)
        XCTAssertEqual(dates.map(\.slot), [.afternoon, .evening, .afternoon, .evening])
        XCTAssertEqual(dates.map { calendar.component(.hour, from: $0.date) }, [16, 19, 16, 19])
        XCTAssertEqual(dates.map { calendar.component(.minute, from: $0.date) }, [0, 30, 0, 30])
        XCTAssertEqual(dates[0].day, "2026-11-01")
    }

    func testTimeZoneChangeKeepsLocalWallClockTimes() throws {
        let now = Date(timeIntervalSince1970: 1_790_000_000)
        for identifier in ["America/Los_Angeles", "Europe/London", "Asia/Tokyo"] {
            let calendar = try calendar(identifier)
            let reminders = NotificationScheduler.reminders(now: now, state: DailyCoordinationState(), days: 2, calendar: calendar)
            XCTAssertTrue(reminders.allSatisfy {
                let components = calendar.dateComponents([.hour, .minute], from: $0.date)
                return $0.slot == .afternoon ? (components.hour, components.minute) == (16, 0) : (components.hour, components.minute) == (19, 30)
            }, identifier)
        }
    }

    func testParentSelectedTimesDriveTheSchedule() throws {
        let calendar = try calendar("America/Los_Angeles")
        let now = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 9, day: 25, hour: 8)))
        var state = DailyCoordinationState()
        state.afternoon = .init(hour: 15, minute: 45)
        state.evening = .init(hour: 18, minute: 0)
        let reminders = NotificationScheduler.reminders(now: now, state: state, days: 1, calendar: calendar)
        XCTAssertEqual(reminders.map { calendar.component(.hour, from: $0.date) }, [15, 18])
        XCTAssertEqual(reminders.map { calendar.component(.minute, from: $0.date) }, [45, 0])
    }
}
