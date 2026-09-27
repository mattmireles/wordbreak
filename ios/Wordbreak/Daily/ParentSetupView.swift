import FamilyControls
import SwiftUI

/// Parent-only setup. Reached from a hidden long press on the home screen's "TODAY" label (or
/// the VoiceOver "Parent setup" action), never from a visible learner control. This is a
/// convenience boundary, not a security one: Screen Time authorization and revocation still
/// require Apple's parent approval.
struct ParentSetupView: View {
    @StateObject private var model = ParentSetupModel()
    @State private var showingPicker = false
    @State private var choosingFile = false
    @State private var prepared: WebProgressImport.Prepared?
    @State private var current = WebProgressImport.Summary(stateJSON: nil)
    @State private var confirmingImport = false
    @State private var importStatus: String?
    @State private var errorMessage: String?

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
                        .font(.system(.title, design: .rounded, weight: .bold))
                        .foregroundStyle(.white)
                        .accessibilityAddTraits(.isHeader)

                    remindersSection
                    if model.screenTimeAvailable { screenTimeSection }

                    ParentSection(title: "Weekly report", status: "Paused on this iPhone") {
                        Text("The iPhone app doesn’t send progress reports, so iPhone practice isn’t in the weekly email. It is not counted as zero.")
                    }

                    ParentSection(title: "Bring web progress", status: importStatus ?? "Optional") {
                        Text("On the computer, open the observer panel in Wordbreak, choose “export progress”, and AirDrop wordbreak-progress.json to this iPhone. Choose it here to preview before anything changes.")
                        Button("Choose export file") { choosingFile = true }
                            .buttonStyle(.bordered)
                            .accessibilityIdentifier("parent.import.file")
                        PasteButton(payloadType: String.self) { strings in
                            guard let text = strings.first else { return }
                            Task { @MainActor in preview(text) }
                        }
                        .labelStyle(.titleAndIcon)
                        .accessibilityIdentifier("parent.import.paste")
                        if let prepared {
                            ImportComparison(current: current, incoming: prepared.summary)
                            Button("Replace iPhone Wordbreak progress", role: .destructive) {
                                confirmingImport = true
                            }
                            .accessibilityIdentifier("parent.import.confirm")
                        }
                    }

                    if let error = model.errorMessage {
                        Text(error)
                            .font(.callout)
                            .foregroundStyle(WordbreakPalette.amber)
                    }
                    if let errorMessage {
                        Text(errorMessage)
                            .font(.callout)
                            .foregroundStyle(WordbreakPalette.amber)
                    }

