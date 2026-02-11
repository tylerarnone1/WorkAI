import type { PrismaClient } from '@prisma/client';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { IntegrationRegistry } from './registry.js';
import type { WebhookPayload } from './types.js';
import { EventBus } from '../core/events/index.js';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'webhook-handler' });

export class WebhookHandler {
  constructor(
    private prisma: PrismaClient,
    private integrationRegistry: IntegrationRegistry,
    private eventBus: EventBus,
  ) {}

  /** HTTP handler for /webhooks/:provider */
  async handle(
    req: IncomingMessage,
    res: ServerResponse,
    provider: string,
    body: string,
  ): Promise<void> {
    const integration = this.integrationRegistry.get(provider);
    if (!integration) {
      res.writeHead(404);
      res.end(`Unknown integration: ${provider}`);
      return;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400);
      res.end('Invalid JSON');
      return;
    }

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        headers[key] = value;
      }
    }

    const eventType = this.extractEventType(provider, headers, payload);

    // Persist the webhook event
    const event = await this.prisma.webhookEvent.create({
      data: {
        provider,
        eventType,
        payload: payload as object,
        headers: headers as object,
        status: 'pending',
      },
    });

    log.info(
      { provider, eventType, eventId: event.id },
      'Webhook event received',
    );

    // Respond immediately
    res.writeHead(200);
    res.end('ok');

    // Process async
    const webhookPayload: WebhookPayload = {
      provider,
      eventType,
      payload,
      headers,
    };

    try {
      if (integration.handleWebhook) {
        await integration.handleWebhook(webhookPayload);
      }

      this.eventBus.emit(`webhook:${provider}`, webhookPayload);
      this.eventBus.emit(`webhook:${provider}:${eventType}`, webhookPayload);

      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: 'processed', processedAt: new Date() },
      });
    } catch (err) {
      log.error({ err, provider, eventType }, 'Webhook processing failed');
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
        },
      });
    }
  }

  private extractEventType(
    provider: string,
    headers: Record<string, string>,
    payload: Record<string, unknown>,
  ): string {
    // Provider-specific event type extraction
    switch (provider) {
      case 'github':
        return headers['x-github-event'] ?? 'unknown';
      case 'clickup':
        return (payload['event'] as string) ?? 'unknown';
      case 'jira':
        return (payload['webhookEvent'] as string) ?? 'unknown';
      case 'hubspot':
        return Array.isArray(payload)
          ? ((payload as Record<string, unknown>[])[0]?.['subscriptionType'] as string) ?? 'unknown'
          : 'unknown';
      case 'figma':
        return (payload['event_type'] as string) ?? 'unknown';
      default:
        return (payload['event'] as string) ?? (payload['type'] as string) ?? 'unknown';
    }
  }
}
