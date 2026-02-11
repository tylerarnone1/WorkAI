import { BaseIntegration } from '../base-integration.js';
import type { CredentialStore } from '../credential-store.js';
import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../../tools/types.js';

const BASE_URL = 'https://api.figma.com/v1';

export class FigmaIntegration extends BaseIntegration {
  readonly provider = 'figma' as const;
  readonly credentialType = 'oauth2' as const;

  constructor(credentialStore: CredentialStore) {
    super(credentialStore);
  }

  getTools(): ITool[] {
    return [
      new FigmaGetFileTool(this),
      new FigmaGetCommentsTool(this),
      new FigmaPostCommentTool(this),
      new FigmaGetComponentsTool(this),
    ];
  }

  async request(path: string, options: { method?: string; body?: unknown; agentId?: string } = {}) {
    return this.apiRequest(`${BASE_URL}${path}`, options);
  }
}

class FigmaGetFileTool implements ITool {
  constructor(private integration: FigmaIntegration) {}
  definition: ToolDefinition = {
    name: 'figma_get_file',
    description: 'Get metadata and structure of a Figma file. Returns pages, frames, and layer tree.',
    parameters: {
      type: 'object',
      properties: {
        fileKey: { type: 'string', description: 'Figma file key (from the URL)' },
        depth: { type: 'number', description: 'How deep to traverse the layer tree (default: 2)' },
      },
      required: ['fileKey'],
    },
    category: 'figma',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const fileKey = args['fileKey'] as string;
    const depth = (args['depth'] as number) ?? 2;
    const res = await this.integration.request(`/files/${encodeURIComponent(fileKey)}?depth=${depth}`, {
      agentId: context.agentId,
    });
    const data = await res.json() as { name: string; lastModified: string; document: Record<string, unknown> };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return {
      success: true,
      output: JSON.stringify({
        name: data.name,
        lastModified: data.lastModified,
        document: data.document,
      }, null, 2),
    };
  }
}

class FigmaGetCommentsTool implements ITool {
  constructor(private integration: FigmaIntegration) {}
  definition: ToolDefinition = {
    name: 'figma_get_comments',
    description: 'Get comments on a Figma file.',
    parameters: {
      type: 'object',
      properties: {
        fileKey: { type: 'string', description: 'Figma file key' },
      },
      required: ['fileKey'],
    },
    category: 'figma',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const fileKey = args['fileKey'] as string;
    const res = await this.integration.request(`/files/${encodeURIComponent(fileKey)}/comments`, {
      agentId: context.agentId,
    });
    const data = await res.json() as { comments: Array<{ id: string; message: string; user: { handle: string }; created_at: string; resolved_at?: string }> };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    const comments = (data.comments ?? []).map(c => ({
      id: c.id,
      message: c.message,
      user: c.user?.handle,
      createdAt: c.created_at,
      resolved: !!c.resolved_at,
    }));
    return { success: true, output: JSON.stringify(comments, null, 2) };
  }
}

class FigmaPostCommentTool implements ITool {
  constructor(private integration: FigmaIntegration) {}
  definition: ToolDefinition = {
    name: 'figma_post_comment',
    description: 'Post a comment on a Figma file.',
    parameters: {
      type: 'object',
      properties: {
        fileKey: { type: 'string', description: 'Figma file key' },
        message: { type: 'string', description: 'Comment text' },
        nodeId: { type: 'string', description: 'Node ID to attach comment to (optional)' },
      },
      required: ['fileKey', 'message'],
    },
    category: 'figma',
    requiresApproval: true,
    approvalReason: 'Posting a comment in Figma',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const fileKey = args['fileKey'] as string;
    const body: Record<string, unknown> = { message: args['message'] };
    if (args['nodeId']) {
      body['client_meta'] = { node_id: args['nodeId'] };
    }
    const res = await this.integration.request(`/files/${encodeURIComponent(fileKey)}/comments`, {
      method: 'POST',
      body,
      agentId: context.agentId,
    });
    const data = await res.json() as { id: string };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: `Comment posted (ID: ${data.id})` };
  }
}

class FigmaGetComponentsTool implements ITool {
  constructor(private integration: FigmaIntegration) {}
  definition: ToolDefinition = {
    name: 'figma_get_components',
    description: 'List components in a Figma file. Useful for design system audits.',
    parameters: {
      type: 'object',
      properties: {
        fileKey: { type: 'string', description: 'Figma file key' },
      },
      required: ['fileKey'],
    },
    category: 'figma',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const fileKey = args['fileKey'] as string;
    const res = await this.integration.request(`/files/${encodeURIComponent(fileKey)}/components`, {
      agentId: context.agentId,
    });
    const data = await res.json() as { meta?: { components: Array<{ key: string; name: string; description: string }> } };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: JSON.stringify(data.meta?.components ?? [], null, 2) };
  }
}
