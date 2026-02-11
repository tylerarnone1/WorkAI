import type { WebClient } from '@slack/web-api';
import type { SlackMessagePayload } from './types.js';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'slack-sender' });

export class MessageSender {
  constructor(private client: WebClient) {}

  async send(payload: SlackMessagePayload): Promise<string | undefined> {
    try {
      const result = await this.client.chat.postMessage({
        channel: payload.channel,
        text: payload.text,
        thread_ts: payload.threadTs,
        blocks: payload.blocks as never[],
        unfurl_links: payload.unfurlLinks ?? false,
      });
      return result.ts;
    } catch (err) {
      log.error({ err, channel: payload.channel }, 'Failed to send Slack message');
      throw err;
    }
  }

  async reply(
    channel: string,
    threadTs: string,
    text: string,
  ): Promise<string | undefined> {
    return this.send({ channel, text, threadTs });
  }

  async dm(userId: string, text: string): Promise<string | undefined> {
    try {
      const conversation = await this.client.conversations.open({
        users: userId,
      });
      const channelId = conversation.channel?.id;
      if (!channelId) {
        throw new Error('Could not open DM channel');
      }
      return this.send({ channel: channelId, text });
    } catch (err) {
      log.error({ err, userId }, 'Failed to send DM');
      throw err;
    }
  }

  async updateMessage(
    channel: string,
    ts: string,
    text: string,
    blocks?: unknown[],
  ): Promise<void> {
    try {
      await this.client.chat.update({
        channel,
        ts,
        text,
        blocks: blocks as never[],
      });
    } catch (err) {
      log.error({ err, channel, ts }, 'Failed to update message');
      throw err;
    }
  }

  async addReaction(
    channel: string,
    timestamp: string,
    emoji: string,
  ): Promise<void> {
    try {
      await this.client.reactions.add({
        channel,
        timestamp,
        name: emoji,
      });
    } catch (err) {
      log.error({ err, emoji }, 'Failed to add reaction');
    }
  }
}
