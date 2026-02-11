import type { SlackMessageEvent } from './types.js';
import type { BaseAgent } from '../agent/base-agent.js';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'slack-router' });

export interface AgentRegistryLike {
  getBySlackChannel(channel: string): BaseAgent | undefined;
  getByName(name: string): BaseAgent | undefined;
  getAll(): BaseAgent[];
}

export class MessageRouter {
  constructor(private agentRegistry: AgentRegistryLike) {}

  routeMessage(event: SlackMessageEvent): BaseAgent | undefined {
    // Skip bot messages
    if (event.botId) {
      return undefined;
    }

    // Check if any agent is subscribed to this channel
    const agent = this.agentRegistry.getBySlackChannel(event.channel);
    if (agent) {
      log.debug(
        { agent: agent.name, channel: event.channel },
        'Routed to agent by channel',
      );
      return agent;
    }

    // Check if text mentions a specific agent by name
    const allAgents = this.agentRegistry.getAll();
    for (const a of allAgents) {
      if (
        event.text.toLowerCase().includes(`@${a.name.toLowerCase()}`) ||
        event.text.toLowerCase().includes(a.displayName.toLowerCase())
      ) {
        log.debug(
          { agent: a.name, channel: event.channel },
          'Routed to agent by mention',
        );
        return a;
      }
    }

    return undefined;
  }
}
