/**
 * TruVolley LIVE integration test.
 * Hits truvolley.com — only run with: npm run test:live
 * Never runs in CI. If this fails, the DOM selectors need updating.
 *
 * Failure guide:
 *   - 0 ratings → gender filter selector changed; inspect button/input elements
 *   - Name is blank → cell structure changed; check which td index holds the name
 *   - Rating is NaN → rating column moved; scan cell values for the numeric one
 *   - Only men scraped → women's filter button selector broke; inspect data-* attrs
 */

import { TruVolleyService } from '../../services/truVolleyService';
import { Gender } from '../../types';

describe('[LIVE] TruVolley scraper', () => {
  let service: TruVolleyService;

  beforeAll(() => {
    service = new TruVolleyService();
  });

  it('returns at least 50 total ratings', async () => {
    const ratings = await service.getRatings();
    console.log(`[truVolley] Fetched ${ratings.length} total ratings`);
    expect(ratings.length).toBeGreaterThanOrEqual(50);
  }, 60000);

  it('includes both men\'s and women\'s ratings', async () => {
    const ratings = await service.getRatings();
    const men   = ratings.filter(r => r.gender === Gender.MEN);
    const women = ratings.filter(r => r.gender === Gender.WOMEN);
    console.log(`  Men: ${men.length}, Women: ${women.length}`);
    expect(men.length).toBeGreaterThan(0);
    expect(women.length).toBeGreaterThan(0);
  }, 60000);

  it('all ratings have non-empty names', async () => {
    const ratings = await service.getRatings();
    for (const r of ratings) {
      expect(r.name.trim().length).toBeGreaterThan(0);
    }
  }, 60000);

  it('all ratings have positive rating values', async () => {
    const ratings = await service.getRatings();
    for (const r of ratings) {
      expect(r.rating).toBeGreaterThan(0);
      expect(isNaN(r.rating)).toBe(false);
    }
  }, 60000);

  it('normalizedName is lowercase with no punctuation', async () => {
    const ratings = await service.getRatings();
    for (const r of ratings) {
      expect(r.normalizedName).toBe(r.normalizedName.toLowerCase());
      expect(r.normalizedName).not.toMatch(/[^a-z\s]/);
    }
  }, 60000);

  it('source is TRUVOLLEY and sourceUrl is set', async () => {
    const ratings = await service.getRatings();
    for (const r of ratings) {
      expect(r.source).toBe('TRUVOLLEY');
      expect(r.sourceUrl.length).toBeGreaterThan(0);
    }
  }, 60000);

  it('prints the top 3 women\'s ratings for visual verification', async () => {
    const ratings = await service.getRatings();
    const top3Women = ratings
      .filter(r => r.gender === Gender.WOMEN)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 3);
    console.log('Top 3 women:');
    for (const r of top3Women) {
      console.log(`  #${r.rank} ${r.name} (${r.country}) — TVR ${r.rating}`);
    }
  }, 60000);
});
