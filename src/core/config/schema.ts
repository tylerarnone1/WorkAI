import { z } from 'zod';
import { config } from 'dotenv';
import type { FrameworkConfig } from './types.js';

config();

const frameworkConfigSchema = z.object({
  databaseUrl: z.string().min(1),
  slackSigningSecret: z.string().default(''),
  slackAppToken: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  port: z.coerce.number().default(3100),
  host: z.string().default('0.0.0.0'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  logLevel: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  taskQueuePollIntervalMs: z.coerce.number().default(5000),
  taskQueueConcurrency: z.coerce.number().default(3),
  embeddingProvider: z.enum(['openai', 'anthropic']).default('openai'),
  embeddingModel: z.string().default('text-embedding-3-small'),
  policyEngine: z.enum(['local', 'opa']).default('local'),
  opaPolicyUrl: z.string().optional(),
  opaPolicyPath: z.string().default('/v1/data/agents/allow'),
  opaTimeoutMs: z.coerce.number().default(3000),
  opaFailOpen: z.coerce.boolean().default(false),
  orchestrationEngine: z.enum(['local', 'temporal']).default('local'),
  temporalAddress: z.string().default('localhost:7233'),
  temporalNamespace: z.string().default('default'),
  temporalTaskQueue: z.string().default('agent-framework'),
  temporalWorkflowType: z.string().default('agentTaskWorkflow'),
  temporalWorkflowExecutionTimeoutMs: z.coerce.number().default(900000),
  observabilityEngine: z.enum(['none', 'langfuse']).default('none'),
  langfusePublicKey: z.string().optional(),
  langfuseSecretKey: z.string().optional(),
  langfuseBaseUrl: z.string().optional(),
  langfuseFlushAt: z.coerce.number().default(15),
  langfuseFlushIntervalMs: z.coerce.number().default(10000),
  authzEngine: z.enum(['local', 'openfga']).default('local'),
  openFgaApiUrl: z.string().optional(),
  openFgaStoreId: z.string().optional(),
  openFgaModelId: z.string().optional(),
  openFgaApiToken: z.string().optional(),
  openFgaFailOpen: z.coerce.boolean().default(false),
  openFgaDefaultRelation: z.string().default('can_execute'),
});

export function loadFrameworkConfig(
  overrides?: Partial<FrameworkConfig>,
): FrameworkConfig {
  const raw = {
    databaseUrl: process.env['DATABASE_URL'],
    slackSigningSecret: process.env['SLACK_SIGNING_SECRET'],
    slackAppToken: process.env['SLACK_APP_TOKEN'],
    anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
    openaiApiKey: process.env['OPENAI_API_KEY'],
    port: process.env['PORT'],
    host: process.env['HOST'],
    nodeEnv: process.env['NODE_ENV'],
    logLevel: process.env['LOG_LEVEL'],
    taskQueuePollIntervalMs: process.env['TASK_QUEUE_POLL_INTERVAL_MS'],
    taskQueueConcurrency: process.env['TASK_QUEUE_CONCURRENCY'],
    embeddingProvider: process.env['EMBEDDING_PROVIDER'],
    embeddingModel: process.env['EMBEDDING_MODEL'],
    policyEngine: process.env['POLICY_ENGINE'],
    opaPolicyUrl: process.env['OPA_POLICY_URL'],
    opaPolicyPath: process.env['OPA_POLICY_PATH'],
    opaTimeoutMs: process.env['OPA_TIMEOUT_MS'],
    opaFailOpen: process.env['OPA_FAIL_OPEN'],
    orchestrationEngine: process.env['ORCHESTRATION_ENGINE'],
    temporalAddress: process.env['TEMPORAL_ADDRESS'],
    temporalNamespace: process.env['TEMPORAL_NAMESPACE'],
    temporalTaskQueue: process.env['TEMPORAL_TASK_QUEUE'],
    temporalWorkflowType: process.env['TEMPORAL_WORKFLOW_TYPE'],
    temporalWorkflowExecutionTimeoutMs:
      process.env['TEMPORAL_WORKFLOW_EXECUTION_TIMEOUT_MS'],
    observabilityEngine: process.env['OBSERVABILITY_ENGINE'],
    langfusePublicKey: process.env['LANGFUSE_PUBLIC_KEY'],
    langfuseSecretKey: process.env['LANGFUSE_SECRET_KEY'],
    langfuseBaseUrl: process.env['LANGFUSE_BASE_URL'],
    langfuseFlushAt: process.env['LANGFUSE_FLUSH_AT'],
    langfuseFlushIntervalMs: process.env['LANGFUSE_FLUSH_INTERVAL_MS'],
    authzEngine: process.env['AUTHZ_ENGINE'],
    openFgaApiUrl: process.env['OPENFGA_API_URL'],
    openFgaStoreId: process.env['OPENFGA_STORE_ID'],
    openFgaModelId: process.env['OPENFGA_MODEL_ID'],
    openFgaApiToken: process.env['OPENFGA_API_TOKEN'],
    openFgaFailOpen: process.env['OPENFGA_FAIL_OPEN'],
    openFgaDefaultRelation: process.env['OPENFGA_DEFAULT_RELATION'],
    ...overrides,
  };

  return frameworkConfigSchema.parse(raw) as FrameworkConfig;
}
