import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../types.js';
import type { MemoryType } from '../../memory/types.js';

export class MemoryStoreTool implements ITool {
  definition: ToolDefinition = {
    name: 'memory_store',
    description:
      'Store important information in long-term memory for future recall. Use this to remember facts, decisions, and key learnings.',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The information to remember',
        },
        memoryType: {
          type: 'string',
          description: 'Type of memory',
          enum: ['fact', 'episode', 'procedure', 'semantic'],
        },
        importance: {
          type: 'number',
          description: 'How important this is (0.0-1.0, default: 0.5)',
        },
        tags: {
          type: 'array',
          description: 'Tags to categorize this memory',
          items: { type: 'string' },
        },
        shared: {
          type: 'boolean',
          description:
            'Store as shared memory accessible to all agents (default: false)',
        },
      },
      required: ['content', 'memoryType'],
    },
    category: 'memory',
  };

  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    const content = args['content'] as string;
    const memoryType = args['memoryType'] as MemoryType;
    const importance = (args['importance'] as number) ?? 0.5;
    const tags = (args['tags'] as string[]) ?? [];
    const shared = (args['shared'] as boolean) ?? false;

    try {
      const storeOpts = {
        memoryType,
        importance,
        tags,
        source: `agent:${context.agentName}`,
      };

      const id = shared
        ? await context.memoryManager.storeShared(content, storeOpts)
        : await context.memoryManager.store(content, storeOpts);

      return {
        success: true,
        output: `Memory stored successfully (id: ${id}, type: ${memoryType}, shared: ${shared})`,
        metadata: { memoryId: id },
      };
    } catch (err) {
      return {
        success: false,
        output: `Failed to store memory: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }
}
