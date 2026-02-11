import type { PrismaClient } from '@prisma/client';
import {
  loadFrameworkConfig,
  type FrameworkConfig,
  type AgentConfig,
} from '../core/config/index.js';
import { initLogger, getLogger } from '../core/logger/index.js';
import { initializeDatabase, disconnectDatabase } from '../core/database/index.js';
import { EventBus } from '../core/events/index.js';
import { LLMClient } from '../llm/client.js';
import { initEmbeddingProvider } from '../memory/embeddings.js';
import { MemoryManager } from '../memory/memory-manager.js';
import { ToolRegistry } from '../tools/registry.js';
import {
  WebSearchTool,
  HttpRequestTool,
  MemorySearchTool,
  MemoryStoreTool,
  AgentMessageTool,
  HumanApprovalTool,
} from '../tools/base-tools/index.js';
import {
  FindExpertTool,
  DelegateTaskTool,
  AskColleagueTool,
} from '../tools/collaboration-tools/index.js';
import type { ITool } from '../tools/types.js';
import { ApprovalStore } from '../approval/approval-store.js';
import { ApprovalManager } from '../approval/approval-manager.js';
import { BaseAgent, type BaseAgentDeps } from '../agent/base-agent.js';
import { AgentRegistry } from './agent-registry.js';
import { SlackApp } from '../slack/slack-app.js';
import { CronScheduler } from '../orchestration/scheduler.js';
import { TaskQueue } from '../orchestration/task-queue.js';
import { InterAgentBus } from '../orchestration/inter-agent.js';
import { TemporalWorkerService } from '../orchestration/temporal-worker.js';
import { HealthServer } from './health.js';
import { registerShutdownHandlers, onShutdown } from './shutdown.js';
import { CredentialStore } from '../integrations/credential-store.js';
import { IntegrationRegistry } from '../integrations/registry.js';
import { WebhookHandler } from '../integrations/webhook-handler.js';
import type { IntegrationConfig } from '../integrations/types.js';
import {
  GitHubIntegration,
  GoogleCalendarIntegration,
  GoogleDriveIntegration,
  GmailIntegration,
  ClickUpIntegration,
  FigmaIntegration,
  JiraIntegration,
  HubSpotIntegration,
  ArgoCDIntegration,
} from '../integrations/providers/index.js';
import {
  createObservability,
  type AgentRunObservation,
} from '../observability/index.js';

export interface EmployeeDefinition {
  config: AgentConfig;
  createAgent: (deps: BaseAgentDeps) => BaseAgent;
  customTools?: ITool[];
  integrations?: IntegrationConfig[];
}

export class AgentFramework {
  private config!: FrameworkConfig;
  private prisma!: PrismaClient;
  private eventBus!: EventBus;
  private toolRegistry!: ToolRegistry;
  private agentRegistry!: AgentRegistry;
  private approvalManager!: ApprovalManager;
  private slackApp!: SlackApp;
  private scheduler!: CronScheduler;
  private taskQueue!: TaskQueue;
  private interAgentBus!: InterAgentBus;
  private temporalWorker?: TemporalWorkerService;
  private healthServer!: HealthServer;
  private credentialStore!: CredentialStore;
  private integrationRegistry!: IntegrationRegistry;
  private webhookHandler!: WebhookHandler;
  private observability!: AgentRunObservation;

