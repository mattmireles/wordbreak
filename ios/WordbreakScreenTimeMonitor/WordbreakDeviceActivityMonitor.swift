import DeviceActivity
import Foundation
import UserNotifications

final class WordbreakDeviceActivityMonitor: DeviceActivityMonitor {
    override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
        if activity.rawValue == "wordbreak.daily.opportunity" {
            deliverDailyOpportunityIfNeeded()
            return
        }
        UserDefaults(suiteName: DailyCoordinationStore.appGroup)?
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

    /// Claims today's single opportunity in the shared ledger before speaking, then removes the
    /// still-pending afternoon reminder. The evening fallback stays scheduled.
    private func deliverDailyOpportunityIfNeeded(now: Date = Date()) {
        let defaults = UserDefaults(suiteName: DailyCoordinationStore.appGroup)
        // Registration can outlive a kill switch or a parent turning suggestions off.
        guard defaults?.bool(forKey: "screenTime.dailyOpportunityEnabled") == true,
              defaults?.object(forKey: DailyNudgePolicy.notificationsEnabledKey) as? Bool != false
        else { return }
        let calendar = Calendar.current
        let day = DailyNudgePolicy.dayKey(now, calendar: calendar)
        guard let store = try? DailyCoordinationStore.shared() else { return }
        var claimed = false
        _ = try? store.update { state in
            guard DailyNudgePolicy.shouldDeliverOpportunity(now: now, state: state, calendar: calendar) else { return }
            state.days[day, default: .init()].opportunityDelivered = true
            claimed = true
        }
        guard claimed else { return }

        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: ["\(DailyNudgePolicy.notificationPrefix)\(day).afternoon"]
        )
        let content = UNMutableNotificationContent()
        content.title = "Good moment for a break?"
        content.body = "Words, then math. No timer."
        content.sound = .default
        content.userInfo = ["route": "daily"]
        UNUserNotificationCenter.current().add(UNNotificationRequest(
            identifier: "\(DailyNudgePolicy.notificationPrefix)\(day).opportunity",
            content: content,
            trigger: nil
        ))
    }
}
