import { SOURCE_PRIORITY, resolveConflict, highestPrioritySource, SourcedValue, DataSource } from '../types';

function sv<T>(value: T, source: DataSource, scrapedAt = '2025-06-01T12:00:00.000Z'): SourcedValue<T> {
  return { value, source, scrapedAt, sourceUrl: 'https://example.com' };
}

describe('SOURCE_PRIORITY ordering', () => {
  it('orders VOLLEYBALL_WORLD as highest priority', () => {
    expect(SOURCE_PRIORITY.indexOf('VOLLEYBALL_WORLD')).toBeGreaterThan(SOURCE_PRIORITY.indexOf('AVP'));
    expect(SOURCE_PRIORITY.indexOf('VOLLEYBALL_WORLD')).toBeGreaterThan(SOURCE_PRIORITY.indexOf('FIVB_12NDR'));
  });

  it('orders AVP above FIVB_12NDR', () => {
    expect(SOURCE_PRIORITY.indexOf('AVP')).toBeGreaterThan(SOURCE_PRIORITY.indexOf('FIVB_12NDR'));
  });
});

describe('resolveConflict', () => {
  describe('single source', () => {
    it('returns the only value regardless of source priority', () => {
      const result = resolveConflict([sv('only value', 'FIVB_12NDR')]);
      expect(result.value).toBe('only value');
      expect(result.source).toBe('FIVB_12NDR');
    });

    it('returns low-priority single source over nothing', () => {
      const result = resolveConflict([sv(42, 'VOLLEYBALL_LIFE')]);
      expect(result.value).toBe(42);
    });
  });

  describe('sources agree — recency wins', () => {
    it('picks the most recently scraped when all values match', () => {
      const values = [
        sv('18:00', 'AVP',              '2025-06-01T06:00:00.000Z'),
        sv('18:00', 'VOLLEYBALL_WORLD', '2025-06-01T10:00:00.000Z'), // freshest
        sv('18:00', 'FIVB_12NDR',       '2025-06-01T02:00:00.000Z'),
      ];
      const result = resolveConflict(values);
      expect(result.source).toBe('VOLLEYBALL_WORLD');
      expect(result.scrapedAt).toBe('2025-06-01T10:00:00.000Z');
    });

    it('fresh low-priority source beats stale high-priority source when values agree', () => {
      const values = [
        sv('425.3', 'VOLLEYBALL_WORLD', '2025-05-01T00:00:00.000Z'), // stale high-priority
        sv('425.3', 'TRUVOLLEY',        '2025-06-01T10:00:00.000Z'), // fresh low-priority
      ];
      const result = resolveConflict(values);
      expect(result.source).toBe('TRUVOLLEY');
    });

    it('treats numeric near-equals as agreement (epsilon 0.01)', () => {
      const values = [
        sv(425.30, 'AVP',              '2025-06-01T06:00:00.000Z'),
        sv(425.3,  'VOLLEYBALL_WORLD', '2025-06-01T10:00:00.000Z'),
      ];
      const result = resolveConflict(values);
      // They agree → pick freshest (VOLLEYBALL_WORLD)
      expect(result.source).toBe('VOLLEYBALL_WORLD');
    });
  });

  describe('true conflict — priority wins', () => {
    it('picks VOLLEYBALL_WORLD over AVP when values differ', () => {
      const values = [
        sv('18:00', 'AVP',              '2025-06-01T10:00:00.000Z'), // fresher
        sv('18:30', 'VOLLEYBALL_WORLD', '2025-06-01T06:00:00.000Z'), // older but higher priority
      ];
      const result = resolveConflict(values);
      expect(result.source).toBe('VOLLEYBALL_WORLD');
      expect(result.value).toBe('18:30');
    });

    it('picks AVP over FIVB_12NDR when values differ', () => {
      const values = [
        sv('Score X', 'FIVB_12NDR', '2025-06-01T10:00:00.000Z'),
        sv('Score Y', 'AVP',        '2025-06-01T06:00:00.000Z'),
      ];
      const result = resolveConflict(values);
      expect(result.source).toBe('AVP');
      expect(result.value).toBe('Score Y');
    });

    it('picks VOLLEYBALL_WORLD from four conflicting sources', () => {
      const values = [
        sv(100, 'FIVB_12NDR',       '2025-06-01T10:00:00.000Z'),
        sv(200, 'VOLLEYBALL_LIFE',   '2025-06-01T10:00:00.000Z'),
        sv(300, 'VOLLEYBALL_WORLD',  '2025-06-01T06:00:00.000Z'), // older but highest priority
        sv(150, 'AVP',               '2025-06-01T10:00:00.000Z'),
      ];
      const result = resolveConflict(values);
      expect(result.source).toBe('VOLLEYBALL_WORLD');
      expect(result.value).toBe(300);
    });

    it('uses recency to break a tie between equal-priority sources', () => {
      // Two AVP entries (shouldn't happen in practice but handle gracefully)
      const values = [
        sv('old score', 'AVP', '2025-06-01T06:00:00.000Z'),
        sv('new score', 'AVP', '2025-06-01T10:00:00.000Z'),
      ];
      const result = resolveConflict(values);
      expect(result.value).toBe('new score');
    });
  });

  describe('custom equality', () => {
    it('respects a custom isEqual function', () => {
      const caseInsensitiveEq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
      const values = [
        sv('DOHA',  'AVP',              '2025-06-01T06:00:00.000Z'),
        sv('Doha',  'VOLLEYBALL_WORLD', '2025-06-01T10:00:00.000Z'),
      ];
      // With custom equality they agree → recency wins
      const result = resolveConflict(values, caseInsensitiveEq);
      expect(result.source).toBe('VOLLEYBALL_WORLD');
    });
  });

  describe('backward compatibility', () => {
    it('highestPrioritySource is an alias for resolveConflict', () => {
      expect(highestPrioritySource).toBe(resolveConflict);
    });
  });
});
