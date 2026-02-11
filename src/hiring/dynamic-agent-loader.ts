import { getPrisma } from '../core/database/index.js';
import { createChildLogger } from '../core/logger/index.js';
import { ContainerProvisioner } from '../container/container-provisioner.js';
import type { Agent } from '@prisma/client';

const log = createChildLogger({ module: 'dynamic-agent-loader' });

export interface LoadedAgent {
  agent: Agent;
  template: {
    role: string;
    slug: string;
    needsContainer: boolean;
    defaultTools: string[];
  };
  background: {
    name: string;
    promptModifiers: string;
  };
  resume: any;
  containerInfo?: any;
}

export class DynamicAgentLoader {
  private containerProvisioner: ContainerProvisioner;

  constructor(containerProvisioner?: ContainerProvisioner) {
    this.containerProvisioner = containerProvisioner ?? new ContainerProvisioner();
  }

  /**
   * Load all active hired agents from database
   */
  async loadAllHiredAgents(): Promise<LoadedAgent[]> {
    const prisma = getPrisma();

    log.info('Loading hired agents from database...');

    const hiredAgents = await prisma.hiredAgent.findMany({
      where: {
        status: 'active',
      },
      include: {
        agent: true,
        template: true,
        background: true,
      },
    });

    log.info({ count: hiredAgents.length }, 'Found hired agents');

    const loadedAgents: LoadedAgent[] = [];

    for (const hired of hiredAgents) {
      try {
        const loaded = await this.loadAgent(hired.agentId);
        if (loaded) {
          loadedAgents.push(loaded);
        }
      } catch (err) {
        log.error({ err, agentId: hired.agentId }, 'Failed to load agent');
      }
    }

    log.info({ count: loadedAgents.length }, 'Successfully loaded agents');

    return loadedAgents;
  }

  /**
   * Load a single agent by ID
   */
  async loadAgent(agentId: string): Promise<LoadedAgent | null> {
    const prisma = getPrisma();

    const hiredAgent = await prisma.hiredAgent.findUnique({
      where: { agentId },
      include: {
        agent: true,
        template: true,
        background: true,
      },
    });

    if (!hiredAgent) {
      log.warn({ agentId }, 'No hired agent found');
      return null;
    }

    log.info(
      {
        agentId,
        role: hiredAgent.template.role,
        background: hiredAgent.background.name,
      },
      'Loading agent...',
    );

    // Build complete system prompt with background modifiers
    const completeSystemPrompt = this.buildSystemPrompt(
      hiredAgent.template.baseSystemPrompt,
      hiredAgent.background.promptModifiers,
    );

    // Update agent's system prompt if needed
    if (hiredAgent.agent.systemPrompt !== completeSystemPrompt) {
      await prisma.agent.update({
        where: { id: agentId },
        data: { systemPrompt: completeSystemPrompt },
      });
    }

    // Provision container if needed
    let provisionedContainer: any = hiredAgent.agent.containerInfo;
    if (hiredAgent.template.needsContainer && !provisionedContainer) {
      log.info({ agentId }, 'Provisioning container for agent...');

      const containerResult = await this.containerProvisioner.provisionForAgent({
        agentId: hiredAgent.agent.id,
        agentName: hiredAgent.agent.name,
        role: hiredAgent.template.role,
      });

      if (containerResult) {
        provisionedContainer = containerResult;

        // Save container info to agent
        await prisma.agent.update({
          where: { id: agentId },
          data: {
            containerInfo: containerResult as any,
          },
        });

        log.info(
          {
            agentId,
            containerName: containerResult.containerName,
          },
          'Container provisioned',
        );
      }
    } else if (hiredAgent.template.needsContainer && provisionedContainer) {
      log.info({ agentId }, 'Agent already has container provisioned');
    }

    return {
      agent: hiredAgent.agent,
      template: {
        role: hiredAgent.template.role,
        slug: hiredAgent.template.slug,
        needsContainer: hiredAgent.template.needsContainer,
        defaultTools: hiredAgent.template.defaultTools,
      },
      background: {
        name: hiredAgent.background.name,
        promptModifiers: hiredAgent.background.promptModifiers,
      },
      resume: hiredAgent.generatedResume,
      containerInfo: provisionedContainer,
    };
  }

