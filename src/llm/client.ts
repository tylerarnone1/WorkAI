import type { ILLMProvider, LLMProviderType, LLMRequest, LLMResponse } from './types.js';
import { createProvider } from './provider-registry.js';
import type { ProviderConfig } from './providers/base-provider.js';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'llm-client' });

export class LLMClient {
  private provider: ILLMProvider;

  constructor(providerType: LLMProviderType, config: ProviderConfig) {
    this.provider = createProvider(providerType, config);
    log.info(
      { provider: providerType, model: config.model },
      'LLM client initialized',
    );
  }

  get providerType(): LLMProviderType {
    return this.provider.providerType;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.provider.complete(request);
    log.debug(
      {
        provider: this.provider.providerType,
        model: response.model,
        latencyMs: response.latencyMs,
        tokens: response.usage.totalTokens,
        toolCalls: response.toolCalls.length,
      },
      'LLM call completed',
    );
    return response;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return this.provider.generateEmbedding(text);
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return this.provider.generateEmbeddings(texts);
  }
}
