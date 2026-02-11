import { PrismaClient } from '@prisma/client';
import { getLogger } from '../logger/index.js';

let prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log:
        process.env['NODE_ENV'] === 'development'
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'error' },
            ]
          : [{ emit: 'stdout', level: 'error' }],
    });
  }
  return prisma;
}

export async function initializeDatabase(): Promise<PrismaClient> {
  const client = getPrisma();
  const logger = getLogger();

  try {
    await client.$connect();
    logger.info('Database connected');

    // Ensure pgvector extension is available
    await client.$executeRawUnsafe(
      'CREATE EXTENSION IF NOT EXISTS vector',
    );
    logger.info('pgvector extension ready');
  } catch (err) {
    logger.error({ err }, 'Database initialization failed');
    throw err;
  }

  return client;
}

export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
    getLogger().info('Database disconnected');
  }
}
