import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            FeedView()
                .tabItem { Label("Feed", systemImage: "wave.3.right") }

            TournamentsView()
                .tabItem { Label("Tournaments", systemImage: "calendar") }

            PlayersView()
                .tabItem { Label("Players", systemImage: "person.2") }
        }
        .tint(Color.oceanBlue)
    }
}
