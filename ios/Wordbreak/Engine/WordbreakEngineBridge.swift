import Foundation
import JavaScriptCore

protocol WordbreakStateStore: AnyObject {
    func readState() throws -> Data?
    func writeStateAtomically(_ data: Data) throws
}

protocol WordbreakSnapshotStateStore: WordbreakStateStore {
    func readViewModel() throws -> Data?
    func writeSnapshotAtomically(state: Data, viewModel: Data) throws
}

final class WordbreakFileStateStore: WordbreakSnapshotStateStore {
    private let stateURL: URL

    init(stateURL: URL) {
        self.stateURL = stateURL
    }

    static func appGroup() throws -> WordbreakFileStateStore {
        try appGroup(filename: "wb2.json")
    }

    static func appGroup(filename: String) throws -> WordbreakFileStateStore {
        guard let root = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.com.mattmireles.wordbreak"
        ) else {
            throw WordbreakEngineError.stateStoreUnavailable
        }
        return WordbreakFileStateStore(stateURL: root.appending(path: "state/\(filename)"))
    }

    func readState() throws -> Data? {
        guard FileManager.default.fileExists(atPath: stateURL.path) else { return nil }
        let data = try Data(contentsOf: stateURL)
        guard let wrapper = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              wrapper["format"] as? String == "wordbreak.snapshot.v1",
              let stateJSON = wrapper["stateJson"] as? String
        else { return data }
        return Data(stateJSON.utf8)
    }

    func readViewModel() throws -> Data? {
        guard FileManager.default.fileExists(atPath: stateURL.path) else { return nil }
        let data = try Data(contentsOf: stateURL)
        guard let wrapper = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              wrapper["format"] as? String == "wordbreak.snapshot.v1",
              let viewModel = wrapper["viewModel"]
        else { return nil }
        return try JSONSerialization.data(withJSONObject: viewModel, options: [.sortedKeys])
    }

    func writeStateAtomically(_ data: Data) throws {
        try FileManager.default.createDirectory(
            at: stateURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try data.write(to: stateURL, options: [.atomic, .completeFileProtection])
    }

    func writeSnapshotAtomically(state: Data, viewModel: Data) throws {
        let viewObject = try JSONSerialization.jsonObject(with: viewModel)
        let wrapper: [String: Any] = [
            "format": "wordbreak.snapshot.v1",
            "stateJson": String(decoding: state, as: UTF8.self),
            "viewModel": viewObject,
        ]
        let data = try JSONSerialization.data(withJSONObject: wrapper, options: [.sortedKeys])
        try writeStateAtomically(data)
    }
}

enum WordbreakEngineError: Error, LocalizedError {
    case missingResource(String)
    case invalidStateEncoding
    case invalidEngineOutput
    case javascript(String)
    case stateStoreUnavailable

    var errorDescription: String? {
        switch self {
        case let .missingResource(name): "Missing bundled engine resource: \(name)"
        case .invalidStateEncoding: "The saved Wordbreak state is not UTF-8 JSON."
        case .invalidEngineOutput: "The Wordbreak engine returned an invalid envelope."
        case let .javascript(message): "Wordbreak engine error: \(message)"
        case .stateStoreUnavailable: "The shared Wordbreak state container is unavailable."
        }
    }
}

struct WordbreakEngineOutput {
    let stateJSON: String
    let viewModel: [String: Any]
    let effects: [[String: Any]]
    let semanticEvents: [[String: Any]]
}

@MainActor
final class WordbreakEngineBridge {
    private let context: JSContext
    private let store: WordbreakStateStore
    private let randomBlock: @convention(block) () -> Double
    private let uuidBlock: @convention(block) () -> String

