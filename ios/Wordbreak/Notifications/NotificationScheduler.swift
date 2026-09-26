import Foundation
import UserNotifications

extension Notification.Name {
    static let wordbreakOpenDaily = Notification.Name("wordbreak.openDaily")
}

struct NotificationScheduler {
    static let pendingPrefix = "wordbreak.daily."
    static let openDailyKey = "notification.openDaily"

    private let center = UNUserNotificationCenter.current()
    private let sharedDefaults = UserDefaults(suiteName: "group.com.mattmireles.wordbreak")

    func requestAndSchedule() async throws -> Bool {
        let granted = try await center.requestAuthorization(options: [.alert, .sound])
        guard granted else { return false }
        try await refresh()
        return true
    }

    func refresh(now: Date = Date(), calendar sourceCalendar: Calendar = .current) async throws {
        let settings = await center.notificationSettings()
        guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else { return }
        let requests = await center.pendingNotificationRequests()
        center.removePendingNotificationRequests(
            withIdentifiers: requests.map(\.identifier).filter { $0.hasPrefix(Self.pendingPrefix) }
        )

        let calendar = sourceCalendar
        let completedDay = sharedDefaults?.string(forKey: "daily.completedDay")
        for (fireDate, suffix) in Self.reminderDates(now: now, calendar: calendar) {
            let dayKey = Self.dayKey(fireDate, calendar: calendar)
            if dayKey == completedDay { continue }
            let components = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: fireDate)
            let content = UNMutableNotificationContent()
            content.title = suffix == "afternoon" ? "A little practice?" : "Practice is still waiting"
            content.body = "Words, then math. No timer."
            content.sound = .default
            content.userInfo = ["route": "daily"]
            let request = UNNotificationRequest(
                identifier: "\(Self.pendingPrefix)\(dayKey).\(suffix)",
                content: content,
                trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            )
            try await center.add(request)
        }
    }

    func markTodayComplete(now: Date = Date(), calendar: Calendar = .current) async throws {
        let dayKey = Self.dayKey(now, calendar: calendar)
        sharedDefaults?.set(dayKey, forKey: "daily.completedDay")
        let requests = await center.pendingNotificationRequests()
        center.removePendingNotificationRequests(
            withIdentifiers: requests.map(\.identifier).filter { $0.hasPrefix("\(Self.pendingPrefix)\(dayKey).") }
        )
    }

    static func consumeOpenDailyRequest() -> Bool {
        let defaults = UserDefaults(suiteName: "group.com.mattmireles.wordbreak")
        let requested = defaults?.bool(forKey: openDailyKey) == true
        if requested { defaults?.set(false, forKey: openDailyKey) }
        return requested
    }

    static func dayKey(_ date: Date, calendar sourceCalendar: Calendar) -> String {
        var calendar = sourceCalendar
        calendar.timeZone = sourceCalendar.timeZone
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", components.year ?? 0, components.month ?? 0, components.day ?? 0)
    }

    static func reminderDates(
        now: Date,
        days: Int = 14,
        calendar: Calendar = .current
    ) -> [(date: Date, suffix: String)] {
        var output: [(Date, String)] = []
        for dayOffset in 0 ..< days {
            guard let day = calendar.date(byAdding: .day, value: dayOffset, to: now) else { continue }
            for (hour, minute, suffix) in [(16, 0, "afternoon"), (19, 30, "evening")] {
                var components = calendar.dateComponents([.year, .month, .day], from: day)
                components.hour = hour
                components.minute = minute
                if let date = calendar.date(from: components), date > now {
                    output.append((date, suffix))
                }
            }
        }
        return output
    }
}
