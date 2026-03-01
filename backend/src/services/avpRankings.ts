import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { promises as fs } from 'fs';
import path from 'path';
import puppeteer, { Page } from 'puppeteer';

interface PlayerRanking {
    rank: number;
    name: string;
    points: number;
}

interface Rankings {
    men: PlayerRanking[];
    women: PlayerRanking[];
}

export class AVPRankingsService {
    private readonly RANKINGS_URL = 'https://avp.volleyballlife.com/rankings/33';
    private readonly CSV_PATH = path.join(__dirname, '../../data/rankings.csv');
    private rankings: Rankings = { men: [], women: [] };

    constructor() {
        this.initializeRankings();
    }

    private async initializeRankings() {
        try {
            // Check if file exists before trying to read it
            try {
                await fs.access(this.CSV_PATH);
                await this.loadFromCSV();
            } catch (error) {
                console.log('No rankings CSV file found, will fetch on first request');
            }
        } catch (error) {
            console.error('Error initializing rankings:', error);
        }
    }

    private async loadFromCSV(): Promise<void> {
        try {
            const csvContent = await fs.readFile(this.CSV_PATH, 'utf-8');
            const records = parse(csvContent, {
                columns: true,
                skip_empty_lines: true
            });

            this.rankings = {
                men: records.filter((r: any) => r.gender === 'men').map((r: any) => ({
                    rank: parseInt(r.rank),
                    name: r.name,
                    points: parseInt(r.points)
                })),
                women: records.filter((r: any) => r.gender === 'women').map((r: any) => ({
                    rank: parseInt(r.rank),
                    name: r.name,
                    points: parseInt(r.points)
                }))
            };

            // Validate that we have enough data
            if (this.rankings.men.length < 50 || this.rankings.women.length < 50) {
                await this.fetchAndUpdateRankings();
            }
        } catch (error) {
            console.error('Error loading rankings from CSV:', error);
            throw error;
        }
    }

    private async saveToCSV(rankings: Rankings): Promise<void> {
        try {
            // Ensure data directory exists
            await fs.mkdir(path.dirname(this.CSV_PATH), { recursive: true });

            const records = [
                ...rankings.men.map(r => ({ ...r, gender: 'men' })),
                ...rankings.women.map(r => ({ ...r, gender: 'women' }))
            ];

            const csvContent = stringify(records, {
                header: true,
                columns: ['gender', 'rank', 'name', 'points']
            });

            await fs.writeFile(this.CSV_PATH, csvContent);
        } catch (error) {
            console.error('Error saving rankings to CSV:', error);
            throw error;
        }
    }

    async getRankings(): Promise<Rankings> {
        // If we don't have complete rankings, fetch them
        if (this.rankings.men.length < 50 || this.rankings.women.length < 50) {
            await this.fetchAndUpdateRankings();
        }
        return this.rankings;
    }

    async refreshRankings(): Promise<Rankings> {
        try {
            // Backup existing CSV if it exists
            try {
                await fs.access(this.CSV_PATH);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupPath = `${this.CSV_PATH}.${timestamp}.bak`;
                await fs.rename(this.CSV_PATH, backupPath);
                console.log(`Backed up existing CSV to ${backupPath}`);
            } catch (error) {
                console.log('No existing CSV to backup');
            }

            // Clear in-memory rankings
            this.rankings = { men: [], women: [] };

            // Fetch fresh rankings
            return await this.fetchAndUpdateRankings();
        } catch (error) {
            console.error('Error refreshing rankings:', error);
            throw new Error('Failed to refresh rankings');
        }
    }

    private async extractRankingsFromTable(page: Page): Promise<PlayerRanking[]> {
        const rankings: PlayerRanking[] = [];

        // Wait for the table to be loaded
        await page.waitForSelector('table tbody tr', { timeout: 10000 });

        // Get all rows
        const rows = await page.$$('table tbody tr');
        console.log(`Found ${rows.length} rows in table`);

        for (let i = 0; i < Math.min(rows.length, 50); i++) {
            const row = rows[i];
            const cells = await row.$$('td');

            if (cells.length >= 4) {
                const rank = parseInt(await cells[0].evaluate(el => el.textContent?.trim() || '0'));
                const name = await cells[1].evaluate(el => el.querySelector('a')?.textContent?.trim() || '');
                const points = parseFloat(await cells[3].evaluate(el => el.textContent?.trim() || '0'));

                if (!isNaN(rank) && name && !isNaN(points)) {
                    rankings.push({ rank, name, points });
                }
            }
        }

        return rankings;
    }

    async fetchAndUpdateRankings(): Promise<Rankings> {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();

            // Set a longer timeout for the page to load
            await page.setDefaultNavigationTimeout(30000);

            // Disable cache
            await page.setCacheEnabled(false);

            const newRankings: Rankings = {
                men: [],
                women: []
            };

            // Load the page once — it defaults to the women's tab
            await page.goto(this.RANKINGS_URL, { waitUntil: 'networkidle0' });

            // Get women's rankings (default tab)
            console.log('Fetching women\'s rankings...');
            await page.waitForSelector('button[value="girls"]', { timeout: 10000 });
            await page.click('button[value="girls"]');
            await new Promise(resolve => setTimeout(resolve, 1500));
            newRankings.women = await this.extractRankingsFromTable(page);

            // Switch to men's tab
            console.log('Fetching men\'s rankings...');
            await page.click('button[value="boys"]');
            await new Promise(resolve => setTimeout(resolve, 1500));
            newRankings.men = await this.extractRankingsFromTable(page);

            console.log('Parsed rankings:', {
                menCount: newRankings.men.length,
                womenCount: newRankings.women.length
            });

            // Update in-memory rankings and save to CSV
            this.rankings = newRankings;
            await this.saveToCSV(newRankings);

            return newRankings;
        } catch (error) {
            console.error('Error fetching AVP rankings:', error);
            throw new Error('Failed to fetch AVP rankings');
        } finally {
            await browser.close();
        }
    }
} 