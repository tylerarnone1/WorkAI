import {
  Langfuse,
  type LangfuseSpanClient,
  type LangfuseTraceClient,
} from 'langfuse';
import type {
  AgentRunObservation,
  AgentRunStartInput,
  ToolExecutionObservation,
} from './types.js';
import type { AgentRunResult } from '../agent/types.js';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'langfuse-observability' });

export interface LangfuseOptions {
  publicKey: string;
  secretKey: string;
  baseUrl?: string;
  flushAt: number;
  flushIntervalMs: number;
}

interface LangfuseRunHandle {
  trace: LangfuseTraceClient;
  runSpan: LangfuseSpanClient;
}

export class LangfuseObservability implements AgentRunObservation {
  private client: Langfuse;

  constructor(options: LangfuseOptions) {
    this.client = new Langfuse({
      enabled: true,
      publicKey: options.publicKey,
      secretKey: options.secretKey,
      baseUrl: options.baseUrl,
      flushAt: options.flushAt,
      flushInterval: options.flushIntervalMs,
    });
  }

  async start(input: AgentRunStartInput): Promise<unknown> {
    const trace = this.client.trace({
      id: input.context.traceId,
      name: `agent_run:${input.agentId}`,
      input: input.prompt,
      sessionId: input.context.conversationId,
      userId: input.agentId,
      metadata: {
        agentName: input.agentName,
        trigger: input.context.trigger,
      },
    });

    const runSpan = trace.span({
      name: 'agent_loop',
      input: input.prompt,
      metadata: {
        agentId: input.agentId,
        traceId: input.context.traceId,
      },
    });

    return { trace, runSpan } satisfies LangfuseRunHandle;
  }

  async observeTool(
    handle: unknown,
    observation: ToolExecutionObservation,
  ): Promise<void> {
    const run = this.asHandle(handle);
    if (!run) return;

    try {
      const span = run.runSpan.span({
        name: `tool:${observation.toolName}`,
        input: observation.args,
        metadata: {
          durationMs: observation.durationMs,
        },
      });

      span.end({
        output: observation.result.output,
        metadata: {
          success: observation.result.success,
        },
      });
    } catch (err) {
      log.warn({ err, tool: observation.toolName }, 'Failed to emit Langfuse tool span');
    }
  }

  async finish(handle: unknown, result: AgentRunResult): Promise<void> {
    const run = this.asHandle(handle);
    if (!run) return;

    run.runSpan.end({
      output: result.response,
      metadata: {
        success: result.success,
        iterations: result.iterations,
        durationMs: result.durationMs,
        toolsUsed: result.toolsUsed,
        tokenUsage: result.tokenUsage,
      },
    });

    run.trace.update({
      output: result.response,
      metadata: {
        success: result.success,
        approvalsPending: result.approvalsPending,
      },
    });
  }

  async fail(handle: unknown, error: unknown): Promise<void> {
    const run = this.asHandle(handle);
    if (!run) return;

    const message = error instanceof Error ? error.message : 'Unknown error';
    run.runSpan.end({
      statusMessage: message,
      metadata: {
        success: false,
      },
    });

    run.trace.update({
      output: message,
      metadata: {
        success: false,
      },
    });
  }

  async shutdown(): Promise<void> {
    await this.client.shutdownAsync();
  }

  private asHandle(handle: unknown): LangfuseRunHandle | undefined {
    if (!handle || typeof handle !== 'object') return undefined;
    const maybeHandle = handle as Partial<LangfuseRunHandle>;
    if (!maybeHandle.trace || !maybeHandle.runSpan) return undefined;
    return maybeHandle as LangfuseRunHandle;
  }
}
