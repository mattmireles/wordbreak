import DeviceActivity
import Foundation
import UserNotifications

final class WordbreakDeviceActivityMonitor: DeviceActivityMonitor {
    override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
        if activity.rawValue == "wordbreak.daily.opportunity" {
            deliverDailyOpportunityIfNeeded()
            return
        }
        UserDefaults(suiteName: "group.com.mattmireles.wordbreak")?
            .set(Date().timeIntervalSince1970, forKey: "phase0.lastThresholdCallback")
        let content = UNMutableNotificationContent()
        content.title = "Wordbreak Screen Time check"
        content.body = "The selected activity reached the diagnostic threshold."
        content.sound = .default
        UNUserNotificationCenter.current().add(UNNotificationRequest(
            identifier: "wordbreak.phase0.threshold",
            content: content,
            trigger: nil
        ))
    }

    private func deliverDailyOpportunityIfNeeded(now: Date = Date()) {
        let defaults = UserDefaults(suiteName: "group.com.mattmireles.wordbreak")
        let calendar = Calendar.current
        let day = DailyOpportunityPolicy.dayKey(now, calendar: calendar)
        guard DailyOpportunityPolicy.shouldDeliver(
            now: now,
            completedDay: defaults?.string(forKey: "daily.completedDay"),
            opportunityDay: defaults?.string(forKey: "nudge.opportunityDay"),
            calendar: calendar
        )
        else { return }

        defaults?.set(day, forKey: "nudge.opportunityDay")
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: ["wordbreak.daily.\(day).afternoon"]
        )
        let content = UNMutableNotificationContent()
        content.title = "Good moment for a break?"
        content.body = "Words, then math. No timer."
        content.sound = .default
        content.userInfo = ["route": "daily"]
        UNUserNotificationCenter.current().add(UNNotificationRequest(
            identifier: "wordbreak.daily.\(day).opportunity",
            content: content,
            trigger: nil
        ))
    }
}
