import axios from 'axios';
import puppeteer, { Browser } from 'puppeteer';
import { DateTime } from 'luxon';
import {
  DataSource,
  Gender,
  MatchStatus,
  RawMatch,
  RawPlayer,
  RawTeam,
  RawTournament,
  TournamentTier,
} from '../types';
import { toUTC } from './timezoneService';

const SOURCE: DataSource = 'VOLLEYBALL_WORLD';

// The site redirects www → en subdomain; call en directly to avoid a redirect round-trip
const BASE_URL = 'https://en.volleyballworld.com';

const API = {
  // Returns { competitions: [...], year, seasons }
  competitions: (year: number, month: number) =>
    `${BASE_URL}/api/v1/globalschedule/competitions/${year}/${month}`,
  // Returns { matches: [...] }  — date format: YYYY-MM-DD
  schedule: (from: string, to: string) =>
    `${BASE_URL}/api/v1/globalschedule/${from}/${to}`,
};

function now(): string {
  return DateTime.now().toUTC().toISO()!;
}

function normalizeTier(str: string): TournamentTier {
  const s = str.toLowerCase();
  if (s.includes('elite')) return TournamentTier.ELITE16;
  if (s.includes('challenger')) return TournamentTier.CHALLENGER;
  if (s.includes('major')) return TournamentTier.MAJOR;
  if (s.includes('futures')) return TournamentTier.FUTURES;
  return TournamentTier.CHALLENGER;
}

// "Doha, Qatar" → "Doha"   "Indian Wells" → "Indian Wells"
function cityFromDestination(destination: string): string {
  return (destination ?? '').split(',')[0].trim();
}

// Shape returned by /api/v1/globalschedule/competitions/{year}/{month}
interface ApiCompetition {
  season: string;
  name: string;
  competitionShortName: string;
  competitionFullName: string;
  url: string;
  menTournaments: string | null;
  womenTournaments: string | null;
  startDate: string;
  endDate: string;
  destination: string;
  venue: string | null;
  discipline: string; // "beach" | "volley"
  subCompetitionType: string;
}

// Shape returned by /api/v1/globalschedule/{from}/{to}
interface ApiMatch {
  matchNo: number;
  matchNoInTournament: number;
  tournamentNo: number;
  competitionSlug: string;
  competitionShortName: string;
  matchDateUtc: string;
  matchDateTimeLocal: string;
  isMatchTBD: boolean;
  teamANo: number;
  teamBNo: number;
  teamAScore: number | null;
  teamBScore: number | null;
  winnerTeamNo: number | null;
  sets: { no: number; pointsTeamA: number; pointsTeamB: number }[];
  matchStatus: number; // 0 = scheduled, 1 = live, 2 = completed
  roundNo: number;
  roundName: string;
  roundCode: string;
  pool: { no: number; name: string; code: string } | null;
  city: string;
  countryCode: string;
  country: string;
  discipline: string;
  gender: string;
}

export class VolleyballWorldService {
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browser;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Fetch beach volleyball competitions for a given year+month directly from the
   * en.volleyballworld.com REST API. No Puppeteer required.
   */
  private async fetchCompetitionsForMonth(
    year: number,
    month: number,
    scrapedAt: string,
  ): Promise<RawTournament[]> {
    const url = API.competitions(year, month);
    const { data } = await axios.get<{ competitions: ApiCompetition[] }>(url, {
      timeout: 15000,
    });

    const competitions: ApiCompetition[] = data?.competitions ?? [];
    const tournaments: RawTournament[] = [];

    for (const c of competitions) {
      if (c.discipline !== 'beach') continue;

      const city = cityFromDestination(c.destination);
      // The API returns ISO8601 dates in UTC already
      const startDate = c.startDate ?? '';
      const endDate = c.endDate ?? '';

      // One competition may have separate men's and women's brackets;
      // create one entry per gender bracket that exists.
      const brackets: { id: string; gender: Gender }[] = [];
      if (c.menTournaments)   brackets.push({ id: c.menTournaments,   gender: Gender.MEN });
      if (c.womenTournaments) brackets.push({ id: c.womenTournaments, gender: Gender.WOMEN });
      if (brackets.length === 0) {
        // No tournament IDs — create a genderless entry
        brackets.push({ id: c.url?.split('/').pop() ?? String(Math.random()), gender: Gender.WOMEN });
      }

      for (const bracket of brackets) {
        tournaments.push({
          id: `vw-${bracket.id}`,
          name: c.competitionFullName || c.name,
          tier: normalizeTier(c.subCompetitionType || c.name),
          city,
          country: '', // destination may include country after comma if needed
          startDate,
          endDate,
          gender: bracket.gender,
          source: SOURCE,
          sourceUrl: c.url ? `${BASE_URL}${c.url}` : `${BASE_URL}/en/beachvolleyball/competitions`,
          scrapedAt,
        });
      }
    }

    return tournaments;
  }

