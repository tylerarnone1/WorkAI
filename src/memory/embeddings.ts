import type { ILLMProvider } from '../llm/types.js';
import { createProvider } from '../llm/provider-registry.js';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'embeddings' });

let embeddingProvider: ILLMProvider | undefined;

export function initEmbeddingProvider(
  provider: 'openai' | 'anthropic',
  apiKey: string,
  model: string,
): void {
  embeddingProvider = createProvider(provider, { apiKey, model });
  log.info({ provider, model }, 'Embedding provider initialized');
}

export function getEmbeddingProvider(): ILLMProvider {
  if (!embeddingProvider) {
    throw new Error(
      'Embedding provider not initialized. Call initEmbeddingProvider() first.',
    );
  }
  return embeddingProvider;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const provider = getEmbeddingProvider();
  return provider.generateEmbedding(text);
}

export async function generateEmbeddings(
  texts: string[],
): Promise<number[][]> {
  const provider = getEmbeddingProvider();
  return provider.generateEmbeddings(texts);
}
