import SwiftUI
import UIKit
import UserNotifications

final class WordbreakAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        Task { try? await NotificationScheduler().refresh() }
        return true
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
