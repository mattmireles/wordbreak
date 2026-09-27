import Foundation
import JavaScriptCore

@MainActor
final class MathbreakEngineBridge {
    private let context: JSContext
    private let store: WordbreakStateStore
    private let randomBlock: @convention(block) () -> Double

    init(
        store: WordbreakStateStore,
        bundle: Bundle = .main,
        now: Date = Date(),
        timezone: TimeZone = .current,
        random: @escaping () -> Double = { Double.random(in: 0 ..< 1) }
    ) throws {
        guard let context = JSContext() else {
            throw WordbreakEngineError.javascript("JavaScriptCore context creation failed")
        }
        self.context = context
        self.store = store
        randomBlock = random
        context.setObject(randomBlock, forKeyedSubscript: "__mathbreakRandom" as NSString)

        let stateData = try store.readState() ?? Data("{}".utf8)
        guard let stateJSON = String(data: stateData, encoding: .utf8) else {
            throw WordbreakEngineError.invalidStateEncoding
        }
        context.setObject(stateJSON, forKeyedSubscript: "__mathbreakStateJSON" as NSString)
        context.setObject(now.timeIntervalSince1970 * 1_000, forKeyedSubscript: "__mathbreakNowMS" as NSString)
        context.setObject(
            -timezone.secondsFromGMT(for: now) / 60,
            forKeyedSubscript: "__mathbreakTimezoneOffset" as NSString
        )

        try evaluateResource("mathbreak-core", extension: "js", bundle: bundle)
        guard let contentURL = bundle.url(forResource: "mathbreak-content", withExtension: "json") else {
            throw WordbreakEngineError.missingResource("mathbreak-content.json")
        }
        let contentJSON = try String(contentsOf: contentURL, encoding: .utf8)
        context.setObject(contentJSON, forKeyedSubscript: "__mathbreakContentJSON" as NSString)
        try evaluate(
            """
            globalThis.__mathbreakEngine = MathbreakCore.create({
              stateJson: __mathbreakStateJSON,
              content: JSON.parse(__mathbreakContentJSON),
              nowMs: __mathbreakNowMS,
              timezoneOffsetMinutes: __mathbreakTimezoneOffset,
              random: __mathbreakRandom
            });
            """
        )
    }

    func dispatch(_ action: [String: Any]) throws -> WordbreakEngineOutput {
        let actionData = try JSONSerialization.data(withJSONObject: action, options: [.sortedKeys])
        context.setObject(String(decoding: actionData, as: UTF8.self), forKeyedSubscript: "__mathbreakActionJSON" as NSString)
        let value = try evaluate("JSON.stringify(__mathbreakEngine.dispatch(JSON.parse(__mathbreakActionJSON)))")
        guard let outputJSON = value.toString(),
              let outputData = outputJSON.data(using: .utf8),
              let envelope = try JSONSerialization.jsonObject(with: outputData) as? [String: Any],
              let stateJSON = envelope["stateJson"] as? String,
              let viewModel = envelope["viewModel"] as? [String: Any],
              let effects = envelope["effects"] as? [[String: Any]],
              let semanticEvents = envelope["semanticEvents"] as? [[String: Any]]
        else {
            throw WordbreakEngineError.invalidEngineOutput
        }

        do {
            try store.writeStateAtomically(Data(stateJSON.utf8))
        } catch {
            _ = try? evaluate("__mathbreakEngine.discard()")
            throw error
        }
        context.setObject(stateJSON, forKeyedSubscript: "__mathbreakPendingStateJSON" as NSString)
        _ = try evaluate("__mathbreakEngine.accept(__mathbreakPendingStateJSON)")
        return WordbreakEngineOutput(
            stateJSON: stateJSON,
            viewModel: viewModel,
            effects: effects,
            semanticEvents: semanticEvents
        )
    }

    private func evaluateResource(_ name: String, extension fileExtension: String, bundle: Bundle) throws {
        guard let url = bundle.url(forResource: name, withExtension: fileExtension) else {
            throw WordbreakEngineError.missingResource("\(name).\(fileExtension)")
        }
        try evaluate(String(contentsOf: url, encoding: .utf8))
    }

    @discardableResult
    private func evaluate(_ source: String) throws -> JSValue {
        context.exception = nil
        guard let value = context.evaluateScript(source) else {
            throw WordbreakEngineError.javascript("evaluation returned no value")
        }
        if let exception = context.exception {
            context.exception = nil
            throw WordbreakEngineError.javascript(exception.toString())
        }
        return value
    }
}
