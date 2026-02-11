import cron from 'node-cron';
import type { PrismaClient } from '@prisma/client';
import type { BaseAgent } from '../agent/base-agent.js';
import type { AgentRegistryLike } from '../slack/message-router.js';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'scheduler' });

export class CronScheduler {
  private jobs = new Map<string, cron.ScheduledTask>();

  constructor(
    private prisma: PrismaClient,
    private agentRegistry: AgentRegistryLike,
  ) {}

  async initialize(): Promise<void> {
    const tasks = await this.prisma.scheduledTask.findMany({
      where: { enabled: true },
    });

    for (const task of tasks) {
      this.scheduleTask(task.id, task.agentId, task.cronExpression, async () => {
        await this.executeTask(task.agentId, task.taskType, task.taskPayload as Record<string, unknown> | null);
        await this.prisma.scheduledTask.update({
          where: { id: task.id },
          data: {
            lastRunAt: new Date(),
            runCount: { increment: 1 },
          },
        });
      });
    }

    log.info({ count: tasks.length }, 'Scheduled tasks loaded');
  }

  scheduleTask(
    taskId: string,
    agentId: string,
    cronExpression: string,
    handler: () => Promise<void>,
  ): void {
    if (!cron.validate(cronExpression)) {
      log.error({ taskId, cronExpression }, 'Invalid cron expression');
      return;
    }

    const job = cron.schedule(cronExpression, async () => {
      log.info({ taskId, agentId }, 'Executing scheduled task');
      try {
        await handler();
      } catch (err) {
        log.error({ err, taskId, agentId }, 'Scheduled task failed');
        await this.prisma.scheduledTask
          .update({
            where: { id: taskId },
            data: {
              errorCount: { increment: 1 },
              lastError: err instanceof Error ? err.message : 'Unknown error',
            },
          })
          .catch(() => {});
      }
    });

    this.jobs.set(taskId, job);
    log.debug({ taskId, cronExpression }, 'Task scheduled');
  }

  unscheduleTask(taskId: string): void {
    const job = this.jobs.get(taskId);
    if (job) {
      job.stop();
      this.jobs.delete(taskId);
    }
  }

  private async executeTask(
    agentId: string,
    taskType: string,
    payload: Record<string, unknown> | null,
  ): Promise<void> {
    const agentRecord = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { name: true },
    });
    if (!agentRecord) {
      log.warn({ agentId }, 'Agent record not found for scheduled task');
      return;
    }

    const agent = this.agentRegistry.getByName(agentRecord.name) as BaseAgent | undefined;
    if (!agent) {
      log.warn({ agentId, agentName: agentRecord.name }, 'Agent not found in registry for scheduled task');
      return;
    }

    if (taskType === 'agent_run') {
      const prompt = (payload?.['prompt'] as string) ?? 'Execute your scheduled task.';
      const conversationId = await agent.createConversation();
      const context = agent.createContext(conversationId, 'scheduled');
      await agent.run(prompt, context);
    }
  }

  async shutdown(): Promise<void> {
    for (const [id, job] of this.jobs) {
      job.stop();
      this.jobs.delete(id);
    }
    log.info('Scheduler shut down');
  }
}
