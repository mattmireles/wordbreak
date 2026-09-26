#if DEBUG
import SwiftUI

@MainActor
private final class ProductionCaptureSmokeModel: ObservableObject {
    @Published private(set) var status = "Preparing production capture…"
    @Published private(set) var verdict: String?

    private let capture = CaptureCoordinator()

    func run() {
        guard verdict == nil else { return }
        Task {
            do {
                let sessionId = "capture-smoke-\(UUID().uuidString.lowercased())"
                _ = try await capture.start(sessionId: sessionId, reason: "start")
                status = "Recording production tracks locally…"
                let requested = ProcessInfo.processInfo.environment["WORDBREAK_CAPTURE_SMOKE_SECONDS"]
                    .flatMap(Double.init) ?? 10
                try await Task.sleep(for: .seconds(max(5, requested)))
                let segment = try await capture.stop(reason: "completion")
                let tracks = Set(segment.objects.map(\.track))
                let required = Set(["screen", "frontCamera", "microphone"])
                let passed = required.isSubset(of: tracks) && segment.errors.isEmpty
                verdict = passed ? "PASS" : "NEEDS WORK"
                status = passed
                    ? "Separate screen, front camera, and microphone files were sealed and hashed."
                    : "Missing: \(required.subtracting(tracks).sorted().joined(separator: ", ")). \(segment.errors.joined(separator: " "))"
            } catch {
                verdict = "NEEDS WORK"
                status = error.localizedDescription
            }
        }
    }
}

struct ProductionCaptureSmokeView: View {
    @StateObject private var model = ProductionCaptureSmokeModel()

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: model.verdict == "PASS" ? "checkmark.circle.fill" : "record.circle")
                .font(.system(size: 52))
                .foregroundStyle(model.verdict == "PASS" ? .green : .red)
            Text(model.verdict ?? "CAPTURE CHECK")
                .font(.system(.title2, design: .rounded, weight: .bold))
                .accessibilityIdentifier("productionCapture.verdict")
            Text(model.status)
                .multilineTextAlignment(.center)
                .accessibilityIdentifier("productionCapture.status")
        }
        .padding(28)
        .task { model.run() }
    }
}
#endif
