import type { ITool } from './types.js';
import type { UnifiedToolDefinition } from '../llm/types.js';
import { ValidationError } from '../core/errors/index.js';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'tool-registry' });

export class ToolRegistry {
  private tools = new Map<string, ITool>();

  register(tool: ITool): void {
    if (this.tools.has(tool.definition.name)) {
      throw new ValidationError(
        `Tool already registered: ${tool.definition.name}`,
      );
    }
    this.tools.set(tool.definition.name, tool);
    log.debug({ tool: tool.definition.name }, 'Tool registered');
  }

  registerMany(tools: ITool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  getAll(): ITool[] {
    return Array.from(this.tools.values());
  }

  getByCategory(category: string): ITool[] {
    return this.getAll().filter((t) => t.definition.category === category);
  }

  getForAgent(toolNames: string[]): ITool[] {
    return toolNames
      .map((name) => this.tools.get(name))
      .filter((t): t is ITool => t !== undefined);
  }

  toUnifiedDefinitions(toolNames: string[]): UnifiedToolDefinition[] {
    return this.getForAgent(toolNames).map((tool) => ({
      name: tool.definition.name,
      description: tool.definition.description,
      parameters: tool.definition.parameters,
    }));
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  get size(): number {
    return this.tools.size;
  }
}
