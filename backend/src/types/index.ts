// ─── Source Metadata ─────────────────────────────────────────────────────────

export type DataSource = 'VOLLEYBALL_WORLD' | 'AVP' | 'VOLLEYBALL_LIFE' | 'FIVB_12NDR' | 'TRUVOLLEY';

export interface SourcedValue<T> {
  value: T;
  source: DataSource;
  scrapedAt: string; // ISO8601 UTC
  sourceUrl: string;
}

// Source priority for conflict resolution (higher index = higher priority).
// Only used when sources genuinely disagree on a value.
export const SOURCE_PRIORITY: DataSource[] = ['FIVB_12NDR', 'VOLLEYBALL_LIFE', 'AVP', 'TRUVOLLEY', 'VOLLEYBALL_WORLD'];

/**
 * Resolve a field that may exist across multiple sources.
 *
 * Rules (in order):
 * 1. Single source → return it unconditionally.
 * 2. All sources agree on the value → return the most recently scraped.
 * 3. True conflict (values differ) → highest-priority source wins;
 *    recency breaks ties between sources of equal priority.
 *
 * Numeric values are compared with a small epsilon (0.01) to treat
 * rounding differences (425.3 vs 425.30) as agreement.
 */
export function resolveConflict<T>(
  values: SourcedValue<T>[],
  isEqual?: (a: T, b: T) => boolean,
): SourcedValue<T> {
  if (values.length === 0) throw new Error('resolveConflict: empty values array');
  if (values.length === 1) return values[0];

  const eq = isEqual ?? defaultEquals;
  const allAgree = values.every(v => eq(v.value, values[0].value));

  if (allAgree) {
    // No conflict — prefer freshest data
    return values.reduce((best, current) =>
      current.scrapedAt > best.scrapedAt ? current : best
    );
  }

  // True conflict — priority wins, recency breaks ties
  return values.reduce((best, current) => {
    const bestPri = SOURCE_PRIORITY.indexOf(best.source);
    const currPri = SOURCE_PRIORITY.indexOf(current.source);
    if (currPri !== bestPri) return currPri > bestPri ? current : best;
    return current.scrapedAt > best.scrapedAt ? current : best;
  });
}

function defaultEquals<T>(a: T, b: T): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) < 0.01;
  }
  return a === b;
}

/** @deprecated Use resolveConflict() */
export const highestPrioritySource = resolveConflict;

// ─── Player Identity ──────────────────────────────────────────────────────────

export type MatchConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface PlayerAlias {
  canonicalId: string;
  aliases: string[]; // normalized names that map to this player
  note?: string;
}

// ─── Partnership ──────────────────────────────────────────────────────────────

export interface Partnership {
  partnerId?: string;            // canonical ID if resolved; undefined if not yet matched
  partnerName: string;
  partnerNormalizedName: string;
  startDate?: string;            // ISO8601 UTC; undefined = unknown
  endDate?: string;              // ISO8601 UTC; undefined = current / ongoing
  source: DataSource;
  sourceUrl: string;
  scrapedAt: string;
}

// ─── Core Domain Types ────────────────────────────────────────────────────────

export enum TournamentTier {
  ELITE16 = 'ELITE16',
  CHALLENGER = 'CHALLENGER',
  AVP_PRO = 'AVP_PRO',
  FUTURES = 'FUTURES',
  MAJOR = 'MAJOR',
}

export enum MatchStatus {
  SCHEDULED = 'SCHEDULED',
  LIVE = 'LIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum Gender {
  MEN = 'MEN',
  WOMEN = 'WOMEN',
}

export interface RawPlayer {
  id: string;            // source-specific ID (ideally the player's profile URL on that source)
  name: string;
  normalizedName: string;
  country?: string;
  gender?: Gender;
  tvrRating?: number;
  avpRank?: number;
  currentPartnerId?: string;
  currentPartnerName?: string;
  profileUrl?: string;   // canonical profile URL on the source site
  source: DataSource;
  sourceUrl: string;     // page the scraper was on when it found this player
  scrapedAt: string;
}

export interface ResolvedPlayer {
  canonicalId: string;   // Volleyball World ID preferred
  name: string;
  normalizedName: string;
  country?: string;
  gender?: Gender;
  tvrRating?: SourcedValue<number>;
  avpRank?: SourcedValue<number>;
  currentPartner?: ResolvedPlayer;
  partnerships: Partnership[];
  sources: { source: DataSource; externalId: string; profileUrl?: string }[];
  confidence: MatchConfidence;
}

export interface RawTournament {
  id: string; // source-specific ID
  name: string;
  tier?: TournamentTier;
  city: string;
  country: string;
  startDate: string; // ISO8601 UTC
  endDate: string;   // ISO8601 UTC
  gender?: Gender;
  registeredTeams?: RawTeam[];
  source: DataSource;
  sourceUrl: string;
  scrapedAt: string;
}

export interface RawTeam {
  player1: RawPlayer;
  player2?: RawPlayer;
  seed?: number;
}

export interface RawMatch {
  id: string;
  tournamentId: string;
  round: string;
  scheduledAt: string;           // ISO8601 UTC
  scheduledAtLocalEvent: string; // original local time as scraped
  timezone: string;              // IANA timezone
  team1: RawTeam;
  team2?: RawTeam;
  score?: string;
  status: MatchStatus;
  watchUrl?: string;
  source: DataSource;
  sourceUrl: string;
  scrapedAt: string;
}

// ─── Feed Types ───────────────────────────────────────────────────────────────

export interface FeedData {
  live: RawMatch[];
  upcoming: RawMatch[];
  recent: RawMatch[];
  tournamentsWithoutFollowedPlayers: RawTournament[];
}

// ─── TVR Rating ───────────────────────────────────────────────────────────────

export interface TVRRating {
  rank: number;
  name: string;
  normalizedName: string;
  country: string;
  gender: Gender;
  rating: number;
  source: DataSource;
  sourceUrl: string;
  scrapedAt: string;
}

// ─── Admin / Review ───────────────────────────────────────────────────────────

export interface ReviewQueueEntry {
  canonicalId: string;
  name: string;
  normalizedName: string;
  confidence: MatchConfidence;
  sources: { source: DataSource; externalId: string; profileUrl?: string }[];
  flaggedAt: string; // ISO8601 UTC
  reason: string;
}
