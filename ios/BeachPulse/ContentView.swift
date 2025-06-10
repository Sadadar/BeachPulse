import SwiftUI

struct ContentView: View {
    @StateObject private var networkService = NetworkService()
    @State private var tapCount = 0
    @State private var isLoading = false
    @State private var errorMessage = ""
    
    var body: some View {
        VStack {
            Text("Hello, iOS + Backend!")
                .font(.title)
                .padding()
            
            Text("Taps: \(tapCount)")
                .font(.headline)
                .padding()
            
            if isLoading {
                ProgressView()
                    .padding()
            }
            
            HStack {
                Button("Tap Me!") {
                    incrementCounter()
                }
                .font(.title2)
                .padding()
                .background(Color.blue)
                .foregroundColor(.white)
                .cornerRadius(10)
                .disabled(isLoading)
                
                Button("Reset") {
                    resetCounter()
                }
                .font(.title2)
                .padding()
                .background(Color.red)
                .foregroundColor(.white)
                .cornerRadius(10)
                .disabled(isLoading)
            }
            
            if !errorMessage.isEmpty {
                Text("Error: \(errorMessage)")
                    .foregroundColor(.red)
                    .padding()
            }
        }
        .padding()
        .onAppear {
            loadCounter()
        }
    }
    
    private func loadCounter() {
        isLoading = true
        errorMessage = ""
        
        Task {
            do {
                let response = try await networkService.fetchCounter()
                await MainActor.run {
                    tapCount = response.count
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
    
    private func incrementCounter() {
        isLoading = true
        errorMessage = ""
        
        Task {
            do {
                let response = try await networkService.incrementCounter()
                await MainActor.run {
                    tapCount = response.count
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
    
    private func resetCounter() {
        isLoading = true
        errorMessage = ""
        
        Task {
            do {
                let response = try await networkService.resetCounter()
                await MainActor.run {
                    tapCount = response.count
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
