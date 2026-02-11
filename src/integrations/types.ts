export type IntegrationProvider =
  | 'github'
  | 'google_calendar'
  | 'google_drive'
  | 'gmail'
  | 'clickup'
  | 'figma'
  | 'jira'
  | 'hubspot'
  | 'argocd'
  | string; // extensible for custom integrations

export type CredentialType = 'oauth2' | 'api_key' | 'pat' | 'service_account';

export interface IntegrationConfig {
  provider: IntegrationProvider;
  enabled: boolean;
  credentialType: CredentialType;
  scopes?: string[];
  baseUrl?: string;
  webhookSecret?: string;
  metadata?: Record<string, unknown>;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
}

export interface WebhookPayload {
  provider: IntegrationProvider;
  eventType: string;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
}

export interface IIntegration {
  readonly provider: IntegrationProvider;
  readonly credentialType: CredentialType;

  /** Return the tools this integration provides to agents */
  getTools(): import('../tools/types.js').ITool[];

  /** Handle an incoming webhook event */
  handleWebhook?(event: WebhookPayload): Promise<void>;

  /** Validate that credentials are still working */
  validateCredentials?(accessToken: string): Promise<boolean>;

  /** Refresh an expired OAuth token */
  refreshToken?(refreshToken: string): Promise<OAuthTokens>;
}
