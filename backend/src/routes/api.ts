import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const apiRouter = Router();

// In-memory storage for demo (replace with database later)
interface CounterData {
  id: string;
  count: number;
  lastUpdated: Date;
}

let counterData: CounterData = {
  id: uuidv4(),
  count: 0,
  lastUpdated: new Date()
};

// Get current counter value
apiRouter.get('/counter', (req, res) => {
  res.json(counterData);
});

// Increment counter
apiRouter.post('/counter/increment', (req, res) => {
  counterData.count += 1;
  counterData.lastUpdated = new Date();
  res.json(counterData);
});

// Reset counter
apiRouter.post('/counter/reset', (req, res) => {
  counterData.count = 0;
  counterData.lastUpdated = new Date();
  res.json(counterData);
});

