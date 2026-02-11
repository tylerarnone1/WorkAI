import { proxyActivities } from '@temporalio/workflow';
import type { TemporalTaskEnvelope } from './temporal-dispatcher.js';

interface TemporalActivities {
  runAgentTask(envelope: TemporalTaskEnvelope): Promise<Record<string, unknown>>;
}

const { runAgentTask } = proxyActivities<TemporalActivities>({
  startToCloseTimeout: '15 minutes',
  retry: {
    initialInterval: '15 seconds',
    maximumInterval: '5 minutes',
    maximumAttempts: 3,
  },
});

export async function agentTaskWorkflow(
  envelope: TemporalTaskEnvelope,
): Promise<Record<string, unknown>> {
  return runAgentTask(envelope);
}

