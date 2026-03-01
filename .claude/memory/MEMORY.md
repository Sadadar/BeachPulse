# BeachPulse Project Memory

## What the project does
iOS app + Node.js backend for tracking AVP + FIVB professional beach volleyball rankings,
schedules, and live match scores. Centered on ~12 followed players.

## Stack
- **Backend**: Node.js + Express 5 + TypeScript, Apollo Server 5 (GraphQL), axios + cheerio for scraping, Puppeteer only for AVP + VW match draws, luxon for timezones, node-cron for polling
- **iOS**: SwiftUI, async/await URLSession, GraphQL over HTTP (no Apollo iOS SDK), targets iOS simulator via localhost

## Key file paths

### Backend
- `backend/src/index.ts` — Express + Apollo Server entry point; wires `/admin`, `/graphql`, `/api`
- `backend/src/graphql/schema.ts` — GraphQL type definitions
- `backend/src/graphql/resolvers/index.ts` — resolvers (Player, Tournament, Match, Feed, AVPRankings)
- `backend/src/routes/api.ts` — REST: counter + legacy AVP rankings
- `backend/src/routes/admin.ts` — REST: review queue + alias CRUD (`/admin/api/*`)
- `backend/src/admin/index.html` — web admin UI (review queue, alias browser, merge/split forms)
- `backend/src/services/avpRankings.ts` — AVP scraper (Puppeteer, CSV cache at `data/rankings.csv`)
- `backend/src/services/volleyballWorldService.ts` — FIVB tournaments via HTTP API; match draws via Puppeteer
- `backend/src/services/truVolleyService.ts` — TVR ratings via axios + cheerio (no Puppeteer)
- `backend/src/services/playerService.ts` — cross-source identity resolution + partnership history
- `backend/src/services/timezoneService.ts` — city/country → IANA timezone, UTC conversion
- `backend/src/services/pollScheduler.ts` — cron jobs (daily + every 6h)
- `backend/src/types/index.ts` — SourcedValue, RawPlayer, RawTournament, RawMatch, ResolvedPlayer, Partnership, enums
- `backend/data/playerAliases.json` — manual player disambiguation (Sarah Hughes, Megan Rice, Megan J. Rice)
- `backend/data/rankings.csv` — cached AVP rankings (seed data committed, updated on each scrape)
- `backend/data/reviewQueue.json` — LOW-confidence player matches awaiting human review

### iOS
- `ios/BeachPulse/NetworkService.swift` — GraphQL client, all data models, FollowStore, Color design tokens
- `ios/BeachPulse/ContentView.swift` — 3-tab app (Feed / Tournaments / Players)
- `ios/BeachPulse/FeedView.swift` — live + upcoming + recent matches for followed players
- `ios/BeachPulse/TournamentsView.swift` — searchable tournament schedule
- `ios/BeachPulse/PlayersView.swift` — following list + DiscoverView (rankings browser, search, follow)
- `ios/BeachPulse/SettingsStore.swift` — device timezone detection, formatMatchTime() helper, UserDefaults persistence
- `ios/BeachPulse/RankingsView.swift` — legacy AVP rankings view (kept)

### Skills
- `.claude/commands/test-scraper.md` — runs all scrapers, prints summary
- `.claude/commands/check-api.md` — verifies GraphQL API + response shapes
- `.claude/commands/new-screen.md` — scaffolds a new SwiftUI screen

## Running locally
1. `cd backend && npm run dev` — starts server on port 3000 (GraphQL at /graphql, REST at /api, admin at /admin)
2. `cd backend && npm test` — runs 74-test Jest suite (6 files, ~1.5s, no network)
3. `cd backend && npm run test:live` — runs integration tests against live sites (slow, opt-in only)
4. `open ios/BeachPulse.xcodeproj` → select simulator → Cmd+R

## Data sources (priority order)
1. `en.volleyballworld.com` — FIVB tournaments, draws, scores (PRIMARY) — **has a public REST API**
2. `avp.volleyballlife.com` — AVP domestic rankings (Puppeteer, Vuetify SPA)
3. `www.truvolley.com` — TVR global ratings (axios + cheerio, server-rendered HTML)
4. `fivb.12ndr.at` — Third-party FIVB fallback (not yet implemented)

## Volleyball World API (confirmed working)
Base URL: `https://en.volleyballworld.com` (`www.` redirects here — go directly to `en.`)

Key endpoints:
- `GET /api/v1/globalschedule/competitions/{year}/{month}` → `{ competitions: [...] }`
  - Filter: `discipline === 'beach'`
  - Fields: `name`, `competitionFullName`, `url`, `menTournaments`, `womenTournaments` (tournament IDs), `startDate`, `endDate`, `destination` (city), `subCompetitionType` (tier), `discipline`
