import { Worker, NativeConnection } from '@temporalio/worker';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import type { PrismaClient } from '@prisma/client';
import type { BaseAgent } from '../agent/base-agent.js';
import type { AgentRegistryLike } from '../slack/message-router.js';
import { createChildLogger } from '../core/logger/index.js';
import type { TemporalDispatchConfig, TemporalTaskEnvelope } from './temporal-dispatcher.js';

const log = createChildLogger({ module: 'temporal-worker' });

export class TemporalWorkerService {
  private worker?: Worker;
  private connection?: NativeConnection;
  private runPromise?: Promise<void>;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly agentRegistry: AgentRegistryLike,
    private readonly config: TemporalDispatchConfig,
  ) {}

  async start(): Promise<boolean> {
    if (!this.config.enabled) return false;

    try {
      this.connection = await NativeConnection.connect({
        address: this.config.address,
      });

      this.worker = await Worker.create({
        connection: this.connection,
        namespace: this.config.namespace,
        taskQueue: this.config.taskQueue,
        workflowsPath: this.resolveWorkflowsPath(),
        activities: {
          runAgentTask: async (envelope: TemporalTaskEnvelope) =>
            this.runAgentTask(envelope),
        },
      });

      this.runPromise = this.worker.run().catch((err) => {
        log.error({ err }, 'Temporal worker run loop failed');
      });

      log.info(
        {
          address: this.config.address,
          namespace: this.config.namespace,
          taskQueue: this.config.taskQueue,
          workflowType: this.config.workflowType,
        },
        'Temporal worker started',
      );
      return true;
    } catch (err) {
      log.error({ err }, 'Failed to start Temporal worker');
      await this.stop().catch(() => undefined);
      return false;
    }
  }

  async stop(): Promise<void> {
    this.worker?.shutdown();
    if (this.runPromise) {
      await this.runPromise;
      this.runPromise = undefined;
    }
    this.worker = undefined;

    if (this.connection) {
      await this.connection.close();
      this.connection = undefined;
    }
  }

  private async runAgentTask(
    envelope: TemporalTaskEnvelope,
  ): Promise<Record<string, unknown>> {
    const scheduledFor = new Date(envelope.scheduledFor);
    if (
      Number.isFinite(scheduledFor.getTime()) &&
      scheduledFor.getTime() > Date.now()
    ) {
      await new Promise((resolve) =>
        setTimeout(resolve, scheduledFor.getTime() - Date.now()),
      );
    }

    const agent = await this.resolveAgentById(envelope.agentId);
    if (!agent) {
      throw new Error(`Agent not found for Temporal task: ${envelope.agentId}`);
    }

    if (envelope.taskType === 'agent_run') {
      const prompt =
        (envelope.payload['prompt'] as string) ?? 'Process queued task.';
      const conversationId = await agent.createConversation();
      const context = agent.createContext(conversationId, 'event');
      const result = await agent.run(prompt, context);
      return result as unknown as Record<string, unknown>;
    }

    if (envelope.taskType === 'approval_resume') {
      return this.executeApprovalResume(envelope, agent);
    }

    return { message: `Unknown temporal task type: ${envelope.taskType}` };
  }

  private async executeApprovalResume(
    envelope: TemporalTaskEnvelope,
    agent: BaseAgent,
  ): Promise<Record<string, unknown>> {
    const requestId = envelope.payload['approvalRequestId'];
    if (typeof requestId !== 'string') {
      throw new Error(
        `approval_resume temporal task missing approvalRequestId for agent ${envelope.agentId}`,
      );
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

    const resumeConversationId = envelope.payload['conversationId'];
    const conversationId =
      typeof resumeConversationId === 'string'
        ? resumeConversationId
        : await agent.createConversation();

    const payload = (approval.actionPayload as Record<string, unknown>) ?? {};
    const approvedToolName = payload['toolName'];
    const approvedArgs = payload['args'];

    const prompt =
      typeof envelope.payload['prompt'] === 'string'
        ? (envelope.payload['prompt'] as string)
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

  private async resolveAgentById(agentId: string): Promise<BaseAgent | undefined> {
    const record = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { name: true },
    });
    if (!record) return undefined;
    return this.agentRegistry.getByName(record.name) as BaseAgent | undefined;
  }

  private resolveWorkflowsPath(): string {
    const jsPath = fileURLToPath(new URL('./temporal-workflows.js', import.meta.url));
    if (existsSync(jsPath)) return jsPath;
    return fileURLToPath(new URL('./temporal-workflows.ts', import.meta.url));
  }
}
