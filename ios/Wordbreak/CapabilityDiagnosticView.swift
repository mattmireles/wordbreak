import DeviceActivity
import FamilyControls
import SwiftUI
import UserNotifications

extension DeviceActivityName {
    static let wordbreakPhase0 = Self("wordbreak.phase0")
}

extension DeviceActivityEvent.Name {
    static let wordbreakPhase0Threshold = Self("wordbreak.phase0.threshold")
}

@MainActor
final class CapabilityDiagnosticModel: ObservableObject {
    @Published var selection = FamilyActivitySelection()
    @Published private(set) var authorization = AuthorizationCenter.shared.authorizationStatus
    @Published private(set) var notificationStatus = "not requested"
    @Published private(set) var monitorStatus = "not started"
    @Published private(set) var dailyReminderStatus = "not scheduled"
    @Published private(set) var opportunityStatus = "not scheduled"
    @Published private(set) var callbackStatus = "not received"
    @Published private(set) var errorMessage: String?

    private let sharedDefaults = UserDefaults(suiteName: "group.com.mattmireles.wordbreak")
    private let selectionKey = ScreenTimeOpportunityScheduler.selectionKey

    var isAuthorized: Bool {
        switch authorization {
        case .approved, .approvedWithDataAccess: true
        default: false
        }
    }

    var authorizationLabel: String {
        switch authorization {
        case .approved, .approvedWithDataAccess: "Allowed"
        case .denied: "Not allowed"
        case .notDetermined: "Not set up"
        @unknown default: "Unavailable"
        }
    }

    var selectionCount: Int {
        (selection.includeEntireCategory ? 1 : 0)
            + selection.applicationTokens.count
            + selection.categoryTokens.count
            + selection.webDomainTokens.count
    }

    var selectionLabel: String {
        selectionCount == 0 ? "Nothing chosen" : "\(selectionCount) chosen"
    }

    init() {
        if let data = sharedDefaults?.data(forKey: selectionKey),
           let saved = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data) {
            selection = saved
        }
        refreshCallback()
    }

    func requestChildAuthorization() {
        Task {
            do {
                try await AuthorizationCenter.shared.requestAuthorization(for: .child)
                authorization = AuthorizationCenter.shared.authorizationStatus
                errorMessage = nil
            } catch { errorMessage = error.localizedDescription }
        }
    }

    func saveSelectionAndStartProof() {
        do {
            let data = try PropertyListEncoder().encode(selection)
            sharedDefaults?.set(data, forKey: selectionKey)
            let now = Date()
            let calendar = Calendar.current
            let start = calendar.dateComponents([.hour, .minute], from: now)
            let endDate = calendar.date(byAdding: .hour, value: 1, to: now) ?? now.addingTimeInterval(3600)
            let end = calendar.dateComponents([.hour, .minute], from: endDate)
            let schedule = DeviceActivitySchedule(intervalStart: start, intervalEnd: end, repeats: false)
            let event = DeviceActivityEvent(
                applications: selection.applicationTokens,
                categories: selection.categoryTokens,
                webDomains: selection.webDomainTokens,
                threshold: DateComponents(minute: 1)
            )
            try DeviceActivityCenter().startMonitoring(.wordbreakPhase0, during: schedule, events: [.wordbreakPhase0Threshold: event])
            monitorStatus = "running · one-minute proof window"
            errorMessage = nil
        } catch { errorMessage = error.localizedDescription }
    }

    func scheduleNotificationProof() {
        Task {
            do {
                let center = UNUserNotificationCenter.current()
                let granted = try await center.requestAuthorization(options: [.alert, .sound])
                guard granted else { notificationStatus = "denied"; return }
                let content = UNMutableNotificationContent()
                content.title = "Wordbreak device check"
                content.body = "Notifications are ready."
                content.sound = .default
                let request = UNNotificationRequest(identifier: "wordbreak.phase0.notification", content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false))
                try await center.add(request)
                notificationStatus = "scheduled · five seconds"
                errorMessage = nil
            } catch { errorMessage = error.localizedDescription }
        }
    }

    func scheduleDailyReminders() {
        Task {
            do {
                let granted = try await NotificationScheduler().requestAndSchedule()
                dailyReminderStatus = granted ? "4:00 PM and 7:30 PM" : "not allowed"
                errorMessage = nil
            } catch { errorMessage = error.localizedDescription }
        }
    }

    func scheduleOpportunityReminders() {
        do {
            try ScreenTimeOpportunityScheduler().start()
            opportunityStatus = "after 15 minutes · from 3:00 PM"
            errorMessage = nil
        } catch { errorMessage = error.localizedDescription }
    }

    func refreshCallback() {
        if let time = sharedDefaults?.double(forKey: "phase0.lastThresholdCallback"), time > 0 {
            callbackStatus = Date(timeIntervalSince1970: time).formatted(date: .abbreviated, time: .standard)
        } else {
            callbackStatus = "not received"
        }
    }

    func revoke() {
        AuthorizationCenter.shared.revokeAuthorization { [weak self] result in
            Task { @MainActor in
                self?.authorization = AuthorizationCenter.shared.authorizationStatus
                if case let .failure(error) = result { self?.errorMessage = error.localizedDescription }
            }
        }
    }
}

