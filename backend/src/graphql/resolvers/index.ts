import { AVPRankingsService } from '../../services/avpRankings';
import { VolleyballWorldService } from '../../services/volleyballWorldService';
import { PlayerService } from '../../services/playerService';
import { Gender, MatchStatus, RawMatch, RawTournament, ResolvedPlayer, TournamentTier } from '../../types';
import { DateTime } from 'luxon';

const avpService = new AVPRankingsService();
const vwService = new VolleyballWorldService();
const playerService = new PlayerService();

// In-memory store for tournaments (replaced by pollScheduler in production)
let cachedTournaments: RawTournament[] = [];
let cachedMatches: Map<string, RawMatch[]> = new Map();
let lastTournamentFetch = 0;

const TOURNAMENT_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function ensureTournamentsLoaded(): Promise<void> {
  const now = Date.now();
  if (cachedTournaments.length === 0 || now - lastTournamentFetch > TOURNAMENT_CACHE_TTL_MS) {
    cachedTournaments = await vwService.getTournaments();
    lastTournamentFetch = now;
  }
}

function rawTournamentToGql(t: RawTournament, followedPlayerIds: string[] = []) {
  return {
    id: t.id,
    name: t.name,
    tier: t.tier,
    city: t.city,
    country: t.country,
    startDate: t.startDate,
    endDate: t.endDate,
    gender: t.gender,
    followedPlayersCount: 0, // computed in feed resolver
    registeredTeams: (t.registeredTeams ?? []).map((team) => ({
      player1: rawPlayerToGql(team.player1 as any),
      player2: team.player2 ? rawPlayerToGql(team.player2 as any) : null,
      seed: team.seed,
    })),
    matches: [],
    sourceUrl: t.sourceUrl,
    _raw: t,
  };
}

function rawPlayerToGql(p: { id: string; name: string; country?: string; gender?: Gender; source: string; sourceUrl: string }) {
  return {
    id: p.id,
    name: p.name,
    country: p.country ?? null,
    gender: p.gender ?? null,
    tvrRating: null,
    tvrRatingSource: null,
    avpRank: null,
    currentPartner: null,
    upcomingMatches: [],
    recentResults: [],
    confidence: 'LOW',
  };
}

interface GqlPlayer {
  id: string;
  name: string;
  country: string | null;
  gender: Gender | null;
  tvrRating: number | null;
  tvrRatingSource: string | null;
  avpRank: number | null;
  currentPartner: GqlPlayer | null;
  upcomingMatches: unknown[];
  recentResults: unknown[];
  confidence: string;
}

function resolvedPlayerToGql(p: ResolvedPlayer): GqlPlayer {
  return {
    id: p.canonicalId,
    name: p.name,
    country: p.country ?? null,
    gender: p.gender ?? null,
    tvrRating: p.tvrRating?.value ?? null,
    tvrRatingSource: p.tvrRating?.source ?? null,
    avpRank: p.avpRank?.value ?? null,
    currentPartner: p.currentPartner ? resolvedPlayerToGql(p.currentPartner) : null,
    upcomingMatches: [],
    recentResults: [],
    confidence: p.confidence,
  };
}

function rawMatchToGql(m: RawMatch, tournament: ReturnType<typeof rawTournamentToGql>) {
  return {
    id: m.id,
    tournament,
    round: m.round,
    scheduledAt: m.scheduledAt,
    scheduledAtLocalEvent: m.scheduledAtLocalEvent ?? null,
    timezone: m.timezone ?? null,
    team1: {
      player1: rawPlayerToGql(m.team1.player1),
      player2: m.team1.player2 ? rawPlayerToGql(m.team1.player2) : null,
    },
    team2: m.team2 ? {
      player1: rawPlayerToGql(m.team2.player1),
      player2: m.team2.player2 ? rawPlayerToGql(m.team2.player2) : null,
    } : null,
    score: m.score ?? null,
    status: m.status,
    watchUrl: m.watchUrl ?? null,
    sourceUrl: m.sourceUrl,
  };
}

function isThisWeek(utcIso: string): boolean {
  const dt = DateTime.fromISO(utcIso, { zone: 'UTC' });
  const now = DateTime.now().toUTC();
  return dt >= now && dt <= now.plus({ weeks: 1 });
}

function isRecent(utcIso: string): boolean {
  const dt = DateTime.fromISO(utcIso, { zone: 'UTC' });
  const now = DateTime.now().toUTC();
  return dt >= now.minus({ hours: 48 }) && dt < now;
}

