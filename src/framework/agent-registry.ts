import type { BaseAgent } from '../agent/base-agent.js';
import type { AgentConfig } from '../core/config/types.js';
import type { AgentRegistryLike } from '../slack/message-router.js';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'agent-registry' });

export class AgentRegistry implements AgentRegistryLike {
  private agents = new Map<string, BaseAgent>();
  private channelMap = new Map<string, string>(); // channel -> agentName

  register(agent: BaseAgent, config: AgentConfig): void {
    this.agents.set(agent.name, agent);

    for (const channel of config.slackChannels) {
      this.channelMap.set(channel, agent.name);
    }

    log.info(
      { agent: agent.name, channels: config.slackChannels },
      'Agent registered',
    );
  }

  unregister(name: string): void {
    const agent = this.agents.get(name);
    if (agent) {
      // Remove channel mappings
      for (const [channel, agentName] of this.channelMap) {
        if (agentName === name) {
          this.channelMap.delete(channel);
        }
      }
      this.agents.delete(name);
      log.info({ agent: name }, 'Agent unregistered');
    }
  }

  getByName(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  getBySlackChannel(channel: string): BaseAgent | undefined {
    const agentName = this.channelMap.get(channel);
    if (agentName) {
      return this.agents.get(agentName);
    }
    return undefined;
  }

  getAll(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  get size(): number {
    return this.agents.size;
  }
}
