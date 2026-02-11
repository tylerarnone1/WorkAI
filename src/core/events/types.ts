export interface EventEnvelope<T = unknown> {
  type: string;
  payload: T;
  timestamp: Date;
  source?: string;
}

export type EventHandler<T = unknown> = (event: EventEnvelope<T>) => void | Promise<void>;
