import SwiftUI

struct FeedView: View {
    @StateObject private var followStore = FollowStore.shared
    @State private var feed: FeedDataGQL?
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && feed == nil {
                    ProgressView("Loading feed...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error = errorMessage, feed == nil {
                    ContentUnavailableView(
                        "Couldn't load feed",
                        systemImage: "wifi.exclamationmark",
                        description: Text(error)
                    )
                } else {
                    feedContent
                }
            }
            .navigationTitle("Feed")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    if isLoading { ProgressView().scaleEffect(0.7) }
                }
            }
            .refreshable { await loadFeed() }
            .task { await loadFeed() }
        }
    }

    // MARK: - Feed sections

    private var feedContent: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                if followStore.followedIds.isEmpty {
                    emptyFollowingPrompt
                } else {
                    // Live now
                    if let live = feed?.live, !live.isEmpty {
                        SectionHeader(title: "Live Now", accent: .oceanBlue)
                        ForEach(live) { match in
                            MatchCard(match: match, isLive: true)
                        }
                    }

                    // This week
                    if let upcoming = feed?.upcoming, !upcoming.isEmpty {
                        SectionHeader(title: "This Week")
                        ForEach(upcoming) { match in
                            MatchCard(match: match, isLive: false)
                        }
                    }

                    // Recent results
                    if let recent = feed?.recent, !recent.isEmpty {
                        SectionHeader(title: "Recent Results")
                        ForEach(recent) { match in
                            MatchCard(match: match, isLive: false)
                        }
                    }

                    // Other active tournaments
                    if let others = feed?.tournamentsWithoutFollowedPlayers, !others.isEmpty {
                        SectionHeader(title: "Also This Week")
                        ForEach(others) { tournament in
                            OtherTournamentRow(tournament: tournament)
                        }
                    }

                    if feed?.live.isEmpty == true && feed?.upcoming.isEmpty == true && feed?.recent.isEmpty == true {
                        noActivityView
                    }
                }
            }
            .padding(.bottom, 20)
        }
    }

    private var emptyFollowingPrompt: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.badge.plus")
                .font(.system(size: 48))
                .foregroundStyle(Color.beachSand)
            Text("Follow players to see their matches here")
                .font(.headline)
                .multilineTextAlignment(.center)
            Text("Go to the Players tab to find and follow players.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(40)
    }

    private var noActivityView: some View {
        VStack(spacing: 8) {
            Text("Nothing happening this week")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(32)
    }

    // MARK: - Data loading

    private func loadFeed() async {
        isLoading = true
        defer { isLoading = false }
        errorMessage = nil
        do {
            let ids = Array(followStore.followedIds)
            feed = try await NetworkService.shared.fetchFeed(playerIds: ids)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Supporting Views

struct SectionHeader: View {
    let title: String
    var accent: Color = .primary

    var body: some View {
        Text(title)
            .font(.title3.weight(.semibold))
            .foregroundStyle(accent)
            .padding(.horizontal, 20)
            .padding(.top, 24)
            .padding(.bottom, 8)
    }
}

struct MatchCard: View {
    let match: MatchGQL
    let isLive: Bool

    private var timeString: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: match.scheduledAt) {
            let display = DateFormatter()
            display.dateStyle = .none
            display.timeStyle = .short
            display.doesRelativeDateFormatting = true
            return display.string(from: date)
        }
        return match.scheduledAt
    }

    var body: some View {
        HStack(spacing: 12) {
            // Live indicator
            if isLive {
                Circle()
                    .fill(Color.oceanBlue)
                    .frame(width: 8, height: 8)
            }

            VStack(alignment: .leading, spacing: 4) {
                // Teams
                HStack {
                    Text(teamLabel(match.team1))
                        .font(.subheadline.weight(.medium))
                    Text("vs")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(match.team2.map { teamLabel($0) } ?? "TBD")
                        .font(.subheadline.weight(.medium))
                }

                // Tournament + time
                HStack(spacing: 6) {
                    Text(match.tournament.name)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("·")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(isLive ? "LIVE" : timeString)
                        .font(.caption.weight(isLive ? .bold : .regular))
                        .foregroundStyle(isLive ? Color.oceanBlue : .secondary)
                }

                // Score if completed
                if let score = match.score, match.status == "COMPLETED" {
                    Text(score)
                        .font(.caption)
                        .foregroundStyle(.primary)
                }
            }

            Spacer()

            if let watchUrl = match.watchUrl, let url = URL(string: watchUrl) {
                Link(destination: url) {
                    Image(systemName: "play.circle")
                        .foregroundStyle(Color.oceanBlue)
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(
            isLive
            ? Color.oceanBlue.opacity(0.05)
            : Color.clear
        )
        Divider().padding(.leading, 20)
    }

    private func teamLabel(_ team: TeamGQL) -> String {
        let p1 = team.player1.name.components(separatedBy: " ").last ?? team.player1.name
        let p2 = team.player2?.name.components(separatedBy: " ").last
        return p2.map { "\(p1) / \($0)" } ?? p1
    }
}

struct OtherTournamentRow: View {
    let tournament: TournamentGQL

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(tournament.name)
                    .font(.subheadline.weight(.medium))
                Text("\(tournament.city) · \(formattedDate(tournament.startDate))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if let tier = tournament.tier {
                Text(tier)
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.beachSand.opacity(0.3))
                    .cornerRadius(4)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 10)
        Divider().padding(.leading, 20)
    }

    private func formattedDate(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = f.date(from: iso) else { return iso }
        let display = DateFormatter()
        display.dateFormat = "MMM d"
        return display.string(from: date)
    }
}
