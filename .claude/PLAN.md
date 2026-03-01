# BeachPulse — Full Product Plan

## Current Status (updated March 2026)

**Phases 1 + 2: Complete**
- All scrapers built and working (VW via REST API, TruVolley via axios+cheerio, AVP via Puppeteer)
- 74-unit-test Jest suite passing in ~1.5s
- GraphQL API live (Apollo Server 5), iOS 3-tab app scaffolded
- Admin panel at `/admin` for player identity disambiguation
- `SettingsStore.swift` for timezone-aware time display

**Key discovery**: Volleyball World has a public REST API at `https://en.volleyballworld.com/api/v1/...` — no scraping needed for tournaments or match schedules. See MEMORY.md for endpoint details.

**Phase 3: Next**
Wire GraphQL resolvers to live scraper data; build TournamentDetailView and PlayerDetailView with real matches + player names from the VW draw API.

---

## Context
The current prototype scrapes AVP rankings and displays them in a two-tab iOS app. The real problem to solve is aggregating professional beach volleyball information across multiple global sources into one clean place — centered on a small set of followed players. The user wants to know when Sarah Hughes is playing in India next week, get a timezone-aware push notification, put the match on their calendar, and track her results as the tournament progresses. ~12 players followed simultaneously, potentially at different global tournaments.

---

## Design Direction
- **Aesthetic**: Clean + minimal, subtle beach character (warm sandy neutrals, soft ocean blue for live/active), not ESPN-overwrought
- **Principle**: Less is more — every screen earns its place
- **Typography-forward**, generous whitespace, no icon clutter

---

## Navigation: 3 Tabs

