import type { ILLMProvider, LLMProviderType, LLMRequest, LLMResponse } from '../types.js';

export interface ProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export abstract class BaseLLMProvider implements ILLMProvider {
  abstract readonly providerType: LLMProviderType;

  constructor(protected config: ProviderConfig) {}

  abstract complete(request: LLMRequest): Promise<LLMResponse>;
  abstract generateEmbedding(text: string): Promise<number[]>;
  abstract generateEmbeddings(texts: string[]): Promise<number[][]>;
}
