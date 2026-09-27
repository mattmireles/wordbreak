import SwiftUI

/// Parent-only setup. Reached from a hidden long press on the home screen's "TODAY" label (or
/// the VoiceOver "Parent setup" action), never from a visible learner control. This is a
/// convenience boundary, not a security one: Screen Time authorization and revocation still
/// require Apple's parent approval.
struct ParentSetupView: View {
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

                    ParentSection(title: "Weekly report", status: "Paused on this iPhone") {
                        Text("The iPhone app doesn’t send progress reports, so iPhone practice isn’t in the weekly email. It is not counted as zero.")
                    }

                    ParentSection(title: "Bring web progress", status: importStatus ?? "Optional") {
                        Text("On the computer, open Wordbreak, open the browser console, run copy(localStorage.wb2), and send the text to this iPhone. Then paste it here to preview.")
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

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.callout)
                            .foregroundStyle(WordbreakPalette.amber)
                    }

                    NavigationLink("Device checks") { CapabilityDiagnosticView() }
                        .foregroundStyle(WordbreakPalette.secondary)
                }
                .padding(22)
            }
        }
        .navigationTitle("Parent setup")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(WordbreakPalette.background, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .onAppear(perform: loadCurrent)
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
