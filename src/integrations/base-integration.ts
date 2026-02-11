import type {
  IIntegration,
  IntegrationProvider,
  CredentialType,
  WebhookPayload,
  OAuthTokens,
} from './types.js';
import type { CredentialStore } from './credential-store.js';
import type { ITool } from '../tools/types.js';
import { createChildLogger } from '../core/logger/index.js';

export abstract class BaseIntegration implements IIntegration {
  abstract readonly provider: IntegrationProvider;
  abstract readonly credentialType: CredentialType;

  protected log = createChildLogger({ module: `integration:${this.constructor.name}` });

  constructor(protected credentialStore: CredentialStore) {}

  abstract getTools(): ITool[];

  async handleWebhook?(_event: WebhookPayload): Promise<void>;
  async validateCredentials?(_accessToken: string): Promise<boolean>;
  async refreshToken?(_refreshToken: string): Promise<OAuthTokens>;

  protected async getToken(agentId?: string): Promise<string | null> {
    return this.credentialStore.getAccessToken(this.provider, agentId);
  }

  protected async ensureToken(agentId?: string): Promise<string> {
    // Check if token is expired and refresh if needed
    const expired = await this.credentialStore.isTokenExpired(
      this.provider,
      agentId,
    );

    if (expired && this.refreshToken) {
      const cred = await this.credentialStore.getCredential(
        this.provider,
        agentId,
      );
      if (cred?.refreshToken) {
        const newTokens = await this.refreshToken(cred.refreshToken);
        await this.credentialStore.storeOAuth(
          this.provider,
          newTokens,
          agentId,
        );
        return newTokens.accessToken;
      }
    }

    const token = await this.getToken(agentId);
    if (!token) {
      throw new Error(
        `No credentials found for ${this.provider}. Configure via credential store.`,
      );
    }
    return token;
  }

  /** Helper for making authenticated API requests */
  protected async apiRequest(
    url: string,
    options: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
      agentId?: string;
    } = {},
  ): Promise<Response> {
    const token = await this.ensureToken(options.agentId);
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    return fetch(url, {
      method: options.method ?? 'GET',
      headers,
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
  }
}
