export interface ApprovalGate {
  agentId: string;
  actionType: string;
  actionPayload: Record<string, unknown>;
  reason: string;
  contextSummary?: string;
  expiresInMs?: number;
}

export type ApprovalDecision = 'approved' | 'denied' | 'expired';

export interface ApprovalResult {
  decision: ApprovalDecision;
  decidedBy?: string;
  reason?: string;
}
