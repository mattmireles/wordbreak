import Foundation

@MainActor
final class MathbreakEngineBridge {
    private let host: JavaScriptEngineHost

    /// - Parameter clock: stamped onto every action as `nowMs`; defaults to the creation instant.
    init(
        store: WordbreakStateStore,
        bundle: Bundle = .main,
        now: Date = Date(),
        clock: (() -> Date)? = nil,
        timezone: TimeZone = .current,
        random: @escaping () -> Double = { Double.random(in: 0 ..< 1) }
    ) throws {
        host = try JavaScriptEngineHost(
            engine: "__mathbreakEngine",
            store: store,
            clock: clock ?? { now },
            writesSnapshots: false
        )
        let randomBlock: @convention(block) () -> Double = random
        host.set(randomBlock, "__mathbreakRandom")
        host.set(try host.savedState(), "__mathbreakStateJSON")
        host.set(now.timeIntervalSince1970 * 1_000, "__mathbreakNowMS")
        host.set(-timezone.secondsFromGMT(for: now) / 60, "__mathbreakTimezoneOffset")
        host.set(try host.loadResource("mathbreak-content", extension: "json", bundle: bundle), "__mathbreakContentJSON")

        try host.evaluate(host.loadResource("mathbreak-core", extension: "js", bundle: bundle))
        try host.evaluate(
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
        try host.dispatch(action)
    }
}
