import { BaseIntegration } from '../base-integration.js';
import type { CredentialStore } from '../credential-store.js';
import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../../tools/types.js';

const BASE_URL = 'https://www.googleapis.com/drive/v3';

export class GoogleDriveIntegration extends BaseIntegration {
  readonly provider = 'google_drive' as const;
  readonly credentialType = 'oauth2' as const;

  constructor(credentialStore: CredentialStore) {
    super(credentialStore);
  }

  getTools(): ITool[] {
    return [
      new DriveSearchTool(this),
      new DriveGetFileTool(this),
      new DriveListFilesTool(this),
      new DriveCreateFileTool(this),
    ];
  }

  async request(path: string, options: { method?: string; body?: unknown; headers?: Record<string, string>; agentId?: string } = {}) {
    return this.apiRequest(`${BASE_URL}${path}`, options);
  }

  async uploadRequest(metadata: Record<string, unknown>, content: string, mimeType: string, agentId?: string) {
    const boundary = '---agents-base-boundary';
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--${boundary}--`;

    const token = await this.ensureToken(agentId);
    return fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });
  }
}

class DriveSearchTool implements ITool {
  constructor(private integration: GoogleDriveIntegration) {}
  definition: ToolDefinition = {
    name: 'drive_search',
    description: 'Search for files in Google Drive by name or content.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (supports Drive search syntax)' },
        maxResults: { type: 'number', description: 'Max files to return (default: 10)' },
      },
      required: ['query'],
    },
    category: 'google_drive',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const query = args['query'] as string;
    const maxResults = (args['maxResults'] as number) ?? 10;
    const q = encodeURIComponent(query);
    const res = await this.integration.request(
      `/files?q=${q}&pageSize=${maxResults}&fields=files(id,name,mimeType,modifiedTime,size,webViewLink,owners)`,
      { agentId: context.agentId },
    );
    const data = await res.json() as { files: Array<{ id: string; name: string; mimeType: string; modifiedTime: string; size: string; webViewLink: string }> };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: JSON.stringify(data.files ?? [], null, 2) };
  }
}

class DriveGetFileTool implements ITool {
  constructor(private integration: GoogleDriveIntegration) {}
  definition: ToolDefinition = {
    name: 'drive_get_file',
    description: 'Get metadata or text content of a Google Drive file.',
    parameters: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'The file ID' },
        exportMimeType: { type: 'string', description: 'MIME type to export as (e.g., "text/plain" for Docs). Omit for metadata only.' },
      },
      required: ['fileId'],
    },
    category: 'google_drive',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const fileId = args['fileId'] as string;
    const exportMime = args['exportMimeType'] as string | undefined;

    if (exportMime) {
      const res = await this.integration.request(
        `/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(exportMime)}`,
        { agentId: context.agentId },
      );
      if (!res.ok) {
        const err = await res.json();
        return { success: false, output: JSON.stringify(err) };
      }
      const text = await res.text();
      return { success: true, output: text.slice(0, 50000) }; // cap large docs
    }

    const res = await this.integration.request(
      `/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,modifiedTime,size,webViewLink,description,owners`,
      { agentId: context.agentId },
    );
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: JSON.stringify(data, null, 2) };
  }
}

class DriveListFilesTool implements ITool {
  constructor(private integration: GoogleDriveIntegration) {}
  definition: ToolDefinition = {
    name: 'drive_list_files',
    description: 'List files in a Google Drive folder.',
    parameters: {
      type: 'object',
      properties: {
        folderId: { type: 'string', description: 'Folder ID (default: "root")' },
        maxResults: { type: 'number', description: 'Max files to return (default: 20)' },
      },
    },
    category: 'google_drive',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const folderId = (args['folderId'] as string) ?? 'root';
    const maxResults = (args['maxResults'] as number) ?? 20;
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const res = await this.integration.request(
      `/files?q=${q}&pageSize=${maxResults}&fields=files(id,name,mimeType,modifiedTime,size,webViewLink)&orderBy=modifiedTime desc`,
      { agentId: context.agentId },
    );
    const data = await res.json() as { files: Array<Record<string, unknown>> };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: JSON.stringify(data.files ?? [], null, 2) };
  }
}

class DriveCreateFileTool implements ITool {
  constructor(private integration: GoogleDriveIntegration) {}
  definition: ToolDefinition = {
    name: 'drive_create_file',
    description: 'Create a new file in Google Drive (Google Doc, Sheet, or plain text).',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'File name' },
        content: { type: 'string', description: 'Text content of the file' },
        mimeType: { type: 'string', description: 'MIME type (e.g., "application/vnd.google-apps.document" for Google Doc)' },
        folderId: { type: 'string', description: 'Parent folder ID (optional)' },
      },
      required: ['name', 'content'],
    },
    category: 'google_drive',
    requiresApproval: true,
    approvalReason: 'Creating a file in Google Drive',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const name = args['name'] as string;
    const content = args['content'] as string;
    const mimeType = (args['mimeType'] as string) ?? 'text/plain';
    const folderId = args['folderId'] as string | undefined;

    const metadata: Record<string, unknown> = { name, mimeType };
    if (folderId) metadata['parents'] = [folderId];

    const res = await this.integration.uploadRequest(metadata, content, mimeType, context.agentId);
    const data = await res.json() as { id: string; webViewLink: string };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: `File created: ${data.webViewLink ?? data.id}` };
  }
}
