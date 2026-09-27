import Foundation

/// Explicit, previewed import of browser Wordbreak progress: the observer panel's
/// `wordbreak-progress.json` export, or the raw `localStorage.wb2` value.
///
/// The pasted bytes are never written directly. They go through the shared reducer's own
/// `progress.import` action in a throwaway engine (validation, field-pack quarantine, state
/// normalization), so the stored snapshot is exactly what the reducer would persist.
/// The summary counts are read-only display; the ledger itself stays opaque.
@MainActor
enum WebProgressImport {
    struct Summary: Equatable {
        var modulesRead = 0
        var modulesCleared = 0
        var wordsScheduled = 0
        var sessionsCompleted = 0

        init(stateJSON: String?) {
            guard let stateJSON,
                  let object = try? JSONSerialization.jsonObject(with: Data(stateJSON.utf8)) as? [String: Any]
            else { return }
            modulesRead = (object["docs"] as? [String: Any])?.count ?? 0
            modulesCleared = (object["cleared"] as? [String: Any])?.count ?? 0
            wordsScheduled = (object["sched"] as? [String: Any])?.count ?? 0
            sessionsCompleted = (object["sessions"] as? [[String: Any]])?
                .filter { $0["status"] as? String == "completed" }.count ?? 0
        }
    }

    struct Prepared {
        let state: Data
        let viewModel: Data
        let summary: Summary
    }

    enum ImportError: LocalizedError {
        case notProgress

        var errorDescription: String? {
            "That doesn’t look like Wordbreak progress. Use the web app’s “export progress” file."
        }
    }

    private final class MemoryStore: WordbreakStateStore {
        var data: Data?
        init(_ data: Data) { self.data = data }
        func readState() throws -> Data? { data }
        func writeStateAtomically(_ data: Data) throws { self.data = data }
    }

    static func prepare(_ text: String, bundle: Bundle = .main) throws -> Prepared {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let parsed = try? JSONSerialization.jsonObject(with: Data(trimmed.utf8)) as? [String: Any] else {
            throw ImportError.notProgress
        }
        // Unwrap the observer export envelope ({format: "wordbreak-progress", version: 1, wb2}).
        let object = parsed["format"] as? String == "wordbreak-progress" ? parsed["wb2"] as? [String: Any] ?? [:] : parsed
        guard ["docs", "cleared", "sched", "sessions"].contains(where: { object[$0] != nil })
        else { throw ImportError.notProgress }
        let engine = try WordbreakEngineBridge(store: MemoryStore(Data("{}".utf8)), bundle: bundle)
        let output = try engine.dispatch(["type": "progress.import", "state": object])
        return Prepared(
            state: Data(output.stateJSON.utf8),
            viewModel: try JSONSerialization.data(withJSONObject: output.viewModel, options: [.sortedKeys]),
            summary: Summary(stateJSON: output.stateJSON)
        )
    }

    static func currentSummary(store: WordbreakStateStore) -> Summary {
        Summary(stateJSON: (try? store.readState()).flatMap { String(data: $0, encoding: .utf8) })
    }

    /// Replaces native Wordbreak progress in one atomic snapshot write. Mathbreak is untouched.
    static func commit(_ prepared: Prepared, to store: WordbreakSnapshotStateStore) throws {
        try store.writeSnapshotAtomically(state: prepared.state, viewModel: prepared.viewModel)
    }
}
