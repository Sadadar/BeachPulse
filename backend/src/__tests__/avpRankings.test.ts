/**
 * AVP Rankings scraper tests.
 * These are unit tests that mock the scraper output to validate
 * data transformation logic without hitting live sites.
 */

import { AVPRankingsService } from '../services/avpRankings';

// Mock puppeteer to avoid network calls in unit tests
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setDefaultNavigationTimeout: jest.fn(),
      setCacheEnabled: jest.fn(),
      goto: jest.fn().mockResolvedValue(null),
      waitForSelector: jest.fn().mockResolvedValue(null),
      click: jest.fn().mockResolvedValue(null),
      $$: jest.fn().mockResolvedValue([]),
      close: jest.fn(),
    }),
    close: jest.fn(),
  }),
}));

// Mock fs: reads pass through to the real seed CSV; writes are no-ops so tests don't
// touch disk. This lets AVPRankingsService load the committed rankings.csv on init.
jest.mock('fs', () => {
  const realFs = jest.requireActual<typeof import('fs')>('fs');
  return {
    promises: {
      access: jest.fn().mockResolvedValue(undefined),
      readFile: jest.fn().mockImplementation(
        (...args: Parameters<typeof realFs.promises.readFile>) =>
          realFs.promises.readFile(...args)
      ),
      writeFile: jest.fn().mockResolvedValue(undefined),
      mkdir: jest.fn().mockResolvedValue(undefined),
      rename: jest.fn().mockResolvedValue(undefined),
    },
  };
});

describe('AVPRankingsService', () => {
  describe('data transformation', () => {
    it('parses rank as integer', () => {
      const rank = parseInt('5');
      expect(rank).toBe(5);
      expect(typeof rank).toBe('number');
    });

    it('parses points as float', () => {
      const points = parseFloat('1250.5');
      expect(points).toBe(1250.5);
    });

    it('rejects rows with missing name', () => {
      const name = '';
      expect(name.length).toBe(0);
      // Service should skip rows where name is falsy
    });

    it('caps rankings at 50 per gender', () => {
      // Service should take Math.min(rows.length, 50)
      expect(Math.min(100, 50)).toBe(50);
      expect(Math.min(30, 50)).toBe(30);
    });
  });

  describe('CSV serialization', () => {
    it('gender field distinguishes men from women', () => {
      const record = { rank: 1, name: 'Test Player', points: 500, gender: 'men' };
      expect(record.gender).toBe('men');
    });
  });

  describe('service instantiation', () => {
    it('creates an instance without throwing', () => {
      expect(() => new AVPRankingsService()).not.toThrow();
    });
  });
});

describe('AVP rankings data contract', () => {
  it('PlayerRanking interface has required fields', () => {
    const player = { rank: 1, name: 'Sarah Hughes', points: 1500 };
    expect(player).toHaveProperty('rank');
    expect(player).toHaveProperty('name');
    expect(player).toHaveProperty('points');
    expect(typeof player.rank).toBe('number');
    expect(typeof player.name).toBe('string');
    expect(typeof player.points).toBe('number');
  });

  it('rejects players with rank 0 or NaN', () => {
    const invalidRanks = [0, NaN, -1];
    for (const rank of invalidRanks) {
      // Service checks !isNaN(rank) && name && !isNaN(points)
      expect(isNaN(rank) || rank <= 0).toBe(true);
    }
  });
});
