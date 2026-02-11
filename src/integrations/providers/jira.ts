import { BaseIntegration } from '../base-integration.js';
import type { CredentialStore } from '../credential-store.js';
import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../../tools/types.js';

/**
 * Jira Cloud integration. Requires `baseUrl` in the integration credential metadata
 * (e.g., "https://yourorg.atlassian.net").
 */
export class JiraIntegration extends BaseIntegration {
  readonly provider = 'jira' as const;
  readonly credentialType = 'oauth2' as const;
  private baseUrl = ''; // set at runtime from credential metadata

  constructor(credentialStore: CredentialStore) {
    super(credentialStore);
  }

  getTools(): ITool[] {
    return [
      new JiraSearchTool(this),
      new JiraGetIssueTool(this),
      new JiraCreateIssueTool(this),
      new JiraUpdateIssueTool(this),
      new JiraAddCommentTool(this),
      new JiraTransitionIssueTool(this),
    ];
  }

  async request(path: string, options: { method?: string; body?: unknown; agentId?: string } = {}) {
    if (!this.baseUrl) {
      // Try to read baseUrl from credential metadata
      const cred = await this.credentialStore.getCredential(this.provider, options.agentId);
      const meta = cred?.metadata as Record<string, unknown> | undefined;
      this.baseUrl = (meta?.['baseUrl'] as string) ?? '';
      if (!this.baseUrl) throw new Error('Jira baseUrl not configured in credential metadata');
    }
    return this.apiRequest(`${this.baseUrl}/rest/api/3${path}`, options);
  }
}

class JiraSearchTool implements ITool {
  constructor(private integration: JiraIntegration) {}
  definition: ToolDefinition = {
    name: 'jira_search',
    description: 'Search Jira issues using JQL (Jira Query Language).',
    parameters: {
      type: 'object',
      properties: {
        jql: { type: 'string', description: 'JQL query (e.g., "project = PROJ AND status = \"In Progress\"")' },
        maxResults: { type: 'number', description: 'Max results (default: 20)' },
        fields: { type: 'array', description: 'Fields to return', items: { type: 'string' } },
      },
      required: ['jql'],
    },
    category: 'jira',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const jql = args['jql'] as string;
    const maxResults = (args['maxResults'] as number) ?? 20;
    const fields = (args['fields'] as string[]) ?? ['summary', 'status', 'assignee', 'priority', 'issuetype', 'created', 'updated'];
    const res = await this.integration.request('/search', {
      method: 'POST',
      body: { jql, maxResults, fields },
      agentId: context.agentId,
    });
    const data = await res.json() as { issues: Array<{ key: string; fields: Record<string, unknown> }> };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    const issues = (data.issues ?? []).map(i => ({
      key: i.key,
      summary: (i.fields['summary'] as string),
      status: (i.fields['status'] as Record<string, unknown>)?.['name'],
      assignee: (i.fields['assignee'] as Record<string, unknown>)?.['displayName'],
      priority: (i.fields['priority'] as Record<string, unknown>)?.['name'],
      type: (i.fields['issuetype'] as Record<string, unknown>)?.['name'],
    }));
    return { success: true, output: JSON.stringify(issues, null, 2) };
  }
}

class JiraGetIssueTool implements ITool {
  constructor(private integration: JiraIntegration) {}
  definition: ToolDefinition = {
    name: 'jira_get_issue',
    description: 'Get details of a specific Jira issue.',
    parameters: {
      type: 'object',
      properties: {
        issueKey: { type: 'string', description: 'Issue key (e.g., "PROJ-123")' },
      },
      required: ['issueKey'],
    },
    category: 'jira',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const issueKey = args['issueKey'] as string;
    const res = await this.integration.request(`/issue/${encodeURIComponent(issueKey)}`, { agentId: context.agentId });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: JSON.stringify(data, null, 2) };
  }
}

