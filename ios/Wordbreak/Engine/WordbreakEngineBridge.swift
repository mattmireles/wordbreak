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
            forSecurityApplicationGroupIdentifier: DailyCoordinationStore.appGroup
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
    private let host: JavaScriptEngineHost

    /// - Parameter clock: stamped onto every action; defaults to the creation instant so golden
    ///   parity replays stay byte-identical. Live hosts pass a real clock.
    init(
        store: WordbreakStateStore,
        bundle: Bundle = .main,
        now: Date = Date(),
        clock: (() -> Date)? = nil,
        timezone: TimeZone = .current,
        random: @escaping () -> Double = { Double.random(in: 0 ..< 1) },
        uuid: @escaping () -> String = { UUID().uuidString.lowercased() }
    ) throws {
        host = try JavaScriptEngineHost(
            engine: "__wordbreakEngine",
            store: store,
            clock: clock ?? { now },
            writesSnapshots: true
        )
        let randomBlock: @convention(block) () -> Double = random
        let uuidBlock: @convention(block) () -> String = uuid
        host.set(randomBlock, "__wordbreakRandom")
        host.set(uuidBlock, "__wordbreakUUID")
        host.set(try host.savedState(), "__wordbreakStateJSON")
        host.set(try host.savedViewModel(), "__wordbreakViewModelJSON")
        host.set(now.timeIntervalSince1970 * 1_000, "__wordbreakNowMS")
        host.set(timezone.secondsFromGMT(for: now) / -60, "__wordbreakTimezoneOffset")

        try host.evaluate(host.loadResource("wordbreak-content", extension: "js", bundle: bundle))
        try host.evaluate(host.loadResource("wordbreak-core", extension: "js", bundle: bundle))
        try host.evaluate(
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
        try host.dispatch(action)
    }
}
