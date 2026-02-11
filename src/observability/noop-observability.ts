import type {
  AgentRunObservation,
  AgentRunStartInput,
  ToolExecutionObservation,
} from './types.js';
import type { AgentRunResult } from '../agent/types.js';

export class NoopObservability implements AgentRunObservation {
  async start(_input: AgentRunStartInput): Promise<unknown> {
    return undefined;
  }

  async observeTool(
    _handle: unknown,
    _observation: ToolExecutionObservation,
  ): Promise<void> {}

  async finish(_handle: unknown, _result: AgentRunResult): Promise<void> {}

  async fail(_handle: unknown, _error: unknown): Promise<void> {}

  async shutdown(): Promise<void> {}
}

