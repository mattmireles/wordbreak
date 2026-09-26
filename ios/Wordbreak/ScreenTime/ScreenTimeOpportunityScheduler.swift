import DeviceActivity
import FamilyControls
import Foundation

extension DeviceActivityName {
    static let wordbreakDailyOpportunity = Self("wordbreak.daily.opportunity")
}

extension DeviceActivityEvent.Name {
    static let wordbreakDailyOpportunityThreshold = Self("wordbreak.daily.opportunity.threshold")
}

struct ScreenTimeOpportunityScheduler {
    private let defaults = UserDefaults(suiteName: "group.com.mattmireles.wordbreak")
    private let selectionKey = "phase0.familyActivitySelection"

    func start() throws {
        guard let data = defaults?.data(forKey: selectionKey) else {
            throw CocoaError(.fileNoSuchFile, userInfo: [NSLocalizedDescriptionKey: "Choose the apps or categories first."])
        }
        let selection = try PropertyListDecoder().decode(FamilyActivitySelection.self, from: data)
        let schedule = DeviceActivitySchedule(
            intervalStart: DateComponents(hour: 15),
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
        defaults?.set(true, forKey: "screenTime.dailyOpportunityEnabled")
    }
}
