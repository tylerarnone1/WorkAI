import { BaseIntegration } from '../base-integration.js';
import type { CredentialStore } from '../credential-store.js';
import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../../tools/types.js';

const BASE_URL = 'https://gmail.googleapis.com/gmail/v1';

export class GmailIntegration extends BaseIntegration {
  readonly provider = 'gmail' as const;
  readonly credentialType = 'oauth2' as const;

  constructor(credentialStore: CredentialStore) {
    super(credentialStore);
  }

  getTools(): ITool[] {
    return [
      new GmailListMessagesTool(this),
      new GmailReadMessageTool(this),
      new GmailSendTool(this),
      new GmailSearchTool(this),
    ];
  }

  async request(path: string, options: { method?: string; body?: unknown; agentId?: string } = {}) {
    return this.apiRequest(`${BASE_URL}${path}`, options);
  }
}

class GmailListMessagesTool implements ITool {
  constructor(private integration: GmailIntegration) {}
  definition: ToolDefinition = {
    name: 'gmail_list_messages',
    description: 'List recent emails from the inbox.',
    parameters: {
      type: 'object',
      properties: {
        maxResults: { type: 'number', description: 'Max messages to return (default: 10)' },
        labelIds: { type: 'array', description: 'Filter by label IDs (e.g., ["INBOX","UNREAD"])', items: { type: 'string' } },
      },
    },
    category: 'gmail',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const maxResults = (args['maxResults'] as number) ?? 10;
    const labelIds = (args['labelIds'] as string[]) ?? ['INBOX'];
    const labels = labelIds.map(l => `labelIds=${encodeURIComponent(l)}`).join('&');
    const res = await this.integration.request(
      `/users/me/messages?maxResults=${maxResults}&${labels}`,
      { agentId: context.agentId },
    );
    const data = await res.json() as { messages?: Array<{ id: string; threadId: string }> };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };

    // Fetch snippet for each message
    const messages = data.messages ?? [];
    const details = await Promise.all(
      messages.slice(0, maxResults).map(async (m) => {
        const r = await this.integration.request(
          `/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { agentId: context.agentId },
        );
        const d = await r.json() as {
          id: string;
          snippet: string;
          payload?: { headers?: Array<{ name: string; value: string }> };
        };
        const headers = d.payload?.headers ?? [];
        return {
          id: d.id,
          subject: headers.find(h => h.name === 'Subject')?.value,
          from: headers.find(h => h.name === 'From')?.value,
          date: headers.find(h => h.name === 'Date')?.value,
          snippet: d.snippet,
        };
      }),
    );

    return { success: true, output: JSON.stringify(details, null, 2) };
  }
}

class GmailReadMessageTool implements ITool {
  constructor(private integration: GmailIntegration) {}
  definition: ToolDefinition = {
    name: 'gmail_read_message',
    description: 'Read the full content of an email message.',
    parameters: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'The message ID' },
      },
      required: ['messageId'],
    },
    category: 'gmail',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const messageId = args['messageId'] as string;
    const res = await this.integration.request(
      `/users/me/messages/${encodeURIComponent(messageId)}?format=full`,
      { agentId: context.agentId },
    );
    const data = await res.json() as {
      id: string;
      snippet: string;
      payload?: {
        headers?: Array<{ name: string; value: string }>;
        body?: { data?: string };
        parts?: Array<{ mimeType: string; body?: { data?: string } }>;
      };
    };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };

    const headers = data.payload?.headers ?? [];
    const subject = headers.find(h => h.name === 'Subject')?.value;
    const from = headers.find(h => h.name === 'From')?.value;
    const to = headers.find(h => h.name === 'To')?.value;
    const date = headers.find(h => h.name === 'Date')?.value;

    // Extract plain text body
    let body = '';
    const textPart = data.payload?.parts?.find(p => p.mimeType === 'text/plain');
    const bodyData = textPart?.body?.data ?? data.payload?.body?.data;
    if (bodyData) {
      body = Buffer.from(bodyData, 'base64url').toString('utf-8');
    }

    return {
      success: true,
      output: JSON.stringify({ id: data.id, subject, from, to, date, body: body.slice(0, 30000) }, null, 2),
    };
  }
}

class GmailSendTool implements ITool {
  constructor(private integration: GmailIntegration) {}
  definition: ToolDefinition = {
    name: 'gmail_send',
    description: 'Send an email message.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body (plain text)' },
        cc: { type: 'string', description: 'CC email address (optional)' },
        threadId: { type: 'string', description: 'Thread ID to reply in (optional)' },
      },
      required: ['to', 'subject', 'body'],
    },
    category: 'gmail',
    requiresApproval: true,
    approvalReason: 'Sending an email on your behalf',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const to = args['to'] as string;
    const subject = args['subject'] as string;
    const body = args['body'] as string;
    const cc = args['cc'] as string | undefined;
    const threadId = args['threadId'] as string | undefined;

    let raw = `To: ${to}\r\nSubject: ${subject}\r\n`;
    if (cc) raw += `Cc: ${cc}\r\n`;
    raw += `Content-Type: text/plain; charset=UTF-8\r\n\r\n${body}`;

    const encoded = Buffer.from(raw).toString('base64url');
    const payload: Record<string, unknown> = { raw: encoded };
    if (threadId) payload['threadId'] = threadId;

    const res = await this.integration.request('/users/me/messages/send', {
      method: 'POST',
      body: payload,
      agentId: context.agentId,
    });
    const data = await res.json() as { id: string; threadId: string };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: `Email sent (ID: ${data.id})` };
  }
}

class GmailSearchTool implements ITool {
  constructor(private integration: GmailIntegration) {}
  definition: ToolDefinition = {
    name: 'gmail_search',
    description: 'Search emails using Gmail search syntax.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Gmail search query (e.g., "from:john subject:report after:2024/01/01")' },
        maxResults: { type: 'number', description: 'Max results (default: 10)' },
      },
      required: ['query'],
    },
    category: 'gmail',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const query = args['query'] as string;
    const maxResults = (args['maxResults'] as number) ?? 10;
    const res = await this.integration.request(
      `/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
      { agentId: context.agentId },
    );
    const data = await res.json() as { messages?: Array<{ id: string; threadId: string }>; resultSizeEstimate?: number };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };

    const messages = data.messages ?? [];
    const details = await Promise.all(
      messages.slice(0, maxResults).map(async (m) => {
        const r = await this.integration.request(
          `/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { agentId: context.agentId },
        );
        const d = await r.json() as {
          id: string;
          snippet: string;
          payload?: { headers?: Array<{ name: string; value: string }> };
        };
        const headers = d.payload?.headers ?? [];
        return {
          id: d.id,
          subject: headers.find(h => h.name === 'Subject')?.value,
          from: headers.find(h => h.name === 'From')?.value,
          date: headers.find(h => h.name === 'Date')?.value,
          snippet: d.snippet,
        };
      }),
    );

    return { success: true, output: JSON.stringify(details, null, 2) };
  }
}
