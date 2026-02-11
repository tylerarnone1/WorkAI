import { BaseIntegration } from '../base-integration.js';
import type { CredentialStore } from '../credential-store.js';
import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../../tools/types.js';

const BASE_URL = 'https://api.github.com';

export class GitHubIntegration extends BaseIntegration {
  readonly provider = 'github' as const;
  readonly credentialType = 'pat' as const;

  constructor(credentialStore: CredentialStore) {
    super(credentialStore);
  }

  getTools(): ITool[] {
    return [
      new GitHubListReposTool(this),
      new GitHubCreateIssueTool(this),
      new GitHubListPRsTool(this),
      new GitHubCreatePRCommentTool(this),
      new GitHubGetFileContentTool(this),
      new GitHubCreatePRTool(this),
    ];
  }

  async request(path: string, options: { method?: string; body?: unknown; agentId?: string } = {}) {
    return this.apiRequest(`${BASE_URL}${path}`, {
      ...options,
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
  }
}

class GitHubListReposTool implements ITool {
  constructor(private integration: GitHubIntegration) {}
  definition: ToolDefinition = {
    name: 'github_list_repos',
    description: 'List repositories for an organization or the authenticated user.',
    parameters: {
      type: 'object',
      properties: {
        org: { type: 'string', description: 'Organization name. If omitted, lists user repos.' },
        limit: { type: 'number', description: 'Max repos to return (default: 10)' },
      },
    },
    category: 'github',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const org = args['org'] as string | undefined;
    const limit = (args['limit'] as number) ?? 10;
    const path = org ? `/orgs/${org}/repos?per_page=${limit}` : `/user/repos?per_page=${limit}&sort=updated`;
    const res = await this.integration.request(path, { agentId: context.agentId });
    const data = await res.json() as Array<{ full_name: string; description: string; html_url: string; updated_at: string }>;
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    const repos = data.map(r => ({ name: r.full_name, description: r.description, url: r.html_url, updated: r.updated_at }));
    return { success: true, output: JSON.stringify(repos, null, 2) };
  }
}

class GitHubCreateIssueTool implements ITool {
  constructor(private integration: GitHubIntegration) {}
  definition: ToolDefinition = {
    name: 'github_create_issue',
    description: 'Create a new issue in a GitHub repository.',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in "owner/repo" format' },
        title: { type: 'string', description: 'Issue title' },
        body: { type: 'string', description: 'Issue body (markdown)' },
        labels: { type: 'array', description: 'Labels to apply', items: { type: 'string' } },
      },
      required: ['repo', 'title'],
    },
    category: 'github',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const repo = args['repo'] as string;
    const res = await this.integration.request(`/repos/${repo}/issues`, {
      method: 'POST',
      body: { title: args['title'], body: args['body'], labels: args['labels'] },
      agentId: context.agentId,
    });
    const data = await res.json() as { html_url: string; number: number };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: `Issue #${data.number} created: ${data.html_url}` };
  }
}

class GitHubListPRsTool implements ITool {
  constructor(private integration: GitHubIntegration) {}
  definition: ToolDefinition = {
    name: 'github_list_prs',
    description: 'List open pull requests for a repository.',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in "owner/repo" format' },
        state: { type: 'string', description: 'PR state', enum: ['open', 'closed', 'all'] },
        limit: { type: 'number', description: 'Max PRs to return (default: 10)' },
      },
      required: ['repo'],
    },
    category: 'github',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const repo = args['repo'] as string;
    const state = (args['state'] as string) ?? 'open';
    const limit = (args['limit'] as number) ?? 10;
    const res = await this.integration.request(`/repos/${repo}/pulls?state=${state}&per_page=${limit}`, { agentId: context.agentId });
    const data = await res.json() as Array<{ number: number; title: string; user: { login: string }; html_url: string; created_at: string }>;
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    const prs = data.map(pr => ({ number: pr.number, title: pr.title, author: pr.user.login, url: pr.html_url, created: pr.created_at }));
    return { success: true, output: JSON.stringify(prs, null, 2) };
  }
}

class GitHubCreatePRCommentTool implements ITool {
  constructor(private integration: GitHubIntegration) {}
  definition: ToolDefinition = {
    name: 'github_comment_pr',
    description: 'Add a comment to a pull request.',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in "owner/repo" format' },
        prNumber: { type: 'number', description: 'Pull request number' },
        body: { type: 'string', description: 'Comment body (markdown)' },
      },
      required: ['repo', 'prNumber', 'body'],
    },
    category: 'github',
    requiresApproval: true,
    approvalReason: 'Posting a public comment on a pull request',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const repo = args['repo'] as string;
    const prNumber = args['prNumber'] as number;
    const res = await this.integration.request(`/repos/${repo}/issues/${prNumber}/comments`, {
      method: 'POST',
      body: { body: args['body'] },
      agentId: context.agentId,
    });
    const data = await res.json() as { html_url: string };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: `Comment posted: ${data.html_url}` };
  }
}

class GitHubGetFileContentTool implements ITool {
  constructor(private integration: GitHubIntegration) {}
  definition: ToolDefinition = {
    name: 'github_get_file',
    description: 'Get the contents of a file from a repository.',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in "owner/repo" format' },
        path: { type: 'string', description: 'File path within the repository' },
        ref: { type: 'string', description: 'Branch or commit SHA (default: main)' },
      },
      required: ['repo', 'path'],
    },
    category: 'github',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const repo = args['repo'] as string;
    const path = args['path'] as string;
    const ref = (args['ref'] as string) ?? 'main';
    const res = await this.integration.request(`/repos/${repo}/contents/${path}?ref=${ref}`, { agentId: context.agentId });
    const data = await res.json() as { content: string; encoding: string; name: string; size: number };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    const content = data.encoding === 'base64' ? Buffer.from(data.content, 'base64').toString('utf-8') : data.content;
    const truncated = content.length > 15000 ? content.slice(0, 15000) + '\n...[truncated]' : content;
    return { success: true, output: truncated };
  }
}

class GitHubCreatePRTool implements ITool {
  constructor(private integration: GitHubIntegration) {}
  definition: ToolDefinition = {
    name: 'github_create_pr',
    description: 'Create a new pull request.',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in "owner/repo" format' },
        title: { type: 'string', description: 'PR title' },
        body: { type: 'string', description: 'PR description (markdown)' },
        head: { type: 'string', description: 'Branch with changes' },
        base: { type: 'string', description: 'Target branch (default: main)' },
      },
      required: ['repo', 'title', 'head'],
    },
    category: 'github',
    requiresApproval: true,
    approvalReason: 'Creating a pull request',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const repo = args['repo'] as string;
    const res = await this.integration.request(`/repos/${repo}/pulls`, {
      method: 'POST',
      body: { title: args['title'], body: args['body'], head: args['head'], base: args['base'] ?? 'main' },
      agentId: context.agentId,
    });
    const data = await res.json() as { html_url: string; number: number };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: `PR #${data.number} created: ${data.html_url}` };
  }
}
