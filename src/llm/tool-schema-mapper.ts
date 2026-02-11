import type { UnifiedToolDefinition, ToolCall } from './types.js';

// Anthropic format
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// OpenAI format
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface OpenAIToolCallObject {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export function toAnthropicTools(
  tools: UnifiedToolDefinition[],
): AnthropicTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: 'object' as const,
      properties: tool.parameters.properties,
      required: tool.parameters.required,
    },
  }));
}

export function toOpenAITools(tools: UnifiedToolDefinition[]): OpenAITool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object' as const,
        properties: tool.parameters.properties,
        required: tool.parameters.required,
      },
    },
  }));
}

export function fromAnthropicToolUse(block: AnthropicToolUseBlock): ToolCall {
  return {
    id: block.id,
    name: block.name,
    arguments: block.input,
  };
}

export function fromOpenAIToolCall(call: OpenAIToolCallObject): ToolCall {
  return {
    id: call.id,
    name: call.function.name,
    arguments: JSON.parse(call.function.arguments),
  };
}