    init(
        store: WordbreakStateStore,
        bundle: Bundle = .main,
        now: Date = Date(),
        timezone: TimeZone = .current,
        random: @escaping () -> Double = { Double.random(in: 0 ..< 1) },
        uuid: @escaping () -> String = { UUID().uuidString.lowercased() }
    ) throws {
        guard let context = JSContext() else {
            throw WordbreakEngineError.javascript("JavaScriptCore context creation failed")
        }
        self.context = context
        self.store = store
        randomBlock = random
        uuidBlock = uuid

        context.setObject(randomBlock, forKeyedSubscript: "__wordbreakRandom" as NSString)
        context.setObject(uuidBlock, forKeyedSubscript: "__wordbreakUUID" as NSString)

        let stateData = try store.readState() ?? Data("{}".utf8)
        guard let stateJSON = String(data: stateData, encoding: .utf8) else {
            throw WordbreakEngineError.invalidStateEncoding
        }
        context.setObject(stateJSON, forKeyedSubscript: "__wordbreakStateJSON" as NSString)
        if let snapshotStore = store as? WordbreakSnapshotStateStore,
           let viewData = try snapshotStore.readViewModel(),
           let viewJSON = String(data: viewData, encoding: .utf8)
        {
            context.setObject(viewJSON, forKeyedSubscript: "__wordbreakViewModelJSON" as NSString)
        } else {
            context.setObject(nil, forKeyedSubscript: "__wordbreakViewModelJSON" as NSString)
        }
        context.setObject(now.timeIntervalSince1970 * 1_000, forKeyedSubscript: "__wordbreakNowMS" as NSString)
        context.setObject(timezone.secondsFromGMT(for: now) / -60, forKeyedSubscript: "__wordbreakTimezoneOffset" as NSString)

        try evaluateResource("wordbreak-content", bundle: bundle)
        try evaluateResource("wordbreak-core", bundle: bundle)
        try evaluate(
            """
            globalThis.__wordbreakEngine = WordbreakCore.create({
              stateJson: __wordbreakStateJSON,
              content: createWordbreakContent(2),
              nowMs: __wordbreakNowMS,
              timezoneOffsetMinutes: __wordbreakTimezoneOffset,
              random: __wordbreakRandom,
              uuid: __wordbreakUUID,
              viewModel: __wordbreakViewModelJSON ? JSON.parse(__wordbreakViewModelJSON) : null
            });
            """
        )
    }

    func dispatch(_ action: [String: Any]) throws -> WordbreakEngineOutput {
        let actionData = try JSONSerialization.data(withJSONObject: action, options: [.sortedKeys])
        guard let actionJSON = String(data: actionData, encoding: .utf8) else {
            throw WordbreakEngineError.invalidEngineOutput
        }
        context.setObject(actionJSON, forKeyedSubscript: "__wordbreakActionJSON" as NSString)
        let value = try evaluate(
            "JSON.stringify(__wordbreakEngine.dispatch(JSON.parse(__wordbreakActionJSON)))"
        )
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
            let stateData = Data(stateJSON.utf8)
            if let snapshotStore = store as? WordbreakSnapshotStateStore {
                let viewData = try JSONSerialization.data(withJSONObject: viewModel, options: [.sortedKeys])
                try snapshotStore.writeSnapshotAtomically(state: stateData, viewModel: viewData)
            } else {
                try store.writeStateAtomically(stateData)
            }
        } catch {
            _ = try? evaluate("__wordbreakEngine.discard()")
            throw error
        }

        context.setObject(stateJSON, forKeyedSubscript: "__wordbreakPendingStateJSON" as NSString)
        _ = try evaluate("__wordbreakEngine.accept(__wordbreakPendingStateJSON)")
        return WordbreakEngineOutput(
            stateJSON: stateJSON,
            viewModel: viewModel,
            effects: effects,
            semanticEvents: semanticEvents
        )
    }

    private func evaluateResource(_ name: String, bundle: Bundle) throws {
        guard let url = bundle.url(forResource: name, withExtension: "js") else {
            throw WordbreakEngineError.missingResource("\(name).js")
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
