import type { PrismaClient } from '@prisma/client';
import { generateEmbedding } from './embeddings.js';
import type { MemorySearchResult, StoreOptions } from './types.js';
import type { MemoryEntry } from './types.js';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'shared-memory' });

const SHARED_NAMESPACE = 'shared';

export class SharedMemory {
  constructor(private prisma: PrismaClient) {}

  async store(content: string, options: StoreOptions): Promise<string> {
    const embedding = await generateEmbedding(content);
    const vectorStr = `[${embedding.join(',')}]`;

    const result = await this.prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO memory_entries (
        id, agent_id, namespace, content, embedding, memory_type,
        source, importance, tags, metadata, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        NULL,
        ${SHARED_NAMESPACE},
        ${content},
        ${vectorStr}::vector,
        ${options.memoryType},
        ${options.source ?? null},
        ${options.importance ?? 0.5},
        ${options.tags ?? []},
        ${options.metadata ? JSON.stringify(options.metadata) : null}::jsonb,
        NOW(),
        NOW()
      )
      RETURNING id
    `;

    const id = result[0]!.id;
    log.debug({ id }, 'Shared memory stored');
    return id;
  }

  async search(
    query: string,
    limit: number = 5,
  ): Promise<MemorySearchResult[]> {
    const embedding = await generateEmbedding(query);
    const vectorStr = `[${embedding.join(',')}]`;

    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        namespace: string;
        content: string;
        summary: string | null;
        memory_type: string;
        source: string | null;
        importance: number;
        tags: string[];
        metadata: unknown;
        created_at: Date;
        similarity: number;
      }>
    >`
      SELECT
        id, namespace, content, summary, memory_type, source,
        importance, tags, metadata, created_at,
        1 - (embedding <=> ${vectorStr}::vector) as similarity
      FROM memory_entries
      WHERE namespace = ${SHARED_NAMESPACE}
        AND embedding IS NOT NULL
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `;

    return results.map((r) => ({
      entry: {
        id: r.id,
        namespace: r.namespace,
        content: r.content,
        summary: r.summary ?? undefined,
        memoryType: r.memory_type as MemoryEntry['memoryType'],
        source: r.source ?? undefined,
        importance: r.importance,
        tags: r.tags,
        metadata: r.metadata as Record<string, unknown> | undefined,
        createdAt: r.created_at,
      },
      similarity: r.similarity,
    }));
  }
}