export const resolvers = {
  Query: {
    async feed(_: unknown, args: { playerIds: string[] }) {
      const { playerIds } = args;
      await ensureTournamentsLoaded();

      const live: ReturnType<typeof rawMatchToGql>[] = [];
      const upcoming: ReturnType<typeof rawMatchToGql>[] = [];
      const recent: ReturnType<typeof rawMatchToGql>[] = [];
      const tournamentsWithoutFollowed: ReturnType<typeof rawTournamentToGql>[] = [];

      for (const tournament of cachedTournaments) {
        if (!cachedMatches.has(tournament.id)) {
          try {
            const matches = await vwService.getTournamentMatches(
              tournament.id.replace('vw-', ''),
              tournament.city,
              tournament.country
            );
            cachedMatches.set(tournament.id, matches);
          } catch {
            cachedMatches.set(tournament.id, []);
          }
        }

        const matches = cachedMatches.get(tournament.id) ?? [];
        const gqlTournament = rawTournamentToGql(tournament);

        let hasFollowedPlayer = false;
        for (const match of matches) {
          const allPlayerNames = [
            match.team1.player1.name,
            match.team1.player2?.name,
            match.team2?.player1.name,
            match.team2?.player2?.name,
          ].filter(Boolean) as string[];

          const matchInvolvesFollowed = playerIds.some((id) =>
            allPlayerNames.some((name) => name.toLowerCase().includes(id.toLowerCase()))
          );

          if (!matchInvolvesFollowed) continue;
          hasFollowedPlayer = true;

          const gqlMatch = rawMatchToGql(match, gqlTournament);
          if (match.status === MatchStatus.LIVE) {
            live.push(gqlMatch);
          } else if (match.status === MatchStatus.SCHEDULED && isThisWeek(match.scheduledAt)) {
            upcoming.push(gqlMatch);
          } else if (match.status === MatchStatus.COMPLETED && isRecent(match.scheduledAt)) {
            recent.push(gqlMatch);
          }
        }

        if (!hasFollowedPlayer) {
          tournamentsWithoutFollowed.push(gqlTournament);
        }
      }

      // Sort upcoming by scheduled time
      upcoming.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
      recent.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));

      return {
        live,
        upcoming,
        recent,
        tournamentsWithoutFollowedPlayers: tournamentsWithoutFollowed,
      };
    },

    async tournaments(_: unknown, args: { search?: string; tier?: TournamentTier; gender?: Gender }) {
      await ensureTournamentsLoaded();

      let results = cachedTournaments;

      if (args.search) {
        const q = args.search.toLowerCase();
        results = results.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.city.toLowerCase().includes(q) ||
            t.country.toLowerCase().includes(q)
        );
      }

      if (args.tier) {
        results = results.filter((t) => t.tier === args.tier);
      }

      if (args.gender) {
        results = results.filter((t) => !t.gender || t.gender === args.gender);
      }

      return results.map((t) => rawTournamentToGql(t));
    },

    async tournament(_: unknown, args: { id: string }) {
      await ensureTournamentsLoaded();
      const t = cachedTournaments.find((x) => x.id === args.id);
      if (!t) return null;

      if (!cachedMatches.has(t.id)) {
        const matches = await vwService.getTournamentMatches(
          t.id.replace('vw-', ''),
          t.city,
          t.country
        );
        cachedMatches.set(t.id, matches);
      }

      const gqlTournament = rawTournamentToGql(t);
      const matches = cachedMatches.get(t.id) ?? [];
      return {
        ...gqlTournament,
        matches: matches.map((m) => rawMatchToGql(m, gqlTournament)),
      };
    },

    async avpRankings(_: unknown, args: { gender?: Gender }) {
      await playerService.initialize();
      const rankings = await avpService.getRankings();
      const list = args.gender === Gender.MEN ? rankings.men : args.gender === Gender.WOMEN ? rankings.women : [...rankings.men, ...rankings.women];

      return list.map((p) => ({
        id: `avp-${p.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: p.name,
        country: null,
        gender: args.gender ?? null,
        tvrRating: null,
        tvrRatingSource: null,
        avpRank: p.rank,
        currentPartner: null,
        upcomingMatches: [],
        recentResults: [],
        confidence: 'LOW',
      }));
    },

    async searchPlayers(_: unknown, args: { q: string; gender?: Gender }) {
      // For now, search against AVP rankings as a proxy
      const rankings = await avpService.getRankings();
      await playerService.initialize();

      const makeAvpPlayer = (p: { name: string; rank: number }, gender: Gender): ResolvedPlayer => ({
        canonicalId: `avp-${p.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: p.name,
        normalizedName: p.name.toLowerCase(),
        country: undefined,
        gender,
        avpRank: { value: p.rank, source: 'AVP' as const, scrapedAt: new Date().toISOString(), sourceUrl: '' },
        sources: [{ source: 'AVP' as const, externalId: String(p.rank) }],
        partnerships: [],
        confidence: 'LOW' as const,
      });

      const allPlayers: ResolvedPlayer[] = [
        ...rankings.men.map((p) => makeAvpPlayer(p, Gender.MEN)),
        ...rankings.women.map((p) => makeAvpPlayer(p, Gender.WOMEN)),
      ];

      const results = playerService.searchPlayers(args.q, allPlayers);
      const filtered = args.gender ? results.filter((p) => p.gender === args.gender) : results;
      return filtered.map(resolvedPlayerToGql);
    },

    async player(_: unknown, args: { id: string }) {
      // Stub — full implementation in Phase 3
      return null;
    },
  },
};
