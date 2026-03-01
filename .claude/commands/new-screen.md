Scaffold a new SwiftUI screen following BeachPulse project conventions.

## Usage
/new-screen ScreenName

## What to create

Given `$ARGUMENTS` as the screen name (e.g. `PlayerDetail`):

1. Create `ios/BeachPulse/$ARGUMENTS View.swift` with this template:

```swift
import SwiftUI

struct {ScreenName}View: View {
    // MARK: - State
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            // Background
            Color(.systemBackground).ignoresSafeArea()

            if isLoading {
                ProgressView()
            } else if let error = errorMessage {
                ContentUnavailableView(error, systemImage: "exclamationmark.triangle")
            } else {
                mainContent
            }
        }
        .navigationTitle("{ScreenName}")
        .task { await loadData() }
    }

    // MARK: - Main content
    private var mainContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("TODO: implement {ScreenName}")
                    .padding()
            }
        }
    }

    // MARK: - Data loading
    private func loadData() async {
        isLoading = true
        defer { isLoading = false }
        // TODO: call NetworkService
    }
}

#Preview {
    NavigationStack {
        {ScreenName}View()
    }
}
```

2. Design system reminders:
   - Primary accent: `Color(hex: "#D4A96A")` (sandy warm neutral)
   - Active/Live accent: `Color(hex: "#3A7CA5")` (ocean blue)
   - Use `.font(.system(.body, design: .default))` — SF Pro, no custom fonts
   - Generous padding: `.padding(.horizontal, 20)`, `.padding(.vertical, 12)`
   - Cards: `.background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))`
   - No gradients, no emojis, no icon clutter

3. After creating the file, remind the user to:
   - Add the file to the Xcode project (drag into navigator)
   - Add navigation link in `ContentView.swift` or parent screen
