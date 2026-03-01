# BeachPulse

iOS app + Node.js backend for tracking professional beach volleyball — FIVB and AVP — centered on a small set of followed players.

## Stack

- **Backend**: Node.js + Express 5 + TypeScript, Apollo Server 5 (GraphQL at `/graphql`), Puppeteer for scraping, luxon for timezones, node-cron for polling
- **iOS**: SwiftUI, plain URLSession GraphQL client (no Apollo iOS SDK), UserDefaults for follow state

## Running locally

```bash
cd backend && npm run dev   # server on :3000
cd backend && npm test      # Jest suite (55 tests)
```

Open `ios/BeachPulse.xcodeproj` → select a simulator → Cmd+R.

## Conventions

- All scraped data is tagged with `SourcedValue<T>` (`{ value, source, scrapedAt, sourceUrl }`). Don't strip this metadata.
- All times are stored and returned as **UTC ISO8601**. The iOS app converts to device local time.
- Player names are normalized with NFD Unicode decomposition before comparison (`normalizeName()` in `playerService.ts`).
- Conflict resolution priority: `VOLLEYBALL_WORLD > AVP > VOLLEYBALL_LIFE > FIVB_12NDR`.
- New iOS screens should follow the design system in `NetworkService.swift`: `Color.beachSand` (primary), `Color.oceanBlue` (live/active).

## Scraping etiquette — read before writing any scraper code

We are a single personal app hitting sites that don't publish public APIs. Behave like a polite human, not a bot.

**Rate limits**
- Never fire more than one request per minute to any single domain during normal polling.
- During backfill (fetching historical data page-by-page), enforce a minimum **5-second delay between pages**, randomized to 5–10s (`Math.random() * 5000 + 5000` ms).
- Never run multiple scrapers against the same domain concurrently.

**Exponential backoff on errors**
Any scraper that can be retried must use exponential backoff:
- Base delay: 30s. Multiply by 2 on each retry. Cap at 10 minutes.
- Max 4 retries before giving up and logging for human review.
- On HTTP 429 or 503: back off immediately, don't count as a normal retry.

```typescript
async function withBackoff<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
  let delay = 30_000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try { return await fn(); }
    catch (e: any) {
      if (attempt === maxRetries) throw e;
      const isRateLimit = e?.status === 429 || e?.status === 503;
      const wait = isRateLimit ? delay * 2 : delay;
      await new Promise(r => setTimeout(r, wait + Math.random() * 2000));
      delay = Math.min(delay * 2, 600_000);
    }
  }
  throw new Error('unreachable');
}
```

**Cache aggressively — don't re-fetch what you have**
- Always check the local cache (`backend/data/`) before launching a browser.
- Tournament pages that are more than 2 hours old during a tournament week are stale. Everything else: 24 hours.
- Write to cache immediately after a successful fetch so a crash mid-run doesn't redo completed work.

**Backfill specifically**
- Backfills (fetching past seasons, full player histories) must be run manually, never from the cron scheduler.
- Always prompt before starting a backfill: confirm the page count and estimated time at 5–10s/page.
- Implement resume-from-checkpoint: record the last successfully fetched page/item to a file so a restart picks up where it left off, not from the beginning.

**Browser hygiene**
- Set a realistic User-Agent (default Puppeteer UA is fine; don't spoof a specific browser version).
- Reuse a single browser instance per scrape run — don't launch a new browser per page.
- Close the browser in a `finally` block; leaked browser processes accumulate fast.

## Tests

```bash
cd backend && npm test           # unit tests — runs always, no network, fast
cd backend && npm run test:live  # integration tests — hits real sites, run manually only
```

`npm run test:live` launches real Puppeteer sessions against live sites. **Run at most once per day during development, never in a loop.** Each file shares one browser instance and paces requests with a 5s delay between navigations.

**When `test:live` fails**
A failure almost always means a site redesigned their DOM, not a bug in our logic. Steps:
1. Open the failing site in a browser and inspect the current HTML structure.
2. Find the new selector for the element that broke (player name, score, tournament card, etc.).
3. Update the selector in the relevant service file (`volleyballWorldService.ts`, `avpRankings.ts`, etc.).
4. Re-run `npm run test:live` for just that scraper to confirm the fix.
5. Do not "fix" the test to match broken output — fix the scraper.

## What to avoid

- Don't add gradients, emojis, or heavy iconography to iOS screens.
- Don't bypass TypeScript strict mode — keep `tsconfig.json` strict.
- Don't commit `.env` files or scrape credentials.
- Don't over-engineer: prefer editing existing files over creating new ones.

## Data sources

| Source | Purpose | Priority |
|--------|---------|----------|
| volleyballworld.com | FIVB tournaments, draws, scores | Highest |
| avp.volleyballlife.com | AVP domestic rankings | High |
| truvolley.com | TVR global ratings | Medium |
| fivb.12ndr.at | FIVB fallback | Low |

## Key files

- `backend/src/types/index.ts` — shared types
- `backend/src/graphql/schema.ts` — GraphQL schema
- `backend/src/graphql/resolvers/index.ts` — resolvers
- `backend/src/services/` — one file per data source + playerService + timezoneService + pollScheduler
- `backend/data/playerAliases.json` — manual player disambiguation (edit carefully)
- `ios/BeachPulse/NetworkService.swift` — all iOS data models + GraphQL client + FollowStore
