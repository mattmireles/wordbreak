import FamilyControls
import SwiftUI
import UIKit
import UserNotifications

/// Parent-only controls for the daily rhythm: reminder permission and times, and the optional
/// Screen Time opportunity trigger. Every change converges on the shared coordination ledger
/// and reschedules from it, so the three nudge routes never disagree.
@MainActor
final class ParentSetupModel: ObservableObject {
    enum ReminderStatus: Equatable {
        case notAsked, allowed, denied, switchedOff
    }

    @Published private(set) var reminderStatus: ReminderStatus = .notAsked
    @Published var afternoon: Date = .now
    @Published var evening: Date = .now
    @Published var selection = FamilyActivitySelection()
    @Published private(set) var screenTimeAllowed = false
    @Published private(set) var suggestionsOn = false
    @Published private(set) var errorMessage: String?

    private let screenTime = ScreenTimeOpportunityScheduler()
    private let calendar = Calendar.current

    var screenTimeAvailable: Bool { ExperimentConfiguration.screenTimeEnabled }
    var hasSelection: Bool { !ScreenTimeOpportunityScheduler.isEmpty(selection) }

    func load() async {
        if let state = try? DailyCoordinationStore.shared().read() {
            afternoon = date(state.afternoon)
            evening = date(state.evening)
        }
        selection = screenTime.savedSelection() ?? FamilyActivitySelection()
        suggestionsOn = screenTime.isEnabled
        refreshScreenTimeStatus()
        await refreshReminderStatus()
    }

    func allowReminders() async {
        do {
            _ = try await NotificationScheduler().requestAndSchedule()
            errorMessage = nil
        } catch { errorMessage = error.localizedDescription }
        await refreshReminderStatus()
    }

    func openSettings() {
        if let url = URL(string: UIApplication.openNotificationSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }

    /// Saves both times atomically; the evening fallback must stay after the afternoon reminder.
    func saveTimes() async {
        let newAfternoon = time(afternoon)
        let newEvening = time(evening)
        guard DailyNudgePolicy.validReminderTimes(afternoon: newAfternoon, evening: newEvening) else {
            errorMessage = "The afternoon reminder needs to be after 1:00 AM, and the evening one after it."
            return
        }
        do {
            let store = try DailyCoordinationStore.shared()
            let previousAfternoon = store.read().afternoon
            try store.update {
                $0.afternoon = newAfternoon
                $0.evening = newEvening
            }
            try await NotificationScheduler().refresh()
            // Re-registering resets today's counted usage, so only when the window moved.
            if newAfternoon != previousAfternoon { try screenTime.restartIfEnabled() }
            errorMessage = nil
        } catch { errorMessage = error.localizedDescription }
    }

    func allowScreenTime() async {
        do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .child)
            errorMessage = nil
        } catch { errorMessage = error.localizedDescription }
        refreshScreenTimeStatus()
    }

    func saveSelection() {
        do {
            try screenTime.save(selection)
            errorMessage = nil
        } catch { errorMessage = error.localizedDescription }
        suggestionsOn = screenTime.isEnabled
    }

    func setSuggestions(_ on: Bool) {
        do {
            if on { try screenTime.start() } else { screenTime.stop() }
            errorMessage = nil
        } catch { errorMessage = error.localizedDescription }
        suggestionsOn = screenTime.isEnabled
    }

    func refreshScreenTimeStatus() {
        switch AuthorizationCenter.shared.authorizationStatus {
        case .approved, .approvedWithDataAccess: screenTimeAllowed = true
        default: screenTimeAllowed = false
        }
        screenTime.reconcile()
        suggestionsOn = screenTime.isEnabled
    }

    private func refreshReminderStatus() async {
        guard ExperimentConfiguration.notificationsEnabled else { reminderStatus = .switchedOff; return }
        switch await UNUserNotificationCenter.current().notificationSettings().authorizationStatus {
        case .authorized, .provisional, .ephemeral: reminderStatus = .allowed
        case .denied: reminderStatus = .denied
        default: reminderStatus = .notAsked
        }
    }

    private func date(_ time: DailyCoordinationState.LocalTime) -> Date {
        calendar.date(bySettingHour: time.hour, minute: time.minute, second: 0, of: .now) ?? .now
    }

    private func time(_ date: Date) -> DailyCoordinationState.LocalTime {
        let components = calendar.dateComponents([.hour, .minute], from: date)
        return .init(hour: components.hour ?? 0, minute: components.minute ?? 0)
    }
}
