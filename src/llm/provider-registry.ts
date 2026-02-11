import type { ILLMProvider, LLMProviderType } from './types.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { OpenAIProvider } from './providers/openai.js';
import type { ProviderConfig } from './providers/base-provider.js';
import { ValidationError } from '../core/errors/index.js';

type ProviderFactory = (config: ProviderConfig) => ILLMProvider;

const builtInProviders: Record<string, ProviderFactory> = {
  anthropic: (config) => new AnthropicProvider(config),
  openai: (config) => new OpenAIProvider(config),
};

const customProviders = new Map<string, ProviderFactory>();

export function registerProvider(
  name: string,
  factory: ProviderFactory,
): void {
  customProviders.set(name, factory);
}

export function createProvider(
  type: LLMProviderType,
  config: ProviderConfig,
): ILLMProvider {
  const factory = customProviders.get(type) ?? builtInProviders[type];
  if (!factory) {
    throw new ValidationError(`Unknown LLM provider: ${type}`);
  }
  return factory(config);
}

export function getAvailableProviders(): string[] {
  return [
    ...Object.keys(builtInProviders),
    ...Array.from(customProviders.keys()),
  ];
}
