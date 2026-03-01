import SwiftUI

struct ContentView: View {
    @StateObject private var networkService = NetworkService()
    @State private var rankings: RankingsResponse?
    @State private var isLoading = false
    @State private var errorMessage = ""

    var body: some View {
        TabView {
            RankingsView(players: rankings?.men ?? [])
                .tabItem { Label("Men's", systemImage: "figure.volleyball") }

            RankingsView(players: rankings?.women ?? [])
                .tabItem { Label("Women's", systemImage: "figure.volleyball") }
        }
        .overlay {
            if isLoading {
                ProgressView("Loading rankings...")
                    .padding()
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
            }
        }
        .alert("Error", isPresented: .constant(!errorMessage.isEmpty)) {
            Button("Retry") { loadRankings() }
            Button("Dismiss") { errorMessage = "" }
        } message: {
            Text(errorMessage)
        }
        .onAppear { loadRankings() }
    }

    private func loadRankings() {
        isLoading = true
        errorMessage = ""
        Task {
            do {
                let response = try await networkService.fetchRankings()
                await MainActor.run {
                    rankings = response
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
}