  /**
   * Hire a new agent (create HiredAgent + Agent + container if needed)
   */
  async hireAgent(options: {
    templateId: string;
    backgroundId: string;
    generatedName: string;
    generatedResume: any;
    hiredBy?: string;
    slackChannels?: string[];
    customizations?: any;
  }): Promise<LoadedAgent> {
    const prisma = getPrisma();
    const llmConfig = resolveDefaultLlmConfig();

    log.info(
      {
        templateId: options.templateId,
        backgroundId: options.backgroundId,
        name: options.generatedName,
      },
      'Hiring new agent...',
    );

    // Accept either template UUID or slug from callers.
    let template = await prisma.roleTemplate.findUnique({
      where: { id: options.templateId },
    });
    if (!template) {
      template = await prisma.roleTemplate.findUnique({
        where: { slug: options.templateId },
      });
    }

    const background = await prisma.background.findUnique({
      where: { id: options.backgroundId },
    });

    if (!template || !background) {
      throw new Error('Template or background not found');
    }
    if (background.templateId !== template.id) {
      throw new Error('Background does not belong to template');
    }

    // Build complete system prompt
    const systemPrompt = this.buildSystemPrompt(
      template.baseSystemPrompt,
      background.promptModifiers,
    );

    // Create agent name (lowercase, no spaces)
    const agentName = options.generatedName.toLowerCase().replace(/\s+/g, '-');

    // Combine template tools with expertise-based tools
    const tools = this.selectToolsForAgent(template, background);

    // Create Agent record
    const agent = await prisma.agent.create({
      data: {
        name: agentName,
        displayName: options.generatedName,
        systemPrompt,
        llmProvider: llmConfig.provider,
        llmModel: llmConfig.model,
        llmTemperature: 0.7,
        llmMaxTokens: 8192,
        tools,
        slackChannels: options.slackChannels ?? [],
        memoryNamespace: agentName,
        role: template.role,
        team: template.team,
        reportsTo: template.reportsTo,
        expertise: [...template.requiredExpertise, ...background.expertiseBoost],
        enabled: true,
      },
    });

    // Create HiredAgent record
    await prisma.hiredAgent.create({
      data: {
        agentId: agent.id,
        templateId: template.id,
        backgroundId: background.id,
        hiredBy: options.hiredBy,
        generatedName: options.generatedName,
        generatedResume: options.generatedResume as any,
        customizations: options.customizations as any,
        status: 'active',
      },
    });

    log.info(
      {
        agentId: agent.id,
        agentName: agent.name,
        role: template.role,
      },
      'Agent hired successfully',
    );

    // Load the agent (will provision container if needed)
    const loaded = await this.loadAgent(agent.id);
    if (!loaded) {
      throw new Error('Failed to load newly hired agent');
    }

    return loaded;
  }

  /**
   * Terminate an agent (stop container, mark as terminated)
   */
  async terminateAgent(agentId: string): Promise<void> {
    const prisma = getPrisma();

    log.info({ agentId }, 'Terminating agent...');

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    // Stop container if exists
    if (agent.containerInfo) {
      try {
        await this.containerProvisioner.deprovisionContainer(agentId);
        log.info({ agentId }, 'Container stopped');
      } catch (err) {
        log.error({ err, agentId }, 'Failed to stop container');
      }
    }

    // Mark agent as disabled
    await prisma.agent.update({
      where: { id: agentId },
      data: { enabled: false },
    });

    // Mark HiredAgent as terminated
    await prisma.hiredAgent.updateMany({
      where: { agentId },
      data: {
        status: 'terminated',
        terminatedAt: new Date(),
      },
    });

    log.info({ agentId }, 'Agent terminated');
  }

  // Helper methods

  private buildSystemPrompt(basePrompt: string, modifiers: string): string {
    return `${basePrompt}\n\n--- BACKGROUND ---\n${modifiers}`;
  }

  private selectToolsForAgent(
    template: { defaultTools: string[]; needsContainer: boolean },
    background: { expertiseBoost: string[] },
  ): string[] {
    const tools = [...template.defaultTools];

    // Add dev tools if container is needed
    if (template.needsContainer) {
      const devTools = [
        'persistent_bash',
        'file_tree',
        'port_allocate',
        'process_manage',
        'file_read',
        'file_write',
      ];
      devTools.forEach(tool => {
        if (!tools.includes(tool)) {
          tools.push(tool);
        }
      });
    }

    // Add browser tool for frontend-related roles
    if (background.expertiseBoost.includes('ux') || background.expertiseBoost.includes('frontend')) {
      if (!tools.includes('browser_screenshot')) {
        tools.push('browser_screenshot');
      }
    }

    return tools;
  }
}

function resolveDefaultLlmConfig(): { provider: 'openai' | 'anthropic'; model: string } {
  const openaiApiKey = process.env['OPENAI_API_KEY']?.trim();
  if (openaiApiKey) {
    return {
      provider: 'openai',
      model: process.env['OPENAI_MODEL'] ?? 'gpt-4o-mini',
    };
  }

  return {
    provider: 'anthropic',
    model: process.env['ANTHROPIC_MODEL'] ?? 'claude-haiku-4-5',
  };
}
