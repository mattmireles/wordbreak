import SwiftUI
import UIKit
import UserNotifications

final class WordbreakAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        // The monitor extension cannot read the bundled kill switches, so mirror this one.
        UserDefaults(suiteName: DailyCoordinationStore.appGroup)?
            .set(ExperimentConfiguration.notificationsEnabled, forKey: DailyNudgePolicy.notificationsEnabledKey)
        Task { try? await NotificationScheduler().refresh() }
        ScreenTimeOpportunityScheduler().reconcile()
        return true
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        ScreenTimeOpportunityScheduler().reconcile()
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        if response.notification.request.content.userInfo["route"] as? String == "daily" {
            UserDefaults(suiteName: "group.com.mattmireles.wordbreak")?
                .set(true, forKey: NotificationScheduler.openDailyKey)
            NotificationCenter.default.post(name: .wordbreakOpenDaily, object: nil)
        }
        completionHandler()
    }

    func applicationSignificantTimeChange(_ application: UIApplication) {
        Task { try? await NotificationScheduler().refresh() }
    }
}

@main
struct WordbreakApp: App {
    @UIApplicationDelegateAdaptor(WordbreakAppDelegate.self) private var appDelegate

    init() {
        #if DEBUG
            // UI tests start from a fresh learner so results never depend on the day's prior runs.
            if ProcessInfo.processInfo.arguments.contains("--wordbreak-reset-state"),
               let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: DailyCoordinationStore.appGroup)
            {
                try? FileManager.default.removeItem(at: root.appending(path: "state"))
            }
        #endif
    }

    var body: some Scene {
        WindowGroup {
            #if CAPTURE_LAB
                NavigationStack {
                    CaptureSpikeView(autoStart: true)
                }
                .preferredColorScheme(.dark)
            #else
                #if DEBUG
                    if ProcessInfo.processInfo.arguments.contains("--production-capture-smoke") {
                        ProductionCaptureSmokeView()
                            .preferredColorScheme(.dark)
                    } else {
                        RootView()
                            .preferredColorScheme(.dark)
                    }
                #else
                    RootView()
                        .preferredColorScheme(.dark)
                #endif
            #endif
        }
    }
}
