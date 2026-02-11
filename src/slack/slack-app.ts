import { App, LogLevel } from '@slack/bolt';
import type { FrameworkConfig } from '../core/config/types.js';
import type { ApprovalManager } from '../approval/approval-manager.js';
import type { BaseAgent } from '../agent/base-agent.js';
import { MessageRouter, type AgentRegistryLike } from './message-router.js';
import { MessageSender } from './message-sender.js';
import { buildApprovalBlocks } from './approval-ui.js';
import { EventBus } from '../core/events/emitter.js';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'slack-app' });

export class SlackApp {
  private app: App | undefined;
  private router: MessageRouter;
  private sender: MessageSender | undefined;

  constructor(
    private config: FrameworkConfig,
    private agentRegistry: AgentRegistryLike,
    private approvalManager: ApprovalManager,
    private eventBus: EventBus,
  ) {
    this.router = new MessageRouter(agentRegistry);
  }

  async start(): Promise<void> {
    if (!this.config.slackSigningSecret) {
      log.warn('Slack not configured — skipping Slack app initialization');
      return;
    }

    this.app = new App({
      signingSecret: this.config.slackSigningSecret,
      appToken: this.config.slackAppToken,
      socketMode: !!this.config.slackAppToken,
      logLevel:
        this.config.nodeEnv === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
    });

    this.sender = new MessageSender(this.app.client);
    this.registerEventListeners();
    this.registerInteractionHandlers();
    this.registerApprovalEvents();

    await this.app.start(this.config.port);
    log.info({ port: this.config.port }, 'Slack app started');
  }

  getSender(): MessageSender | undefined {
    return this.sender;
  }

  private registerEventListeners(): void {
    if (!this.app) return;

    // Handle @mentions
    this.app.event('app_mention', async ({ event, say }) => {
      const userId = event.user ?? 'unknown';
      const agent = this.router.routeMessage({
        type: 'app_mention',
        channel: event.channel,
        user: userId,
        text: event.text,
        ts: event.ts,
        threadTs: event.thread_ts,
      });

      if (!agent) {
        await say({ text: "I'm not sure which agent should handle this.", thread_ts: event.ts });
        return;
      }

      await this.handleAgentMessage(agent, event.text, {
        channel: event.channel,
        threadTs: event.thread_ts ?? event.ts,
        userId,
        messageTs: event.ts,
      });
    });

    // Handle DMs
    this.app.event('message', async ({ event }) => {
      if (!('text' in event) || !event.text) return;
      if ('bot_id' in event && event.bot_id) return;

      // Only process DMs (channel type 'im')
      if (event.channel_type !== 'im') return;

      const allAgents = this.agentRegistry.getAll();
      const agent = allAgents[0]; // Default to first agent for DMs
      if (!agent) return;

      await this.handleAgentMessage(agent, event.text, {
        channel: event.channel,
        threadTs: ('thread_ts' in event ? event.thread_ts : undefined) ?? event.ts,
        userId: 'user' in event ? (event.user as string) : 'unknown',
        messageTs: event.ts,
      });
    });
  }

  private registerInteractionHandlers(): void {
    if (!this.app) return;

    // Approval: Approve button
    this.app.action('approval_approve', async ({ body, ack }) => {
      await ack();
      if (body.type !== 'block_actions') return;
      const action = body.actions[0];
      if (!action || !('value' in action)) return;

      const requestId = action.value as string;
      const userId = body.user.id;

      await this.approvalManager.processDecision(
        requestId,
        'approved',
        userId,
      );

      log.info({ requestId, userId }, 'Approval granted via Slack');
    });

    // Approval: Deny button
    this.app.action('approval_deny', async ({ body, ack }) => {
      await ack();
      if (body.type !== 'block_actions') return;
      const action = body.actions[0];
      if (!action || !('value' in action)) return;

      const requestId = action.value as string;
      const userId = body.user.id;

      await this.approvalManager.processDecision(
        requestId,
        'denied',
        userId,
      );

      log.info({ requestId, userId }, 'Approval denied via Slack');
    });
  }

  private registerApprovalEvents(): void {
    // When an approval is requested, send Slack message with buttons
    this.eventBus.on<{
      requestId: string;
      agentId: string;
      actionType: string;
      reason: string;
      contextSummary?: string;
    }>('approval:requested', async (event) => {
      if (!this.sender) return;

      const agent = this.agentRegistry.getByName(event.payload.agentId);
      const channel = agent
        ? (agent as unknown as { config: { slackChannels: string[] } }).config
            .slackChannels[0]
        : undefined;
      if (!channel) return;

      const blocks = buildApprovalBlocks({
        requestId: event.payload.requestId,
        agentName: agent?.displayName ?? event.payload.agentId,
        actionType: event.payload.actionType,
        reason: event.payload.reason,
        contextSummary: event.payload.contextSummary,
      });

      const ts = await this.sender.send({
        channel,
        text: `Approval required: ${event.payload.actionType}`,
        blocks,
      });

      if (ts) {
        await this.approvalManager.updateSlackReference(
          event.payload.requestId,
          channel,
          ts,
        );
      }
    });

    // When an approval is decided, update the Slack message
    this.eventBus.on<{
      requestId: string;
      decision: 'approved' | 'denied';
      decidedBy?: string;
    }>('approval:decided', async (event) => {
      // The Slack message update would go here
      log.info(
        {
          requestId: event.payload.requestId,
          decision: event.payload.decision,
        },
        'Approval decision — Slack message would be updated',
      );
    });
  }

  private async handleAgentMessage(
    agent: BaseAgent,
    text: string,
    slack: {
      channel: string;
      threadTs: string;
      userId: string;
      messageTs: string;
    },
  ): Promise<void> {
    try {
      // Add thinking reaction
      await this.sender?.addReaction(slack.channel, slack.messageTs, 'hourglass_flowing_sand');

      // Find or create conversation for this thread
      const conversationId = await agent.findOrCreateConversation(
        slack.threadTs,
        slack.channel,
        slack.userId,
      );

      const context = agent.createContext(conversationId, 'slack_message', {
        slackContext: slack,
      });

      const result = await agent.run(text, context);

      // Send response
      if (result.response && this.sender) {
        await this.sender.reply(slack.channel, slack.threadTs, result.response);
      }

      // Update reaction
      await this.sender?.addReaction(slack.channel, slack.messageTs, 'white_check_mark');
    } catch (err) {
      log.error({ err, agent: agent.name }, 'Failed to handle Slack message');
      await this.sender?.reply(
        slack.channel,
        slack.threadTs,
        'Sorry, I encountered an error processing your message.',
      );
    }
  }

  async stop(): Promise<void> {
    if (this.app) {
      await this.app.stop();
      log.info('Slack app stopped');
    }
  }
}
