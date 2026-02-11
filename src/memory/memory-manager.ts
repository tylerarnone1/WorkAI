import type { PrismaClient } from '@prisma/client';
import type { LLMMessage } from '../llm/types.js';
import type { MemoryQuery, MemorySearchResult, StoreOptions } from './types.js';
import { ShortTermMemory } from './short-term.js';
import { LongTermMemory } from './long-term.js';
import { SharedMemory } from './shared.js';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'memory-manager' });

export class MemoryManager {
  public readonly shortTerm: ShortTermMemory;
  public readonly longTerm: LongTermMemory;
  public readonly shared: SharedMemory;

  constructor(
    prisma: PrismaClient,
    agentId: string,
    namespace: string,
  ) {
    this.shortTerm = new ShortTermMemory(prisma, agentId);
    this.longTerm = new LongTermMemory(prisma, agentId, namespace);
    this.shared = new SharedMemory(prisma);
    log.info({ agentId, namespace }, 'Memory manager initialized');
  }

  // --- Short-term (conversation context) ---

  async createConversation(
    externalId?: string,
    channel?: string,
    userId?: string,
  ): Promise<string> {
    return this.shortTerm.createConversation(externalId, channel, userId);
  }

  async getConversationHistory(
    conversationId: string,
    limit?: number,
  ): Promise<LLMMessage[]> {
    return this.shortTerm.getHistory(conversationId, limit);
  }

  async addToConversation(
    conversationId: string,
    message: LLMMessage,
  ): Promise<void> {
    return this.shortTerm.addMessage(conversationId, message);
  }

  async endConversation(conversationId: string): Promise<void> {
    return this.shortTerm.endConversation(conversationId);
  }

  async findConversation(
    externalId: string,
    channel?: string,
  ): Promise<string | null> {
    return this.shortTerm.findConversation(externalId, channel);
  }

  // --- Long-term (semantic search) ---

  async store(content: string, options: StoreOptions): Promise<string> {
    return this.longTerm.store(content, options);
  }

  async search(query: MemoryQuery): Promise<MemorySearchResult[]> {
    return this.longTerm.search(query);
  }

  async recall(
    query: string,
    limit: number = 5,
  ): Promise<MemorySearchResult[]> {
    return this.longTerm.search({ query, limit });
  }

  async forget(memoryId: string): Promise<void> {
    return this.longTerm.forget(memoryId);
  }

  // --- Shared (cross-agent) ---

  async storeShared(content: string, options: StoreOptions): Promise<string> {
    return this.shared.store(content, options);
  }

  async searchShared(
    query: string,
    limit: number = 5,
  ): Promise<MemorySearchResult[]> {
    return this.shared.search(query, limit);
  }

  // --- Utility ---

  async searchAll(
    query: string,
    limit: number = 5,
  ): Promise<MemorySearchResult[]> {
    const [agentResults, sharedResults] = await Promise.all([
      this.recall(query, limit),
      this.searchShared(query, limit),
    ]);

    return [...agentResults, ...sharedResults]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
}
