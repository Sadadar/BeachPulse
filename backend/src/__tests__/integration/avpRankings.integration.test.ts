/**
 * AVP Rankings LIVE integration test.
 * Hits avp.volleyballlife.com — only run with: npm run test:live
 * Never runs in CI. If this fails, the DOM selectors need updating.
 *
 * Failure guide:
 *   - 0 rows scraped  → waitForSelector target changed; inspect the live page
 *   - Name is blank   → 'td a.font-weight-bold' selector broke; check the cell structure
 *   - Points are NaN  → column order changed; verify cells[3] still has points
 */

import { AVPRankingsService } from '../../services/avpRankings';

describe('[LIVE] AVP Rankings scraper', () => {
  let service: AVPRankingsService;

  beforeAll(() => {
    service = new AVPRankingsService();
  });

  it('fetches at least 40 women\'s rankings', async () => {
    const rankings = await service.fetchAndUpdateRankings();
    expect(rankings.women.length).toBeGreaterThanOrEqual(40);
  }, 60000);

  it('fetches at least 40 men\'s rankings', async () => {
    const rankings = await service.fetchAndUpdateRankings();
    expect(rankings.men.length).toBeGreaterThanOrEqual(40);
  }, 60000);

  it('all players have non-empty names', async () => {
    const rankings = await service.fetchAndUpdateRankings();
    const allPlayers = [...rankings.men, ...rankings.women];
    for (const p of allPlayers) {
      expect(p.name.trim().length).toBeGreaterThan(0);
    }
  }, 60000);

  it('all ranks are positive integers', async () => {
    const rankings = await service.fetchAndUpdateRankings();
    const allPlayers = [...rankings.men, ...rankings.women];
    for (const p of allPlayers) {
      expect(Number.isInteger(p.rank)).toBe(true);
      expect(p.rank).toBeGreaterThan(0);
    }
  }, 60000);

  it('all points are non-negative numbers', async () => {
    const rankings = await service.fetchAndUpdateRankings();
    const allPlayers = [...rankings.men, ...rankings.women];
    for (const p of allPlayers) {
      expect(typeof p.points).toBe('number');
      expect(isNaN(p.points)).toBe(false);
      expect(p.points).toBeGreaterThanOrEqual(0);
    }
  }, 60000);

  it('women\'s rank 1 is a recognisable name (not blank or a number)', async () => {
    const rankings = await service.fetchAndUpdateRankings();
    const top = rankings.women[0];
    expect(top).toBeDefined();
    expect(top.name).toMatch(/^[A-Za-z]/); // starts with a letter
    console.log('Women #1:', top.name, '—', top.points, 'pts');
  }, 60000);

  it('men\'s rank 1 is a recognisable name', async () => {
    const rankings = await service.fetchAndUpdateRankings();
    const top = rankings.men[0];
    expect(top).toBeDefined();
    expect(top.name).toMatch(/^[A-Za-z]/);
    console.log('Men #1:', top.name, '—', top.points, 'pts');
  }, 60000);
});
