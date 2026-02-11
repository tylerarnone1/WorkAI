import Anthropic from '@anthropic-ai/sdk';
import { BaseLLMProvider, type ProviderConfig } from './base-provider.js';
import type { LLMRequest, LLMResponse, LLMMessage, ToolCall } from '../types.js';
import {
  toAnthropicTools,
  fromAnthropicToolUse,
  type AnthropicToolUseBlock,
} from '../tool-schema-mapper.js';
import { ProviderError } from '../../core/errors/index.js';
import { createChildLogger } from '../../core/logger/index.js';

const log = createChildLogger({ module: 'anthropic-provider' });

export class AnthropicProvider extends BaseLLMProvider {
  readonly providerType = 'anthropic' as const;
  private client: Anthropic;

  constructor(config: ProviderConfig) {
    super(config);
    this.client = new Anthropic({
      apiKey: config.apiKey,
      ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
    });
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();
    const model = request.model ?? this.config.model;

    try {
      const messages = this.convertMessages(request.messages);
      const tools = request.tools ? toAnthropicTools(request.tools) : undefined;

      const params: Anthropic.MessageCreateParams = {
        model,
        max_tokens: request.maxTokens ?? 4096,
        messages,
        ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
        ...(tools && tools.length > 0 ? { tools } : {}),
        ...(request.temperature !== undefined
          ? { temperature: request.temperature }
          : {}),
        ...(request.stopSequences
          ? { stop_sequences: request.stopSequences }
          : {}),
      };

      if (request.toolChoice && tools && tools.length > 0) {
        if (request.toolChoice === 'auto') {
          params.tool_choice = { type: 'auto' };
        } else if (request.toolChoice === 'none') {
          // Anthropic doesn't have a direct 'none' — omit tools
          delete params.tools;
        } else if (request.toolChoice === 'required') {
          params.tool_choice = { type: 'any' };
        } else if (typeof request.toolChoice === 'object') {
          params.tool_choice = {
            type: 'tool',
            name: request.toolChoice.name,
          };
        }
      }

      const response = await this.client.messages.create(params);

      // Extract text content and tool calls
      let content = '';
      const toolCalls: ToolCall[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          content += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push(
            fromAnthropicToolUse(block as unknown as AnthropicToolUseBlock),
          );
        }
      }

      const finishReason =
        response.stop_reason === 'tool_use'
          ? 'tool_use'
          : response.stop_reason === 'max_tokens'
            ? 'length'
            : 'stop';

      return {
        content,
        toolCalls,
        finishReason,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens:
            response.usage.input_tokens + response.usage.output_tokens,
        },
        model,
        provider: 'anthropic',
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      log.error({ err, model }, 'Anthropic API call failed');
      throw new ProviderError(
        'anthropic',
        err instanceof Error ? err.message : 'Unknown error',
      );
    }
  }

  async generateEmbedding(_text: string): Promise<number[]> {
    // Anthropic doesn't have a native embedding API yet.
    // This should be handled by the embedding service using OpenAI.
    throw new ProviderError(
      'anthropic',
      'Anthropic does not support embeddings. Use OpenAI embedding provider instead.',
    );
  }

  async generateEmbeddings(_texts: string[]): Promise<number[][]> {
    throw new ProviderError(
      'anthropic',
      'Anthropic does not support embeddings. Use OpenAI embedding provider instead.',
    );
  }

  private convertMessages(
    messages: LLMMessage[],
  ): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        // System messages are handled via the 'system' param, skip here
        continue;
      }

      if (msg.role === 'assistant') {
        const content: Anthropic.ContentBlockParam[] = [];
        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
        }
        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            content.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            });
          }
        }
        result.push({ role: 'assistant', content });
      } else if (msg.role === 'tool') {
        result.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.toolCallId!,
              content: msg.content,
            },
          ],
        });
      } else {
        // user
        result.push({ role: 'user', content: msg.content });
      }
    }

    return result;
  }
}
