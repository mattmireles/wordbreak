import Foundation
import XCTest
@testable import Wordbreak

final class NotificationSchedulerTests: XCTestCase {
    func testReminderWallClockTimesSurviveDaylightSavingChange() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/Los_Angeles"))
        let now = try XCTUnwrap(calendar.date(from: DateComponents(
            year: 2026,
            month: 10,
            day: 31,
            hour: 20
        )))
        let dates = NotificationScheduler.reminderDates(now: now, days: 3, calendar: calendar)

        XCTAssertEqual(dates.count, 4)
        XCTAssertEqual(dates.map(\.suffix), ["afternoon", "evening", "afternoon", "evening"])
        XCTAssertEqual(dates.map { calendar.component(.hour, from: $0.date) }, [16, 19, 16, 19])
        XCTAssertEqual(dates.map { calendar.component(.minute, from: $0.date) }, [0, 30, 0, 30])
        XCTAssertEqual(NotificationScheduler.dayKey(dates[0].date, calendar: calendar), "2026-11-01")
    }
}
