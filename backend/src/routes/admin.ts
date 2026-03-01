import { Router, Request, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { ReviewQueueEntry } from '../types';

export const adminRouter = Router();

const ALIASES_PATH = path.join(__dirname, '../../data/playerAliases.json');
const REVIEW_QUEUE_PATH = path.join(__dirname, '../../data/reviewQueue.json');

// Serve the admin UI
adminRouter.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../admin/index.html'));
});

// ─── API ──────────────────────────────────────────────────────────────────────

// GET /admin/api/review — all LOW-confidence players needing human review
adminRouter.get('/api/review', async (_req: Request, res: Response) => {
  try {
    const raw = await fs.readFile(REVIEW_QUEUE_PATH, 'utf-8');
    res.json(JSON.parse(raw));
  } catch {
    res.json([]);
  }
});

// GET /admin/api/aliases — current playerAliases.json contents
adminRouter.get('/api/aliases', async (_req: Request, res: Response) => {
  try {
    const raw = await fs.readFile(ALIASES_PATH, 'utf-8');
    res.json(JSON.parse(raw));
  } catch (e) {
    res.status(500).json({ error: 'Could not read aliases file' });
  }
});

// POST /admin/api/aliases/merge — confirm two source profiles are the same player
// Body: { canonicalId, aliases: string[], note?: string }
adminRouter.post('/api/aliases/merge', async (req: Request, res: Response) => {
  const { canonicalId, aliases, note } = req.body as {
    canonicalId: string;
    aliases: string[];
    note?: string;
  };

  if (!canonicalId || !Array.isArray(aliases) || aliases.length === 0) {
    res.status(400).json({ error: 'canonicalId and aliases[] are required' });
    return;
  }

  try {
    const raw = await fs.readFile(ALIASES_PATH, 'utf-8');
    const data = JSON.parse(raw);

    // Find existing entry or create new one
    const existing = data.aliases.find((a: { canonicalId: string }) => a.canonicalId === canonicalId);
    if (existing) {
      // Merge aliases (deduplicate)
      existing.aliases = Array.from(new Set([...existing.aliases, ...aliases]));
      if (note) existing.note = note;
    } else {
      data.aliases.push({ canonicalId, aliases, note });
    }

    await fs.writeFile(ALIASES_PATH, JSON.stringify(data, null, 2));

    // Remove from review queue if present
    await removeFromQueue(canonicalId);

    res.json({ ok: true, entry: existing ?? { canonicalId, aliases, note } });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update aliases' });
  }
});

// POST /admin/api/aliases/split — mark two normalized names as different players
// Body: { nameA: string, nameB: string, noteA?: string, noteB?: string }
adminRouter.post('/api/aliases/split', async (req: Request, res: Response) => {
  const { nameA, nameB, noteA, noteB } = req.body as {
    nameA: string;
    nameB: string;
    noteA?: string;
    noteB?: string;
  };

  if (!nameA || !nameB) {
    res.status(400).json({ error: 'nameA and nameB are required' });
    return;
  }

  try {
    const raw = await fs.readFile(ALIASES_PATH, 'utf-8');
    const data = JSON.parse(raw);

    // Add each as a distinct entry so they'll never merge
    const idA = `split-${nameA.toLowerCase().replace(/\s+/g, '-')}`;
    const idB = `split-${nameB.toLowerCase().replace(/\s+/g, '-')}-b`;

    data.aliases.push({ canonicalId: idA, aliases: [nameA.toLowerCase()], note: noteA ?? `Distinct from "${nameB}"` });
    data.aliases.push({ canonicalId: idB, aliases: [nameB.toLowerCase()], note: noteB ?? `Distinct from "${nameA}"` });

    await fs.writeFile(ALIASES_PATH, JSON.stringify(data, null, 2));
    res.json({ ok: true, idA, idB });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update aliases' });
  }
});

// DELETE /admin/api/review/:canonicalId — dismiss from queue without creating alias
adminRouter.delete('/api/review/:canonicalId', async (req: Request, res: Response) => {
  await removeFromQueue(req.params.canonicalId);
  res.json({ ok: true });
});

async function removeFromQueue(canonicalId: string): Promise<void> {
  try {
    const raw = await fs.readFile(REVIEW_QUEUE_PATH, 'utf-8');
    const entries: ReviewQueueEntry[] = JSON.parse(raw);
    const filtered = entries.filter(e => e.canonicalId !== canonicalId);
    await fs.writeFile(REVIEW_QUEUE_PATH, JSON.stringify(filtered, null, 2));
  } catch { /* queue may not exist yet */ }
}
