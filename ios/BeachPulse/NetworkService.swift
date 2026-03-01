import Foundation

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

class NetworkService: ObservableObject {
    private let baseURL = "http://localhost:3000/api"

    struct CounterResponse: Codable {
        let id: String
        let count: Int
        let lastUpdated: String
    }

    func fetchRankings() async throws -> RankingsResponse {
        guard let url = URL(string: "\(baseURL)/rankings") else {
            throw URLError(.badURL)
        }
        let (data, _) = try await URLSession.shared.data(from: url)
        return try JSONDecoder().decode(RankingsResponse.self, from: data)
    }
    
    func fetchCounter() async throws -> CounterResponse {
        guard let url = URL(string: "\(baseURL)/counter") else {
            throw URLError(.badURL)
        }
        
        let (data, _) = try await URLSession.shared.data(from: url)
        return try JSONDecoder().decode(CounterResponse.self, from: data)
    }
    
    func incrementCounter() async throws -> CounterResponse {
        guard let url = URL(string: "\(baseURL)/counter/increment") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let (data, _) = try await URLSession.shared.data(for: request)
        return try JSONDecoder().decode(CounterResponse.self, from: data)
    }
    
    func resetCounter() async throws -> CounterResponse {
        guard let url = URL(string: "\(baseURL)/counter/reset") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let (data, _) = try await URLSession.shared.data(for: request)
        return try JSONDecoder().decode(CounterResponse.self, from: data)
    }
}
