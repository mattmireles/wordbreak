import Foundation
import JavaScriptCore

/// The one JavaScriptCore host shared by the Wordbreak and Mathbreak bridges.
///
/// It owns the commit protocol both authored cores require: `dispatch` returns a pending
/// envelope, the host writes the returned state bytes atomically, and only then calls
/// `accept`; a failed write calls `discard` so the same action stays exactly retryable.
/// Each action carries the host clock as `nowMs`, because a bridge lives for a whole run and
/// the cores otherwise keep the clock they were created with.
@MainActor
final class JavaScriptEngineHost {
    private let context: JSContext
    private let engine: String
    private let store: WordbreakStateStore
    private let clock: () -> Date
    private let writesSnapshots: Bool
    private var retained: [Any] = []

    /// - Parameters:
    ///   - engine: the global the setup script assigns the created core to.
    ///   - writesSnapshots: persist the view model beside the state (Wordbreak resumes the exact
    ///     screen); otherwise only the opaque state bytes are written.
    init(engine: String, store: WordbreakStateStore, clock: @escaping () -> Date, writesSnapshots: Bool) throws {
        guard let context = JSContext() else {
            throw WordbreakEngineError.javascript("JavaScriptCore context creation failed")
        }
        self.context = context
        self.engine = engine
        self.store = store
        self.clock = clock
        self.writesSnapshots = writesSnapshots
    }

    func set(_ value: Any?, _ name: String) {
        if let value { retained.append(value) }
        context.setObject(value, forKeyedSubscript: name as NSString)
    }

    func savedState() throws -> String {
        let data = try store.readState() ?? Data("{}".utf8)
        guard let json = String(data: data, encoding: .utf8) else { throw WordbreakEngineError.invalidStateEncoding }
        return json
    }

    func savedViewModel() throws -> String? {
        guard writesSnapshots, let snapshots = store as? WordbreakSnapshotStateStore,
              let data = try snapshots.readViewModel()
        else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func loadResource(_ name: String, extension fileExtension: String, bundle: Bundle) throws -> String {
        guard let url = bundle.url(forResource: name, withExtension: fileExtension) else {
            throw WordbreakEngineError.missingResource("\(name).\(fileExtension)")
        }
        return try String(contentsOf: url, encoding: .utf8)
    }

    func dispatch(_ action: [String: Any]) throws -> WordbreakEngineOutput {
        var stamped = action
        stamped["nowMs"] = clock().timeIntervalSince1970 * 1_000
        let actionData = try JSONSerialization.data(withJSONObject: stamped, options: [.sortedKeys])
        context.setObject(String(decoding: actionData, as: UTF8.self), forKeyedSubscript: "__hostActionJSON" as NSString)
        let value = try evaluate("JSON.stringify(\(engine).dispatch(JSON.parse(__hostActionJSON)))")
        guard let outputJSON = value.toString(),
              let envelope = try JSONSerialization.jsonObject(with: Data(outputJSON.utf8)) as? [String: Any],
              let stateJSON = envelope["stateJson"] as? String,
              let viewModel = envelope["viewModel"] as? [String: Any],
              let effects = envelope["effects"] as? [[String: Any]],
              let semanticEvents = envelope["semanticEvents"] as? [[String: Any]]
        else {
            throw WordbreakEngineError.invalidEngineOutput
        }

        do {
            let stateData = Data(stateJSON.utf8)
            if writesSnapshots, let snapshots = store as? WordbreakSnapshotStateStore {
                let viewData = try JSONSerialization.data(withJSONObject: viewModel, options: [.sortedKeys])
                try snapshots.writeSnapshotAtomically(state: stateData, viewModel: viewData)
            } else {
                try store.writeStateAtomically(stateData)
            }
        } catch {
            _ = try? evaluate("\(engine).discard()")
            throw error
        }

        context.setObject(stateJSON, forKeyedSubscript: "__hostPendingStateJSON" as NSString)
        _ = try evaluate("\(engine).accept(__hostPendingStateJSON)")
        return WordbreakEngineOutput(
            stateJSON: stateJSON,
            viewModel: viewModel,
            effects: effects,
            semanticEvents: semanticEvents
        )
    }

    @discardableResult
    func evaluate(_ source: String) throws -> JSValue {
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
