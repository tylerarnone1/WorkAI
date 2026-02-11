import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../types.js';

export class HttpRequestTool implements ITool {
  definition: ToolDefinition = {
    name: 'http_request',
    description:
      'Make an HTTP request to a URL. Supports GET, POST, PUT, DELETE methods.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to request',
        },
        method: {
          type: 'string',
          description: 'HTTP method',
          enum: ['GET', 'POST', 'PUT', 'DELETE'],
        },
        headers: {
          type: 'object',
          description: 'Request headers as key-value pairs',
        },
        body: {
          type: 'string',
          description: 'Request body (for POST/PUT)',
        },
      },
      required: ['url'],
    },
    category: 'web',
    timeout: 30000,
  };

  async execute(
    args: Record<string, unknown>,
    _context: ToolExecutionContext,
  ): Promise<ToolResult> {
    const url = args['url'] as string;
    const method = (args['method'] as string) ?? 'GET';
    const headers = (args['headers'] as Record<string, string>) ?? {};
    const body = args['body'] as string | undefined;

    try {
      const response = await fetch(url, {
        method,
        headers,
        ...(body ? { body } : {}),
      });

      const text = await response.text();
      const truncated =
        text.length > 10000 ? text.slice(0, 10000) + '\n...[truncated]' : text;

      return {
        success: response.ok,
        output: JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          body: truncated,
        }),
        metadata: { status: response.status, url },
      };
    } catch (err) {
      return {
        success: false,
        output: `HTTP request failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }
}
