import Foundation

enum ExperimentConfiguration {
    private struct Document: Decodable {
        struct FeatureFlags: Decodable {
            let capture: Bool
            let upload: Bool
            let analysis: Bool
            let agentWrite: Bool
            let automatedInstall: Bool
            let notifications: Bool
            let screenTime: Bool
        }

        let featureFlags: FeatureFlags
    }

    private static let document: Document? = {
        guard let url = Bundle.main.url(forResource: "experiment.v1", withExtension: "json"),
              let data = try? Data(contentsOf: url)
        else { return nil }
        return try? JSONDecoder().decode(Document.self, from: data)
    }()

    static var captureEnabled: Bool { document?.featureFlags.capture == true }
    static var uploadEnabled: Bool { document?.featureFlags.upload == true }
    static var analysisEnabled: Bool { document?.featureFlags.analysis == true }
    static var agentWriteEnabled: Bool { document?.featureFlags.agentWrite == true }
    static var automatedInstallEnabled: Bool { document?.featureFlags.automatedInstall == true }
    static var notificationsEnabled: Bool { document?.featureFlags.notifications == true }
    static var screenTimeEnabled: Bool { document?.featureFlags.screenTime == true }
    /// Plan 008 observes the session only while one of its evidence flags is on.
    static var observationEnabled: Bool { captureEnabled || uploadEnabled || analysisEnabled }
}
