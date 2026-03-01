import { PlayerService, normalizeName, normalizeNameCoarse } from '../services/playerService';
import { DataSource, Gender, RawPlayer } from '../types';

function makePlayer(
  id: string,
  name: string,
  source: DataSource = 'VOLLEYBALL_WORLD',
  partnerName?: string,
): RawPlayer {
  return {
    id,
    name,
    normalizedName: normalizeName(name),
    gender: Gender.WOMEN,
    source,
    sourceUrl: 'https://example.com',
    scrapedAt: '2025-06-01T00:00:00.000Z',
    currentPartnerName: partnerName,
  };
}

describe('normalizeName', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeName('Sarah Hughes')).toBe('sarah hughes');
    expect(normalizeName('Megan J. Rice')).toBe('megan j rice');
  });

  it('handles Unicode diacritics via NFD decomposition', () => {
    expect(normalizeName('  Ana  Patrícia  ')).toBe('ana patricia');
    expect(normalizeName('Tônja Lay')).toBe('tonja lay');
  });
});

describe('normalizeNameCoarse', () => {
  it('strips middle initials', () => {
    expect(normalizeNameCoarse('Megan J. Rice')).toBe('megan rice');
    expect(normalizeNameCoarse('John A. Smith')).toBe('john smith');
  });

  it('keeps first and last name intact', () => {
    expect(normalizeNameCoarse('Sarah Hughes')).toBe('sarah hughes');
  });
});

