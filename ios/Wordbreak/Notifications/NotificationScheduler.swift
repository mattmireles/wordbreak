import Foundation
import UserNotifications

extension Notification.Name {
    static let wordbreakOpenDaily = Notification.Name("wordbreak.openDaily")
}

/// Schedules the afternoon and evening reminders from the shared daily coordination ledger.
///
/// Every refresh rebuilds the next 14 days from scratch, so completion, a delivered Screen Time
/// nudge, a time-zone or DST change, and a parent's new reminder times all converge on the same
/// rule in `DailyNudgePolicy.shouldSchedule`.
struct NotificationScheduler {
    static let pendingPrefix = DailyNudgePolicy.notificationPrefix
    static let openDailyKey = "notification.openDaily"
    static let horizonDays = 14

    private let center = UNUserNotificationCenter.current()

    func requestAndSchedule() async throws -> Bool {
        let granted = try await center.requestAuthorization(options: [.alert, .sound])
        guard granted else { return false }
        try await refresh()
        return true
    }

    func refresh(now: Date = Date(), calendar: Calendar = .current) async throws {
        guard ExperimentConfiguration.notificationsEnabled else {
            // Kill switch: remove every pending reminder rather than leaving stale ones behind.
            let requests = await center.pendingNotificationRequests()
            center.removePendingNotificationRequests(
                withIdentifiers: requests.map(\.identifier).filter { $0.hasPrefix(Self.pendingPrefix) }
            )
            return
        }
        let settings = await center.notificationSettings()
        guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else { return }
        let store = try DailyCoordinationStore.shared()
        let state = try store.update {
            $0.prune(keepingFrom: DailyNudgePolicy.dayKey(now.addingTimeInterval(-2 * 86_400), calendar: calendar))
        }
        let requests = await center.pendingNotificationRequests()
        center.removePendingNotificationRequests(
            withIdentifiers: requests.map(\.identifier).filter { $0.hasPrefix(Self.pendingPrefix) }
        )
        for reminder in Self.reminders(now: now, state: state, calendar: calendar) {
            let components = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: reminder.date)
            let content = UNMutableNotificationContent()
            content.title = reminder.slot == .afternoon ? "A little practice?" : "Practice is still waiting"
            content.body = "Words, then math. No timer."
            content.sound = .default
            content.userInfo = ["route": "daily"]
            let request = UNNotificationRequest(
                identifier: "\(Self.pendingPrefix)\(reminder.day).\(reminder.slot.rawValue)",
                content: content,
                trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            )
            try await center.add(request)
        }
        // The monitor extension may claim today's opportunity (or the app may complete) while this
        // refresh awaits; re-check the ledger so a reminder it suppressed is not resurrected.
        let latest = store.read()
        let stale = Self.reminders(now: now, state: state, calendar: calendar)
            .filter { !DailyNudgePolicy.shouldSchedule($0.slot, day: $0.day, state: latest) }
            .map { "\(Self.pendingPrefix)\($0.day).\($0.slot.rawValue)" }
        if !stale.isEmpty { center.removePendingNotificationRequests(withIdentifiers: stale) }
    }

    static func consumeOpenDailyRequest() -> Bool {
        let defaults = UserDefaults(suiteName: DailyCoordinationStore.appGroup)
        let requested = defaults?.bool(forKey: openDailyKey) == true
        if requested { defaults?.set(false, forKey: openDailyKey) }
        return requested
    }

    /// Future reminders at the parent's wall-clock times in the current calendar's time zone.
    static func reminders(
        now: Date,
        state: DailyCoordinationState,
        days: Int = horizonDays,
        calendar: Calendar = .current
    ) -> [(date: Date, day: String, slot: DailyNudgePolicy.Slot)] {
        var output: [(Date, String, DailyNudgePolicy.Slot)] = []
        for dayOffset in 0 ..< days {
            guard let day = calendar.date(byAdding: .day, value: dayOffset, to: now) else { continue }
            let dayKey = DailyNudgePolicy.dayKey(day, calendar: calendar)
            for slot in DailyNudgePolicy.Slot.allCases {
                let time = slot == .afternoon ? state.afternoon : state.evening
                var components = calendar.dateComponents([.year, .month, .day], from: day)
                components.hour = time.hour
                components.minute = time.minute
                guard let date = calendar.date(from: components), date > now,
                      DailyNudgePolicy.shouldSchedule(slot, day: dayKey, state: state)
                else { continue }
                output.append((date, dayKey, slot))
            }
        }
        return output
    }
}
