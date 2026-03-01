import SwiftUI

struct TournamentsView: View {
    @State private var tournaments: [TournamentGQL] = []
    @State private var searchText = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    private var filtered: [TournamentGQL] {
        if searchText.isEmpty { return tournaments }
        let q = searchText.lowercased()
        return tournaments.filter {
            $0.name.lowercased().contains(q) ||
            $0.city.lowercased().contains(q) ||
            $0.country.lowercased().contains(q)
        }
    }

    // Tournaments with followed players first
    private var sorted: [TournamentGQL] {
        filtered.sorted { $0.followedPlayersCount > $1.followedPlayersCount }
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && tournaments.isEmpty {
                    ProgressView("Loading tournaments...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error = errorMessage, tournaments.isEmpty {
                    ContentUnavailableView(
                        "Couldn't load tournaments",
                        systemImage: "wifi.exclamationmark",
                        description: Text(error)
                    )
                } else if sorted.isEmpty && !searchText.isEmpty {
                    ContentUnavailableView.search(text: searchText)
                } else {
                    List(sorted) { tournament in
                        TournamentRow(tournament: tournament)
                            .listRowInsets(EdgeInsets(top: 8, leading: 20, bottom: 8, trailing: 20))
                            .listRowSeparator(.automatic)
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Tournaments")
            .searchable(text: $searchText, prompt: "Search by city, name...")
            .refreshable { await loadTournaments() }
            .task { await loadTournaments() }
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    if isLoading { ProgressView().scaleEffect(0.7) }
                }
            }
        }
    }

    private func loadTournaments() async {
        isLoading = true
        defer { isLoading = false }
        errorMessage = nil
        do {
            tournaments = try await NetworkService.shared.fetchTournaments()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct TournamentRow: View {
    let tournament: TournamentGQL

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(tournament.name)
                        .font(.subheadline.weight(.semibold))
                    Text("\(tournament.city), \(tournament.country)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if tournament.followedPlayersCount > 0 {
                    Label("\(tournament.followedPlayersCount)", systemImage: "star.fill")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Color.beachSand)
                }
            }

            HStack(spacing: 8) {
                if let tier = tournament.tier {
                    Text(tier)
                        .font(.caption2.weight(.medium))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.beachSand.opacity(0.25))
                        .cornerRadius(4)
                }
                Text(dateRange(tournament.startDate, tournament.endDate))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

    private func dateRange(_ start: String, _ end: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let df = DateFormatter()
        df.dateFormat = "MMM d"
        let startStr = f.date(from: start).map { df.string(from: $0) } ?? start
        let endStr = f.date(from: end).map { df.string(from: $0) } ?? end
        return "\(startStr) – \(endStr)"
    }
}
