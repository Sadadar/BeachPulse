import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { apiRouter } from './routes/api';
import { adminRouter } from './routes/admin';
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import { pollScheduler } from './services/pollScheduler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  // Apollo Studio/sandbox needs these relaxed for dev
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// REST routes
app.use('/api', apiRouter);
app.use('/admin', express.static('src/admin'), adminRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

async function start() {
  // GraphQL
  const apollo = new ApolloServer({ typeDefs, resolvers });
  await apollo.start();
  app.use('/graphql', expressMiddleware(apollo));

  // Start background polling
  pollScheduler.start();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`GraphQL: http://localhost:${PORT}/graphql`);
  });
}

start().catch(console.error);
