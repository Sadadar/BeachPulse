import express from 'express';
import { AVPRankingsService } from '../services/avpRankings';

const router = express.Router();
const rankingsService = new AVPRankingsService();

// Get current rankings
router.get('/', async (req, res) => {
    try {
        const rankings = await rankingsService.getRankings();
        res.json(rankings);
    } catch (error) {
        console.error('Error fetching rankings:', error);
        res.status(500).json({ error: 'Failed to fetch rankings' });
    }
});

// Refresh rankings
router.post('/refresh', async (req, res) => {
    try {
        const rankings = await rankingsService.refreshRankings();
        res.json(rankings);
    } catch (error) {
        console.error('Error refreshing rankings:', error);
        res.status(500).json({ error: 'Failed to refresh rankings' });
    }
});

export default router; 