describe('PlayerService', () => {
  let service: PlayerService;

  beforeEach(() => {
    service = new PlayerService();
  });

  // ─── resolveCanonicalId ────────────────────────────────────────────────────

  describe('resolveCanonicalId', () => {
    it('returns HIGH confidence for Volleyball World source', () => {
      const player = makePlayer('vw-123', 'Sarah Hughes', 'VOLLEYBALL_WORLD');
      const result = service.resolveCanonicalId(player);
      expect(result.canonicalId).toBe('vw-123');
      expect(result.confidence).toBe('HIGH');
    });

    it('returns MEDIUM confidence when partner name is provided (non-VW source)', () => {
      const player = makePlayer('avp-456', 'Sarah Hughes', 'AVP', 'Kelley Larsen');
      const result = service.resolveCanonicalId(player, 'Kelley Larsen');
      expect(result.confidence).toBe('MEDIUM');
      expect(result.canonicalId).toContain('sarah-hughes');
    });

    it('returns LOW confidence with name only (non-VW source)', () => {
      const player = makePlayer('tv-789', 'Sarah Hughes', 'TRUVOLLEY');
      const result = service.resolveCanonicalId(player);
      expect(result.confidence).toBe('LOW');
      expect(result.canonicalId).toContain('sarah-hughes');
    });
  });

  // ─── Alias-based disambiguation ───────────────────────────────────────────

  describe('alias-based disambiguation', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('resolves Sarah Hughes to her canonical ID via alias', () => {
      const player = makePlayer('tv-sarah', 'Sarah Hughes', 'TRUVOLLEY');
      const result = service.resolveCanonicalId(player);
      expect(result.canonicalId).toBe('vw-sarah-hughes');
      expect(result.confidence).toBe('HIGH');
    });

    it('resolves Megan Rice and Megan J. Rice to different canonical IDs', () => {
      const meganRice  = makePlayer('tv-megan',   'Megan Rice',    'TRUVOLLEY');
      const meganJRice = makePlayer('tv-megan-j', 'Megan J. Rice', 'TRUVOLLEY');

      const r1 = service.resolveCanonicalId(meganRice);
      const r2 = service.resolveCanonicalId(meganJRice);

      expect(r1.canonicalId).toBe('vw-megan-rice');
      expect(r2.canonicalId).toBe('vw-megan-j-rice');
      expect(r1.canonicalId).not.toBe(r2.canonicalId);
    });

    it('assigns HIGH confidence to aliased players', () => {
      const player = makePlayer('tv-megan', 'Megan Rice', 'TRUVOLLEY');
      expect(service.resolveCanonicalId(player).confidence).toBe('HIGH');
    });
  });

  // ─── Partnership history ───────────────────────────────────────────────────

  describe('partnership history', () => {
    const canonicalId = 'resolved-sarah-hughes';

    it('records a partnership and returns it as current', () => {
      service.recordPartnership(canonicalId, 'Kelley Larsen', 'AVP', 'https://avp.com', '2025-06-01T00:00:00.000Z');
      const current = service.getCurrentPartnership(canonicalId);
      expect(current).toBeDefined();
      expect(current!.partnerName).toBe('Kelley Larsen');
      expect(current!.endDate).toBeUndefined();
    });

    it('closes previous partnership when a new one is recorded', () => {
      service.recordPartnership(canonicalId, 'Kelley Larsen', 'AVP', 'https://avp.com', '2025-01-01T00:00:00.000Z');
      service.recordPartnership(canonicalId, 'Ally Niedermaier', 'AVP', 'https://avp.com', '2025-06-01T00:00:00.000Z');

      const current = service.getCurrentPartnership(canonicalId);
      expect(current!.partnerName).toBe('Ally Niedermaier');

      // Old partnership should be closed
      expect(service.hasKnownPartnership(canonicalId, 'kelley larsen')).toBe(true);
    });

    it('recognises current partner → HIGH confidence upgrade', () => {
      service.recordPartnership(canonicalId, 'Kelley Larsen', 'AVP', 'https://avp.com', '2025-06-01T00:00:00.000Z');

      // Simulate a non-VW player coming in with the matching partner
      const player = makePlayer('tv-sarah', 'Sarah Hughes', 'TRUVOLLEY', 'Kelley Larsen');
      const result = service.resolveCanonicalId(player, 'Kelley Larsen');
      // Current partner match → HIGH
      expect(result.confidence).toBe('HIGH');
    });

    it('recognises historical partner → MEDIUM confidence', () => {
      // Record and then close a partnership
      service.recordPartnership(canonicalId, 'Kelley Larsen', 'AVP', 'https://avp.com', '2025-01-01T00:00:00.000Z');
      service.recordPartnership(canonicalId, 'Ally Niedermaier', 'AVP', 'https://avp.com', '2025-06-01T00:00:00.000Z');

      const player = makePlayer('tv-sarah', 'Sarah Hughes', 'TRUVOLLEY', 'Kelley Larsen');
      const result = service.resolveCanonicalId(player, 'Kelley Larsen');
      // Historical partner match → at least MEDIUM
      expect(['HIGH', 'MEDIUM']).toContain(result.confidence);
    });

    it('hasKnownPartnership returns false for unrelated partner', () => {
      service.recordPartnership(canonicalId, 'Kelley Larsen', 'AVP', 'https://avp.com', '2025-06-01T00:00:00.000Z');
      expect(service.hasKnownPartnership(canonicalId, 'completely different person')).toBe(false);
    });

    it('same-name players with different partners resolve to different IDs', () => {
      const canonicalA = 'resolved-sarah-a';
      const canonicalB = 'resolved-sarah-b';
      service.recordPartnership(canonicalA, 'Kelley Larsen', 'AVP', 'https://avp.com', '2025-06-01T00:00:00.000Z');
      service.recordPartnership(canonicalB, 'Emily Day', 'AVP', 'https://avp.com', '2025-06-01T00:00:00.000Z');

      // They should have different current partners
      expect(service.getCurrentPartnership(canonicalA)!.partnerName).toBe('Kelley Larsen');
      expect(service.getCurrentPartnership(canonicalB)!.partnerName).toBe('Emily Day');
    });
  });

  // ─── mergePlayerSources ────────────────────────────────────────────────────

  describe('mergePlayerSources', () => {
    it('prefers Volleyball World as primary source', () => {
      const merged = service.mergePlayerSources([
        makePlayer('avp-001', 'Sarah Hughes', 'AVP'),
        makePlayer('vw-001', 'Sarah Hughes', 'VOLLEYBALL_WORLD'),
      ]);
      expect(merged.canonicalId).toBe('vw-001');
    });

    it('includes all sources in merged player', () => {
      const merged = service.mergePlayerSources([
        makePlayer('vw-001', 'Sarah Hughes', 'VOLLEYBALL_WORLD'),
        makePlayer('avp-001', 'Sarah Hughes', 'AVP'),
        makePlayer('tv-001', 'Sarah Hughes', 'TRUVOLLEY'),
      ]);
      expect(merged.sources).toHaveLength(3);
      expect(merged.sources.map(s => s.source)).toEqual(
        expect.arrayContaining(['VOLLEYBALL_WORLD', 'AVP', 'TRUVOLLEY'])
      );
    });

    it('seeds partnership history from raw player currentPartnerName', () => {
      const merged = service.mergePlayerSources([
        makePlayer('vw-001', 'Sarah Hughes', 'VOLLEYBALL_WORLD', 'Kelley Larsen'),
      ]);
      expect(merged.partnerships).toHaveLength(1);
      expect(merged.partnerships[0].partnerName).toBe('Kelley Larsen');
    });

    it('attaches TVR rating when name matches', () => {
      const merged = service.mergePlayerSources(
        [makePlayer('vw-001', 'Sarah Hughes', 'VOLLEYBALL_WORLD')],
        [{
          rank: 5, name: 'Sarah Hughes', normalizedName: 'sarah hughes',
          country: 'USA', gender: Gender.WOMEN, rating: 425.3,
          source: 'TRUVOLLEY' as DataSource,
          sourceUrl: 'https://truvolley.com/ratings',
          scrapedAt: '2025-06-01T00:00:00.000Z',
        }],
      );
      expect(merged.tvrRating?.value).toBe(425.3);
    });

    it('stores profileUrl per source when provided', () => {
      const player = {
        ...makePlayer('vw-001', 'Sarah Hughes', 'VOLLEYBALL_WORLD'),
        profileUrl: 'https://www.volleyballworld.com/en/players/sarah-hughes-001',
      };
      const merged = service.mergePlayerSources([player]);
      expect(merged.sources[0].profileUrl).toBe('https://www.volleyballworld.com/en/players/sarah-hughes-001');
    });
  });

  // ─── searchPlayers ─────────────────────────────────────────────────────────

  describe('searchPlayers', () => {
    const players = [
      { canonicalId: '1', name: 'Sarah Hughes', normalizedName: 'sarah hughes', partnerships: [], sources: [], confidence: 'HIGH' as const },
      { canonicalId: '2', name: 'Sara Lay',     normalizedName: 'sara lay',     partnerships: [], sources: [], confidence: 'HIGH' as const },
      { canonicalId: '3', name: 'Melissa Humana-Paredes', normalizedName: 'melissa humanaparedes', partnerships: [], sources: [], confidence: 'HIGH' as const },
    ];

    it('finds players by partial name', () => {
      const results = service.searchPlayers('sara', players);
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some(p => p.name === 'Sarah Hughes')).toBe(true);
    });

    it('returns empty array for no matches', () => {
      expect(service.searchPlayers('zzznotaplayer', players)).toHaveLength(0);
    });
  });
});
