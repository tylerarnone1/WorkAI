import type { PrismaClient } from '@prisma/client';
import type { LLMMessage } from '../llm/types.js';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'short-term-memory' });

export class ShortTermMemory {
  constructor(
    private prisma: PrismaClient,
    private agentId: string,
  ) {}

  async createConversation(
    externalId?: string,
    channel?: string,
    userId?: string,
  ): Promise<string> {
    const conversation = await this.prisma.conversation.create({
      data: {
        agentId: this.agentId,
        externalId,
        channel,
        userId,
      },
    });
    log.debug(
      { conversationId: conversation.id, agentId: this.agentId },
      'Conversation created',
    );
    return conversation.id;
  }

  async addMessage(
    conversationId: string,
    message: LLMMessage,
  ): Promise<void> {
    await this.prisma.conversationMessage.create({
      data: {
        conversationId,
        role: message.role,
        content: message.content,
        toolCalls: message.toolCalls
          ? JSON.parse(JSON.stringify(message.toolCalls))
          : undefined,
        toolCallId: message.toolCallId,
      },
    });
  }

  async getHistory(
    conversationId: string,
    limit?: number,
  ): Promise<LLMMessage[]> {
    const messages = await this.prisma.conversationMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      ...(limit ? { take: limit } : {}),
    });

    return messages.map((m) => ({
      role: m.role as LLMMessage['role'],
      content: m.content,
      toolCalls: m.toolCalls
        ? (m.toolCalls as unknown as LLMMessage['toolCalls'])
        : undefined,
      toolCallId: m.toolCallId ?? undefined,
    }));
  }

  async endConversation(conversationId: string): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { endedAt: new Date() },
    });
  }

  async findConversation(
    externalId: string,
    channel?: string,
  ): Promise<string | null> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        agentId: this.agentId,
        externalId,
        ...(channel ? { channel } : {}),
        endedAt: null,
      },
      orderBy: { startedAt: 'desc' },
    });
    return conversation?.id ?? null;
  }
}
