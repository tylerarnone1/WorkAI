import { BaseIntegration } from '../base-integration.js';
import type { CredentialStore } from '../credential-store.js';
import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../../tools/types.js';

const BASE_URL = 'https://api.clickup.com/api/v2';

export class ClickUpIntegration extends BaseIntegration {
  readonly provider = 'clickup' as const;
  readonly credentialType = 'oauth2' as const;

  constructor(credentialStore: CredentialStore) {
    super(credentialStore);
  }

  getTools(): ITool[] {
    return [
      new ClickUpListTasksTool(this),
      new ClickUpGetTaskTool(this),
      new ClickUpCreateTaskTool(this),
      new ClickUpUpdateTaskTool(this),
      new ClickUpAddCommentTool(this),
      new ClickUpGetSpacesTool(this),
    ];
  }

  async request(path: string, options: { method?: string; body?: unknown; agentId?: string } = {}) {
    return this.apiRequest(`${BASE_URL}${path}`, options);
  }
}

class ClickUpGetSpacesTool implements ITool {
  constructor(private integration: ClickUpIntegration) {}
  definition: ToolDefinition = {
    name: 'clickup_get_spaces',
    description: 'List all spaces in a ClickUp workspace/team.',
    parameters: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'Team/workspace ID' },
      },
      required: ['teamId'],
    },
    category: 'clickup',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const teamId = args['teamId'] as string;
    const res = await this.integration.request(`/team/${teamId}/space?archived=false`, { agentId: context.agentId });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: JSON.stringify(data, null, 2) };
  }
}

class ClickUpListTasksTool implements ITool {
  constructor(private integration: ClickUpIntegration) {}
  definition: ToolDefinition = {
    name: 'clickup_list_tasks',
    description: 'List tasks in a ClickUp list. Supports filtering by status, assignee, and tags.',
    parameters: {
      type: 'object',
      properties: {
        listId: { type: 'string', description: 'The list ID' },
        statuses: { type: 'array', description: 'Filter by status names', items: { type: 'string' } },
        assignees: { type: 'array', description: 'Filter by assignee user IDs', items: { type: 'string' } },
        tags: { type: 'array', description: 'Filter by tag names', items: { type: 'string' } },
        page: { type: 'number', description: 'Page number (default: 0)' },
      },
      required: ['listId'],
    },
    category: 'clickup',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const listId = args['listId'] as string;
    const page = (args['page'] as number) ?? 0;
    const params = new URLSearchParams({ page: String(page), archived: 'false' });
    const statuses = args['statuses'] as string[] | undefined;
    const assignees = args['assignees'] as string[] | undefined;
    const tags = args['tags'] as string[] | undefined;
    if (statuses) statuses.forEach(s => params.append('statuses[]', s));
    if (assignees) assignees.forEach(a => params.append('assignees[]', a));
    if (tags) tags.forEach(t => params.append('tags[]', t));

    const res = await this.integration.request(`/list/${listId}/task?${params}`, { agentId: context.agentId });
    const data = await res.json() as { tasks: Array<Record<string, unknown>> };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    const tasks = (data.tasks ?? []).map(t => ({
      id: t['id'],
      name: t['name'],
      status: (t['status'] as Record<string, unknown>)?.['status'],
      assignees: t['assignees'],
      priority: t['priority'],
      dueDate: t['due_date'],
      url: t['url'],
    }));
    return { success: true, output: JSON.stringify(tasks, null, 2) };
  }
}

class ClickUpGetTaskTool implements ITool {
  constructor(private integration: ClickUpIntegration) {}
  definition: ToolDefinition = {
    name: 'clickup_get_task',
    description: 'Get details of a specific ClickUp task.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task ID' },
      },
      required: ['taskId'],
    },
    category: 'clickup',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const taskId = args['taskId'] as string;
    const res = await this.integration.request(`/task/${taskId}`, { agentId: context.agentId });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: JSON.stringify(data, null, 2) };
  }
}

class ClickUpCreateTaskTool implements ITool {
  constructor(private integration: ClickUpIntegration) {}
  definition: ToolDefinition = {
    name: 'clickup_create_task',
    description: 'Create a new task in ClickUp.',
    parameters: {
      type: 'object',
      properties: {
        listId: { type: 'string', description: 'The list ID to create the task in' },
        name: { type: 'string', description: 'Task name' },
        description: { type: 'string', description: 'Task description (supports markdown)' },
        assignees: { type: 'array', description: 'Assignee user IDs', items: { type: 'number' } },
        tags: { type: 'array', description: 'Tag names', items: { type: 'string' } },
        status: { type: 'string', description: 'Task status name' },
        priority: { type: 'number', description: 'Priority (1=urgent, 2=high, 3=normal, 4=low)' },
        dueDate: { type: 'number', description: 'Due date as Unix timestamp in ms' },
      },
      required: ['listId', 'name'],
    },
    category: 'clickup',
    requiresApproval: true,
    approvalReason: 'Creating a task in ClickUp',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const listId = args['listId'] as string;
    const body: Record<string, unknown> = { name: args['name'] };
    if (args['description']) body['description'] = args['description'];
    if (args['assignees']) body['assignees'] = args['assignees'];
    if (args['tags']) body['tags'] = args['tags'];
    if (args['status']) body['status'] = args['status'];
    if (args['priority']) body['priority'] = args['priority'];
    if (args['dueDate']) body['due_date'] = args['dueDate'];

    const res = await this.integration.request(`/list/${listId}/task`, {
      method: 'POST',
      body,
      agentId: context.agentId,
    });
    const data = await res.json() as { id: string; url: string };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: `Task created: ${data.url ?? data.id}` };
  }
}

class ClickUpUpdateTaskTool implements ITool {
  constructor(private integration: ClickUpIntegration) {}
  definition: ToolDefinition = {
    name: 'clickup_update_task',
    description: 'Update an existing ClickUp task (status, assignees, priority, etc.).',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task ID' },
        name: { type: 'string', description: 'New task name' },
        description: { type: 'string', description: 'New description' },
        status: { type: 'string', description: 'New status' },
        priority: { type: 'number', description: 'New priority (1-4)' },
        dueDate: { type: 'number', description: 'New due date (Unix ms)' },
      },
      required: ['taskId'],
    },
    category: 'clickup',
    requiresApproval: true,
    approvalReason: 'Updating a ClickUp task',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const taskId = args['taskId'] as string;
    const body: Record<string, unknown> = {};
    if (args['name']) body['name'] = args['name'];
    if (args['description']) body['description'] = args['description'];
    if (args['status']) body['status'] = args['status'];
    if (args['priority']) body['priority'] = args['priority'];
    if (args['dueDate']) body['due_date'] = args['dueDate'];

    const res = await this.integration.request(`/task/${taskId}`, {
      method: 'PUT',
      body,
      agentId: context.agentId,
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: `Task updated: ${data['url'] ?? taskId}` };
  }
}

class ClickUpAddCommentTool implements ITool {
  constructor(private integration: ClickUpIntegration) {}
  definition: ToolDefinition = {
    name: 'clickup_add_comment',
    description: 'Add a comment to a ClickUp task.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task ID' },
        commentText: { type: 'string', description: 'The comment text' },
      },
      required: ['taskId', 'commentText'],
    },
    category: 'clickup',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const taskId = args['taskId'] as string;
    const res = await this.integration.request(`/task/${taskId}/comment`, {
      method: 'POST',
      body: { comment_text: args['commentText'] },
      agentId: context.agentId,
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: 'Comment added.' };
  }
}
