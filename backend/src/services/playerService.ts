import { promises as fs } from 'fs';
import path from 'path';
import {
  DataSource,
  MatchConfidence,
  Partnership,
  PlayerAlias,
  RawPlayer,
  ResolvedPlayer,
  ReviewQueueEntry,
  SourcedValue,
  TVRRating,
} from '../types';
import { DateTime } from 'luxon';

const ALIASES_PATH = path.join(__dirname, '../../data/playerAliases.json');
const REVIEW_QUEUE_PATH = path.join(__dirname, '../../data/reviewQueue.json');

interface AliasesFile {
  version: string;
  aliases: PlayerAlias[];
}

/**
 * Normalize a player name for fuzzy matching:
 * - Unicode NFD decomposition (Patrícia → Patricia, Höbinger → Hobinger)
 * - Strip combining diacritics
 * - Lowercase
 * - Strip remaining non-alpha punctuation (keep spaces)
 * - Collapse whitespace
 */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strip middle initials for coarse matching (intentionally lossy).
 * "Megan J Rice" → "megan rice"
 */
export function normalizeNameCoarse(name: string): string {
  return normalizeName(name)
    .split(' ')
    .filter((part) => part.length > 1)
    .join(' ');
}

export class PlayerService {
  private aliases: PlayerAlias[] = [];
  private aliasMap = new Map<string, string>(); // normalizedName → canonicalId
  private initialized = false;

