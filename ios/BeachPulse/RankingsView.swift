import SwiftUI

struct RankingsView: View {
    let players: [PlayerRanking]

    var body: some View {
        List(players) { player in
            HStack {
                Text("#\(player.rank)")
                    .font(.headline)
                    .foregroundColor(.secondary)
                    .frame(width: 44, alignment: .leading)
                Text(player.name)
                    .font(.body)
                Spacer()
                Text("\(Int(player.points)) pts")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            .padding(.vertical, 2)
        }
    }
}
