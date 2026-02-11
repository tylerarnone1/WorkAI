import type { PrismaClient } from '@prisma/client';
import type { BaseAgent } from '../agent/base-agent.js';
import type { AgentRegistryLike } from '../slack/message-router.js';
import { EventBus } from '../core/events/emitter.js';
import { createChildLogger } from '../core/logger/index.js';
import { randomUUID } from 'node:crypto';

const log = createChildLogger({ module: 'inter-agent' });

export class InterAgentBus {
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private prisma: PrismaClient,
    private agentRegistry: AgentRegistryLike,
    private eventBus: EventBus,
  ) {}

  async send(
    fromAgentId: string,
    toAgentId: string,
    content: string,
    opts?: {
      messageType?: string;
      payload?: Record<string, unknown>;
      correlationId?: string;
    },
  ): Promise<string> {
    const message = await this.prisma.agentMessage.create({
      data: {
        id: randomUUID(),
        fromAgentId,
        toAgentId,
        messageType: opts?.messageType ?? 'request',
        content,
        payload: (opts?.payload as object) ?? undefined,
        correlationId: opts?.correlationId ?? randomUUID(),
        status: 'pending',
      },
    });

    this.eventBus.emit('inter_agent:message', {
      messageId: message.id,
      fromAgentId,
      toAgentId,
      content,
    });

    log.debug(
      { messageId: message.id, from: fromAgentId, to: toAgentId },
      'Inter-agent message sent',
    );

    return message.id;
  }

  async processPending(agentId: string): Promise<void> {
    const messages = await this.prisma.agentMessage.findMany({
      where: { toAgentId: agentId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    if (messages.length === 0) return;

    const target = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { name: true },
    });
    if (!target) {
      log.warn({ agentId }, 'Target agent record not found for inter-agent messages');
      return;
    }

    const agent = this.agentRegistry.getByName(target.name) as BaseAgent | undefined;
    if (!agent) {
      log.warn({ agentId, agentName: target.name }, 'Target agent not found in registry for inter-agent messages');
      return;
    }

    for (const msg of messages) {
      try {
        // Claim message for processing. If run fails, we return it to pending.
        await this.prisma.agentMessage.update({
          where: { id: msg.id },
          data: { status: 'processing' },
        });

        // Run agent with the inter-agent message
        const conversationId = await agent.createConversation();
        const context = agent.createContext(conversationId, 'inter_agent', {
          triggerPayload: {
            fromAgentId: msg.fromAgentId,
            messageType: msg.messageType,
            correlationId: msg.correlationId,
          },
        });

        await agent.run(
          `[Message from agent ${msg.fromAgentId}]: ${msg.content}`,
          context,
        );

        await this.prisma.agentMessage.update({
          where: { id: msg.id },
          data: { status: 'processed' },
        });
      } catch (err) {
        await this.prisma.agentMessage.update({
          where: { id: msg.id },
          data: { status: 'pending' },
        }).catch(() => {});
        log.error(
          { err, messageId: msg.id, agentId },
          'Failed to process inter-agent message',
        );
      }
    }
  }

  startPolling(intervalMs: number = 10_000): void {
    this.pollTimer = setInterval(async () => {
      const pending = await this.prisma.agentMessage.findMany({
        where: { status: 'pending' },
        select: { toAgentId: true },
        distinct: ['toAgentId'],
        take: 100,
      });

      for (const item of pending) {
        await this.processPending(item.toAgentId).catch((err) =>
          log.error({ err, agentId: item.toAgentId }, 'Inter-agent polling error'),
        );
      }
    }, intervalMs);
    log.info({ intervalMs }, 'Inter-agent bus polling started');
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    log.info('Inter-agent bus stopped');
  }
}
