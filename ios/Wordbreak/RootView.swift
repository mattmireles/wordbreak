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
    static let muted = Color.white.opacity(0.43)
}

struct WordbreakPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(.headline, design: .rounded, weight: .semibold))
            .foregroundStyle(WordbreakPalette.background)
            .background(WordbreakPalette.green.opacity(configuration.isPressed ? 0.72 : 1), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