  async boot(
    employees: EmployeeDefinition[],
    configOverrides?: Partial<FrameworkConfig>,
  ): Promise<void> {
    // 1. Load config
    this.config = loadFrameworkConfig(configOverrides);
    this.applyRuntimeConfigToEnv();

    // 2. Initialize logger
    initLogger(this.config.logLevel);
    const log = getLogger();
    log.info('Agent framework booting...');

    // 3. Connect to database
    this.prisma = await initializeDatabase();

    // 4. Initialize event bus
    this.eventBus = new EventBus();

    // 5. Initialize embedding provider
    const embeddingApiKey =
      this.config.embeddingProvider === 'openai'
        ? this.config.openaiApiKey
        : this.config.anthropicApiKey;

    if (embeddingApiKey) {
      initEmbeddingProvider(
        this.config.embeddingProvider,
        embeddingApiKey,
        this.config.embeddingModel,
      );
    } else {
      log.warn('No API key for embedding provider — memory search will not work');
    }

    // 5b. Initialize observability
    this.observability = createObservability(this.config);

    // 6. Initialize tool registry with base tools + collaboration tools
    this.toolRegistry = new ToolRegistry();
    this.toolRegistry.registerMany([
      new WebSearchTool(),
      new HttpRequestTool(),
      new MemorySearchTool(),
      new MemoryStoreTool(),
      new AgentMessageTool(this.prisma),
      new HumanApprovalTool(),
      new FindExpertTool(),
      new DelegateTaskTool(),
      new AskColleagueTool(),
    ]);

    // 7. Initialize approval system
    const approvalStore = new ApprovalStore(this.prisma);
    this.approvalManager = new ApprovalManager(approvalStore, this.eventBus);

    // 8. Initialize integration system
    this.credentialStore = new CredentialStore(this.prisma);
    this.integrationRegistry = new IntegrationRegistry();
    this.webhookHandler = new WebhookHandler(this.prisma, this.integrationRegistry, this.eventBus);

    // Register integrations from employee definitions
    const registeredProviders = new Set<string>();
    for (const employee of employees) {
      for (const ic of employee.integrations ?? []) {
        if (!ic.enabled || registeredProviders.has(ic.provider)) continue;
        const integration = this.createIntegration(ic.provider);
        if (integration) {
          this.integrationRegistry.register(integration);
          registeredProviders.add(ic.provider);
        }
      }
    }

    // Add integration tools to tool registry
    const integrationTools = this.integrationRegistry.getAllTools();
    if (integrationTools.length > 0) {
      this.toolRegistry.registerMany(integrationTools);
      log.info({ count: integrationTools.length, providers: Array.from(registeredProviders) }, 'Integration tools registered');
    }

    // 9. Initialize agent registry
    this.agentRegistry = new AgentRegistry();

    // 10. Register custom tools from employees
    for (const employee of employees) {
      if (employee.customTools) {
        this.toolRegistry.registerMany(employee.customTools);
      }
    }

    // 11. Create and register agents
    for (const employee of employees) {
      const llmApiKey =
        employee.config.llmProvider === 'anthropic'
          ? this.config.anthropicApiKey
          : this.config.openaiApiKey;

      if (!llmApiKey) {
        log.error(
          { agent: employee.config.name, provider: employee.config.llmProvider },
          'No API key for LLM provider — skipping agent',
        );
        continue;
      }

      const llmClient = new LLMClient(employee.config.llmProvider, {
        apiKey: llmApiKey,
        model: employee.config.llmModel,
      });

      const memoryManager = new MemoryManager(
        this.prisma,
        employee.config.name,
        employee.config.memoryNamespace,
      );

      const deps: BaseAgentDeps = {
        config: employee.config,
        llmClient,
        memoryManager,
        toolRegistry: this.toolRegistry,
        approvalManager: this.approvalManager,
        eventBus: this.eventBus,
        observability: this.observability,
      };

      const agent = employee.createAgent(deps);
      this.agentRegistry.register(agent, employee.config);

      // Sync agent config to DB
      await this.prisma.agent.upsert({
        where: { name: employee.config.name },
        update: {
          displayName: employee.config.displayName,
          systemPrompt: employee.config.systemPrompt,
          llmProvider: employee.config.llmProvider,
          llmModel: employee.config.llmModel,
          llmTemperature: employee.config.llmTemperature,
          llmMaxTokens: employee.config.llmMaxTokens,
          tools: employee.config.tools,
          slackChannels: employee.config.slackChannels,
          memoryNamespace: employee.config.memoryNamespace,
          role: employee.config.role,
          team: employee.config.team,
          reportsTo: employee.config.reportsTo,
          expertise: employee.config.expertise ?? [],
          canDelegate: employee.config.canDelegate ?? [],
          enabled: true,
        },
        create: {
          name: employee.config.name,
          displayName: employee.config.displayName,
          systemPrompt: employee.config.systemPrompt,
          llmProvider: employee.config.llmProvider,
          llmModel: employee.config.llmModel,
          llmTemperature: employee.config.llmTemperature,
          llmMaxTokens: employee.config.llmMaxTokens,
          tools: employee.config.tools,
          slackChannels: employee.config.slackChannels,
          memoryNamespace: employee.config.memoryNamespace,
          role: employee.config.role,
          team: employee.config.team,
          reportsTo: employee.config.reportsTo,
          expertise: employee.config.expertise ?? [],
          canDelegate: employee.config.canDelegate ?? [],
          enabled: true,
        },
      });

      // Sync scheduled tasks
      for (const task of employee.config.scheduledTasks) {
        const agentRecord = await this.prisma.agent.findUnique({
          where: { name: employee.config.name },
        });
        if (agentRecord) {
          await this.prisma.scheduledTask.upsert({
            where: {
              agentId_name: {
                agentId: agentRecord.id,
                name: task.name,
              },
            },
            update: {
              cronExpression: task.cronExpression,
              taskType: task.taskType,
              taskPayload: (task.payload as object) ?? undefined,
              enabled: task.enabled,
            },
            create: {
              agentId: agentRecord.id,
              name: task.name,
              cronExpression: task.cronExpression,
              taskType: task.taskType,
              taskPayload: (task.payload as object) ?? undefined,
              enabled: task.enabled,
            },
          });
        }
      }

      log.info(
        {
          agent: employee.config.name,
          provider: employee.config.llmProvider,
          model: employee.config.llmModel,
          tools: employee.config.tools.length,
        },
        'Agent created and registered',
      );
    }

    // 12. Initialize Slack
    this.slackApp = new SlackApp(
      this.config,
      this.agentRegistry,
      this.approvalManager,
      this.eventBus,
    );
    await this.slackApp.start();

    // 13. Initialize scheduler
    this.scheduler = new CronScheduler(this.prisma, this.agentRegistry);
    await this.scheduler.initialize();

    // 13b. Start temporal worker if configured
    let temporalEnabled = false;
    if (this.config.orchestrationEngine === 'temporal') {
      this.temporalWorker = new TemporalWorkerService(
        this.prisma,
        this.agentRegistry,
        {
          enabled: true,
          address: this.config.temporalAddress,
          namespace: this.config.temporalNamespace,
          taskQueue: this.config.temporalTaskQueue,
          workflowType: this.config.temporalWorkflowType,
          workflowExecutionTimeoutMs:
            this.config.temporalWorkflowExecutionTimeoutMs,
        },
      );

      temporalEnabled = await this.temporalWorker.start();
      if (!temporalEnabled) {
        log.warn(
          'Temporal orchestration requested but worker failed to start. Falling back to local queue.',
        );
      }
    }

    // 14. Start task queue
    this.taskQueue = new TaskQueue(this.prisma, this.agentRegistry, {
      pollIntervalMs: this.config.taskQueuePollIntervalMs,
      concurrency: this.config.taskQueueConcurrency,
      processingTimeoutMs: 5 * 60_000,
      temporal: {
        enabled: temporalEnabled,
        address: this.config.temporalAddress,
        namespace: this.config.temporalNamespace,
        taskQueue: this.config.temporalTaskQueue,
        workflowType: this.config.temporalWorkflowType,
        workflowExecutionTimeoutMs:
          this.config.temporalWorkflowExecutionTimeoutMs,
      },
    });
    await this.taskQueue.start();

    // Resume paused runs when approvals are granted.
    this.eventBus.on<{
      requestId: string;
      decision: 'approved' | 'denied' | 'expired';
    }>('approval:decided', async (event) => {
      if (event.payload.decision !== 'approved') return;

      const approval = await this.approvalManager.getRequest(event.payload.requestId);
      if (!approval) return;

      const actionPayload =
        (approval.actionPayload as Record<string, unknown>) ?? {};
      const resumeContext =
        (actionPayload['resumeContext'] as Record<string, unknown> | undefined) ??
        undefined;

      const conversationId = resumeContext?.['conversationId'];
      if (typeof conversationId !== 'string') return;

      await this.taskQueue.enqueue(
        approval.agentId,
        'approval_resume',
        {
          approvalRequestId: approval.id,
          conversationId,
          prompt: `Approval granted for "${approval.actionType}". Continue and complete the action.`,
        },
        { priority: 100 },
      );
    });

    // 15. Start inter-agent bus
    this.interAgentBus = new InterAgentBus(
      this.prisma,
      this.agentRegistry,
      this.eventBus,
    );
    this.interAgentBus.startPolling();

    // 16. Start health server
    this.healthServer = new HealthServer(this.agentRegistry);
    this.healthServer.start(this.config.port, this.config.host);

    // 17. Register shutdown handlers
    registerShutdownHandlers();
    onShutdown(async () => {
      this.interAgentBus.stop();
      await this.taskQueue.stop();
      await this.scheduler.shutdown();
      await this.slackApp.stop();
      this.healthServer.stop();
      await this.temporalWorker?.stop();
      await this.observability.shutdown();
      await disconnectDatabase();
    });

    log.info(
      { agents: this.agentRegistry.size },
      'Agent framework ready',
    );
  }