struct CapabilityDiagnosticView: View {
    @StateObject private var model = CapabilityDiagnosticModel()
    @State private var showingPicker = false

    var body: some View {
        ZStack {
            WordbreakPalette.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("PARENT SETUP")
                        .font(.system(.caption, design: .monospaced, weight: .semibold))
                        .tracking(2)
                        .foregroundStyle(WordbreakPalette.amber)
                    Text("Set up Luca’s practice.")
                        .font(.system(size: 31, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                    Text("A few quick steps let Wordbreak notice a good moment to practice and send a gentle reminder.")
                        .foregroundStyle(WordbreakPalette.secondary)

                    SetupCard(
                        number: "1",
                        title: "Allow Screen Time",
                        detail: "Apple asks a parent before Wordbreak can notice eligible activity.",
                        status: model.authorizationLabel,
                        complete: model.isAuthorized
                    ) {
                        Button(model.isAuthorized ? "Allowed" : "Continue") {
                            model.requestChildAuthorization()
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(model.isAuthorized)
                        .accessibilityIdentifier("permissions.authorize")
                    }

                    SetupCard(
                        number: "2",
                        title: "Choose what counts",
                        detail: "Pick the apps or categories that can suggest a practice break.",
                        status: model.selectionLabel,
                        complete: model.selectionCount > 0
                    ) {
                        Button(model.selectionCount > 0 ? "Change selection" : "Choose activity") {
                            showingPicker = true
                        }
                        .buttonStyle(.bordered)
                        .disabled(!model.isAuthorized)
                        .accessibilityIdentifier("permissions.choose-activity")
                    }

                    SetupCard(
                        number: "3",
                        title: "Run a one-minute check",
                        detail: "Confirm that the reminder arrives before relying on it day to day.",
                        status: model.callbackStatus == "not received" ? model.monitorStatus : "Check received",
                        complete: model.callbackStatus != "not received"
                    ) {
                        HStack {
                            Button("Start check") { model.saveSelectionAndStartProof() }
                                .buttonStyle(.bordered)
                                .disabled(!model.isAuthorized || model.selectionCount == 0)
                                .accessibilityIdentifier("permissions.start-threshold-proof")
                            Button("Refresh") { model.refreshCallback() }
                                .buttonStyle(.plain)
                                .foregroundStyle(WordbreakPalette.secondary)
                                .accessibilityIdentifier("permissions.refresh-callback")
                        }
                    }

                    SetupCard(
                        number: "4",
                        title: "Allow a well-timed suggestion",
                        detail: "After 15 minutes in what you chose, between 3 PM and 4 PM, Wordbreak may send one practice suggestion. It never blocks an app.",
                        status: model.opportunityStatus,
                        complete: model.opportunityStatus != "not scheduled"
                    ) {
                        Button("Turn on suggestions") { model.scheduleOpportunityReminders() }
                            .buttonStyle(.bordered)
                            .disabled(!model.isAuthorized || model.selectionCount == 0)
                            .accessibilityIdentifier("permissions.schedule-opportunity")
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        Text("REMINDERS")
                            .font(.system(.caption, design: .monospaced, weight: .semibold))
                            .tracking(1.6)
                            .foregroundStyle(WordbreakPalette.muted)
                        Text("Send a five-second test reminder")
                            .font(.system(.headline, design: .rounded))
                            .foregroundStyle(.white)
                        Text("This verifies notifications without waiting until tomorrow.")
                            .font(.subheadline)
                            .foregroundStyle(WordbreakPalette.secondary)
                        Button("Send test reminder") { model.scheduleNotificationProof() }
                            .buttonStyle(.bordered)
                            .accessibilityIdentifier("permissions.schedule-notification")
                        DiagnosticRow(title: "Reminder", status: model.notificationStatus)
                        Button("Schedule daily reminders") { model.scheduleDailyReminders() }
                            .buttonStyle(.borderedProminent)
                            .accessibilityIdentifier("permissions.schedule-daily-reminders")
                        DiagnosticRow(title: "Every day", status: model.dailyReminderStatus)
                    }
                    .padding(18)
                    .background(WordbreakPalette.panel, in: RoundedRectangle(cornerRadius: 20, style: .continuous))

                    if let error = model.errorMessage {
                        Text(error).font(.system(.callout, design: .monospaced)).foregroundStyle(.red)
                    }
                    if model.isAuthorized {
                        Button("Remove Screen Time access", role: .destructive) { model.revoke() }
                            .font(.footnote)
                            .accessibilityIdentifier("permissions.revoke")
                    }
                }
                .padding(22)
            }
        }
        .familyActivityPicker(isPresented: $showingPicker, selection: $model.selection)
        .navigationTitle("Permissions")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(WordbreakPalette.background, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .task {
            #if DEBUG
                if ProcessInfo.processInfo.arguments.contains("--wordbreak-request-family-controls") {
                    model.requestChildAuthorization()
                }
                if ProcessInfo.processInfo.arguments.contains("--wordbreak-schedule-notification-proof") {
                    model.scheduleNotificationProof()
                }
                if ProcessInfo.processInfo.arguments.contains("--wordbreak-open-activity-picker") {
                    await Task.yield()
                    showingPicker = true
                }
            #endif
        }
    }
}

private struct SetupCard<Actions: View>: View {
    let number: String
    let title: String
    let detail: String
    let status: String
    let complete: Bool
    @ViewBuilder let actions: Actions

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center, spacing: 12) {
                Text(complete ? "✓" : number)
                    .font(.system(.headline, design: .rounded, weight: .bold))
                    .foregroundStyle(complete ? WordbreakPalette.background : .white)
                    .frame(width: 34, height: 34)
                    .background(
                        complete ? WordbreakPalette.green : WordbreakPalette.line,
                        in: Circle()
                    )
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.system(.headline, design: .rounded))
                        .foregroundStyle(.white)
                    Text(status)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(complete ? WordbreakPalette.green : WordbreakPalette.muted)
                }
            }
            Text(detail)
                .font(.subheadline)
                .foregroundStyle(WordbreakPalette.secondary)
            actions
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(WordbreakPalette.panel, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(complete ? WordbreakPalette.green.opacity(0.35) : WordbreakPalette.line)
        }
    }
}

private struct DiagnosticRow: View {
    let title: String
    let status: String

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title).foregroundStyle(.white)
            Spacer()
            Text(status).font(.system(.caption, design: .monospaced)).foregroundStyle(WordbreakPalette.secondary).multilineTextAlignment(.trailing)
        }
        .padding(16)
        .background(WordbreakPalette.panel, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