  // In-memory partnership history: canonicalId → Partnership[]
  private partnershipHistory = new Map<string, Partnership[]>();

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const raw = await fs.readFile(ALIASES_PATH, 'utf-8');
      const data: AliasesFile = JSON.parse(raw);
      this.aliases = data.aliases;
      for (const entry of this.aliases) {
        for (const alias of entry.aliases) {
          this.aliasMap.set(normalizeName(alias), entry.canonicalId);
        }
      }
    } catch (e) {
      console.warn('[playerService] Could not load playerAliases.json:', e);
    }
    this.initialized = true;
  }

  // ─── Partnership History ────────────────────────────────────────────────────

  /**
   * Record a partnership observation. Called whenever a match or registration
   * is scraped and a team is seen together.
   */
  recordPartnership(
    canonicalId: string,
    partnerName: string,
    source: DataSource,
    sourceUrl: string,
    scrapedAt: string,
    partnerId?: string,
    matchDate?: string,
  ): void {
    const partnerNorm = normalizeName(partnerName);
    const existing = this.partnershipHistory.get(canonicalId) ?? [];

    // Find an open (current) partnership with this partner
    const openIdx = existing.findIndex(
      (p) => p.partnerNormalizedName === partnerNorm && !p.endDate
    );

    if (openIdx >= 0) {
      // Update scrapedAt to reflect we've seen them together more recently
      existing[openIdx] = { ...existing[openIdx], scrapedAt };
    } else {
      // Close any previously open partnership with a different partner
      const previousOpenIdx = existing.findIndex((p) => !p.endDate);
      if (previousOpenIdx >= 0) {
        existing[previousOpenIdx] = { ...existing[previousOpenIdx], endDate: scrapedAt };
      }

      existing.push({
        partnerId,
        partnerName,
        partnerNormalizedName: partnerNorm,
        startDate: matchDate ?? scrapedAt,
        endDate: undefined,
        source,
        sourceUrl,
        scrapedAt,
      });
    }

    this.partnershipHistory.set(canonicalId, existing);
  }

  /**
   * Returns the current (most recent open) partnership for a canonical player.
   */
  getCurrentPartnership(canonicalId: string): Partnership | undefined {
    const history = this.partnershipHistory.get(canonicalId) ?? [];
    return history.find((p) => !p.endDate);
  }

  /**
   * Check if a partner name matches any known partnership (current or historical).
   * Used to upgrade confidence during resolution.
   */
  hasKnownPartnership(canonicalId: string, partnerNormalizedName: string): boolean {
    const history = this.partnershipHistory.get(canonicalId) ?? [];
    return history.some((p) => p.partnerNormalizedName === partnerNormalizedName);
  }

  // ─── Identity Resolution ───────────────────────────────────────────────────

  /**
   * Resolve a raw player from any source to a canonical ID + confidence level.
   */
  resolveCanonicalId(
    player: RawPlayer,
    partnerName?: string,
  ): { canonicalId: string; confidence: MatchConfidence } {
    const normalized = normalizeName(player.name);

    // 1. Manual alias → HIGH
    if (this.aliasMap.has(normalized)) {
      return { canonicalId: this.aliasMap.get(normalized)!, confidence: 'HIGH' };
    }

    // 2. Volleyball World source — use their ID directly → HIGH
    if (player.source === 'VOLLEYBALL_WORLD') {
      return { canonicalId: player.id, confidence: 'HIGH' };
    }

    // 3. Name + partner cross-reference
    if (partnerName) {
      const partnerNorm = normalizeName(partnerName);
      const partnerCoarse = normalizeNameCoarse(partnerName);
      const candidateId = `resolved-${normalized.replace(/\s+/g, '-')}`;

      // If partner matches a CURRENT known partnership → HIGH
      const currentPartnership = this.getCurrentPartnership(candidateId);
      if (currentPartnership && currentPartnership.partnerNormalizedName === partnerNorm) {
        return { canonicalId: candidateId, confidence: 'HIGH' };
      }

      // If partner matches any HISTORICAL partnership → MEDIUM (upgraded)
      if (this.hasKnownPartnership(candidateId, partnerNorm) ||
          this.hasKnownPartnership(candidateId, partnerCoarse)) {
        return { canonicalId: candidateId, confidence: 'MEDIUM' };
      }

      // Partner provided but not in history → MEDIUM
      const candidate = `resolved-${normalized.replace(/\s+/g, '-')}-with-${partnerCoarse.replace(/\s+/g, '-')}`;
      return { canonicalId: candidate, confidence: 'MEDIUM' };
    }

    // 4. Name only → LOW
    const coarse = normalizeNameCoarse(player.name);
    return {
      canonicalId: `unresolved-${coarse.replace(/\s+/g, '-')}`,
      confidence: 'LOW',
    };
  }

  // ─── Merging ───────────────────────────────────────────────────────────────

  /**
   * Merge a list of RawPlayers (same person from different sources) into a ResolvedPlayer.
   */
  mergePlayerSources(
    players: RawPlayer[],
    tvrRatings: TVRRating[] = [],
  ): ResolvedPlayer {
    if (players.length === 0) throw new Error('Cannot merge empty player list');

    const sourcePriority: DataSource[] = ['VOLLEYBALL_WORLD', 'AVP', 'VOLLEYBALL_LIFE', 'FIVB_12NDR', 'TRUVOLLEY'];
    const sorted = [...players].sort(
      (a, b) => sourcePriority.indexOf(a.source) - sourcePriority.indexOf(b.source)
    );
    const primary = sorted[0];

    const { canonicalId, confidence } = this.resolveCanonicalId(
      primary,
      primary.currentPartnerName,
    );

    const normalizedPrimary = normalizeName(primary.name);

    // TVR rating
    const tvrEntry = tvrRatings.find(
      (r) => normalizeName(r.name) === normalizedPrimary ||
             normalizeNameCoarse(r.name) === normalizeNameCoarse(primary.name)
    );
    const tvrRating: SourcedValue<number> | undefined = tvrEntry
      ? { value: tvrEntry.rating, source: 'TRUVOLLEY', scrapedAt: tvrEntry.scrapedAt, sourceUrl: tvrEntry.sourceUrl }
      : undefined;

    // AVP rank
    const avpSource = players.find((p) => p.source === 'AVP' && p.avpRank !== undefined);
    const avpRank: SourcedValue<number> | undefined = avpSource?.avpRank !== undefined
      ? { value: avpSource.avpRank!, source: 'AVP', scrapedAt: avpSource.scrapedAt, sourceUrl: avpSource.sourceUrl }
      : undefined;

    // Aggregate partnership history from all sources
    const partnerships = this.partnershipHistory.get(canonicalId) ?? [];

    // Seed current partner from raw data if not yet in history
    if (primary.currentPartnerName && partnerships.length === 0) {
      partnerships.push({
        partnerName: primary.currentPartnerName,
        partnerNormalizedName: normalizeName(primary.currentPartnerName),
        source: primary.source,
        sourceUrl: primary.sourceUrl,
        scrapedAt: primary.scrapedAt,
      });
    }

    return {
      canonicalId,
      name: primary.name,
      normalizedName: normalizedPrimary,
      country: primary.country,
      gender: primary.gender,
      tvrRating,
      avpRank,
      currentPartner: undefined, // populated by caller if needed
      partnerships,
      sources: players.map((p) => ({ source: p.source, externalId: p.id, profileUrl: p.profileUrl })),
      confidence,
    };
  }

  // ─── Search ────────────────────────────────────────────────────────────────

  searchPlayers(query: string, players: ResolvedPlayer[]): ResolvedPlayer[] {
    const q = normalizeName(query);
    return players
      .filter((p) => p.normalizedName.includes(q))
      .sort((a, b) => {
        if (a.normalizedName === q) return -1;
        if (b.normalizedName === q) return 1;
        if (a.normalizedName.startsWith(q) && !b.normalizedName.startsWith(q)) return -1;
        if (b.normalizedName.startsWith(q) && !a.normalizedName.startsWith(q)) return 1;
        return 0;
      });
  }

  // ─── Review Queue ──────────────────────────────────────────────────────────

  /**
   * Log LOW-confidence matches to the review queue file for the admin panel.
   */
  async writeReviewQueue(players: ResolvedPlayer[]): Promise<void> {
    const low = players.filter((p) => p.confidence === 'LOW');
    if (low.length === 0) return;

    const entries: ReviewQueueEntry[] = low.map((p) => ({
      canonicalId: p.canonicalId,
      name: p.name,
      normalizedName: p.normalizedName,
      confidence: p.confidence,
      sources: p.sources,
      flaggedAt: DateTime.now().toUTC().toISO()!,
      reason: 'Name-only match across sources — no Volleyball World ID or known partner to confirm identity',
    }));

    try {
      await fs.mkdir(path.dirname(REVIEW_QUEUE_PATH), { recursive: true });
      // Merge with any existing entries (deduplicate by canonicalId)
      let existing: ReviewQueueEntry[] = [];
      try {
        const raw = await fs.readFile(REVIEW_QUEUE_PATH, 'utf-8');
        existing = JSON.parse(raw);
      } catch { /* first run */ }

      const existingIds = new Set(existing.map((e) => e.canonicalId));
      const newEntries = entries.filter((e) => !existingIds.has(e.canonicalId));
      await fs.writeFile(REVIEW_QUEUE_PATH, JSON.stringify([...existing, ...newEntries], null, 2));
      console.log(`[playerService] ${newEntries.length} new LOW-confidence players added to review queue`);
    } catch (e) {
      console.error('[playerService] Failed to write review queue:', e);
    }
  }

  auditLowConfidence(players: ResolvedPlayer[]): void {
    const low = players.filter((p) => p.confidence === 'LOW');
    if (low.length > 0) {
      console.warn(
        `[playerService] ${low.length} LOW-confidence resolutions need review:`,
        low.map((p) => `${p.name} (${p.canonicalId})`).join(', ')
      );
    }
  }
}

export const playerService = new PlayerService();
