import Foundation

/// Versioned daily coordination state shared by the app and the DeviceActivity monitor extension.
///
/// This file owns the one daily completion bit and the daily nudge ledger. Wordbreak and
/// Mathbreak progress live in their own engine-owned files and are never mirrored here.
/// Both processes read-modify-write through `NSFileCoordinator` so an extension callback and
/// an app completion cannot overwrite each other, and every write is atomic.
struct DailyCoordinationState: Codable, Equatable {
    struct LocalTime: Codable, Equatable {
        var hour: Int
        var minute: Int

        var minutesAfterMidnight: Int { hour * 60 + minute }
    }

    /// Per-local-day nudge ledger. One entry covers every route into the same session.
    struct DayLedger: Codable, Equatable {
        var opportunityDelivered = false
    }

    static let currentVersion = 1
    static let defaultAfternoon = LocalTime(hour: 16, minute: 0)
    static let defaultEvening = LocalTime(hour: 19, minute: 30)

    var version = Self.currentVersion
    var completedDay: String?
    var afternoon = Self.defaultAfternoon
    var evening = Self.defaultEvening
    var days: [String: DayLedger] = [:]

    func ledger(for day: String) -> DayLedger { days[day] ?? DayLedger() }

    /// Keeps the ledger bounded; reminders are never scheduled more than 14 days ahead.
    mutating func prune(keepingFrom oldestDay: String) {
        days = days.filter { $0.key >= oldestDay }
    }
}

enum DailyNudgePolicy {
    /// Identifier prefix shared by scheduled reminders and the Screen Time nudge.
    static let notificationPrefix = "wordbreak.daily."

    enum Slot: String, CaseIterable {
        case afternoon
        case evening
    }

    static func dayKey(_ date: Date, calendar: Calendar = .current) -> String {
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return String(
            format: "%04d-%02d-%02d",
            components.year ?? 0,
            components.month ?? 0,
            components.day ?? 0
        )
    }

    /// A scheduled reminder is suppressed on a completed day, and the afternoon reminder is
    /// suppressed once the Screen Time opportunity nudge has already spoken for that day.
    static func shouldSchedule(_ slot: Slot, day: String, state: DailyCoordinationState) -> Bool {
        guard state.completedDay != day else { return false }
        return !(slot == .afternoon && state.ledger(for: day).opportunityDelivered)
    }

    /// The Screen Time opportunity may speak once, in the hour before the afternoon reminder,
    /// only while today's practice is unfinished.
    static func shouldDeliverOpportunity(
        now: Date,
        state: DailyCoordinationState,
        calendar: Calendar = .current
    ) -> Bool {
        let today = dayKey(now, calendar: calendar)
        let components = calendar.dateComponents([.hour, .minute], from: now)
        let minute = (components.hour ?? 0) * 60 + (components.minute ?? 0)
        let windowEnd = state.afternoon.minutesAfterMidnight
        return state.completedDay != today
            && !state.ledger(for: today).opportunityDelivered
            && minute >= windowEnd - 60
            && minute < windowEnd
    }
}

final class DailyCoordinationStore {
    static let appGroup = "group.com.mattmireles.wordbreak"

    private let url: URL

    init(url: URL) {
        self.url = url
    }

    static func shared() throws -> DailyCoordinationStore {
        guard let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
            throw CocoaError(.fileNoSuchFile, userInfo: [NSLocalizedDescriptionKey: "The shared practice container is unavailable."])
        }
        return DailyCoordinationStore(url: root.appending(path: "state/daily.v1.json"))
    }

    func read() -> DailyCoordinationState {
        var result = DailyCoordinationState()
        var coordinationError: NSError?
        NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &coordinationError) { readURL in
            result = Self.load(readURL)
        }
        return result
    }

    /// Atomically applies `change` and returns the committed state.
    @discardableResult
    func update(_ change: (inout DailyCoordinationState) -> Void) throws -> DailyCoordinationState {
        var committed = DailyCoordinationState()
        var writeError: Error?
        var coordinationError: NSError?
        NSFileCoordinator().coordinate(writingItemAt: url, options: [], error: &coordinationError) { writeURL in
            do {
                var state = Self.load(writeURL)
                change(&state)
                try FileManager.default.createDirectory(
                    at: writeURL.deletingLastPathComponent(),
                    withIntermediateDirectories: true
                )
                let encoder = JSONEncoder()
                encoder.outputFormatting = [.sortedKeys]
                // No complete-file protection: the monitor extension must read this while locked.
                try encoder.encode(state).write(to: writeURL, options: [.atomic])
                committed = state
            } catch {
                writeError = error
            }
        }
        if let error = writeError ?? coordinationError { throw error }
        return committed
    }

    private static func load(_ url: URL) -> DailyCoordinationState {
        guard let data = try? Data(contentsOf: url) else { return DailyCoordinationState() }
        if let state = try? JSONDecoder().decode(DailyCoordinationState.self, from: data),
           state.version == DailyCoordinationState.currentVersion
        {
            return state
        }
        // Unreadable or future-version bytes are set aside, never silently overwritten.
        let quarantine = url.deletingPathExtension().appendingPathExtension("unreadable-\(Int(Date().timeIntervalSince1970)).json")
        try? FileManager.default.moveItem(at: url, to: quarantine)
        return DailyCoordinationState()
    }
}
