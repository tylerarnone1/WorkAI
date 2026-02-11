import OpenAI from 'openai';
import { BaseLLMProvider, type ProviderConfig } from './base-provider.js';
import type { LLMRequest, LLMResponse, LLMMessage, ToolCall } from '../types.js';
import { toOpenAITools, fromOpenAIToolCall } from '../tool-schema-mapper.js';
import { ProviderError } from '../../core/errors/index.js';
import { createChildLogger } from '../../core/logger/index.js';

const log = createChildLogger({ module: 'openai-provider' });

export class OpenAIProvider extends BaseLLMProvider {
  readonly providerType = 'openai' as const;
  private client: OpenAI;

  constructor(config: ProviderConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.apiKey,
      ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
    });
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();
    const model = request.model ?? this.config.model;

    try {
      const messages = this.convertMessages(request.messages, request.systemPrompt);
      const tools = request.tools ? toOpenAITools(request.tools) : undefined;
      const maxTokens = request.maxTokens ?? 4096;
      const useMaxCompletionTokens = this.requiresMaxCompletionTokens(model);
      const shouldSendTemperature = this.shouldSendTemperature(
        model,
        request.temperature,
      );

      const params: OpenAI.ChatCompletionCreateParamsNonStreaming & {
        max_completion_tokens?: number;
      } = {
        model,
        messages,
        ...(request.jsonMode && (!tools || tools.length === 0)
          ? { response_format: { type: 'json_object' as const } }
          : {}),
        ...(tools && tools.length > 0 ? { tools } : {}),
        ...(shouldSendTemperature
          ? { temperature: request.temperature }
          : {}),
        ...(request.stopSequences ? { stop: request.stopSequences } : {}),
      };

      if (useMaxCompletionTokens) {
        params.max_completion_tokens = maxTokens;
      } else {
        params.max_tokens = maxTokens;
      }

      if (request.toolChoice && tools && tools.length > 0) {
        if (request.toolChoice === 'auto') {
          params.tool_choice = 'auto';
        } else if (request.toolChoice === 'none') {
          params.tool_choice = 'none';
        } else if (request.toolChoice === 'required') {
          params.tool_choice = 'required';
        } else if (typeof request.toolChoice === 'object') {
          params.tool_choice = {
            type: 'function',
            function: { name: request.toolChoice.name },
          };
        }
      }

      const response = await this.client.chat.completions.create(params);
      const choice = response.choices[0]!;
      const message = choice.message;

      const toolCalls: ToolCall[] = (message.tool_calls ?? []).map(
        fromOpenAIToolCall,
      );

      const finishReason =
        choice.finish_reason === 'tool_calls'
          ? 'tool_use'
          : choice.finish_reason === 'length'
            ? 'length'
            : choice.finish_reason === 'content_filter'
              ? 'content_filter'
              : 'stop';

      return {
        content: message.content ?? '',
        toolCalls,
        finishReason,
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
        model,
        provider: 'openai',
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      log.error({ err, model }, 'OpenAI API call failed');
      throw new ProviderError(
        'openai',
        err instanceof Error ? err.message : 'Unknown error',
      );
    }
  }

  private requiresMaxCompletionTokens(model: string): boolean {
    return /^(gpt-5|o1|o3|o4)/i.test(model);
  }

  private shouldSendTemperature(
    model: string,
    temperature: number | undefined,
  ): boolean {
    if (temperature === undefined) return false;
    if (!/^gpt-5/i.test(model)) return true;
    return temperature === 1;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.config.model,
        input: text,
      });
      return response.data[0]!.embedding;
    } catch (err) {
      log.error({ err }, 'OpenAI embedding generation failed');
      throw new ProviderError(
        'openai',
        err instanceof Error ? err.message : 'Embedding generation failed',
      );
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.config.model,
        input: texts,
      });
      return response.data.map((d) => d.embedding);
    } catch (err) {
      log.error({ err }, 'OpenAI batch embedding generation failed');
      throw new ProviderError(
        'openai',
        err instanceof Error ? err.message : 'Batch embedding generation failed',
      );
    }
  }

  private convertMessages(
    messages: LLMMessage[],
    systemPrompt?: string,
  ): OpenAI.ChatCompletionMessageParam[] {
    const result: OpenAI.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      if (msg.role === 'system') {
        result.push({ role: 'system', content: msg.content });
      } else if (msg.role === 'assistant') {
        const toolCalls = msg.toolCalls?.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        }));
        result.push({
          role: 'assistant',
          content: msg.content || null,
          ...(toolCalls && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        });
      } else if (msg.role === 'tool') {
        result.push({
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.toolCallId!,
        });
      } else {
        result.push({ role: 'user', content: msg.content });
      }
    }

    return result;
  }
}
