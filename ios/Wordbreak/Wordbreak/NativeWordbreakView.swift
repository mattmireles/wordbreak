import SwiftUI

struct NativeWordbreakView: View {
    let viewModel: [String: Any]
    let send: ([String: Any]) -> Void
    @State private var answer = ""
    @FocusState private var answerFocused: Bool
    @ScaledMetric(relativeTo: .title) private var answerSize = 30.0
    @ScaledMetric(relativeTo: .largeTitle) private var solvedSize = 38.0
    @ScaledMetric(relativeTo: .title2) private var letterSize = 24.0

    private var screen: String { viewModel["screen"] as? String ?? "map" }
    private var phase: String { viewModel["phase"] as? String ?? "type" }
    private var unit: [String: Any] { viewModel["unit"] as? [String: Any] ?? [:] }
    private var words: [[String: Any]] { unit["words"] as? [[String: Any]] ?? [] }
    private var wordIndex: Int { viewModel["wordIdx"] as? Int ?? 0 }
    private var word: [String: Any] { words.indices.contains(wordIndex) ? words[wordIndex] : [:] }

    var body: some View {
        FillingScrollView { practice }
    }

    private var practice: some View {
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
                    primaryButton(phase == "patch" ? "Check" : "Choose a letter", action: commitAnswer)
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
                        .font(.system(size: solvedSize, weight: .bold, design: .rounded))
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
        // Already 30 pt at default size; a single word must stay on one line to be read as a spelling.
        TextField("Spell it", text: $answer)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .font(.system(size: answerSize, weight: .semibold, design: .rounded))
            .foregroundStyle(.white)
            .padding(.horizontal, 16)
            .frame(minHeight: 58)
            .background(WordbreakPalette.background.opacity(0.7), in: RoundedRectangle(cornerRadius: 15))
            .focused($answerFocused)
            .submitLabel(.done)
            .onSubmit(commitAnswer)
            .minimumScaleFactor(0.5)
            .dynamicTypeSize(...DynamicTypeSize.accessibility1)
            .accessibilityLabel("Your spelling")
            .accessibilityIdentifier("wordbreak.answer")
    }

    private var letterRow: some View {
        let letters = Array((viewModel["typed"] as? String ?? ""))
        let selected = viewModel["flagIdx"] as? Int
        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                ForEach(Array(letters.enumerated()), id: \.offset) { index, letter in
                    Button { send(["type": "word.setFlag", "index": index]) } label: {
                        Text(String(letter))
                            .font(.system(size: letterSize, weight: .bold, design: .monospaced))
                            .foregroundStyle(selected == index ? WordbreakPalette.background : .white)
                            .frame(minWidth: 44, minHeight: 52)
                            .padding(.horizontal, 2)
                            .background(selected == index ? WordbreakPalette.amber : WordbreakPalette.background, in: RoundedRectangle(cornerRadius: 12))
                    }
                    .accessibilityLabel("Letter \(String(letter)), position \(index + 1)")
                    .accessibilityAddTraits(selected == index ? .isSelected : [])
                }
            }
        }
    }

    private func commitAnswer() {
        guard phase == "type" || phase == "patch",
              !answer.trimmingCharacters(in: .whitespaces).isEmpty
        else { return }
        send(["type": phase == "patch" ? "word.commitPatch" : "word.commitTyped", "value": answer])
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