  getAgentRegistry(): AgentRegistry {
    return this.agentRegistry;
  }

  getTaskQueue(): TaskQueue {
    return this.taskQueue;
  }

  getInterAgentBus(): InterAgentBus {
    return this.interAgentBus;
  }

  getEventBus(): EventBus {
    return this.eventBus;
  }

  getIntegrationRegistry(): IntegrationRegistry {
    return this.integrationRegistry;
  }

  getCredentialStore(): CredentialStore {
    return this.credentialStore;
  }

  getWebhookHandler(): WebhookHandler {
    return this.webhookHandler;
  }

  private createIntegration(provider: string) {
    switch (provider) {
      case 'github': return new GitHubIntegration(this.credentialStore);
      case 'google_calendar': return new GoogleCalendarIntegration(this.credentialStore);
      case 'google_drive': return new GoogleDriveIntegration(this.credentialStore);
      case 'gmail': return new GmailIntegration(this.credentialStore);
      case 'clickup': return new ClickUpIntegration(this.credentialStore);
      case 'figma': return new FigmaIntegration(this.credentialStore);
      case 'jira': return new JiraIntegration(this.credentialStore);
      case 'hubspot': return new HubSpotIntegration(this.credentialStore);
      case 'argocd': return new ArgoCDIntegration(this.credentialStore);
      default: return null;
    }
  }

