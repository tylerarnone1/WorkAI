export interface ApprovalBlockPayload {
  requestId: string;
  agentName: string;
  actionType: string;
  reason: string;
  contextSummary?: string;
}

export function buildApprovalBlocks(payload: ApprovalBlockPayload): unknown[] {
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Approval Required — ${payload.agentName}`,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Action:*\n${payload.actionType}`,
        },
        {
          type: 'mrkdwn',
          text: `*Agent:*\n${payload.agentName}`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Reason:*\n${payload.reason}`,
      },
    },
  ];

  if (payload.contextSummary) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Context:*\n${payload.contextSummary}`,
      },
    } as never);
  }

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Approve' },
        style: 'primary',
        action_id: 'approval_approve',
        value: payload.requestId,
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Deny' },
        style: 'danger',
        action_id: 'approval_deny',
        value: payload.requestId,
      },
    ],
  } as never);

  return blocks;
}

export function buildApprovalResultBlocks(
  original: ApprovalBlockPayload,
  decision: 'approved' | 'denied',
  decidedBy: string,
): unknown[] {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${decision === 'approved' ? 'Approved' : 'Denied'} — ${original.agentName}`,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Action:*\n${original.actionType}`,
        },
        {
          type: 'mrkdwn',
          text: `*Decision by:*\n<@${decidedBy}>`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Status:* ${decision === 'approved' ? ':white_check_mark: Approved' : ':x: Denied'}`,
      },
    },
  ];
}
