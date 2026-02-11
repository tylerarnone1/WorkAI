import type { PrismaClient } from '@prisma/client';
import type { OAuthTokens, CredentialType } from './types.js';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'credential-store' });

export class CredentialStore {
  constructor(private prisma: PrismaClient) {}

  async storeOAuth(
    provider: string,
    tokens: OAuthTokens,
    agentId?: string,
  ): Promise<void> {
    await this.prisma.integrationCredential.upsert({
      where: {
        agentId_provider: {
          agentId: agentId ?? '',
          provider,
        },
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        credentialType: 'oauth2',
      },
      create: {
        agentId: agentId || null,
        provider,
        credentialType: 'oauth2',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
      },
    });
    log.debug({ provider, agentId }, 'OAuth credentials stored');
  }

  async storeApiKey(
    provider: string,
    apiKey: string,
    agentId?: string,
  ): Promise<void> {
    await this.prisma.integrationCredential.upsert({
      where: {
        agentId_provider: {
          agentId: agentId ?? '',
          provider,
        },
      },
      update: {
        apiKey,
        credentialType: 'api_key',
      },
      create: {
        agentId: agentId || null,
        provider,
        credentialType: 'api_key',
        apiKey,
      },
    });
    log.debug({ provider, agentId }, 'API key stored');
  }

  async getCredential(
    provider: string,
    agentId?: string,
  ): Promise<{
    type: CredentialType;
    accessToken?: string;
    refreshToken?: string;
    apiKey?: string;
    expiresAt?: Date;
    scopes: string[];
    metadata?: Record<string, unknown>;
  } | null> {
    // Try agent-specific first, then fall back to global
    const cred = await this.prisma.integrationCredential.findFirst({
      where: {
        provider,
        OR: [
          { agentId: agentId ?? '' },
          { agentId: null },
        ],
      },
      orderBy: { agentId: 'desc' }, // Agent-specific first
    });

    if (!cred) return null;

    return {
      type: cred.credentialType as CredentialType,
      accessToken: cred.accessToken ?? undefined,
      refreshToken: cred.refreshToken ?? undefined,
      apiKey: cred.apiKey ?? undefined,
      expiresAt: cred.expiresAt ?? undefined,
      scopes: cred.scopes,
      metadata: (cred.metadata as Record<string, unknown>) ?? undefined,
    };
  }

  async getAccessToken(
    provider: string,
    agentId?: string,
  ): Promise<string | null> {
    const cred = await this.getCredential(provider, agentId);
    if (!cred) return null;
    return cred.accessToken ?? cred.apiKey ?? null;
  }

  async isTokenExpired(
    provider: string,
    agentId?: string,
  ): Promise<boolean> {
    const cred = await this.getCredential(provider, agentId);
    if (!cred || !cred.expiresAt) return false;
    return cred.expiresAt <= new Date();
  }

  async deleteCredential(
    provider: string,
    agentId?: string,
  ): Promise<void> {
    await this.prisma.integrationCredential.deleteMany({
      where: {
        provider,
        agentId: agentId ?? null,
      },
    });
    log.debug({ provider, agentId }, 'Credentials deleted');
  }
}
