export interface ScheduledTaskDef {
  id: string;
  agentId: string;
  name: string;
  cronExpression: string;
  taskType: string;
  payload?: Record<string, unknown>;
  enabled: boolean;
}

export interface TaskQueueEntry {
  id: string;
  agentId: string;
  taskType: string;
  payload: Record<string, unknown>;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
}
