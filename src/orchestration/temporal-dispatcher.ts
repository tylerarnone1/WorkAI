import { randomUUID } from 'node:crypto';
import { Client, Connection } from '@temporalio/client';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'temporal-dispatcher' });

export interface TemporalDispatchConfig {
  enabled: boolean;
  address: string;
  namespace: string;
  taskQueue: string;
  workflowType: string;
  workflowExecutionTimeoutMs: number;
}

export interface TemporalTaskEnvelope {
  agentId: string;
  taskType: string;
  payload: Record<string, unknown>;
  priority: number;
  scheduledFor: string;
}

export class TemporalDispatcher {
  private connection?: Connection;
  private client?: Client;
  private connecting?: Promise<Client | undefined>;

  constructor(private readonly config: TemporalDispatchConfig) {}

  isEnabled(): boolean {
    return this.config.enabled;
  }

  async dispatchTask(envelope: TemporalTaskEnvelope): Promise<string | undefined> {
    if (!this.config.enabled) return undefined;

    const client = await this.getClient();
    if (!client) return undefined;

    const workflowId = [
      'agent-task',
      envelope.taskType,
      Date.now().toString(),
      randomUUID(),
    ].join('-');
    const scheduledTime = new Date(envelope.scheduledFor).getTime();
    const delayMs = Number.isFinite(scheduledTime)
      ? Math.max(scheduledTime - Date.now(), 0)
      : 0;

    try {
      const handle = await client.workflow.start(this.config.workflowType, {
        taskQueue: this.config.taskQueue,
        workflowId,
        args: [envelope],
        workflowExecutionTimeout: this.config.workflowExecutionTimeoutMs,
        startDelay: delayMs > 0 ? delayMs : undefined,
      });
      log.debug(
        {
          workflowId: handle.workflowId,
          taskType: envelope.taskType,
          agentId: envelope.agentId,
        },
        'Dispatched task to Temporal',
      );
      return handle.workflowId;
    } catch (err) {
      log.error(
        { err, taskType: envelope.taskType, agentId: envelope.agentId },
        'Failed to dispatch task to Temporal',
      );
      return undefined;
    }
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = undefined;
      this.client = undefined;
      this.connecting = undefined;
    }
  }

  private async getClient(): Promise<Client | undefined> {
    if (this.client) return this.client;
    if (this.connecting) return this.connecting;

    this.connecting = this.connect().finally(() => {
      this.connecting = undefined;
    });
    return this.connecting;
  }

  private async connect(): Promise<Client | undefined> {
    try {
      this.connection = await Connection.connect({
        address: this.config.address,
      });
      this.client = new Client({
        connection: this.connection,
        namespace: this.config.namespace,
      });

      log.info(
        {
          address: this.config.address,
          namespace: this.config.namespace,
          taskQueue: this.config.taskQueue,
          workflowType: this.config.workflowType,
        },
        'Temporal client connected',
      );
      return this.client;
    } catch (err) {
      log.error({ err, address: this.config.address }, 'Temporal connection failed');
      this.connection = undefined;
      this.client = undefined;
      return undefined;
    }
  }
}
