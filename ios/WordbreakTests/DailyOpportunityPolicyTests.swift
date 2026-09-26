import Foundation
import XCTest
@testable import Wordbreak

final class DailyOpportunityPolicyTests: XCTestCase {
    private var calendar: Calendar {
        var value = Calendar(identifier: .gregorian)
        value.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        return value
    }

    private func date(day: Int, hour: Int, minute: Int = 0) -> Date {
        calendar.date(from: DateComponents(
            year: 2026,
            month: 9,
            day: day,
            hour: hour,
            minute: minute
        ))!
    }

    func testDeliversOnlyInsideTheThreeOClockOpportunityWindow() {
        XCTAssertFalse(DailyOpportunityPolicy.shouldDeliver(
            now: date(day: 25, hour: 14, minute: 59),
            completedDay: nil,
            opportunityDay: nil,
            calendar: calendar
        ))
        XCTAssertTrue(DailyOpportunityPolicy.shouldDeliver(
            now: date(day: 25, hour: 15, minute: 15),
            completedDay: nil,
            opportunityDay: nil,
            calendar: calendar
        ))
        XCTAssertFalse(DailyOpportunityPolicy.shouldDeliver(
            now: date(day: 25, hour: 16),
            completedDay: nil,
            opportunityDay: nil,
            calendar: calendar
        ))
    }

    func testSuppressesCompletedAndAlreadyNudgedDays() {
        let now = date(day: 25, hour: 15, minute: 15)
        XCTAssertFalse(DailyOpportunityPolicy.shouldDeliver(
            now: now,
            completedDay: "2026-09-25",
            opportunityDay: nil,
            calendar: calendar
        ))
        XCTAssertFalse(DailyOpportunityPolicy.shouldDeliver(
            now: now,
            completedDay: nil,
            opportunityDay: "2026-09-25",
            calendar: calendar
        ))
    }

    func testPriorDayMarkersDoNotSuppressTheNextDay() {
        XCTAssertTrue(DailyOpportunityPolicy.shouldDeliver(
            now: date(day: 26, hour: 15, minute: 15),
            completedDay: "2026-09-25",
            opportunityDay: "2026-09-25",
            calendar: calendar
        ))
    }
}
