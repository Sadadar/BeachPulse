import Foundation

/// Persists user preferences across launches.
/// All times returned to the UI should go through `formatMatchTime(_:)`.
final class SettingsStore: ObservableObject {

    static let shared = SettingsStore()

    // MARK: - Published preferences

    /// IANA timezone identifier used for displaying match times (e.g. "America/Los_Angeles").
    /// Defaults to the device's current timezone, falling back to PST if unavailable.
    @Published var displayTimezone: String {
        didSet { UserDefaults.standard.set(displayTimezone, forKey: Keys.displayTimezone) }
    }

    // MARK: - Init

    private init() {
        // Restore saved preference or detect device timezone
        if let saved = UserDefaults.standard.string(forKey: Keys.displayTimezone), !saved.isEmpty {
            self.displayTimezone = saved
        } else {
            // Use device timezone, fall back to PST if the identifier is empty
            let deviceId = TimeZone.current.identifier
            self.displayTimezone = deviceId.isEmpty ? "America/Los_Angeles" : deviceId
        }
    }

    // MARK: - Helpers

    /// Format a UTC ISO8601 match time string for display in the user's chosen timezone.
    /// Returns a short localized string, e.g. "Jun 15, 9:00 AM".
    /// Returns the raw string unchanged if it cannot be parsed.
    func formatMatchTime(_ utcIso: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: utcIso) else {
            return utcIso
        }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        if let tz = TimeZone(identifier: displayTimezone) {
            formatter.timeZone = tz
        }
        return formatter.string(from: date)
    }

    /// Reset to device timezone.
    func resetToDeviceTimezone() {
        let deviceId = TimeZone.current.identifier
        displayTimezone = deviceId.isEmpty ? "America/Los_Angeles" : deviceId
    }

    // MARK: - UserDefaults keys

    private enum Keys {
        static let displayTimezone = "displayTimezone"
    }
}
