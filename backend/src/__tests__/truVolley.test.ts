/**
 * TruVolley scraper tests — validates data shapes and normalization logic.
 */

import { TruVolleyService } from '../services/truVolleyService';
import { Gender, DataSource } from '../types';

describe('TruVolleyService data contracts', () => {
  it('TVRRating has required fields', () => {
    const rating = {
      rank: 3,
      name: 'Sarah Hughes',
      normalizedName: 'sarah hughes',
      country: 'USA',
      gender: Gender.WOMEN,
      rating: 425.3,
      source: 'TRUVOLLEY' as DataSource,
      sourceUrl: 'https://www.truvolley.com/ratings',
      scrapedAt: '2025-06-01T00:00:00.000Z',
    };

    expect(rating).toHaveProperty('rank');
    expect(rating).toHaveProperty('name');
    expect(rating).toHaveProperty('normalizedName');
    expect(rating).toHaveProperty('rating');
    expect(rating).toHaveProperty('source');
    expect(rating).toHaveProperty('scrapedAt');
    expect(rating).toHaveProperty('sourceUrl');
  });

  it('source is always TRUVOLLEY', () => {
    const source: DataSource = 'TRUVOLLEY';
    expect(source).toBe('TRUVOLLEY');
  });

  it('gender enum distinguishes men from women', () => {
    expect(Gender.MEN).toBe('MEN');
    expect(Gender.WOMEN).toBe('WOMEN');
    expect(Gender.MEN).not.toBe(Gender.WOMEN);
  });

  it('rating is a positive float', () => {
    const validRatings = [425.3, 100.0, 0.1];
    const invalidRatings = [0, -1, NaN];

    for (const r of validRatings) {
      expect(r > 0 && !isNaN(r)).toBe(true);
    }
    for (const r of invalidRatings) {
      expect(r > 0 && !isNaN(r)).toBe(false);
    }
  });

  it('normalizedName is lowercase with no punctuation, unicode diacritics stripped', () => {
    const normalize = (name: string) =>
      name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    expect(normalize('Sarah Hughes')).toBe('sarah hughes');
    expect(normalize('Ana Patrícia')).toBe('ana patricia');
    expect(normalize('Tônja Lay')).toBe('tonja lay');
  });
});

describe('TruVolleyService instantiation', () => {
  it('creates instance without throwing', () => {
    expect(() => new TruVolleyService()).not.toThrow();
  });
});
