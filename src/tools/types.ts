import type { UnifiedToolDefinition } from '../llm/types.js';
import type { MemoryManager } from '../memory/memory-manager.js';
import type { ApprovalManager } from '../approval/approval-manager.js';

export interface ToolDefinition extends UnifiedToolDefinition {
  category: string;
  requiresApproval?: boolean;
  approvalReason?: string;
  timeout?: number;
}

export interface ToolExecutionContext {
  agentId: string;
  agentName: string;
  conversationId?: string;
  traceId: string;
  memoryManager: MemoryManager;
  approvalManager: ApprovalManager;
  capabilities?: string[];
  preApprovedAction?: {
    requestId: string;
    toolName: string;
    args: Record<string, unknown>;
  };
}

export interface ITool {
  definition: ToolDefinition;
  execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}
