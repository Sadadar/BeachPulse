Run all backend scrapers and print a summary of results. Highlight any data quality issues or LOW confidence player matches.

## Steps

1. Run `npm test` in `backend/` and show results summary.

2. For live scraper validation, run a Node.js script that:
   - Calls `AVPRankingsService.getRankings()` — print top 5 men's and women's, confirm counts are ≥ 50
   - Calls `TruVolleyService.getRatings()` — print top 5 men's and women's, confirm counts > 0
   - Calls `VolleyballWorldService.getTournaments()` — print first 5 tournaments, confirm count > 0
   - Calls `PlayerService.auditLowConfidence()` on all scraped players — report any LOW confidence matches

3. Print a summary table:

```
Source         | Men | Women | Status
---------------|-----|-------|-------
AVP Rankings   | XX  | XX    | ✓/✗
TVR Ratings    | XX  | XX    | ✓/✗
Volleyball World | XX tournaments | ✓/✗
```

Use `cd backend && npx ts-node -e "..."` for quick scraper calls.
