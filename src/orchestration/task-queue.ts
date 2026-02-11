import type { PrismaClient } from '@prisma/client';
import type { BaseAgent } from '../agent/base-agent.js';
import type { AgentRegistryLike } from '../slack/message-router.js';
import { createChildLogger } from '../core/logger/index.js';
import {
  TemporalDispatcher,
  type TemporalDispatchConfig,
} from './temporal-dispatcher.js';

const log = createChildLogger({ module: 'task-queue' });

interface ClaimedTask {
  id: string;
  agentId: string;
  taskType: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
}

interface ClaimedTaskRow {
  id: string;
  agent_id: string;
  task_type: string;
  payload: unknown;
  attempts: number;
  max_attempts: number;
}

export class TaskQueue {
  private isRunning = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private temporalDispatcher?: TemporalDispatcher;

  constructor(
    private prisma: PrismaClient,
    private agentRegistry: AgentRegistryLike,
    private config: {
      pollIntervalMs: number;
      concurrency: number;
      processingTimeoutMs?: number;
      temporal?: TemporalDispatchConfig;
    },
  ) {
    if (this.config.temporal) {
      this.temporalDispatcher = new TemporalDispatcher(this.config.temporal);
    }
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.pollTimer = setInterval(
      () => this.processNextBatch().catch((err) => log.error({ err }, 'Task queue processing error')),
      this.config.pollIntervalMs,
    );
    log.info(
      { pollIntervalMs: this.config.pollIntervalMs },
      'Task queue started',
    );
  }

  async enqueue(
    agentId: string,
    taskType: string,
    payload: Record<string, unknown>,
    opts?: {
      priority?: number;
      scheduledFor?: Date;
      maxAttempts?: number;
    },
  ): Promise<string> {
    const priority = opts?.priority ?? 0;
    const scheduledFor = opts?.scheduledFor ?? new Date();

    if (this.temporalDispatcher?.isEnabled()) {
      const workflowId = await this.temporalDispatcher.dispatchTask({
        agentId,
        taskType,
        payload,
        priority,
        scheduledFor: scheduledFor.toISOString(),
      });

      if (workflowId) {
        return workflowId;
      }
    }

    const item = await this.prisma.taskQueueItem.create({
      data: {
        agentId,
        taskType,
        payload: payload as object,
        priority,
        scheduledFor,
        maxAttempts: opts?.maxAttempts ?? 3,
      },
    });
    log.debug({ id: item.id, agentId, taskType }, 'Task enqueued');
    return item.id;
  }

