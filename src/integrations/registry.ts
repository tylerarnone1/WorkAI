import type { IIntegration, IntegrationProvider } from './types.js';
import type { ITool } from '../tools/types.js';
import { ValidationError } from '../core/errors/index.js';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'integration-registry' });

export class IntegrationRegistry {
  private integrations = new Map<string, IIntegration>();

  register(integration: IIntegration): void {
    if (this.integrations.has(integration.provider)) {
      throw new ValidationError(
        `Integration already registered: ${integration.provider}`,
      );
    }
    this.integrations.set(integration.provider, integration);
    log.info({ provider: integration.provider }, 'Integration registered');
  }

  registerMany(integrations: IIntegration[]): void {
    for (const integration of integrations) {
      this.register(integration);
    }
  }

  get(provider: IntegrationProvider): IIntegration | undefined {
    return this.integrations.get(provider);
  }

  getAll(): IIntegration[] {
    return Array.from(this.integrations.values());
  }

  getAllTools(): ITool[] {
    const tools: ITool[] = [];
    for (const integration of this.integrations.values()) {
      tools.push(...integration.getTools());
    }
    return tools;
  }

  has(provider: IntegrationProvider): boolean {
    return this.integrations.has(provider);
  }

  get size(): number {
    return this.integrations.size;
  }
}
