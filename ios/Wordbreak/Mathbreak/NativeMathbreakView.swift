import SwiftUI

struct NativeMathbreakView: View {
    let viewModel: [String: Any]
    let send: ([String: Any]) -> Void
    @State private var answer = ""
    @State private var shownAt = Date()
    @FocusState private var answerFocused: Bool

    private var phase: String { viewModel["phase"] as? String ?? "attempt" }
    private var item: [String: Any] { viewModel["item"] as? [String: Any] ?? [:] }

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            PracticeHeader(
                eyebrow: "2 of 2 · Math",
                title: viewModel["screen"] as? String == "mathPlacement" ? "Find your starting point" : "Build the fact",
                progress: progress
            )
            PracticeCard {
                VStack(alignment: .leading, spacing: 22) {
                    Text(viewModel["prompt"] as? String ?? "")
                        .font(.system(size: 44, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, alignment: .center)
                    if phase == "bridge" { strategyChoices }
                    else { answerStep }
                }
            }
            Spacer()
            Text("Take the time you need.")
                .font(.system(.caption, design: .rounded))
                .foregroundStyle(WordbreakPalette.muted)
                .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, 22)
        .padding(.vertical, 24)
        .accessibilityIdentifier("mathbreak.practice")
        .onAppear { beginItem() }
        .onChange(of: viewModel["prompt"] as? String) { _, _ in beginItem() }
        .onChange(of: phase) { _, newPhase in
            answer = ""
            answerFocused = newPhase == "attempt" || newPhase == "retype"
        }
    }

    private var progress: String? {
        guard let position = viewModel["position"] as? Int, let total = viewModel["total"] as? Int else { return nil }
        return "\(position) / \(total)"
    }

    @ViewBuilder private var answerStep: some View {
        if phase == "retype" {
            Text("Now type the answer again.")
                .font(.system(.headline, design: .rounded))
                .foregroundStyle(WordbreakPalette.secondary)
        }
        TextField("Answer", text: $answer)
            .keyboardType(.numberPad)
            .font(.system(size: 34, weight: .bold, design: .rounded))
            .multilineTextAlignment(.center)
            .foregroundStyle(.white)
            .frame(height: 62)
            .background(WordbreakPalette.background.opacity(0.7), in: RoundedRectangle(cornerRadius: 15))
            .focused($answerFocused)
        Button(phase == "retype" ? "Check again" : "Check") {
            let value = Int(answer) ?? Int.min
            if phase == "retype" {
                send(["type": "answer.retype", "answer": value])
            } else {
                send([
                    "type": "answer.submit",
                    "answer": value,
                    "latencyMs": max(0, Int(Date().timeIntervalSince(shownAt) * 1_000)),
                ])
            }
        }
        .frame(maxWidth: .infinity, minHeight: 54)
        .buttonStyle(WordbreakPrimaryButtonStyle())
        .disabled(Int(answer) == nil)
    }

    private var strategyChoices: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let strategy = viewModel["strategy"] as? [String: Any] {
                Text(strategy["title"] as? String ?? "Find a helpful form")
                    .font(.system(.title3, design: .rounded, weight: .bold))
                    .foregroundStyle(.white)
                Text(strategy["construction"] as? String ?? "Choose the expression that keeps the value the same.")
                    .font(.system(.body, design: .rounded))
                    .foregroundStyle(WordbreakPalette.secondary)
            }
            ForEach(Array((viewModel["strategyChoices"] as? [[String: Any]] ?? []).enumerated()), id: \.offset) { _, choice in
                Button {
                    send(["type": "strategy.select", "choiceId": choice["id"] as? String ?? ""])
                } label: {
                    Text(choice["text"] as? String ?? "")
                        .font(.system(.headline, design: .rounded))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
                        .padding(.horizontal, 16)
                        .background(WordbreakPalette.background.opacity(0.72), in: RoundedRectangle(cornerRadius: 14))
                }
            }
        }
    }

    private func beginItem() {
        answer = ""
        shownAt = Date()
        answerFocused = phase == "attempt" || phase == "retype"
    }
}
