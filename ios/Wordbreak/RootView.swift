import SwiftUI

struct RootView: View {
    private let opensCapabilityCheck: Bool

    init() {
        #if DEBUG
            let opensCapabilityCheck = ProcessInfo.processInfo.arguments.contains("--wordbreak-capability-check")
        #else
            let opensCapabilityCheck = false
        #endif
        self.opensCapabilityCheck = opensCapabilityCheck
    }

    var body: some View {
        if opensCapabilityCheck {
            NavigationStack { CapabilityDiagnosticView() }
        } else {
            DailyPracticeView()
        }
    }
}

enum WordbreakPalette {
    static let background = Color(red: 0.035, green: 0.043, blue: 0.047)
    static let panel = Color(red: 0.071, green: 0.082, blue: 0.086)
    static let line = Color.white.opacity(0.11)
    static let green = Color(red: 0.33, green: 0.92, blue: 0.58)
    static let amber = Color(red: 1.0, green: 0.69, blue: 0.25)
    static let secondary = Color.white.opacity(0.70)
    // 0.60 keeps caption text above WCAG 4.5:1 on `background`; the app renders dark only.
    static let muted = Color.white.opacity(0.60)
}

/// Fills the screen at ordinary text sizes (so `Spacer`s still pin actions low) and scrolls
/// instead of clipping when Dynamic Type makes the content taller than the screen.
struct FillingScrollView<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        GeometryReader { proxy in
            ScrollView {
                content.frame(maxWidth: .infinity, minHeight: proxy.size.height, alignment: .top)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
    }
}

struct WordbreakPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        PrimaryLabel(configuration: configuration)
    }

    private struct PrimaryLabel: View {
        let configuration: Configuration
        @Environment(\.accessibilityReduceMotion) private var reduceMotion
        @Environment(\.isEnabled) private var isEnabled

        var body: some View {
            configuration.label
                .font(.system(.headline, design: .rounded, weight: .semibold))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 18)
                .padding(.vertical, 14)
                .frame(maxWidth: .infinity, minHeight: 54)
                .foregroundStyle(isEnabled ? WordbreakPalette.background : WordbreakPalette.secondary)
                .background(
                    isEnabled ? WordbreakPalette.green.opacity(configuration.isPressed ? 0.72 : 1) : WordbreakPalette.line,
                    in: RoundedRectangle(cornerRadius: 16, style: .continuous)
                )
                .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .scaleEffect(configuration.isPressed && !reduceMotion ? 0.985 : 1)
                .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: configuration.isPressed)
        }
    }
}
