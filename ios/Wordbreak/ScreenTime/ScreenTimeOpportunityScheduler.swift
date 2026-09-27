import DeviceActivity
import FamilyControls
import Foundation

extension DeviceActivityName {
    static let wordbreakDailyOpportunity = Self(DailyNudgePolicy.opportunityActivity)
}

extension DeviceActivityEvent.Name {
    static let wordbreakDailyOpportunityThreshold = Self("wordbreak.daily.opportunity.threshold")
}

/// Registers the optional Screen Time opportunity trigger. It only observes the parent's
/// selection; it never shields or blocks an app. Delivery rules live in `DailyNudgePolicy`.
struct ScreenTimeOpportunityScheduler {
    static let selectionKey = "phase0.familyActivitySelection"
    private static let enabledKey = DailyNudgePolicy.opportunityEnabledKey
    private let defaults = UserDefaults(suiteName: DailyCoordinationStore.appGroup)

    var isEnabled: Bool { defaults?.bool(forKey: Self.enabledKey) == true }

    func savedSelection() -> FamilyActivitySelection? {
        guard let data = defaults?.data(forKey: Self.selectionKey) else { return nil }
        return try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data)
    }

    static func isEmpty(_ selection: FamilyActivitySelection) -> Bool {
        selection.applicationTokens.isEmpty && selection.categoryTokens.isEmpty && selection.webDomainTokens.isEmpty
    }

    /// Persists a changed selection. Re-registering resets today's counted usage, so an unchanged
    /// selection is a no-op, and an emptied one turns the trigger off.
    func save(_ selection: FamilyActivitySelection) throws {
        guard selection != savedSelection() else { return }
        defaults?.set(try PropertyListEncoder().encode(selection), forKey: Self.selectionKey)
        if Self.isEmpty(selection) { stop() } else if isEnabled { try start() }
    }

    func start() throws {
        guard ExperimentConfiguration.screenTimeEnabled else { stop(); return }
        guard let selection = savedSelection(), !Self.isEmpty(selection) else {
            throw CocoaError(.fileNoSuchFile, userInfo: [NSLocalizedDescriptionKey: "Choose the apps or categories first."])
        }
        // Usage is counted from one hour before the parent's afternoon reminder.
        let windowStart = max(0, try DailyCoordinationStore.shared().read().afternoon.minutesAfterMidnight - 60)
        let schedule = DeviceActivitySchedule(
            intervalStart: DateComponents(hour: windowStart / 60, minute: windowStart % 60),
            intervalEnd: DateComponents(hour: 23, minute: 59),
            repeats: true
        )
        let event = DeviceActivityEvent(
            applications: selection.applicationTokens,
            categories: selection.categoryTokens,
            webDomains: selection.webDomainTokens,
            threshold: DateComponents(minute: 15)
        )
        let center = DeviceActivityCenter()
        center.stopMonitoring([.wordbreakDailyOpportunity])
        try center.startMonitoring(
            .wordbreakDailyOpportunity,
            during: schedule,
            events: [.wordbreakDailyOpportunityThreshold: event]
        )
        defaults?.set(true, forKey: Self.enabledKey)
    }

    func stop() {
        DeviceActivityCenter().stopMonitoring([.wordbreakDailyOpportunity])
        defaults?.set(false, forKey: Self.enabledKey)
    }

    /// Launch/activation reconciliation. The kill switch always wins. Authorization is only
    /// treated as revoked on an explicit `.denied`: `.notDetermined` can be read at cold start
    /// before FamilyControls has loaded, and must not silently switch the trigger off.
    func reconcile() {
        if !ExperimentConfiguration.screenTimeEnabled, isEnabled { stop(); return }
        if AuthorizationCenter.shared.authorizationStatus == .denied, isEnabled { stop() }
    }

    /// Re-registers after a reminder-time change so the usage window follows the afternoon time.
    func restartIfEnabled() throws {
        if isEnabled { try start() }
    }
}
