import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../types.js';
import { getPrisma } from '../../core/database/index.js';
import { createChildLogger } from '../../core/logger/index.js';

const log = createChildLogger({ module: 'delegate-task-tool' });

export class DelegateTaskTool implements ITool {
  definition: ToolDefinition = {
    name: 'delegate_task',
    description: 'Delegate a task to another agent. Creates a task queue item that the target agent will pick up. Use this when you need another agent to do work for you.',
    parameters: {
      type: 'object',
      properties: {
        targetAgent: {
          type: 'string',
          description: 'The name of the agent to delegate to (use find_expert first if unsure)',
        },
        taskType: {
          type: 'string',
          description: 'Type of task (e.g., "review", "create", "analyze", "deploy")',
        },
        instructions: {
          type: 'string',
          description: 'Clear instructions describing what the agent should do',
        },
        priority: {
          type: 'number',
          description: 'Priority level (1=highest, 5=lowest). Default: 3',
        },
        dueDate: {
          type: 'string',
          description: 'When the task should be completed (ISO 8601 format, optional)',
        },
        context: {
          type: 'object',
          description: 'Additional context data (URLs, IDs, etc.) the agent might need',
        },
      },
      required: ['targetAgent', 'taskType', 'instructions'],
    },
    category: 'collaboration',
    requiresApproval: true,
    approvalReason: 'Delegating work to another agent',
  };

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const prisma = getPrisma();
    const targetAgent = args['targetAgent'] as string;
    const taskType = args['taskType'] as string;
    const instructions = args['instructions'] as string;
    const priority = (args['priority'] as number) ?? 3;
    const dueDate = args['dueDate'] as string | undefined;
    const taskContext = args['context'] as Record<string, unknown> | undefined;

    try {
      // Verify target agent exists and is enabled
      const agent = await prisma.agent.findFirst({
        where: {
          name: { equals: targetAgent, mode: 'insensitive' },
          enabled: true,
        },
      });

      if (!agent) {
        return {
          success: false,
          output: `Agent "${targetAgent}" not found or is disabled. Use find_expert to locate active agents.`,
        };
      }

      // Check if delegation is allowed (optional canDelegate check)
      const sourceAgent = await prisma.agent.findUnique({
        where: { name: context.agentId },
        select: { canDelegate: true, name: true, displayName: true },
      });

      if (sourceAgent && sourceAgent.canDelegate.length > 0) {
        const allowed = sourceAgent.canDelegate.some(
          (name: string) => name.toLowerCase() === targetAgent.toLowerCase(),
        );
        if (!allowed) {
          return {
            success: false,
            output: `You are not authorized to delegate to ${targetAgent}. Your delegation list: ${sourceAgent.canDelegate.join(', ')}`,
          };
        }
      }

      // Create task queue item
      const payload: Record<string, unknown> = {
        taskType,
        instructions,
        delegatedBy: context.agentId,
        context: taskContext ?? {},
      };

      const task = await prisma.taskQueueItem.create({
        data: {
          agentId: agent.id,
          taskType,
          payload: payload as object,
          priority,
          scheduledFor: dueDate ? new Date(dueDate) : new Date(),
          status: 'pending',
        },
      });

      log.info(
        {
          taskId: task.id,
          from: context.agentId,
          to: targetAgent,
          taskType,
        },
        'Task delegated',
      );

      return {
        success: true,
        output: `Task delegated to ${agent.displayName} (@${agent.name}). Task ID: ${task.id}. They will receive it in their task queue.`,
      };
    } catch (err) {
      log.error({ err, targetAgent }, 'Failed to delegate task');
      return {
        success: false,
        output: `Failed to delegate task: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }
}