                    #if DEBUG
                        NavigationLink("Device checks") { CapabilityDiagnosticView() }
                            .foregroundStyle(WordbreakPalette.secondary)
                    #endif
                }
                .padding(22)
            }
        }
        .navigationTitle("Parent setup")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(WordbreakPalette.background, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .onAppear(perform: loadCurrent)
        .task { await model.load() }
        .familyActivityPicker(isPresented: $showingPicker, selection: $model.selection)
        .fileImporter(isPresented: $choosingFile, allowedContentTypes: [.json]) { result in
            do {
                let url = try result.get()
                let scoped = url.startAccessingSecurityScopedResource()
                defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                preview(try String(contentsOf: url, encoding: .utf8))
            } catch {
                errorMessage = error.localizedDescription
            }
        }
        .onChange(of: showingPicker) { _, open in
            if !open { model.saveSelection() }
        }
        .confirmationDialog(
            "Replace this iPhone’s Wordbreak progress with the web progress?",
            isPresented: $confirmingImport,
            titleVisibility: .visible
        ) {
            Button("Replace", role: .destructive, action: commitImport)
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Math progress is kept. After this, practice on the iPhone; web progress won’t sync back.")
        }
    }

    private var reminderStatusText: String {
        switch model.reminderStatus {
        case .allowed: "On"
        case .denied: "Off in Settings"
        case .notAsked: "Not set up"
        case .switchedOff: "Switched off for this build"
        }
    }

    private var remindersSection: some View {
        ParentSection(title: "Reminders", status: reminderStatusText) {
            Text("One gentle reminder in the afternoon and one in the evening, only on days practice isn’t done.")
            switch model.reminderStatus {
            case .notAsked:
                Button("Allow reminders") { Task { await model.allowReminders() } }
                    .buttonStyle(.borderedProminent)
                    .accessibilityIdentifier("parent.reminders.allow")
            case .denied:
                Button("Open Settings", action: model.openSettings)
                    .buttonStyle(.bordered)
            case .allowed, .switchedOff:
                EmptyView()
            }
            DatePicker("Afternoon", selection: $model.afternoon, displayedComponents: .hourAndMinute)
                .accessibilityIdentifier("parent.reminders.afternoon")
            DatePicker("Evening", selection: $model.evening, displayedComponents: .hourAndMinute)
                .accessibilityIdentifier("parent.reminders.evening")
            Button("Save times") { Task { await model.saveTimes() } }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("parent.reminders.save")
        }
        .foregroundStyle(.white)
    }

    private var screenTimeSection: some View {
        ParentSection(
            title: "Screen Time suggestion",
            status: model.suggestionsOn ? "On" : (model.screenTimeAllowed ? "Off" : "Needs a parent")
        ) {
            Text("In the hour before the afternoon reminder, after 15 minutes in what you choose, Wordbreak may suggest practice once. It never blocks an app.")
            if !model.screenTimeAllowed {
                Button("Allow Screen Time") { Task { await model.allowScreenTime() } }
                    .buttonStyle(.borderedProminent)
                    .accessibilityIdentifier("parent.screenTime.allow")
            } else {
                Button(model.hasSelection ? "Change what counts" : "Choose what counts") { showingPicker = true }
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("parent.screenTime.choose")
                Toggle("Suggest practice", isOn: Binding(get: { model.suggestionsOn }, set: model.setSuggestions))
                    .disabled(!model.hasSelection)
                    .accessibilityIdentifier("parent.screenTime.toggle")
            }
        }
        .foregroundStyle(.white)
    }

    private func loadCurrent() {
        if let store = try? WordbreakFileStateStore.appGroup() {
            current = WebProgressImport.currentSummary(store: store)
        }
    }

    private func preview(_ text: String) {
        do {
            prepared = try WebProgressImport.prepare(text)
            errorMessage = nil
        } catch {
            prepared = nil
            errorMessage = error.localizedDescription
        }
    }

    private func commitImport() {
        guard let prepared else { return }
        do {
            try WebProgressImport.commit(prepared, to: WordbreakFileStateStore.appGroup())
            self.prepared = nil
            importStatus = "Imported"
            loadCurrent()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct ImportComparison: View {
    let current: WebProgressImport.Summary
    let incoming: WebProgressImport.Summary

    var body: some View {
        Grid(alignment: .leading, horizontalSpacing: 14, verticalSpacing: 6) {
            GridRow {
                Text("")
                Text("iPhone now").foregroundStyle(WordbreakPalette.muted)
                Text("Web").foregroundStyle(WordbreakPalette.muted)
            }
            row("Lessons read", current.modulesRead, incoming.modulesRead)
            row("Modules cleared", current.modulesCleared, incoming.modulesCleared)
            row("Words in review", current.wordsScheduled, incoming.wordsScheduled)
            row("Sessions done", current.sessionsCompleted, incoming.sessionsCompleted)
        }
        .font(.system(.subheadline, design: .rounded))
        .foregroundStyle(.white)
        .accessibilityIdentifier("parent.import.preview")
    }

    private func row(_ title: String, _ now: Int, _ web: Int) -> some View {
        GridRow {
            Text(title)
            Text("\(now)").monospacedDigit()
            Text("\(web)").monospacedDigit()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(title): \(now) on iPhone, \(web) from the web")
    }
}

struct ParentSection<Content: View>: View {
    let title: String
    let status: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(.headline, design: .rounded))
                    .foregroundStyle(.white)
                    .accessibilityAddTraits(.isHeader)
                Text(status)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(WordbreakPalette.muted)
            }
            content
                .font(.subheadline)
                .foregroundStyle(WordbreakPalette.secondary)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(WordbreakPalette.panel, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}