- `GET /api/v1/globalschedule/{YYYY-MM-DD}/{YYYY-MM-DD}` → `{ matches: [...] }`
  - Filter: `discipline === 'beach'`
  - Fields: `matchNo`, `tournamentNo`, `matchDateUtc`, `city`, `countryCode`, `teamANo/teamBNo`, `teamAScore/teamBScore`, `matchStatus` (0=scheduled, 1=live, 2=completed), `roundName`, `gender`
  - **Player names NOT in this endpoint** — only team IDs. Player names require scraping the draw page.

## TruVolley scraping
- URL: `https://www.truvolley.com/ratings?gender=men` and `?gender=women`
- Server-rendered HTML table: 3 columns (Rank | Name | TVR) or 4 columns with Country
- Parse with `cheerio` — `$('table tbody tr')` then `.find('td')`

## Architecture decisions

### GraphQL (Apollo Server 5 + @as-integrations/express5)
- Plain URLSession HTTP client on iOS — POST JSON to /graphql
- Existing REST endpoints kept: /api/counter, /api/rankings

### SourcedValue + resolveConflict
Every scraped value tagged `{ value, source, scrapedAt, sourceUrl }`.
`resolveConflict()` rules: single source → return it; all agree → most recently scraped wins; true conflict → source priority (VW > AVP > VL > FIVB_12NDR).
`highestPrioritySource` kept as deprecated alias.

### Player identity resolution (playerService.ts)
- Confidence: HIGH (alias/VW ID or current-partner match) | MEDIUM (name+partner) | LOW (name only)
- `recordPartnership()` tracks history with open/close; current partner match → HIGH, historical → MEDIUM
- `writeReviewQueue()` writes LOW-confidence matches to `data/reviewQueue.json`
- Web admin at `/admin` for human review + merge/split

### Timezone handling
- All times stored as UTC ISO8601; `timezoneService.ts` maps city names to IANA IDs
- Both "city,country" and bare "city" keys in map
- `toUTC(localStr, city, country)` for ingestion; `fromUTC(utcIso, ianaId)` for display (PST default)
- iOS: `SettingsStore.formatMatchTime()` converts UTC → device timezone

### Player follow model
- Stored in UserDefaults via `FollowStore` singleton
- Follow/unfollow via swipe actions or star button from any surface

## Design system (iOS)
- Primary: `Color.beachSand` = rgb(0.83, 0.66, 0.42) — sandy warm neutral
- Active/Live: `Color.oceanBlue` = rgb(0.23, 0.49, 0.65) — ocean blue
- SF Pro, generous whitespace, no gradients, no emojis

## AVP scraper details (Puppeteer, unchanged)
- Vuetify SPA — tab switching via `button[value="girls"]` / `button[value="boys"]`
- Name cell: use `querySelector('a')` inside the name td
- Table columns: rank(0), name(1), tournament count(2), points(3)

## iOS ATS note
No manual Info.plist (`GENERATE_INFOPLIST_FILE = YES`).
To allow HTTP to localhost: Target → Info tab → App Transport Security Settings → `NSAllowsLocalNetworking = YES`

## Build phases
- **Phase 1+2 (done)**: All scrapers, types, 74-test Jest suite, GraphQL API, iOS 3-tab navigation, admin panel, SettingsStore
- **Phase 3 (next)**: Wire resolvers to live scraper data; Feed + Tournament detail views with real matches + player names; pollScheduler tuning
- **Phase 4 (todo)**: Push notifications (APNs) + iCal feed
- **Phase 5 (todo)**: Deploy (Railway/Render) + TestFlight

## Known gaps / next priorities
1. **Player names missing from VW match schedule** — `getScheduledMatches()` returns "Team 12345" placeholders. Need to either find the player-names API endpoint on VW, or use `getTournamentMatches()` (Puppeteer draw scrape) for active tournaments.
2. **GraphQL resolvers return placeholder data** — Feed, Tournament, and Player resolvers are wired but not yet pulling from live scraper services. Phase 3 work.
3. **TruVolley gender URL** — `?gender=men` / `?gender=women` is our best guess from the live page; confirm working once server is running in next session.
4. **Only 1 beach tournament returned** — VW API returns 1 beach event for the current 6-month window (Mar–Aug 2026). Likely correct for this time of year; re-check in May when the BPT season ramps up.

## Open questions
1. ~~Does volleyballworld.com have a public API?~~ **Yes — `en.volleyballworld.com/api/v1/...`**
2. How early does AVP post tournament registration lists?
3. Olympic standings tracking window for LA2028
