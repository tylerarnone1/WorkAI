import type { BaseAgent } from './base-agent.js';
import type { AgentContext, AgentRunResult } from './types.js';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'agent-runner' });

// Per-conversation lock to prevent concurrent runs corrupting state
const conversationLocks = new Map<string, Promise<AgentRunResult>>();

export class AgentRunner {
  constructor(private agent: BaseAgent) {}

  async run(
    input: string,
    context: AgentContext,
  ): Promise<AgentRunResult> {
    const lockKey = `${context.agentId}:${context.conversationId}`;

    // Wait for any existing run on this conversation to complete
    const existing = conversationLocks.get(lockKey);
    if (existing) {
      log.debug(
        { agent: context.agentName, conversationId: context.conversationId },
        'Waiting for existing run to complete',
      );
      await existing.catch(() => {}); // Don't propagate errors from previous run
    }

    const runPromise = this.agent.run(input, context);
    conversationLocks.set(lockKey, runPromise);

    try {
      const result = await runPromise;
      return result;
    } finally {
      conversationLocks.delete(lockKey);
    }
  }

  get agentName(): string {
    return this.agent.name;
  }

  get agentState() {
    return this.agent.state;
  }
}
