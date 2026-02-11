import { CredentialsMethod, OpenFgaClient } from '@openfga/sdk';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'openfga-authorizer' });

export interface OpenFgaCheckInput {
  agentId: string;
  agentName: string;
  toolName: string;
  args: Record<string, unknown>;
  capabilities: string[];
}

export interface OpenFgaDecision {
  allowed: boolean;
  reason?: string;
}

interface RelationTarget {
  relation: string;
  object: string;
}

export class OpenFgaAuthorizer {
  private client?: OpenFgaClient;
  private initAttempted = false;
  private readonly enabled =
    (process.env['AUTHZ_ENGINE'] ?? 'local').toLowerCase() === 'openfga';
  private readonly failOpen =
    (process.env['OPENFGA_FAIL_OPEN'] ?? 'false').toLowerCase() === 'true';
  private readonly defaultRelation =
    process.env['OPENFGA_DEFAULT_RELATION'] ?? 'can_execute';
  private readonly apiUrl = process.env['OPENFGA_API_URL'];
  private readonly storeId = process.env['OPENFGA_STORE_ID'];
  private readonly modelId = process.env['OPENFGA_MODEL_ID'];
  private readonly apiToken = process.env['OPENFGA_API_TOKEN'];

  isEnabled(): boolean {
    return this.enabled;
  }

  async check(input: OpenFgaCheckInput): Promise<OpenFgaDecision> {
    if (!this.enabled) {
      return { allowed: true };
    }

    const client = this.getClient();
    if (!client) {
      const message =
        'OpenFGA authz is enabled but OPENFGA_API_URL or OPENFGA_STORE_ID is missing.';
      if (this.failOpen) {
        log.warn({ agentId: input.agentId, tool: input.toolName }, message);
        return { allowed: true };
      }
      return { allowed: false, reason: message };
    }

    const target = this.resolveTarget(input.toolName, input.args);
    const user = `agent:${this.normalizeObjectPart(input.agentId)}`;

    try {
      const result = await client.check({
        user,
        relation: target.relation,
        object: target.object,
        context: {
          toolName: input.toolName,
          capabilities: input.capabilities,
          agentName: input.agentName,
        },
      });

      if (result.allowed) {
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: `OpenFGA denied ${user} -> ${target.relation} on ${target.object}`,
      };
    } catch (err) {
      const message = `OpenFGA check error: ${err instanceof Error ? err.message : 'Unknown error'}`;
      if (this.failOpen) {
        log.warn({ err, tool: input.toolName, user, target }, message);
        return { allowed: true };
      }
      return { allowed: false, reason: message };
    }
  }

  private getClient(): OpenFgaClient | undefined {
    if (this.client || this.initAttempted) {
      return this.client;
    }

    this.initAttempted = true;

    if (!this.apiUrl || !this.storeId) {
      return undefined;
    }

    try {
      const credentials = this.apiToken
        ? {
            method: CredentialsMethod.ApiToken as CredentialsMethod.ApiToken,
            config: { token: this.apiToken },
          }
        : undefined;

      this.client = new OpenFgaClient({
        apiUrl: this.apiUrl,
        storeId: this.storeId,
        authorizationModelId: this.modelId,
        credentials,
      });
      return this.client;
    } catch (err) {
      log.error({ err }, 'Failed to initialize OpenFGA client');
      this.client = undefined;
      return undefined;
    }
  }

  private resolveTarget(
    toolName: string,
    args: Record<string, unknown>,
  ): RelationTarget {
    if (toolName === 'delegate_task') {
      const targetAgent = this.readString(args['targetAgent']);
      if (targetAgent) {
        return {
          relation: 'can_delegate',
          object: `agent:${this.normalizeObjectPart(targetAgent)}`,
        };
      }
    }

    if (toolName === 'agent_message') {
      const targetAgent = this.readString(args['toAgent']);
      if (targetAgent) {
        return {
          relation: 'can_message',
          object: `agent:${this.normalizeObjectPart(targetAgent)}`,
        };
      }
    }

    if (toolName === 'ask_colleague') {
      const colleague = this.readString(args['colleague']);
      if (colleague) {
        return {
          relation: 'can_message',
          object: `agent:${this.normalizeObjectPart(colleague)}`,
        };
      }
    }

    if (toolName === 'memory_store' && args['shared'] === true) {
      return {
        relation: 'can_write',
        object: 'memory:shared',
      };
    }

    const provider = this.extractIntegrationProvider(toolName);
    if (provider) {
      const isWrite =
        /(create|update|delete|send|sync|rollback|transition|comment)/.test(
          toolName,
        );
      return {
        relation: isWrite ? 'can_write' : 'can_read',
        object: `integration:${provider}`,
      };
    }

    return {
      relation: this.defaultRelation,
      object: `tool:${this.normalizeObjectPart(toolName)}`,
    };
  }

  private extractIntegrationProvider(toolName: string): string | undefined {
    const match = toolName.match(
      /^(github|jira|clickup|gmail|hubspot|argocd|drive|calendar|figma)_/,
    );
    return match?.[1];
  }

  private normalizeObjectPart(input: string): string {
    return input.toLowerCase().replace(/[^a-z0-9:_-]/g, '_');
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : undefined;
  }
}

export function getOpenFgaAuthorizer(): OpenFgaAuthorizer {
  return new OpenFgaAuthorizer();
}
