import type { TokenUsage } from '../llm/types.js';

export type AgentState =
  | 'idle'
  | 'thinking'
  | 'executing_tool'
  | 'waiting_approval'
  | 'responding'
  | 'error';

export type AgentTrigger =
  | 'slack_message'
  | 'slack_command'
  | 'scheduled'
  | 'event'
  | 'inter_agent'
  | 'api';

export interface AgentContext {
  agentId: string;
  agentName: string;
  traceId: string;
  conversationId: string;
  trigger: AgentTrigger;
  triggerPayload?: Record<string, unknown>;
  slackContext?: {
    channel: string;
    threadTs?: string;
    userId: string;
    messageTs: string;
  };
}

export interface AgentRunResult {
  success: boolean;
  response?: string;
  toolsUsed: string[];
  tokenUsage: TokenUsage;
  iterations: number;
  durationMs: number;
  approvalsPending: string[];
}
