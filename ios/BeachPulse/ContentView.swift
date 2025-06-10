import SwiftUI

struct ContentView: View {
    @State private var tapCount = 0
    
    var body: some View {
        VStack {
            Text("Hello, iOS Development!")
                .font(.title)
                .padding()
            
            Text("Taps: \(tapCount)")
                .font(.headline)
                .padding()
            
            Button("Tap Me!") {
                tapCount += 1
            }
            .font(.title2)
            .padding()
            .background(Color.blue)
            .foregroundColor(.white)
            .cornerRadius(10)
        }
        .padding()
    }
}
