import type { PrismaClient } from '@prisma/client';
import type { ApprovalDecision } from './types.js';

export class ApprovalStore {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    agentId: string;
    actionType: string;
    actionPayload: object;
    reason: string;
    contextSummary?: string;
    expiresAt: Date;
    slackChannel?: string;
    slackMessageTs?: string;
  }): Promise<string> {
    const agent = await this.prisma.agent.findFirst({
      where: {
        OR: [{ id: data.agentId }, { name: data.agentId }],
      },
      select: { id: true },
    });
    if (!agent) {
      throw new Error(`Cannot create approval request. Unknown agent: ${data.agentId}`);
    }

    const request = await this.prisma.approvalRequest.create({
      data: {
        agentId: agent.id,
        actionType: data.actionType,
        actionPayload: data.actionPayload as object,
        reason: data.reason,
        contextSummary: data.contextSummary,
        expiresAt: data.expiresAt,
        slackChannel: data.slackChannel,
        slackMessageTs: data.slackMessageTs,
      },
    });
    return request.id;
  }

  async getById(requestId: string) {
    return this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
    });
  }

  async updateDecision(
    requestId: string,
    decision: ApprovalDecision,
    decidedBy?: string,
    reason?: string,
  ): Promise<void> {
    await this.prisma.approvalRequest.update({
      where: { id: requestId },
      data: {
        status: decision,
        decisionBy: decidedBy,
        decisionReason: reason,
        decidedAt: new Date(),
      },
    });
  }

  async updateSlackReference(
    requestId: string,
    channel: string,
    messageTs: string,
  ): Promise<void> {
    await this.prisma.approvalRequest.update({
      where: { id: requestId },
      data: {
        slackChannel: channel,
        slackMessageTs: messageTs,
      },
    });
  }

  async expireStale(): Promise<number> {
    const result = await this.prisma.approvalRequest.updateMany({
      where: {
        status: 'pending',
        expiresAt: { lte: new Date() },
      },
      data: { status: 'expired' },
    });
    return result.count;
  }

  async getPending(agentId: string) {
    return this.prisma.approvalRequest.findMany({
      where: { agentId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
  }
}
