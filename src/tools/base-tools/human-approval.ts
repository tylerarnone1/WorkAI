import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../types.js';

export class HumanApprovalTool implements ITool {
  definition: ToolDefinition = {
    name: 'human_approval',
    description:
      'Request human approval before taking a sensitive action. The agent will pause until a human approves or denies.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Description of the action that needs approval',
        },
        reason: {
          type: 'string',
          description: 'Why this action needs to be taken',
        },
        details: {
          type: 'string',
          description: 'Additional context for the approver',
        },
      },
      required: ['action', 'reason'],
    },
    category: 'approval',
  };

  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    const action = args['action'] as string;
    const reason = args['reason'] as string;
    const details = args['details'] as string | undefined;

    const requestId = await context.approvalManager.requestApproval({
      agentId: context.agentId,
      actionType: action,
      actionPayload: args,
      reason,
      contextSummary: details,
    });

    return {
      success: true,
      output: `Approval requested for: ${action}. Reason: ${reason}. Waiting for human decision.`,
      metadata: {
        approvalPending: true,
        approvalRequestId: requestId,
      },
    };
  }
}
