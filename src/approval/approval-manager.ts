import { ApprovalStore } from './approval-store.js';
import { EventBus } from '../core/events/index.js';
import type { ApprovalGate, ApprovalDecision, ApprovalResult } from './types.js';
import { ApprovalTimeoutError } from '../core/errors/index.js';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'approval-manager' });

const DEFAULT_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

export class ApprovalManager {
  constructor(
    private store: ApprovalStore,
    private eventBus: EventBus,
  ) {}

  async requestApproval(gate: ApprovalGate): Promise<string> {
    const expiresAt = new Date(
      Date.now() + (gate.expiresInMs ?? DEFAULT_EXPIRY_MS),
    );

    const requestId = await this.store.create({
      agentId: gate.agentId,
      actionType: gate.actionType,
      actionPayload: gate.actionPayload,
      reason: gate.reason,
      contextSummary: gate.contextSummary,
      expiresAt,
    });

    log.info(
      { requestId, agentId: gate.agentId, actionType: gate.actionType },
      'Approval requested',
    );

    this.eventBus.emit('approval:requested', {
      requestId,
      ...gate,
      expiresAt,
    });

    return requestId;
  }

  async processDecision(
    requestId: string,
    decision: ApprovalDecision,
    decidedBy?: string,
    reason?: string,
  ): Promise<void> {
    await this.store.updateDecision(requestId, decision, decidedBy, reason);

    log.info(
      { requestId, decision, decidedBy },
      'Approval decision processed',
    );

    this.eventBus.emit(`approval:decided:${requestId}`, {
      requestId,
      decision,
      decidedBy,
      reason,
    });

    this.eventBus.emit('approval:decided', {
      requestId,
      decision,
      decidedBy,
      reason,
    });
  }

  async waitForDecision(
    requestId: string,
    timeoutMs: number = DEFAULT_EXPIRY_MS,
  ): Promise<ApprovalResult> {
    const start = Date.now();
    const pollIntervalMs = 1000;

    while (Date.now() - start < timeoutMs) {
      const existing = await this.store.getById(requestId);
      if (existing && existing.status !== 'pending') {
        return {
          decision: existing.status as ApprovalDecision,
          decidedBy: existing.decisionBy ?? undefined,
          reason: existing.decisionReason ?? undefined,
        };
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new ApprovalTimeoutError(requestId);
  }

  async expireStaleApprovals(): Promise<number> {
    const count = await this.store.expireStale();
    if (count > 0) {
      log.info({ count }, 'Expired stale approval requests');
    }
    return count;
  }

  async updateSlackReference(
    requestId: string,
    channel: string,
    messageTs: string,
  ): Promise<void> {
    await this.store.updateSlackReference(requestId, channel, messageTs);
  }

  async getRequest(requestId: string) {
    return this.store.getById(requestId);
  }
}
