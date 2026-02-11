import type { AgentContext, AgentRunResult } from '../agent/types.js';
import type { ToolResult } from '../tools/types.js';

export interface AgentRunStartInput {
  agentId: string;
  agentName: string;
  prompt: string;
  context: AgentContext;
}

export interface ToolExecutionObservation {
  toolName: string;
  args: Record<string, unknown>;
  result: ToolResult;
  durationMs: number;
}

export interface AgentRunObservation {
  start(input: AgentRunStartInput): Promise<unknown>;
  observeTool(
    handle: unknown,
    observation: ToolExecutionObservation,
  ): Promise<void>;
  finish(handle: unknown, result: AgentRunResult): Promise<void>;
  fail(handle: unknown, error: unknown): Promise<void>;
  shutdown(): Promise<void>;
}

