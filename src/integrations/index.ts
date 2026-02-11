// Base
export { BaseIntegration } from './base-integration.js';
export { CredentialStore } from './credential-store.js';
export { IntegrationRegistry } from './registry.js';
export { WebhookHandler } from './webhook-handler.js';

// Types
export type {
  IIntegration,
  IntegrationProvider,
  IntegrationConfig,
  CredentialType,
  OAuthTokens,
  WebhookPayload,
} from './types.js';

// Providers
export {
  GitHubIntegration,
  GoogleCalendarIntegration,
  GoogleDriveIntegration,
  GmailIntegration,
  ClickUpIntegration,
  FigmaIntegration,
  JiraIntegration,
  HubSpotIntegration,
  ArgoCDIntegration,
} from './providers/index.js';
