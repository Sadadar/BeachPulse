/**
 * Volleyball World LIVE integration test.
 * Hits volleyballworld.com — only run with: npm run test:live
 * Never runs in CI. If this fails, inspect the live site's DOM / network calls.
 *
 * Failure guide:
 *   - 0 tournaments → API endpoint changed; re-run network inspection with Puppeteer
 *   - Missing name/city → page structure changed; update parseApiTournamentResponse selectors
 *   - startDate not ISO → toUTC() city lookup is failing; check timezoneService map
 */

import { VolleyballWorldService } from '../../services/volleyballWorldService';

describe('[LIVE] Volleyball World scraper', () => {
  let service: VolleyballWorldService;

  beforeAll(() => {
    service = new VolleyballWorldService();
  });

  afterAll(async () => {
    await service.close();
  });

  it('returns at least 5 tournaments', async () => {
    const tournaments = await service.getTournaments();
    console.log(`[volleyballWorld] Fetched ${tournaments.length} tournaments`);
    expect(tournaments.length).toBeGreaterThanOrEqual(5);
  }, 60000);

  it('all tournaments have non-empty id, name, and source', async () => {
    const tournaments = await service.getTournaments();
    for (const t of tournaments) {
      expect(t.id.length).toBeGreaterThan(0);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.source).toBe('VOLLEYBALL_WORLD');
    }
  }, 60000);

  it('all tournament IDs are prefixed with vw-', async () => {
    const tournaments = await service.getTournaments();
    for (const t of tournaments) {
      expect(t.id.startsWith('vw-')).toBe(true);
    }
  }, 60000);

  it('startDate is a valid ISO8601 UTC string when present', async () => {
    const tournaments = await service.getTournaments();
    const withDates = tournaments.filter(t => t.startDate.length > 0);
    expect(withDates.length).toBeGreaterThan(0);
    for (const t of withDates) {
      const ms = Date.parse(t.startDate);
      expect(isNaN(ms)).toBe(false);
    }
  }, 60000);

  it('all tournaments have a sourceUrl', async () => {
    const tournaments = await service.getTournaments();
    for (const t of tournaments) {
      expect(typeof t.sourceUrl).toBe('string');
      expect(t.sourceUrl.length).toBeGreaterThan(0);
    }
  }, 60000);

  it('prints the first 3 tournaments for visual verification', async () => {
    const tournaments = await service.getTournaments();
    console.log('First 3 tournaments:');
    for (const t of tournaments.slice(0, 3)) {
      console.log(`  [${t.tier}] ${t.name} — ${t.city}, ${t.country} (${t.startDate})`);
    }
  }, 60000);
});