  /**
   * Fetch beach volleyball matches from the global schedule API for a date window.
   * Returns raw match data including scores and status.
   */
  async getScheduledMatches(fromDate: DateTime, toDate: DateTime): Promise<RawMatch[]> {
    const from = fromDate.toFormat('yyyy-MM-dd');
    const to   = toDate.toFormat('yyyy-MM-dd');
    const url  = API.schedule(from, to);
    const scrapedAt = now();

    const { data } = await axios.get<{ matches: ApiMatch[] }>(url, { timeout: 15000 });
    const matches: ApiMatch[] = (data?.matches ?? []).filter(m => m.discipline === 'beach');

    return matches.map(m => {
      const gender = m.gender?.toLowerCase().includes('men') && !m.gender?.toLowerCase().includes('women')
        ? Gender.MEN : Gender.WOMEN;

      const makePlayer = (teamNo: number, label: 'A' | 'B'): RawPlayer => ({
        id: `vw-team-${teamNo}-${label}`,
        name: `Team ${teamNo}`,
        normalizedName: `team ${teamNo}`,
        gender,
        source: SOURCE,
        sourceUrl: url,
        scrapedAt,
      });

      const team1: RawTeam = { player1: makePlayer(m.teamANo, 'A') };
      const team2: RawTeam = { player1: makePlayer(m.teamBNo, 'B') };

      let status: MatchStatus;
      if (m.matchStatus === 1) status = MatchStatus.LIVE;
      else if (m.matchStatus === 2) status = MatchStatus.COMPLETED;
      else status = MatchStatus.SCHEDULED;

      const score = (m.teamAScore != null && m.teamBScore != null)
        ? `${m.teamAScore}-${m.teamBScore}`
        : undefined;

      return {
        id: `vw-match-${m.matchNo}`,
        tournamentId: `vw-${m.tournamentNo}`,
        round: m.roundName || m.roundCode,
        scheduledAt: m.matchDateUtc,
        scheduledAtLocalEvent: m.matchDateTimeLocal,
        timezone: m.city ? toUTC(m.matchDateTimeLocal, m.city, m.countryCode).timezone : 'UTC',
        team1,
        team2,
        score,
        status,
        source: SOURCE,
        sourceUrl: `${BASE_URL}/en/beachvolleyball/competitions/${m.competitionSlug}`,
        scrapedAt,
      } as RawMatch;
    });
  }

  /**
   * Main entry: fetch all upcoming beach volleyball tournaments.
   * Covers this month + the next 5 months so the calendar stays populated.
   */
  async getTournaments(): Promise<RawTournament[]> {
    const scrapedAt = now();
    const today = DateTime.now();
    const tournaments: RawTournament[] = [];
    const seen = new Set<string>();

    for (let offset = 0; offset < 6; offset++) {
      const dt = today.plus({ months: offset });
      try {
        const batch = await this.fetchCompetitionsForMonth(dt.year, dt.month, scrapedAt);
        for (const t of batch) {
          if (!seen.has(t.id)) {
            seen.add(t.id);
            tournaments.push(t);
          }
        }
      } catch (e) {
        console.warn(`[volleyballWorldService] Failed to fetch ${dt.year}/${dt.month}:`, (e as Error).message);
      }
    }

    console.log(`[volleyballWorldService] Fetched ${tournaments.length} beach tournaments across 6 months`);
    return tournaments;
  }

