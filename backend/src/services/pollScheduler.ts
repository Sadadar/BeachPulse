import cron from 'node-cron';
import { AVPRankingsService } from './avpRankings';
import { VolleyballWorldService } from './volleyballWorldService';
import { TruVolleyService } from './truVolleyService';
import { RawTournament } from '../types';
import { DateTime } from 'luxon';

const avpService = new AVPRankingsService();
const vwService = new VolleyballWorldService();
const tvService = new TruVolleyService();

// Shared cache — services write here; resolvers read from here
export const cache = {
  tournaments: [] as RawTournament[],
  tvrRatings: [] as Awaited<ReturnType<TruVolleyService['getRatings']>>,
  lastUpdated: {
    tournaments: 0,
    avpRankings: 0,
    tvrRatings: 0,
  },
};

function isActiveTournamentWeek(tournament: RawTournament): boolean {
  const now = DateTime.now().toUTC();
  const start = DateTime.fromISO(tournament.startDate, { zone: 'UTC' });
  const end = DateTime.fromISO(tournament.endDate, { zone: 'UTC' });
  const weekBefore = start.minus({ weeks: 1 });
  return now >= weekBefore && now <= end;
}

async function refreshAvpRankings() {
  try {
    console.log('[pollScheduler] Refreshing AVP rankings...');
    await avpService.refreshRankings();
    cache.lastUpdated.avpRankings = Date.now();
    console.log('[pollScheduler] AVP rankings updated');
  } catch (e) {
    console.error('[pollScheduler] AVP rankings refresh failed:', e);
  }
}

async function refreshTvrRatings() {
  try {
    console.log('[pollScheduler] Refreshing TVR ratings...');
    cache.tvrRatings = await tvService.getRatings();
    cache.lastUpdated.tvrRatings = Date.now();
    console.log(`[pollScheduler] TVR ratings updated: ${cache.tvrRatings.length} ratings`);
  } catch (e) {
    console.error('[pollScheduler] TVR ratings refresh failed:', e);
  }
}

async function refreshTournamentCalendar() {
  try {
    console.log('[pollScheduler] Refreshing tournament calendar...');
    cache.tournaments = await vwService.getTournaments();
    cache.lastUpdated.tournaments = Date.now();
    console.log(`[pollScheduler] Tournament calendar updated: ${cache.tournaments.length} tournaments`);
  } catch (e) {
    console.error('[pollScheduler] Tournament calendar refresh failed:', e);
  }
}

async function refreshActiveTournamentRegistrations() {
  const active = cache.tournaments.filter(isActiveTournamentWeek);
  if (active.length === 0) return;

  console.log(`[pollScheduler] Refreshing registrations for ${active.length} active tournaments...`);
  for (const t of active) {
    try {
      // Re-fetch tournament detail which includes registered teams
      const matches = await vwService.getTournamentMatches(
        t.id.replace('vw-', ''),
        t.city,
        t.country
      );
      console.log(`[pollScheduler] ${t.name}: ${matches.length} matches`);
    } catch (e) {
      console.error(`[pollScheduler] Failed to refresh ${t.name}:`, e);
    }
  }
}

export class PollScheduler {
  private tasks: ReturnType<typeof cron.schedule>[] = [];
  private started = false;

  start() {
    if (this.started) return;
    this.started = true;

    // Daily at 3 AM UTC: refresh rankings and tournament calendar
    this.tasks.push(
      cron.schedule('0 3 * * *', async () => {
        await refreshAvpRankings();
        await refreshTvrRatings();
        await refreshTournamentCalendar();
      }, { timezone: 'UTC' })
    );

    // Every 6 hours: refresh tournament registrations (rosters change up to day-of)
    this.tasks.push(
      cron.schedule('0 */6 * * *', async () => {
        await refreshActiveTournamentRegistrations();
      }, { timezone: 'UTC' })
    );

    // Initial load on startup (non-blocking)
    void refreshTournamentCalendar();
    void refreshTvrRatings();

    console.log('[pollScheduler] Background polling started');
  }

  stop() {
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];
    this.started = false;
  }
}

export const pollScheduler = new PollScheduler();