  private async processNextBatch(): Promise<void> {
    if (!this.isRunning) return;

    await this.recoverStuckTasks();
    const tasks = await this.claimPendingTasks();
    if (tasks.length === 0) return;

    const promises = tasks.map(async (task) => {
      try {
        const result = await this.executeTask(task);
        await this.prisma.taskQueueItem.updateMany({
          where: { id: task.id, status: 'processing' },
          data: {
            status: 'completed',
            result: result as unknown as object,
            completedAt: new Date(),
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const shouldRetry = task.attempts < task.maxAttempts;

        await this.prisma.taskQueueItem.updateMany({
          where: { id: task.id, status: 'processing' },
          data: {
            status: shouldRetry ? 'pending' : 'failed',
            error: message,
            startedAt: null,
            ...(shouldRetry
              ? { scheduledFor: new Date(Date.now() + this.getRetryDelayMs(task.attempts)) }
              : { completedAt: new Date() }),
          },
        });

        log.error(
          { err, taskId: task.id, retry: shouldRetry, attempts: task.attempts, maxAttempts: task.maxAttempts },
          'Task execution failed',
        );
      }
    });

    await Promise.allSettled(promises);
  }

  private async executeTask(task: ClaimedTask): Promise<Record<string, unknown>> {
    const agent = await this.resolveAgentById(task.agentId);
    if (!agent) {
      throw new Error(`Agent not found for task ${task.id}: ${task.agentId}`);
    }

    if (task.taskType === 'agent_run') {
      const prompt =
        (task.payload['prompt'] as string) ?? 'Process queued task.';
      const conversationId = await agent.createConversation();
      const context = agent.createContext(conversationId, 'event');
      const result = await agent.run(prompt, context);
      return result as unknown as Record<string, unknown>;
    }

    if (task.taskType === 'approval_resume') {
      return this.executeApprovalResume(task, agent);
    }

    return { message: `Unknown task type: ${task.taskType}` };
  }

  private async executeApprovalResume(
    task: ClaimedTask,
    agent: BaseAgent,
  ): Promise<Record<string, unknown>> {
    const requestId = task.payload['approvalRequestId'];
    if (typeof requestId !== 'string') {
      throw new Error(`approval_resume task missing approvalRequestId: ${task.id}`);
    }

    const approval = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
    });
    if (!approval) {
      throw new Error(`Approval request not found: ${requestId}`);
    }

    if (approval.status !== 'approved') {
      return {
        resumed: false,
        reason: `Approval status is ${approval.status}, skipping resume.`,
      };
    }

    const resumeConversationId = task.payload['conversationId'];
    const conversationId =
      typeof resumeConversationId === 'string'
        ? resumeConversationId
        : await agent.createConversation();

    const payload = (approval.actionPayload as Record<string, unknown>) ?? {};
    const approvedToolName = payload['toolName'];
    const approvedArgs = payload['args'];

    const prompt =
      typeof task.payload['prompt'] === 'string'
        ? (task.payload['prompt'] as string)
        : `Human approved your previously requested action "${approval.actionType}".
Continue the task and execute the approved action.`;

    const context = agent.createContext(conversationId, 'event', {
      triggerPayload: {
        approvalRequestId: requestId,
        preApprovedAction:
          typeof approvedToolName === 'string' && typeof approvedArgs === 'object'
            ? {
                requestId,
                toolName: approvedToolName,
                args: approvedArgs as Record<string, unknown>,
              }
            : undefined,
      },
    });

    const result = await agent.run(prompt, context);
    return result as unknown as Record<string, unknown>;
  }

  private async claimPendingTasks(): Promise<ClaimedTask[]> {
    const rows = await this.prisma.$queryRaw<ClaimedTaskRow[]>`
      WITH claimed AS (
        SELECT id
        FROM task_queue_items
        WHERE status = 'pending'
          AND scheduled_for <= NOW()
        ORDER BY priority DESC, scheduled_for ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${this.config.concurrency}
      )
      UPDATE task_queue_items t
      SET
        status = 'processing',
        started_at = NOW(),
        attempts = t.attempts + 1,
        updated_at = NOW()
      FROM claimed
      WHERE t.id = claimed.id
      RETURNING
        t.id,
        t.agent_id,
        t.task_type,
        t.payload,
        t.attempts,
        t.max_attempts
    `;

    return rows.map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      taskType: row.task_type,
      payload:
        typeof row.payload === 'object' && row.payload !== null
          ? (row.payload as Record<string, unknown>)
          : {},
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
    }));
  }

  private async recoverStuckTasks(): Promise<void> {
    const processingTimeoutMs = this.config.processingTimeoutMs ?? 5 * 60_000;
    const staleBefore = new Date(Date.now() - processingTimeoutMs);

    const stale = await this.prisma.taskQueueItem.findMany({
      where: {
        status: 'processing',
        startedAt: { lte: staleBefore },
      },
      select: {
        id: true,
        attempts: true,
        maxAttempts: true,
      },
      take: this.config.concurrency * 5,
    });
    if (stale.length === 0) return;

    const retryIds = stale
      .filter((t) => t.attempts < t.maxAttempts)
      .map((t) => t.id);
    const failIds = stale
      .filter((t) => t.attempts >= t.maxAttempts)
      .map((t) => t.id);

    if (retryIds.length > 0) {
      await this.prisma.taskQueueItem.updateMany({
        where: { id: { in: retryIds }, status: 'processing' },
        data: {
          status: 'pending',
          startedAt: null,
          scheduledFor: new Date(),
          error: 'Recovered stale processing task',
        },
      });
    }

    if (failIds.length > 0) {
      await this.prisma.taskQueueItem.updateMany({
        where: { id: { in: failIds }, status: 'processing' },
        data: {
          status: 'failed',
          startedAt: null,
          completedAt: new Date(),
          error: 'Task exceeded max attempts while stale in processing state',
        },
      });
    }

    log.warn(
      { stale: stale.length, retried: retryIds.length, failed: failIds.length },
      'Recovered stale processing tasks',
    );
  }

  private async resolveAgentById(agentId: string): Promise<BaseAgent | undefined> {
    const record = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { name: true },
    });
    if (!record) return undefined;
    return this.agentRegistry.getByName(record.name) as BaseAgent | undefined;
  }

  private getRetryDelayMs(attempts: number): number {
    const base = 15_000;
    return Math.min(base * 2 ** Math.max(attempts - 1, 0), 5 * 60_000);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    await this.temporalDispatcher?.close();
    log.info('Task queue stopped');
  }
}
