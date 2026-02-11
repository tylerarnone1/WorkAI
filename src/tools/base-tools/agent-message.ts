import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../types.js';
import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

export class AgentMessageTool implements ITool {
  constructor(private prisma: PrismaClient) {}

  definition: ToolDefinition = {
    name: 'agent_message',
    description:
      'Send a message to another agent. Use this to collaborate, delegate tasks, or share information with other AI employees.',
    parameters: {
      type: 'object',
      properties: {
        toAgent: {
          type: 'string',
          description: 'The name of the agent to message',
        },
        message: {
          type: 'string',
          description: 'The message content',
        },
        messageType: {
          type: 'string',
          description: 'Type of message',
          enum: ['request', 'response', 'notification'],
        },
      },
      required: ['toAgent', 'message'],
    },
    category: 'communication',
  };

  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    const toAgentName = args['toAgent'] as string;
    const message = args['message'] as string;
    const messageType = (args['messageType'] as string) ?? 'request';

    try {
      // Look up target agent
      const targetAgent = await this.prisma.agent.findUnique({
        where: { name: toAgentName },
      });

      if (!targetAgent) {
        return {
          success: false,
          output: `Agent "${toAgentName}" not found. Available agents can be discovered via the agent registry.`,
        };
      }

      // Create the message
      await this.prisma.agentMessage.create({
        data: {
          id: randomUUID(),
          fromAgentId: context.agentId,
          toAgentId: targetAgent.id,
          messageType,
          content: message,
          correlationId: randomUUID(),
          status: 'pending',
        },
      });

      return {
        success: true,
        output: `Message sent to ${toAgentName} (type: ${messageType})`,
      };
    } catch (err) {
      return {
        success: false,
        output: `Failed to send message: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }
}