class JiraCreateIssueTool implements ITool {
  constructor(private integration: JiraIntegration) {}
  definition: ToolDefinition = {
    name: 'jira_create_issue',
    description: 'Create a new Jira issue.',
    parameters: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Project key (e.g., "PROJ")' },
        summary: { type: 'string', description: 'Issue summary/title' },
        description: { type: 'string', description: 'Issue description (plain text)' },
        issueType: { type: 'string', description: 'Issue type (e.g., "Task", "Bug", "Story")' },
        priority: { type: 'string', description: 'Priority name (e.g., "High")' },
        assigneeAccountId: { type: 'string', description: 'Assignee account ID' },
        labels: { type: 'array', description: 'Labels', items: { type: 'string' } },
      },
      required: ['projectKey', 'summary', 'issueType'],
    },
    category: 'jira',
    requiresApproval: true,
    approvalReason: 'Creating a Jira issue',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const fields: Record<string, unknown> = {
      project: { key: args['projectKey'] },
      summary: args['summary'],
      issuetype: { name: args['issueType'] },
    };
    if (args['description']) {
      fields['description'] = {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: args['description'] }] }],
      };
    }
    if (args['priority']) fields['priority'] = { name: args['priority'] };
    if (args['assigneeAccountId']) fields['assignee'] = { accountId: args['assigneeAccountId'] };
    if (args['labels']) fields['labels'] = args['labels'];

    const res = await this.integration.request('/issue', {
      method: 'POST',
      body: { fields },
      agentId: context.agentId,
    });
    const data = await res.json() as { key: string; self: string };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: `Issue created: ${data.key}` };
  }
}

class JiraUpdateIssueTool implements ITool {
  constructor(private integration: JiraIntegration) {}
  definition: ToolDefinition = {
    name: 'jira_update_issue',
    description: 'Update fields on a Jira issue.',
    parameters: {
      type: 'object',
      properties: {
        issueKey: { type: 'string', description: 'Issue key (e.g., "PROJ-123")' },
        summary: { type: 'string', description: 'New summary' },
        description: { type: 'string', description: 'New description' },
        priority: { type: 'string', description: 'New priority name' },
        assigneeAccountId: { type: 'string', description: 'New assignee account ID' },
        labels: { type: 'array', description: 'New labels', items: { type: 'string' } },
      },
      required: ['issueKey'],
    },
    category: 'jira',
    requiresApproval: true,
    approvalReason: 'Updating a Jira issue',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const issueKey = args['issueKey'] as string;
    const fields: Record<string, unknown> = {};
    if (args['summary']) fields['summary'] = args['summary'];
    if (args['description']) {
      fields['description'] = {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: args['description'] }] }],
      };
    }
    if (args['priority']) fields['priority'] = { name: args['priority'] };
    if (args['assigneeAccountId']) fields['assignee'] = { accountId: args['assigneeAccountId'] };
    if (args['labels']) fields['labels'] = args['labels'];

    const res = await this.integration.request(`/issue/${encodeURIComponent(issueKey)}`, {
      method: 'PUT',
      body: { fields },
      agentId: context.agentId,
    });
    if (!res.ok) {
      const data = await res.json();
      return { success: false, output: JSON.stringify(data) };
    }
    return { success: true, output: `Issue ${issueKey} updated.` };
  }
}

class JiraAddCommentTool implements ITool {
  constructor(private integration: JiraIntegration) {}
  definition: ToolDefinition = {
    name: 'jira_add_comment',
    description: 'Add a comment to a Jira issue.',
    parameters: {
      type: 'object',
      properties: {
        issueKey: { type: 'string', description: 'Issue key (e.g., "PROJ-123")' },
        body: { type: 'string', description: 'Comment text' },
      },
      required: ['issueKey', 'body'],
    },
    category: 'jira',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const issueKey = args['issueKey'] as string;
    const res = await this.integration.request(`/issue/${encodeURIComponent(issueKey)}/comment`, {
      method: 'POST',
      body: {
        body: {
          type: 'doc',
          version: 1,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: args['body'] }] }],
        },
      },
      agentId: context.agentId,
    });
    const data = await res.json() as { id: string };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: `Comment added (ID: ${data.id})` };
  }
}

class JiraTransitionIssueTool implements ITool {
  constructor(private integration: JiraIntegration) {}
  definition: ToolDefinition = {
    name: 'jira_transition_issue',
    description: 'Transition a Jira issue to a new status (e.g., move to "In Progress" or "Done").',
    parameters: {
      type: 'object',
      properties: {
        issueKey: { type: 'string', description: 'Issue key (e.g., "PROJ-123")' },
        transitionId: { type: 'string', description: 'Transition ID. Use jira_get_issue to find available transitions.' },
      },
      required: ['issueKey', 'transitionId'],
    },
    category: 'jira',
    requiresApproval: true,
    approvalReason: 'Changing Jira issue status',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const issueKey = args['issueKey'] as string;
    const res = await this.integration.request(`/issue/${encodeURIComponent(issueKey)}/transitions`, {
      method: 'POST',
      body: { transition: { id: args['transitionId'] } },
      agentId: context.agentId,
    });
    if (!res.ok) {
      const data = await res.json();
      return { success: false, output: JSON.stringify(data) };
    }
    return { success: true, output: `Issue ${issueKey} transitioned.` };
  }
}
