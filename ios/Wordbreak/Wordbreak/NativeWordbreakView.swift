import SwiftUI

struct NativeWordbreakView: View {
    let viewModel: [String: Any]
    let send: ([String: Any]) -> Void
    @State private var answer = ""
    @FocusState private var answerFocused: Bool

    private var screen: String { viewModel["screen"] as? String ?? "map" }
    private var phase: String { viewModel["phase"] as? String ?? "type" }
    private var unit: [String: Any] { viewModel["unit"] as? [String: Any] ?? [:] }
    private var words: [[String: Any]] { unit["words"] as? [[String: Any]] ?? [] }
    private var wordIndex: Int { viewModel["wordIdx"] as? Int ?? 0 }
    private var word: [String: Any] { words.indices.contains(wordIndex) ? words[wordIndex] : [:] }

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            PracticeHeader(
                eyebrow: "1 of 2 · Words",
                title: screen == "docs" ? (unit["ti"] as? String ?? "See the pattern") : "Build the word",
                progress: screen == "run" && !words.isEmpty ? "\(wordIndex + 1) / \(words.count)" : nil
            )
            if screen == "docs" { lesson }
            else if screen == "run" { run }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 22)
        .padding(.vertical, 24)
        .accessibilityIdentifier("wordbreak.practice")
        .onChange(of: phase) { _, newPhase in
            if newPhase == "type" || newPhase == "patch" {
                answer = ""
                answerFocused = true
            }
        }
    }

    private var lesson: some View {
        ScrollView {
            PracticeCard {
                VStack(alignment: .leading, spacing: 18) {
                    ForEach(Array((unit["docs"] as? [[String: Any]] ?? []).enumerated()), id: \.offset) { _, page in
                        VStack(alignment: .leading, spacing: 7) {
                            Text(page["t"] as? String ?? "")
                                .font(.system(.title3, design: .rounded, weight: .semibold))
                                .foregroundStyle(.white)
                            Text(plainText(page["b"] as? String ?? page["cue"] as? String ?? ""))
                                .font(.system(.body, design: .rounded))
                                .foregroundStyle(WordbreakPalette.secondary)
                        }
                    }
                    Button("Try the words") { send(["type": "docs.complete"]) }
                        .frame(maxWidth: .infinity, minHeight: 54)
                        .buttonStyle(WordbreakPrimaryButtonStyle())
                }
            }
        }
    }

    @ViewBuilder private var run: some View {
        PracticeCard {
            VStack(alignment: .leading, spacing: 20) {
                if let prompt = (word["p"] as? [String: Any])?["s"] as? String {
                    Text(prompt)
                        .font(.system(.body, design: .rounded, weight: .medium))
                        .foregroundStyle(WordbreakPalette.secondary)
                }
                switch phase {
                case "type", "patch":
                    Text(phase == "patch" ? "Build it once more." : "Type the whole word.")
                        .font(.system(.title3, design: .rounded, weight: .semibold))
                        .foregroundStyle(.white)
                    answerField
                    primaryButton(phase == "patch" ? "Check" : "Choose a letter") {
                        send(["type": phase == "patch" ? "word.commitPatch" : "word.commitTyped", "value": answer])
                    }
                    .disabled(answer.trimmingCharacters(in: .whitespaces).isEmpty)
                case "flag":
                    Text("Which letter or seam deserves a second look?")
                        .font(.system(.title3, design: .rounded, weight: .semibold))
                        .foregroundStyle(.white)
                    letterRow
                    primaryButton("Check the word") { send(["type": "word.execute"]) }
                        .disabled(viewModel["flagIdx"] is NSNull || viewModel["flagIdx"] == nil)
                case "fork":
                    Text((viewModel["firstClean"] as? Bool) == true ? "The spelling is right." : "Now repair the word.")
                        .font(.system(.title2, design: .rounded, weight: .bold))
                        .foregroundStyle(.white)
                    Text(plainText((word["fork"] as? [String: Any])?["vd"] as? String ?? "Look at the meaningful parts, then build it again."))
                        .font(.system(.body, design: .rounded))
                        .foregroundStyle(WordbreakPalette.secondary)
                    primaryButton((viewModel["firstClean"] as? Bool) == true ? "I see it" : "Fix it") {
                        send(["type": (viewModel["firstClean"] as? Bool) == true ? "word.confirmDone" : "word.toPatch"])
                    }
                case "done":
                    Text(word["a"] as? String ?? "Done")
                        .font(.system(size: 38, weight: .bold, design: .rounded))
                        .foregroundStyle(WordbreakPalette.green)
                    Text("Good. Keep moving.")
                        .font(.system(.body, design: .rounded))
                        .foregroundStyle(WordbreakPalette.secondary)
                    primaryButton("Next") { send(["type": "word.advance"]) }
                default:
                    EmptyView()
                }
            }
        }
    }

    private var answerField: some View {
        TextField("Your answer", text: $answer)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .font(.system(size: 30, weight: .semibold, design: .rounded))
            .foregroundStyle(.white)
            .padding(.horizontal, 16)
            .frame(height: 58)
            .background(WordbreakPalette.background.opacity(0.7), in: RoundedRectangle(cornerRadius: 15))
            .focused($answerFocused)
            .submitLabel(.done)
    }

    private var letterRow: some View {
        let letters = Array((viewModel["typed"] as? String ?? ""))
        let selected = viewModel["flagIdx"] as? Int
        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                ForEach(Array(letters.enumerated()), id: \.offset) { index, letter in
                    Button { send(["type": "word.setFlag", "index": index]) } label: {
                        Text(String(letter))
                            .font(.system(size: 24, weight: .bold, design: .monospaced))
                            .foregroundStyle(selected == index ? WordbreakPalette.background : .white)
                            .frame(width: 43, height: 52)
                            .background(selected == index ? WordbreakPalette.amber : WordbreakPalette.background, in: RoundedRectangle(cornerRadius: 12))
                    }
                    .accessibilityLabel("Letter \(String(letter)), position \(index + 1)")
                }
            }
        }
    }

    private func primaryButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(title, action: action)
            .frame(maxWidth: .infinity, minHeight: 54)
            .buttonStyle(WordbreakPrimaryButtonStyle())
    }

    private func plainText(_ html: String) -> String {
        html.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
            .replacingOccurrences(of: "&nbsp;", with: " ")
    }
}
