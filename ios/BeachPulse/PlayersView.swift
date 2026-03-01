import SwiftUI

struct PlayersView: View {
    @StateObject private var followStore = FollowStore.shared

    var body: some View {
        NavigationStack {
            List {
                // Following section
                if !followStore.followedIds.isEmpty {
                    Section {
                        ForEach(Array(followStore.followedIds), id: \.self) { playerId in
                            FollowedPlayerRow(playerId: playerId)
                        }
                    } header: {
                        Text("Following")
                            .font(.caption.weight(.semibold))
                            .textCase(.uppercase)
                            .foregroundStyle(.secondary)
                    }
                }

                // Discover section
                Section {
                    NavigationLink("Browse Rankings") {
                        DiscoverView()
                    }
                    .foregroundStyle(Color.oceanBlue)
                } header: {
                    Text("Discover")
                        .font(.caption.weight(.semibold))
                        .textCase(.uppercase)
                        .foregroundStyle(.secondary)
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Players")
        }
    }
}

// MARK: - Followed Player Row

struct FollowedPlayerRow: View {
    let playerId: String
    @StateObject private var followStore = FollowStore.shared

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(displayName)
                    .font(.subheadline.weight(.medium))
                Text(playerId)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button {
                followStore.unfollow(playerId)
            } label: {
                Image(systemName: "star.fill")
                    .foregroundStyle(Color.beachSand)
            }
            .buttonStyle(.plain)
        }
    }

    private var displayName: String {
        // Format the ID back to a readable name (e.g. "avp-sarah-hughes" → "Sarah Hughes")
        playerId
            .replacingOccurrences(of: "avp-", with: "")
            .replacingOccurrences(of: "vw-", with: "")
            .split(separator: "-")
            .map { $0.capitalized }
            .joined(separator: " ")
    }
}

// MARK: - Discover View

struct DiscoverView: View {
    @State private var searchText = ""
    @State private var selectedGender = "WOMEN"
    @State private var players: [PlayerGQL] = []
    @State private var rankingPlayers: [PlayerGQL] = []
    @State private var isLoading = false
    @State private var isSearching = false
    @State private var errorMessage: String?
    @StateObject private var followStore = FollowStore.shared

    private var displayedPlayers: [PlayerGQL] {
        searchText.count >= 2 ? players : rankingPlayers
    }

    var body: some View {
        Group {
            if isLoading && displayedPlayers.isEmpty {
                ProgressView("Loading...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = errorMessage, displayedPlayers.isEmpty {
                ContentUnavailableView(
                    "Couldn't load players",
                    systemImage: "wifi.exclamationmark",
                    description: Text(error)
                )
            } else {
                playerList
            }
        }
        .navigationTitle("Discover")
        .searchable(text: $searchText, prompt: "Search players...")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Picker("Gender", selection: $selectedGender) {
                    Text("Women").tag("WOMEN")
                    Text("Men").tag("MEN")
                }
                .pickerStyle(.segmented)
                .frame(width: 140)
            }
        }
        .task { await loadRankings() }
        .onChange(of: selectedGender) { _, _ in Task { await loadRankings() } }
        .onChange(of: searchText) { _, newVal in
            if newVal.count >= 2 {
                Task { await search(q: newVal) }
            }
        }
    }

    private var playerList: some View {
        List(displayedPlayers) { player in
            PlayerRow(player: player)
                .swipeActions(edge: .trailing) {
                    Button {
                        if followStore.isFollowing(player.id) {
                            followStore.unfollow(player.id)
                        } else {
                            followStore.follow(player.id)
                        }
                    } label: {
                        Label(
                            followStore.isFollowing(player.id) ? "Unfollow" : "Follow",
                            systemImage: followStore.isFollowing(player.id) ? "star.slash" : "star"
                        )
                    }
                    .tint(followStore.isFollowing(player.id) ? .gray : Color.beachSand)
                }
        }
        .listStyle(.plain)
    }

    private func loadRankings() async {
        isLoading = true
        defer { isLoading = false }
        errorMessage = nil
        do {
            rankingPlayers = try await NetworkService.shared.fetchAVPRankings(gender: selectedGender)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func search(q: String) async {
        isSearching = true
        defer { isSearching = false }
        do {
            players = try await NetworkService.shared.searchPlayers(q: q, gender: selectedGender)
        } catch {
            // Silently fail search — show ranking list as fallback
        }
    }
}

// MARK: - Player Row

struct PlayerRow: View {
    let player: PlayerGQL
    @StateObject private var followStore = FollowStore.shared

    var body: some View {
        HStack(spacing: 12) {
            if let rank = player.avpRank {
                Text("#\(rank)")
                    .font(.headline)
                    .foregroundStyle(.secondary)
                    .frame(width: 40, alignment: .leading)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(player.name)
                    .font(.subheadline.weight(.medium))
                if let partner = player.currentPartner {
                    Text("w/ \(partner.name)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                if let tvr = player.tvrRating {
                    Text(String(format: "%.0f TVR", tvr))
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Color.oceanBlue)
                }
                if let country = player.country {
                    Text(country)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Button {
                if followStore.isFollowing(player.id) {
                    followStore.unfollow(player.id)
                } else {
                    followStore.follow(player.id)
                }
            } label: {
                Image(systemName: followStore.isFollowing(player.id) ? "star.fill" : "star")
                    .foregroundStyle(Color.beachSand)
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 4)
    }
}
