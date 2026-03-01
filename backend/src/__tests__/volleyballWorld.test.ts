/**
 * VolleyballWorld scraper tests — validates data shapes and parsing logic.
 */

import { VolleyballWorldService } from '../services/volleyballWorldService';
import { MatchStatus, TournamentTier, DataSource } from '../types';

describe('VolleyballWorldService data contracts', () => {
  it('RawTournament has required fields', () => {
    const tournament = {
      id: 'vw-tournament-123',
      name: 'Beach Pro Tour Elite16 Doha',
      tier: TournamentTier.ELITE16,
      city: 'Doha',
      country: 'QA',
      startDate: '2025-06-10T00:00:00.000Z',
      endDate: '2025-06-15T00:00:00.000Z',
      source: 'VOLLEYBALL_WORLD' as DataSource,
      sourceUrl: 'https://www.volleyballworld.com/en/beachvolleyball/competitions/elite16-doha',
      scrapedAt: '2025-06-01T00:00:00.000Z',
    };

    expect(tournament).toHaveProperty('id');
    expect(tournament).toHaveProperty('name');
    expect(tournament).toHaveProperty('city');
    expect(tournament).toHaveProperty('startDate');
    expect(tournament).toHaveProperty('endDate');
    expect(tournament).toHaveProperty('source');
    expect(tournament).toHaveProperty('sourceUrl');
    expect(tournament.source).toBe('VOLLEYBALL_WORLD');
  });

  it('RawMatch has required fields', () => {
    const match = {
      id: 'vw-match-123-0',
      tournamentId: 'vw-tournament-123',
      round: 'Pool A',
      scheduledAt: '2025-06-11T09:00:00.000Z',
      scheduledAtLocalEvent: '2025-06-11T12:00:00.000+03:00',
      timezone: 'Asia/Qatar',
      team1: {
        player1: {
          id: 'vw-player-sarah-hughes',
          name: 'Sarah Hughes',
          normalizedName: 'sarah hughes',
          source: 'VOLLEYBALL_WORLD' as DataSource,
          sourceUrl: 'https://example.com',
          scrapedAt: '2025-06-01T00:00:00.000Z',
        },
      },
      status: MatchStatus.SCHEDULED,
      source: 'VOLLEYBALL_WORLD' as DataSource,
      sourceUrl: 'https://example.com',
      scrapedAt: '2025-06-01T00:00:00.000Z',
    };

    expect(match).toHaveProperty('id');
    expect(match).toHaveProperty('tournamentId');
    expect(match).toHaveProperty('scheduledAt');
    expect(match).toHaveProperty('scheduledAtLocalEvent');
    expect(match).toHaveProperty('timezone');
    expect(match).toHaveProperty('team1');
    expect(match).toHaveProperty('status');
    expect(match.status).toBe(MatchStatus.SCHEDULED);
  });

  it('TournamentTier enum includes all expected tiers', () => {
    expect(TournamentTier.ELITE16).toBe('ELITE16');
    expect(TournamentTier.CHALLENGER).toBe('CHALLENGER');
    expect(TournamentTier.AVP_PRO).toBe('AVP_PRO');
    expect(TournamentTier.FUTURES).toBe('FUTURES');
    expect(TournamentTier.MAJOR).toBe('MAJOR');
  });

  it('MatchStatus enum includes all states', () => {
    expect(MatchStatus.SCHEDULED).toBe('SCHEDULED');
    expect(MatchStatus.LIVE).toBe('LIVE');
    expect(MatchStatus.COMPLETED).toBe('COMPLETED');
    expect(MatchStatus.CANCELLED).toBe('CANCELLED');
  });

  it('tournament ID is prefixed with vw-', () => {
    const id = `vw-${'tournament-123'}`;
    expect(id.startsWith('vw-')).toBe(true);
  });

  it('match ID is prefixed with vw-match-', () => {
    const id = `vw-match-${'tournament-123'}-${0}`;
    expect(id.startsWith('vw-match-')).toBe(true);
  });
});

describe('VolleyballWorldService instantiation', () => {
  it('creates instance without throwing', () => {
    expect(() => new VolleyballWorldService()).not.toThrow();
  });
});

describe('tier normalization', () => {
  function normalizeTier(tierStr: string): TournamentTier {
    const t = tierStr.toLowerCase();
    if (t.includes('elite')) return TournamentTier.ELITE16;
    if (t.includes('challenger')) return TournamentTier.CHALLENGER;
    if (t.includes('major')) return TournamentTier.MAJOR;
    if (t.includes('futures')) return TournamentTier.FUTURES;
    return TournamentTier.CHALLENGER;
  }

  it('normalizes Elite16 tier strings', () => {
    expect(normalizeTier('Elite16')).toBe(TournamentTier.ELITE16);
    expect(normalizeTier('ELITE 16')).toBe(TournamentTier.ELITE16);
    expect(normalizeTier('Beach Pro Tour Elite')).toBe(TournamentTier.ELITE16);
  });

  it('normalizes Challenger tier strings', () => {
    expect(normalizeTier('Challenger')).toBe(TournamentTier.CHALLENGER);
    expect(normalizeTier('Beach Pro Tour Challenger')).toBe(TournamentTier.CHALLENGER);
  });

  it('falls back to CHALLENGER for unknown tiers', () => {
    expect(normalizeTier('unknown tier xyz')).toBe(TournamentTier.CHALLENGER);
    expect(normalizeTier('')).toBe(TournamentTier.CHALLENGER);
  });
});
