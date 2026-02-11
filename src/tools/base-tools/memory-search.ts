import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../types.js';

export class MemorySearchTool implements ITool {
  definition: ToolDefinition = {
    name: 'memory_search',
    description:
      'Search your long-term memory for relevant information. Use this to recall facts, past conversations, and knowledge.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'What to search for in memory',
        },
        includeShared: {
          type: 'boolean',
          description:
            'Include shared memories from other agents (default: true)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 5)',
        },
      },
      required: ['query'],
    },
    category: 'memory',
  };

  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    const query = args['query'] as string;
    const includeShared = (args['includeShared'] as boolean) ?? true;
    const limit = (args['limit'] as number) ?? 5;

    try {
      const results = includeShared
        ? await context.memoryManager.searchAll(query, limit)
        : await context.memoryManager.recall(query, limit);

      if (results.length === 0) {
        return {
          success: true,
          output: 'No relevant memories found.',
        };
      }

      const formatted = results.map((r, i) => ({
        rank: i + 1,
        similarity: Math.round(r.similarity * 100) / 100,
        type: r.entry.memoryType,
        content: r.entry.content,
        source: r.entry.source,
        tags: r.entry.tags,
      }));

      return {
        success: true,
        output: JSON.stringify(formatted, null, 2),
        metadata: { resultCount: results.length },
      };
    } catch (err) {
      return {
        success: false,
        output: `Memory search failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }
}
