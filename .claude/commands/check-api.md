Verify the GraphQL API is working and print current response shapes so iOS models can be verified.

## Steps

1. Run `npm run build` in `backend/` — show TypeScript compile result.

2. Start the backend server in the background: `cd backend && npm run dev &`

3. Wait 3 seconds, then run these GraphQL queries against `http://localhost:3000/graphql`:

```graphql
# Test 1: AVP Rankings
query {
  avpRankings(gender: WOMEN) {
    id name avpRank
  }
}

# Test 2: Tournament list
query {
  tournaments {
    id name tier city country startDate
  }
}

# Test 3: Player search
query {
  searchPlayers(q: "hughes") {
    id name avpRank tvrRating
  }
}
```

Use curl:
```bash
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ avpRankings(gender: WOMEN) { id name avpRank } }"}'
```

4. Print the response shapes and confirm:
   - Field names match iOS `Codable` structs in `NetworkService.swift`
   - Dates are ISO8601 UTC strings
   - No null required fields

5. Kill the background server process.
