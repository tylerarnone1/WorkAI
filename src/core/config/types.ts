export interface FrameworkConfig {
  databaseUrl: string;
  slackSigningSecret: string;
  slackAppToken?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  port: number;
  host: string;
  nodeEnv: 'development' | 'production' | 'test';
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  taskQueuePollIntervalMs: number;
  taskQueueConcurrency: number;
  embeddingProvider: 'openai' | 'anthropic';
  embeddingModel: string;
  policyEngine: 'local' | 'opa';
  opaPolicyUrl?: string;
  opaPolicyPath: string;
  opaTimeoutMs: number;
  opaFailOpen: boolean;
  orchestrationEngine: 'local' | 'temporal';
  temporalAddress: string;
  temporalNamespace: string;
  temporalTaskQueue: string;
  temporalWorkflowType: string;
  temporalWorkflowExecutionTimeoutMs: number;
  observabilityEngine: 'none' | 'langfuse';
  langfusePublicKey?: string;
  langfuseSecretKey?: string;
  langfuseBaseUrl?: string;
  langfuseFlushAt: number;
  langfuseFlushIntervalMs: number;
  authzEngine: 'local' | 'openfga';
  openFgaApiUrl?: string;
  openFgaStoreId?: string;
  openFgaModelId?: string;
  openFgaApiToken?: string;
  openFgaFailOpen: boolean;
  openFgaDefaultRelation: string;
}

export interface AgentConfig {
  name: string;
  displayName: string;
  avatarUrl?: string;
  systemPrompt: string;
  personality?: string;
  llmProvider: 'anthropic' | 'openai';
  llmModel: string;
  llmTemperature: number;
  llmMaxTokens: number;
  tools: string[];
  slackBotToken?: string;
  slackAppToken?: string;
  slackChannels: string[];
  memoryNamespace: string;
  role?: string;
  team?: string;
  reportsTo?: string;
  expertise?: string[];
  canDelegate?: string[];
  maxIterations: number;
  scheduledTasks: ScheduledTaskConfig[];
  metadata?: Record<string, unknown>;
}

export interface ScheduledTaskConfig {
  name: string;
  cronExpression: string;
  taskType: string;
  payload?: Record<string, unknown>;
  enabled: boolean;
}

export interface AgentFactory {
  config: AgentConfig;
  createAgent: (deps: AgentDependencies) => unknown;
  customTools?: unknown[];
}

export interface AgentDependencies {
  config: AgentConfig;
  frameworkConfig: FrameworkConfig;
  llmClient: unknown;
  memoryManager: unknown;
  toolRegistry: unknown;
  approvalManager: unknown;
  messageSender: unknown;
  eventBus: unknown;
}