  /**
   * Scrape the draw for a specific tournament to get player names.
   * The global schedule API only returns team IDs, not names — Puppeteer fills that gap.
   * Falls back to an empty array if the page structure changes.
   */
  async getTournamentMatches(tournamentId: string, city: string, country: string): Promise<RawMatch[]> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    const scrapedAt = now();
    const sourceUrl = `${BASE_URL}/en/beachvolleyball/competitions/${tournamentId}/results`;

    try {
      await page.goto(sourceUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      try {
        await page.waitForSelector('[class*="Match"], [class*="match"], [class*="game"]', { timeout: 8000 });
      } catch {
        console.warn(`[volleyballWorldService] No match elements found for tournament ${tournamentId}`);
        return [];
      }

      const rawMatches = await page.evaluate((tId, src) => {
        const matches: {
          round: string; scheduledAt: string;
          team1p1: string; team1p2: string;
          team2p1: string; team2p2: string;
          score: string; status: string; watchUrl: string;
        }[] = [];

        document.querySelectorAll(
          '[class*="MatchCard"], [class*="match-card"], [class*="match-item"]'
        ).forEach(el => {
          const round = el.querySelector('[class*="round"], [class*="phase"]')?.textContent?.trim() ?? '';
          const dateEl = el.querySelector('time, [class*="time"], [class*="date"]');
          const scheduledAt = (dateEl as HTMLTimeElement)?.dateTime ?? dateEl?.textContent?.trim() ?? '';
          const teamEls = el.querySelectorAll('[class*="Team"], [class*="team"]');
          const t1p1 = teamEls[0]?.querySelectorAll('[class*="player"], span')[0]?.textContent?.trim() ?? '';
          const t1p2 = teamEls[0]?.querySelectorAll('[class*="player"], span')[1]?.textContent?.trim() ?? '';
          const t2p1 = teamEls[1]?.querySelectorAll('[class*="player"], span')[0]?.textContent?.trim() ?? '';
          const t2p2 = teamEls[1]?.querySelectorAll('[class*="player"], span')[1]?.textContent?.trim() ?? '';
          const score = el.querySelector('[class*="score"], [class*="Score"]')?.textContent?.trim() ?? '';
          const status = el.querySelector('[class*="live"], [class*="status"]')?.textContent?.trim().toUpperCase() ?? '';
          const watchUrl = (el.querySelector('a[href*="watch"], a[href*="livestream"]') as HTMLAnchorElement)?.href ?? '';
          matches.push({ round, scheduledAt, team1p1: t1p1, team1p2: t1p2, team2p1: t2p1, team2p2: t2p2, score, status, watchUrl });
        });

        return matches;
      }, tournamentId, sourceUrl);

      return rawMatches.map((m, i) => {
        const parsed = toUTC(m.scheduledAt || now(), city, country);
        const makePlayer = (name: string): RawPlayer => ({
          id: `vw-player-${name.toLowerCase().replace(/\s+/g, '-')}`,
          name,
          normalizedName: name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z\s]/g, '').trim(),
          source: SOURCE,
          sourceUrl,
          scrapedAt,
        });
        const team1: RawTeam = {
          player1: makePlayer(m.team1p1 || 'Unknown'),
          player2: m.team1p2 ? makePlayer(m.team1p2) : undefined,
        };
        const team2: RawTeam | undefined = m.team2p1 ? {
          player1: makePlayer(m.team2p1),
          player2: m.team2p2 ? makePlayer(m.team2p2) : undefined,
        } : undefined;

        let status: MatchStatus = MatchStatus.SCHEDULED;
        if (m.status.includes('LIVE')) status = MatchStatus.LIVE;
        else if (m.score) status = MatchStatus.COMPLETED;

        return {
          id: `vw-match-${tournamentId}-${i}`,
          tournamentId: `vw-${tournamentId}`,
          round: m.round,
          scheduledAt: parsed.utc,
          scheduledAtLocalEvent: parsed.localEvent,
          timezone: parsed.timezone,
          team1,
          team2,
          score: m.score || undefined,
          status,
          watchUrl: m.watchUrl || undefined,
          source: SOURCE,
          sourceUrl,
          scrapedAt,
        } as RawMatch;
      });
    } finally {
      await page.close();
    }
  }
}

export const volleyballWorldService = new VolleyballWorldService();