### 1. Feed (home)
What's happening now and this week across your followed players.
- **Live now** section (if any matches in progress) — bold, prominent
- **This week** — time-sorted upcoming matches, each card shows: player, partner, opponent, local time (converted to user's timezone), tournament name + city, link to watch
- **Recent results** — last 48h, collapsible
- **Also this week** — tournaments happening where none of your players are registered. Tap to browse that tournament and potentially add players.
- Pull-to-refresh

### 2. Tournaments
Full schedule of all upcoming tournaments (FIVB + AVP), searchable and sortable.
- Each tournament card shows: name, tier (Elite16 / Challenger / AVP Pro), city, dates, and a "Your players: N" badge
- Tournaments with followed players shown first / highlighted
- Search by city, player name, date range
- Tap into a tournament → see full draw, schedule, which of your players are registered

### 3. Players
Two sections:
- **Following** — your ~12 followed players as cards: name, current partner, TVR rating, AVP rank, current tournament status ("Playing in India this week", "Next: [date, city]", "Off-season")
- **Discover** — rankings browser (men's / women's tabs, same as current prototype) + search. Tap any player → player detail → Follow button

---

## Data Sources

| Source | What it provides | Access method |
|--------|-----------------|---------------|
| `en.volleyballworld.com` | FIVB tournament schedules, draws, live scores, results — **primary source** | **Public REST API** (`/api/v1/globalschedule/...`) — no scraping needed |
| `truvolley.com/ratings` | Global TVR ratings for all players, country, filterable | axios + cheerio (server-rendered HTML) |
| `avp.volleyballlife.com` | AVP domestic rankings + some tournament data | Puppeteer scraper (Vuetify SPA) |
| `avp.com` | AVP season structure, league teams, schedule image | Parse manually for now; scrape schedule page |
| `fivb.12ndr.at` | Third-party FIVB aggregator — useful as reference/fallback | Scrape |

---

## Backend Architecture

### API Layer: GraphQL (Apollo Server 5)
- `backend/src/graphql/schema.ts` — type definitions
- `backend/src/graphql/resolvers/index.ts` — resolvers per type (Player, Tournament, Match, Feed)
- Existing REST endpoints (`/api/counter`, `/api/rankings`) stay as-is for now
- Admin panel at `/admin` (static HTML + REST API)

**Two non-GraphQL endpoints remain:**
- `POST /api/devices` — APNs device token registration
- `GET /api/calendar/:userId.ics` — iCal feed (text/calendar MIME type)

### Volleyball World REST API (confirmed)
```
Base: https://en.volleyballworld.com
GET /api/v1/globalschedule/competitions/{year}/{month}
  → { competitions: [...] }  filter: discipline === 'beach'
  Fields: name, competitionFullName, url, menTournaments, womenTournaments,
          startDate, endDate, destination (city), subCompetitionType (tier)

GET /api/v1/globalschedule/{YYYY-MM-DD}/{YYYY-MM-DD}
  → { matches: [...] }  filter: discipline === 'beach'
  Fields: matchNo, tournamentNo, matchDateUtc, city, countryCode,
          teamANo, teamBNo, teamAScore, teamBScore,
          matchStatus (0=scheduled, 1=live, 2=completed), roundName, gender
  Note: player names NOT in this endpoint — need draw-page scrape per tournament
```

### Core GraphQL Types
```graphql
type Player {
  id: ID!
  name: String!
  currentPartner: Player
  tvrRating: Float
  avpRank: Int
  upcomingMatches: [Match!]
  recentResults: [Match!]
}

type Tournament {
  id: ID!
  name: String!
  tier: TournamentTier  # ELITE16 | CHALLENGER | AVP_PRO | FUTURES
  city: String!
  country: String!
  startDate: String!
  endDate: String!
  followedPlayersCount: Int
  registeredTeams: [Team!]
  matches: [Match!]
}

type Match {
  id: ID!
  tournament: Tournament!
  round: String!
  scheduledAt: String!  # ISO8601 UTC
  team1: Team!
  team2: Team
  score: String
  status: MatchStatus  # SCHEDULED | LIVE | COMPLETED
  watchUrl: String
}
```

### Polling Strategy

| Data | When | Frequency |
|------|------|-----------|
| Rankings (TVR + AVP) | Always | Once daily |
| Tournament calendar | Always | Once daily |
| Tournament registration lists | Week before event | Every 6h |
| Draw / match schedule | Tournament week | Every 2h |
| Live match scores + round progression | During active matches | Every 2min |
| Round schedule updates | Between rounds | Every 30min |

---

## iOS App Screens

### Built
- `FeedView.swift` — home tab (scaffolded, needs live data)
- `TournamentsView.swift` — searchable tournament list (scaffolded)
- `PlayersView.swift` — following list + DiscoverView
- `ContentView.swift` — 3-tab navigation
- `NetworkService.swift` — GraphQL client + all data models
- `SettingsStore.swift` — timezone detection + formatMatchTime()

### Still to build
- `TournamentDetailView.swift` — draw, schedule, results for one tournament
- `PlayerDetailView.swift` — profile, ratings, upcoming, recent results
- `SettingsView.swift` — notification preferences, iCal subscription button

### Player follow model
- Stored locally in UserDefaults (`FollowStore` singleton)
- Synced to backend on launch (for push notification routing)
- Follow/unfollow from any surface

### Push notifications
- Request permission on first launch
- Register APNs token → `POST /api/devices` with token + followed player IDs
- Types: draw published, match day reminder, match result, eliminated/won

### iCal subscription
- Settings screen: "Subscribe to Calendar" button copies `.ics` URL to clipboard
- `GET /api/calendar/:userId.ics` returns `text/calendar`

---

## Build Phases

### Phase 1: Data layer + scrapers + test suite ✅
- All scrapers working (VW API, TruVolley cheerio, AVP Puppeteer)
- Player identity resolution with partnership history + confidence scoring
- Admin panel for human disambiguation
- 74 unit tests

### Phase 2: GraphQL API + iOS foundation ✅
- Apollo Server 5 schema + resolvers
- 3-tab iOS app
- FollowStore + SettingsStore

### Phase 3: Feed + Tournament views (next)
- Wire resolvers to live scraper data
- `TournamentDetailView.swift` — draw, schedule, results
- `PlayerDetailView.swift` — profile, ratings, upcoming/recent
- Confirm TruVolley `?gender=` params work on live site
- Get player names into VW match schedule (investigate team-detail API or draw scrape)

### Phase 4: Push notifications + calendar
- Apple Developer account setup (user action required)
- `notificationService.ts` + APNs (node-apn)
- Change detection on each poll cycle
- `calendarService.ts` + `GET /api/calendar/:userId.ics`
- `SettingsView.swift`

### Phase 5: Deploy + TestFlight
- Dockerfile for backend
- Deploy to Railway or Render
- Update iOS base URL for production
- App signing + TestFlight build

---

## Claude Code Skills

| Skill | File | Purpose |
|-------|------|---------|
| `/test-scraper` | `.claude/commands/test-scraper.md` | Runs all scrapers, prints top 5 results, confirms row counts |
| `/check-api` | `.claude/commands/check-api.md` | Compiles TypeScript + prints current API response shapes |
| `/new-screen` | `.claude/commands/new-screen.md` | Scaffolds a new SwiftUI screen following project conventions |

---

## Open Questions
1. ~~Does volleyballworld.com have a public API?~~ **Yes — `en.volleyballworld.com/api/v1/...`**
2. How early does AVP post tournament registration lists — days or weeks in advance?
3. Olympic standings tracking window for LA2028
4. Where are player names in the VW API? (team IDs only in global schedule; need draw-page endpoint)
