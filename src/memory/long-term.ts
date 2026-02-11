import type { PrismaClient } from '@prisma/client';
import { generateEmbedding } from './embeddings.js';
import type {
  MemoryEntry,
  MemorySearchResult,
  MemoryQuery,
  StoreOptions,
} from './types.js';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'long-term-memory' });

export class LongTermMemory {
  constructor(
    private prisma: PrismaClient,
    private agentId: string,
    private namespace: string,
  ) {}

  async store(content: string, options: StoreOptions): Promise<string> {
    const embedding = await generateEmbedding(content);
    const vectorStr = `[${embedding.join(',')}]`;

    const result = await this.prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO memory_entries (
        id, agent_id, namespace, content, embedding, memory_type,
        source, importance, tags, metadata, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        ${this.agentId},
        ${this.namespace},
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
    log.debug({ id, namespace: this.namespace }, 'Memory stored');
    return id;
  }

  async search(query: MemoryQuery): Promise<MemorySearchResult[]> {
    const embedding = await generateEmbedding(query.query);
    const vectorStr = `[${embedding.join(',')}]`;
    const limit = query.limit ?? 5;
    const namespace = query.namespace ?? this.namespace;
    const minImportance = query.minImportance ?? 0;

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
      WHERE namespace = ${namespace}
        AND embedding IS NOT NULL
        AND importance >= ${minImportance}
        ${query.memoryType ? this.prisma.$queryRaw`AND memory_type = ${query.memoryType}` : this.prisma.$queryRaw``}
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

  async forget(memoryId: string): Promise<void> {
    await this.prisma.memoryEntry.delete({ where: { id: memoryId } });
    log.debug({ memoryId }, 'Memory forgotten');
  }

  async updateAccessCount(memoryId: string): Promise<void> {
    await this.prisma.memoryEntry.update({
      where: { id: memoryId },
      data: {
        accessCount: { increment: 1 },
        lastAccessed: new Date(),
      },
    });
  }
}
