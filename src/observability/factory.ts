import { createChildLogger } from '../core/logger/index.js';
import type { FrameworkConfig } from '../core/config/types.js';
import type { AgentRunObservation } from './types.js';
import { NoopObservability } from './noop-observability.js';
import { LangfuseObservability } from './langfuse-observability.js';

const log = createChildLogger({ module: 'observability-factory' });

export function createObservability(
  config: FrameworkConfig,
): AgentRunObservation {
  const engine = config.observabilityEngine;
  if (engine !== 'langfuse') {
    return new NoopObservability();
  }

  if (!config.langfusePublicKey || !config.langfuseSecretKey) {
    log.warn(
      'OBSERVABILITY_ENGINE=langfuse but LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY is missing. Falling back to no-op.',
    );
    return new NoopObservability();
  }

  return new LangfuseObservability({
    publicKey: config.langfusePublicKey,
    secretKey: config.langfuseSecretKey,
    baseUrl: config.langfuseBaseUrl,
    flushAt: config.langfuseFlushAt,
    flushIntervalMs: config.langfuseFlushIntervalMs,
  });
}
