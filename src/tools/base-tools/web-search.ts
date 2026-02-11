import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../types.js';

export class WebSearchTool implements ITool {
  definition: ToolDefinition = {
    name: 'web_search',
    description:
      'Search the web for current information. Returns relevant search results with titles, URLs, and snippets.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5)',
        },
      },
      required: ['query'],
    },
    category: 'web',
    timeout: 15000,
  };

  async execute(
    args: Record<string, unknown>,
    _context: ToolExecutionContext,
  ): Promise<ToolResult> {
    const query = args['query'] as string;
    // Placeholder — employee projects wire in their preferred search API
    // (e.g., SerpAPI, Tavily, Brave Search, Google Custom Search)
    return {
      success: false,
      output: `Web search not configured. Override this tool with your preferred search API. Query was: "${query}"`,
      metadata: { query },
    };
  }
}
