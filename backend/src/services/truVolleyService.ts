import axios from 'axios';
import * as cheerio from 'cheerio';
import { DateTime } from 'luxon';
import { DataSource, Gender, TVRRating } from '../types';

const SOURCE: DataSource = 'TRUVOLLEY';
const BASE_URL = 'https://www.truvolley.com';

// Gender query parameter discovered on the live site
const RATINGS_URL = (gender: 'men' | 'women') =>
  `${BASE_URL}/ratings?gender=${gender}`;

function now(): string {
  return DateTime.now().toUTC().toISO()!;
}

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export class TruVolleyService {
  /**
   * Fetch TVR global ratings for men and women.
   * The page is server-rendered HTML — no Puppeteer needed, just axios + cheerio.
   */
  async getRatings(): Promise<TVRRating[]> {
    const scrapedAt = now();
    const ratings: TVRRating[] = [];

    for (const gender of ['men', 'women'] as const) {
      const genderEnum = gender === 'men' ? Gender.MEN : Gender.WOMEN;
      const url = RATINGS_URL(gender);

      try {
        const { data: html } = await axios.get<string>(url, {
          timeout: 15000,
          headers: {
            // Identify as a real browser to avoid bot-detection soft-blocks
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
          },
        });

        const $ = cheerio.load(html);
        const rows: { rank: number; name: string; country: string; rating: number }[] = [];

        // The table has 3 columns: Rank | Name | TVR
        // A 4-column variant adds Country between Name and TVR.
        $('table tbody tr').each((_i, el) => {
          const cells = $(el).find('td');
          if (cells.length < 3) return;

          const rank   = parseInt($(cells[0]).text().trim(), 10);
          const name   = $(cells[1]).text().trim();
          let country  = '';
          let rating   = 0;

          if (cells.length >= 4) {
            country = $(cells[2]).text().trim();
            rating  = parseFloat($(cells[cells.length - 1]).text().replace(/[^0-9.]/g, ''));
          } else {
            rating  = parseFloat($(cells[2]).text().replace(/[^0-9.]/g, ''));
          }

          if (!isNaN(rank) && rank > 0 && name && !isNaN(rating) && rating > 0) {
            rows.push({ rank, name, country, rating });
          }
        });

        for (const row of rows) {
          ratings.push({
            rank: row.rank,
            name: row.name,
            normalizedName: normalizeName(row.name),
            country: row.country,
            gender: genderEnum,
            rating: row.rating,
            source: SOURCE,
            sourceUrl: url,
            scrapedAt,
          });
        }

        console.log(`[truVolleyService] Scraped ${rows.length} ${gender} ratings`);
      } catch (e) {
        console.warn(`[truVolleyService] Failed to fetch ${gender} ratings:`, (e as Error).message);
      }
    }

    return ratings;
  }
}

export const truVolleyService = new TruVolleyService();
