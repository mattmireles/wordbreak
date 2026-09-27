import SwiftUI
import UIKit

struct DailyPracticeView: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var controller = DailySessionController()
    @State private var showingSetup = false

    var body: some View {
        NavigationStack {
            ZStack {
                WordbreakPalette.background.ignoresSafeArea()
                switch controller.stage {
                case .home:
                    DailyHomeView(start: controller.startToday, openParentSetup: { showingSetup = true })
                case .wordbreak:
                    NativeWordbreakView(viewModel: controller.wordView, send: controller.sendWord)
                case .mathbreak:
                    NativeMathbreakView(viewModel: controller.mathView, send: controller.sendMath)
                case .checkIn:
                    DailyCheckInView(submit: controller.submitCheckIn)
                case .done:
                    DailyDoneView(openParentSetup: { showingSetup = true })
                }
            }
            .overlay(alignment: .top) {
                if controller.isCapturing, controller.stage != .home, controller.stage != .done {
                    Label("Session recording", systemImage: "record.circle.fill")
                        .font(.system(.caption2, design: .rounded, weight: .semibold))
                        .foregroundStyle(WordbreakPalette.secondary)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(.ultraThinMaterial, in: Capsule())
                        .padding(.top, 8)
                        .accessibilityIdentifier("capture.indicator")
                }
            }
            .navigationDestination(isPresented: $showingSetup) {
                ParentSetupView()
            }
        }
        .tint(WordbreakPalette.green)
        .alert(
            "Practice couldn’t continue",
            isPresented: Binding(
                get: { controller.errorMessage != nil },
                set: { if !$0 { controller.dismissError() } }
            )
        ) {
            Button("OK", role: .cancel) { controller.dismissError() }
        } message: {
            Text(controller.errorMessage ?? "Try again.")
        }
        .onAppear {
            if NotificationScheduler.consumeOpenDailyRequest() { controller.startToday() }
        }
        .onReceive(NotificationCenter.default.publisher(for: .wordbreakOpenDaily)) { _ in
            _ = NotificationScheduler.consumeOpenDailyRequest()
            // Never start practice underneath an open parent setup (an import may be in flight).
            if !showingSetup { controller.startToday() }
        }
        .onChange(of: scenePhase) { _, newPhase in
            controller.handleScenePhase(newPhase)
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.significantTimeChangeNotification)) { _ in
            controller.refreshDay()  // a midnight tick never interrupts an item in progress
        }
    }
}

private struct DailyCheckInView: View {
    let submit: (String, URL?) -> Void
    @StateObject private var recorder = CheckInVoiceRecorder()
    @State private var selection: String?

    private let choices = [
        ("confusing", "Something was confusing"),
        ("annoying", "Something was annoying"),
        ("too_easy", "It was too easy"),
        ("okay", "It felt okay"),
    ]

    var body: some View {
        FillingScrollView { checkIn }
    }

    private var checkIn: some View {
        VStack(alignment: .leading, spacing: 22) {
            PracticeHeader(eyebrow: "One last thing", title: "How did that feel?", progress: nil)
            PracticeCard {
                VStack(spacing: 10) {
                    ForEach(choices, id: \.0) { id, title in
                        Button {
                            selection = id
                        } label: {
                            HStack {
                                Text(title)
                                Spacer()
                                if selection == id { Image(systemName: "checkmark.circle.fill") }
                            }
                            .font(.system(.headline, design: .rounded))
                            .foregroundStyle(selection == id ? WordbreakPalette.background : .white)
                            .padding(.horizontal, 16)
                            .frame(maxWidth: .infinity, minHeight: 52)
                            .background(selection == id ? WordbreakPalette.green : WordbreakPalette.background, in: RoundedRectangle(cornerRadius: 14))
                        }
                        .accessibilityAddTraits(selection == id ? .isSelected : [])
                    }
                }
            }
            Button {
                recorder.toggle()
            } label: {
                Label(
                    recorder.isRecording ? "Stop voice note" : (recorder.recordingURL == nil ? "Add a voice note" : "Voice note added"),
                    systemImage: recorder.isRecording ? "stop.circle.fill" : "mic.circle"
                )
                .frame(maxWidth: .infinity, minHeight: 50)
            }
            .buttonStyle(.bordered)
            .tint(recorder.isRecording ? .red : WordbreakPalette.secondary)
            if let error = recorder.errorMessage {
                Text(error).font(.footnote).foregroundStyle(WordbreakPalette.secondary)
            }
            Spacer()
            Button("Done") {
                recorder.stop()
                if let selection { submit(selection, recorder.recordingURL) }
            }
            .frame(maxWidth: .infinity, minHeight: 56)
            .buttonStyle(WordbreakPrimaryButtonStyle())
            .disabled(selection == nil)
            .accessibilityIdentifier("checkin.submit")
        }
        .padding(.horizontal, 22)
        .padding(.vertical, 24)
        .accessibilityIdentifier("checkin.prompt")
    }
}

