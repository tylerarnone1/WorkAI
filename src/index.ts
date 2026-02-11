// Framework
export { AgentFramework, type EmployeeDefinition } from './framework/bootstrap.js';
export { AgentRegistry } from './framework/agent-registry.js';
export { onShutdown } from './framework/shutdown.js';

// Agent
export { BaseAgent, type BaseAgentDeps } from './agent/base-agent.js';
export { AgentRunner } from './agent/agent-runner.js';
export { OrgRegistry, type OrgAgent } from './agent/org-registry.js';
export type {
  AgentContext,
  AgentState,
  AgentTrigger,
  AgentRunResult,
} from './agent/types.js';

// Config
export { loadFrameworkConfig } from './core/config/index.js';
export type {
  FrameworkConfig,
  AgentConfig,
  ScheduledTaskConfig,
  AgentDependencies,
} from './core/config/types.js';

// LLM
export { LLMClient } from './llm/client.js';
export {
  registerProvider,
  getAvailableProviders,
} from './llm/provider-registry.js';
export { BaseLLMProvider } from './llm/providers/base-provider.js';
export type {
  ILLMProvider,
  LLMProviderType,
  LLMMessage,
  LLMRequest,
  LLMResponse,
  TokenUsage,
  ToolCall,
  ToolCallResult,
  UnifiedToolDefinition,
  ToolParameterSchema,
} from './llm/types.js';

// Memory
export { MemoryManager } from './memory/memory-manager.js';
export type {
  MemoryEntry,
  MemoryQuery,
  MemorySearchResult,
  MemoryType,
  StoreOptions,
} from './memory/types.js';

// Tools
export { ToolRegistry } from './tools/registry.js';
export { ToolExecutor } from './tools/executor.js';
export type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from './tools/types.js';
export {
  WebSearchTool,
  HttpRequestTool,
  MemorySearchTool,
  MemoryStoreTool,
  AgentMessageTool,
  HumanApprovalTool,
} from './tools/base-tools/index.js';
export {
  FindExpertTool,
  DelegateTaskTool,
  AskColleagueTool,
} from './tools/collaboration-tools/index.js';

// Approval
export { ApprovalManager } from './approval/approval-manager.js';
export type { ApprovalGate, ApprovalDecision, ApprovalResult } from './approval/types.js';

// Slack
export { SlackApp } from './slack/slack-app.js';
export { MessageSender } from './slack/message-sender.js';
export { MessageRouter } from './slack/message-router.js';
export { buildApprovalBlocks, buildApprovalResultBlocks } from './slack/approval-ui.js';

// Orchestration
export { CronScheduler } from './orchestration/scheduler.js';
export { TaskQueue } from './orchestration/task-queue.js';
export { InterAgentBus } from './orchestration/inter-agent.js';
export { TemporalDispatcher } from './orchestration/temporal-dispatcher.js';
export { TemporalWorkerService } from './orchestration/temporal-worker.js';

// Integrations
export {
  BaseIntegration,
  CredentialStore,
  IntegrationRegistry,
  WebhookHandler,
  GitHubIntegration,
  GoogleCalendarIntegration,
  GoogleDriveIntegration,
  GmailIntegration,
  ClickUpIntegration,
  FigmaIntegration,
  JiraIntegration,
  HubSpotIntegration,
  ArgoCDIntegration,
} from './integrations/index.js';
export type {
  IIntegration,
  IntegrationProvider,
  IntegrationConfig,
  CredentialType,
  OAuthTokens,
  WebhookPayload,
} from './integrations/index.js';

// Core utilities
export { EventBus } from './core/events/index.js';
export { getLogger, createChildLogger } from './core/logger/index.js';
export { getPrisma } from './core/database/index.js';
export {
  AppError,
  ValidationError,
  NotFoundError,
  ProviderError,
  ToolExecutionError,
  ApprovalTimeoutError,
} from './core/errors/index.js';

// Observability
export {
  createObservability,
  LangfuseObservability,
  NoopObservability,
} from './observability/index.js';
export type {
  AgentRunObservation,
  AgentRunStartInput,
  ToolExecutionObservation,
} from './observability/index.js';

// Authorization
export {
  OpenFgaAuthorizer,
  getOpenFgaAuthorizer,
} from './authz/index.js';
