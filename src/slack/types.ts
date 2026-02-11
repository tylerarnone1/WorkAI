export interface SlackMessageEvent {
  type: string;
  channel: string;
  user: string;
  text: string;
  ts: string;
  threadTs?: string;
  botId?: string;
}

export interface SlackCommand {
  command: string;
  text: string;
  userId: string;
  channelId: string;
  triggerId: string;
  responseUrl: string;
}

export interface SlackMessagePayload {
  channel: string;
  text: string;
  threadTs?: string;
  blocks?: unknown[];
  unfurlLinks?: boolean;
}
