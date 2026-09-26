import SwiftUI

struct CaptureSpikeView: View {
    let autoStart: Bool
    @StateObject private var model = CaptureSpikeModel()
    @State private var attemptedAutoStart = false

    init(autoStart: Bool = false) {
        self.autoStart = autoStart
    }

    var body: some View {
        ZStack {
            WordbreakPalette.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 7) {
                        Text("PARENT CHECK")
                            .font(.system(.caption, design: .monospaced, weight: .semibold))
                            .tracking(2)
                            .foregroundStyle(WordbreakPalette.amber)
                        Text("Can this phone see the whole session?")
                            .font(.system(size: 31, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                        Text("This fifteen-minute run measures screen, app audio, microphone, and the front camera together. It does not upload anything.")
                            .font(.system(.body, design: .rounded))
                            .foregroundStyle(WordbreakPalette.secondary)
                    }

                    VStack(spacing: 12) {
                        CaptureMetricRow(label: "screen", value: model.screenStatus)
                        CaptureMetricRow(label: "front camera", value: model.cameraStatus)
                        CaptureMetricRow(label: "microphone", value: model.microphoneStatus)
                        CaptureMetricRow(label: "app audio", value: model.appAudioStatus)
                    }
                    .padding(18)
                    .background(WordbreakPalette.panel, in: RoundedRectangle(cornerRadius: 20, style: .continuous))

                    if model.isRunning {
                        VStack(alignment: .leading, spacing: 10) {
                            ProgressView(value: model.progress)
                                .tint(WordbreakPalette.green)
                            HStack {
                                Text(model.elapsedLabel)
                                Spacer()
                                Text(model.targetDurationLabel)
                            }
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(WordbreakPalette.secondary)
                        }
                    }

                    if let message = model.message {
                        Text(message)
                            .font(.system(.callout, design: .monospaced))
                            .foregroundStyle(model.hasError ? Color.red.opacity(0.9) : WordbreakPalette.secondary)
                            .textSelection(.enabled)
                    }

                    if let verdict = model.verdict {
                        HStack {
                            Text("PHYSICAL CAPTURE")
                            Spacer()
                            Text(verdict)
                                .foregroundStyle(verdict == "PASS" ? WordbreakPalette.green : WordbreakPalette.amber)
                                .accessibilityIdentifier("capture.verdict")
                        }
                        .font(.system(.caption, design: .monospaced, weight: .semibold))
                        .padding(16)
                        .background(WordbreakPalette.panel, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .accessibilityElement(children: .combine)
                    }

                    Button {
                        model.isRunning ? model.stop() : model.start()
                    } label: {
                        Label(model.isRunning ? "Stop and save receipt" : "Begin 15-minute device check", systemImage: model.isRunning ? "stop.fill" : "record.circle")
                            .frame(maxWidth: .infinity, minHeight: 56)
                    }
                    .buttonStyle(WordbreakPrimaryButtonStyle())
                    .disabled(model.isBusy)
                    .accessibilityIdentifier("capture.toggle")
                }
                .padding(22)
            }
        }
        .navigationTitle("Device check")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(WordbreakPalette.background, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .onAppear {
            guard autoStart, !attemptedAutoStart else { return }
            attemptedAutoStart = true
            model.start()
        }
    }
}

private struct CaptureMetricRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.system(.body, design: .rounded))
                .foregroundStyle(.white)
            Spacer()
            Text(value)
                .font(.system(.caption, design: .monospaced, weight: .medium))
                .foregroundStyle(value == "waiting" ? WordbreakPalette.muted : WordbreakPalette.green)
        }
        .frame(minHeight: 32)
        .accessibilityElement(children: .combine)
    }
}
