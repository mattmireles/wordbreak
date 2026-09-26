import Foundation

struct DailyOpportunityPolicy {
    static func dayKey(_ date: Date, calendar: Calendar = .current) -> String {
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return String(
            format: "%04d-%02d-%02d",
            components.year ?? 0,
            components.month ?? 0,
            components.day ?? 0
        )
    }

    static func shouldDeliver(
        now: Date,
        completedDay: String?,
        opportunityDay: String?,
        calendar: Calendar = .current
    ) -> Bool {
        let today = dayKey(now, calendar: calendar)
        let hour = calendar.component(.hour, from: now)
        return completedDay != today
            && opportunityDay != today
            && hour >= 15
            && hour < 16
    }
}
