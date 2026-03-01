import Foundation
import SwiftUI

// MARK: - Design System Colors

extension Color {
    /// Sandy warm neutral — primary accent
    static let beachSand = Color(red: 0.83, green: 0.66, blue: 0.42)
    /// Ocean blue — live/active accent
    static let oceanBlue = Color(red: 0.23, green: 0.49, blue: 0.65)
}

// MARK: - GraphQL Response Wrappers

struct GraphQLResponse<T: Decodable>: Decodable {
    let data: T?
    let errors: [GraphQLError]?
}

struct GraphQLError: Decodable {
    let message: String
}

// MARK: - Domain Models

struct PlayerGQL: Codable, Identifiable {
    let id: String
    let name: String
    let country: String?
    let gender: String?
    let tvrRating: Double?
    let tvrRatingSource: String?
    let avpRank: Int?
    let currentPartner: PartnerRef?
    let confidence: String
}

struct PartnerRef: Codable {
    let id: String
    let name: String
}

struct TournamentGQL: Codable, Identifiable {
    let id: String
    let name: String
    let tier: String?
    let city: String
    let country: String
    let startDate: String
    let endDate: String
    let followedPlayersCount: Int
    let sourceUrl: String
}

struct MatchGQL: Codable, Identifiable {
    let id: String
    let round: String
    let scheduledAt: String
    let scheduledAtLocalEvent: String?
    let timezone: String?
    let team1: TeamGQL
    let team2: TeamGQL?
    let score: String?
    let status: String
    let watchUrl: String?
    let sourceUrl: String
    let tournament: TournamentRef
}

struct TournamentRef: Codable {
    let id: String
    let name: String
    let city: String
    let country: String
}

struct TeamGQL: Codable {
    let player1: PlayerGQL
    let player2: PlayerGQL?
}

struct FeedDataGQL: Codable {
    let live: [MatchGQL]
    let upcoming: [MatchGQL]
    let recent: [MatchGQL]
    let tournamentsWithoutFollowedPlayers: [TournamentGQL]
}

// MARK: - Legacy AVP Model (kept for RankingsView)

struct PlayerRanking: Codable, Identifiable {
    let rank: Int
    let name: String
    let points: Double
    var id: String { name }
}

struct RankingsResponse: Codable {
    let men: [PlayerRanking]
    let women: [PlayerRanking]
}

// MARK: - Player Follow Store

class FollowStore: ObservableObject {
    static let shared = FollowStore()
    private let key = "followedPlayerIds"

    @Published var followedIds: Set<String> = []

    init() {
        let stored = UserDefaults.standard.stringArray(forKey: key) ?? []
        followedIds = Set(stored)
    }

    func follow(_ id: String) {
        followedIds.insert(id)
        persist()
    }

    func unfollow(_ id: String) {
        followedIds.remove(id)
        persist()
    }

    func isFollowing(_ id: String) -> Bool {
        followedIds.contains(id)
    }

    private func persist() {
        UserDefaults.standard.set(Array(followedIds), forKey: key)
    }
}

// MARK: - Network Service

class NetworkService: ObservableObject {
    static let shared = NetworkService()
    private let baseURL = "http://localhost:3000"

    // MARK: GraphQL

    func graphQL<T: Decodable>(query: String, variables: [String: Any] = [:]) async throws -> T {
        guard let url = URL(string: "\(baseURL)/graphql") else {
            throw URLError(.badURL)
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        var body: [String: Any] = ["query": query]
        if !variables.isEmpty { body["variables"] = variables }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try JSONDecoder().decode(GraphQLResponse<T>.self, from: data)
        if let errors = response.errors, !errors.isEmpty {
            throw NSError(domain: "GraphQL", code: 0, userInfo: [
                NSLocalizedDescriptionKey: errors.map(\.message).joined(separator: ", ")
            ])
        }
        guard let result = response.data else {
            throw URLError(.badServerResponse)
        }
        return result
    }

    // MARK: Feed

    struct FeedResponse: Decodable {
        let feed: FeedDataGQL
    }

    func fetchFeed(playerIds: [String]) async throws -> FeedDataGQL {
        let query = """
        query Feed($playerIds: [ID!]!) {
          feed(playerIds: $playerIds) {
            live { ...MatchFields }
            upcoming { ...MatchFields }
            recent { ...MatchFields }
            tournamentsWithoutFollowedPlayers {
              id name tier city country startDate endDate followedPlayersCount sourceUrl
            }
          }
        }
        fragment MatchFields on Match {
          id round scheduledAt scheduledAtLocalEvent timezone score status watchUrl sourceUrl
          tournament { id name city country }
          team1 { player1 { id name country } player2 { id name country } }
          team2 { player1 { id name country } player2 { id name country } }
        }
        """
        let response: FeedResponse = try await graphQL(query: query, variables: ["playerIds": playerIds])
        return response.feed
    }

    // MARK: Tournaments

    struct TournamentsResponse: Decodable {
        let tournaments: [TournamentGQL]
    }

    func fetchTournaments(search: String? = nil) async throws -> [TournamentGQL] {
        let query = """
        query Tournaments($search: String) {
          tournaments(search: $search) {
            id name tier city country startDate endDate followedPlayersCount sourceUrl
          }
        }
        """
        var vars: [String: Any] = [:]
        if let s = search { vars["search"] = s }
        let response: TournamentsResponse = try await graphQL(query: query, variables: vars)
        return response.tournaments
    }

    // MARK: Player Search / Discover

    struct SearchPlayersResponse: Decodable {
        let searchPlayers: [PlayerGQL]
    }

    func searchPlayers(q: String, gender: String? = nil) async throws -> [PlayerGQL] {
        let query = """
        query SearchPlayers($q: String!, $gender: Gender) {
          searchPlayers(q: $q, gender: $gender) {
            id name country gender tvrRating avpRank confidence
            currentPartner { id name }
          }
        }
        """
        var vars: [String: Any] = ["q": q]
        if let g = gender { vars["gender"] = g }
        let response: SearchPlayersResponse = try await graphQL(query: query, variables: vars)
        return response.searchPlayers
    }

    // MARK: AVP Rankings (via GraphQL)

    struct AVPRankingsResponse: Decodable {
        let avpRankings: [PlayerGQL]
    }

    func fetchAVPRankings(gender: String) async throws -> [PlayerGQL] {
        let query = """
        query AVPRankings($gender: Gender) {
          avpRankings(gender: $gender) {
            id name avpRank confidence
          }
        }
        """
        let response: AVPRankingsResponse = try await graphQL(query: query, variables: ["gender": gender])
        return response.avpRankings
    }

    // MARK: Legacy REST (kept for fallback)

    func fetchRankings() async throws -> RankingsResponse {
        guard let url = URL(string: "\(baseURL)/api/rankings") else {
            throw URLError(.badURL)
        }
        let (data, _) = try await URLSession.shared.data(from: url)
        return try JSONDecoder().decode(RankingsResponse.self, from: data)
    }
}
