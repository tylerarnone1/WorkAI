import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../types.js';
import { getPrisma } from '../../core/database/index.js';
import { MessageSender } from '../../slack/message-sender.js';
import { WebClient } from '@slack/web-api';
import { createChildLogger } from '../../core/logger/index.js';

const log = createChildLogger({ module: 'ask-colleague-tool' });

export class AskColleagueTool implements ITool {
  definition: ToolDefinition = {
    name: 'ask_colleague',
    description: 'Send a direct message or mention a colleague in a Slack channel. Use this for quick questions, status updates, or to loop someone into a conversation.',
    parameters: {
      type: 'object',
      properties: {
        colleague: {
          type: 'string',
          description: 'The agent name to contact (use find_expert if unsure)',
        },
        message: {
          type: 'string',
          description: 'Your message or question',
        },
        channel: {
          type: 'string',
          description: 'Slack channel ID to post in (optional). If omitted, sends a DM.',
        },
        threadTs: {
          type: 'string',
          description: 'Thread timestamp to reply in (optional, for continuing a thread)',
        },
      },
      required: ['colleague', 'message'],
    },
    category: 'collaboration',
  };

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const prisma = getPrisma();
    const colleague = args['colleague'] as string;
    const message = args['message'] as string;
    const channel = args['channel'] as string | undefined;
    const threadTs = args['threadTs'] as string | undefined;

    try {
      // Find the target agent
      const targetAgent = await prisma.agent.findFirst({
        where: {
          name: { equals: colleague, mode: 'insensitive' },
          enabled: true,
        },
        select: {
          id: true,
          name: true,
          displayName: true,
          slackBotToken: true,
          slackChannels: true,
        },
      });

      if (!targetAgent) {
        return {
          success: false,
          output: `Colleague "${colleague}" not found or is disabled. Use find_expert to locate active agents.`,
        };
      }

      // Get source agent info for attribution
      const sourceAgent = await prisma.agent.findUnique({
        where: { name: context.agentId },
        select: { displayName: true, name: true },
      });

      const fromName = sourceAgent?.displayName ?? context.agentId;

      // Get Slack token from framework config (global token, not agent-specific)
      const frameworkConfig = await prisma.$queryRaw<Array<{ value: string }>>`
        SELECT value FROM config WHERE key = 'slack_bot_token' LIMIT 1
      `.catch(() => []);
      const slackToken = frameworkConfig[0]?.value ?? process.env['SLACK_BOT_TOKEN'];

      if (!slackToken) {
        return {
          success: false,
          output: 'Slack integration not configured. Cannot send messages.',
        };
      }

      const slackClient = new WebClient(slackToken);
      const sender = new MessageSender(slackClient);

      // Format message with mention
      const formattedMessage = `*Message from ${fromName}:*\n\n${message}\n\n_cc: @${targetAgent.name}_`;

      if (channel) {
        // Post in channel, mentioning the colleague
        await sender.send({ channel, text: formattedMessage, threadTs });
        log.info(
          { from: context.agentId, to: colleague, channel },
          'Colleague mentioned in channel',
        );
        return {
          success: true,
          output: `Posted in <#${channel}> and mentioned @${targetAgent.name}.`,
        };
      } else {
        // Send DM - find a common channel or use first available
        const commonChannel = targetAgent.slackChannels[0];
        if (!commonChannel) {
          return {
            success: false,
            output: `Cannot DM ${targetAgent.displayName} - they have no Slack channels configured.`,
          };
        }

        // Use agent message via DB as fallback for async DM
        // First get the agent record to get the ID
        const sourceAgentRecord = await prisma.agent.findUnique({
          where: { name: context.agentId },
          select: { id: true },
        });

        if (!sourceAgentRecord) {
          return {
            success: false,
            output: 'Failed to send message - source agent not found in database.',
          };
        }

        await prisma.agentMessage.create({
          data: {
            fromAgentId: sourceAgentRecord.id,
            toAgentId: targetAgent.id,
            messageType: 'direct_message',
            content: message,
            payload: { via: 'ask_colleague_tool' } as object,
          },
        });

        log.info({ from: context.agentId, to: colleague }, 'Message queued for colleague');

        return {
          success: true,
          output: `Message sent to ${targetAgent.displayName} (@${targetAgent.name}). They will see it in their message queue.`,
        };
      }
    } catch (err) {
      log.error({ err, colleague }, 'Failed to contact colleague');
      return {
        success: false,
        output: `Failed to contact colleague: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }
}