/// Hidden parent entry: a long press on the eyebrow label, or the VoiceOver action.
private struct ParentEntry: ViewModifier {
    let open: () -> Void

    func body(content: Content) -> some View {
        content
            .frame(minHeight: 44, alignment: .leading)
            .contentShape(Rectangle())
            .onLongPressGesture(minimumDuration: 1.5, perform: open)
            .accessibilityAction(named: "Parent setup", open)
            .accessibilityIdentifier("parent.entry")
    }
}

private struct DailyHomeView: View {
    let start: () -> Void
    let openParentSetup: () -> Void
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        FillingScrollView { home }
    }

    private var home: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer()
            Text("TODAY")
                .font(.system(.caption, design: .monospaced, weight: .semibold))
                .tracking(2.6)
                .foregroundStyle(WordbreakPalette.green)
                .modifier(ParentEntry(open: openParentSetup))
            Text("A little practice.\nThen you’re done.")
                .font(.system(.largeTitle, design: .rounded, weight: .bold))
                .tracking(-1)
                .foregroundStyle(.white)
                .minimumScaleFactor(0.6)
                .accessibilityAddTraits(.isHeader)
            // AnyLayout keeps the pills' identity when accessibility sizes stack them.
            let steps = dynamicTypeSize.isAccessibilitySize
                ? AnyLayout(VStackLayout(alignment: .leading, spacing: 10))
                : AnyLayout(HStackLayout(spacing: 10))
            steps { subjectSteps }
            .padding(.top, 28)
            Spacer()
            Button(action: start) {
                HStack {
                    Text("Start today’s practice")
                    Spacer()
                    Image(systemName: "arrow.right")
                }
                .padding(.vertical, 2)
            }
            .buttonStyle(WordbreakPrimaryButtonStyle())
            .accessibilityIdentifier("practice.start")
            .accessibilityHint("Words first, then math.")
            Text("No timer. No streak to protect.")
                .font(.system(.caption, design: .rounded))
                .foregroundStyle(WordbreakPalette.muted)
                .frame(maxWidth: .infinity)
                .padding(.top, 14)
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 30)
    }

    @ViewBuilder private var subjectSteps: some View {
        SubjectPill(number: "1", title: "Words")
        Image(systemName: dynamicTypeSize.isAccessibilitySize ? "arrow.down" : "arrow.right")
            .foregroundStyle(WordbreakPalette.muted)
            .accessibilityHidden(true)
        SubjectPill(number: "2", title: "Math")
    }
}

private struct SubjectPill: View {
    let number: String
    let title: String
    @ScaledMetric(relativeTo: .caption) private var badge = 22.0

    var body: some View {
        HStack(spacing: 8) {
            Text(number)
                .font(.system(.caption, design: .rounded, weight: .bold))
                .foregroundStyle(WordbreakPalette.background)
                .frame(minWidth: badge, minHeight: badge)
                .background(WordbreakPalette.green, in: Circle())
            Text(title).font(.system(.subheadline, design: .rounded, weight: .semibold))
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 13)
        .padding(.vertical, 10)
        .background(WordbreakPalette.panel, in: Capsule())
        .accessibilityElement(children: .combine)
    }
}

private struct DailyDoneView: View {
    let openParentSetup: () -> Void

    var body: some View {
        FillingScrollView { done }
    }

    private var done: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: "checkmark")
                .font(.system(size: 34, weight: .semibold))
                .foregroundStyle(WordbreakPalette.background)
                .frame(width: 72, height: 72)
                .background(WordbreakPalette.green, in: Circle())
                .accessibilityHidden(true)
            Text("That’s today done.")
                .font(.system(.largeTitle, design: .rounded, weight: .bold))
                .minimumScaleFactor(0.6)
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)
                .modifier(ParentEntry(open: openParentSetup))
            Text("Come back tomorrow.")
                .font(.system(.body, design: .rounded))
                .foregroundStyle(WordbreakPalette.secondary)
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .accessibilityIdentifier("daily.done")
    }
}

struct PracticeHeader: View {
    let eyebrow: String
    let title: String
    let progress: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text(eyebrow.uppercased())
                    .font(.system(.caption, design: .monospaced, weight: .semibold))
                    .tracking(2)
                    .foregroundStyle(WordbreakPalette.green)
                Spacer()
                if let progress {
                    Text(progress)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(WordbreakPalette.muted)
                        .accessibilityLabel(progress.replacingOccurrences(of: " / ", with: " of "))
                }
            }
            Text(title)
                .font(.system(.title, design: .rounded, weight: .bold))
                .minimumScaleFactor(0.6)
                .foregroundStyle(.white)
                .accessibilityAddTraits(.isHeader)
        }
    }
}

struct PracticeCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(22)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(WordbreakPalette.panel, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(WordbreakPalette.line, lineWidth: 1)
            }
    }
}