  private applyRuntimeConfigToEnv(): void {
    const setEnv = (key: string, value: string | number | boolean | undefined) => {
      if (value === undefined || value === null || value === '') {
        delete process.env[key];
        return;
      }
      process.env[key] = String(value);
    };

    setEnv('POLICY_ENGINE', this.config.policyEngine);
    setEnv('OPA_POLICY_URL', this.config.opaPolicyUrl);
    setEnv('OPA_POLICY_PATH', this.config.opaPolicyPath);
    setEnv('OPA_TIMEOUT_MS', this.config.opaTimeoutMs);
    setEnv('OPA_FAIL_OPEN', this.config.opaFailOpen);

    setEnv('AUTHZ_ENGINE', this.config.authzEngine);
    setEnv('OPENFGA_API_URL', this.config.openFgaApiUrl);
    setEnv('OPENFGA_STORE_ID', this.config.openFgaStoreId);
    setEnv('OPENFGA_MODEL_ID', this.config.openFgaModelId);
    setEnv('OPENFGA_API_TOKEN', this.config.openFgaApiToken);
    setEnv('OPENFGA_FAIL_OPEN', this.config.openFgaFailOpen);
    setEnv('OPENFGA_DEFAULT_RELATION', this.config.openFgaDefaultRelation);
  }
}
