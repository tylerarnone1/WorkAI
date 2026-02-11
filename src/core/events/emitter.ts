import { EventEmitter } from 'node:events';
import { getLogger } from '../logger/index.js';
import type { EventEnvelope, EventHandler } from './types.js';

export class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  emit<T>(type: string, payload: T, source?: string): void {
    const envelope: EventEnvelope<T> = {
      type,
      payload,
      timestamp: new Date(),
      source,
    };
    this.emitter.emit(type, envelope);
  }

  on<T>(type: string, handler: EventHandler<T>): void {
    this.emitter.on(type, (envelope: EventEnvelope<T>) => {
      Promise.resolve(handler(envelope)).catch((err) => {
        getLogger().error({ err, eventType: type }, 'Event handler error');
      });
    });
  }

  once<T>(type: string, handler: EventHandler<T>): void {
    this.emitter.once(type, (envelope: EventEnvelope<T>) => {
      Promise.resolve(handler(envelope)).catch((err) => {
        getLogger().error({ err, eventType: type }, 'Event handler error');
      });
    });
  }

  off(type: string, handler: EventHandler): void {
    this.emitter.off(type, handler as (...args: unknown[]) => void);
  }

  removeAllListeners(type?: string): void {
    this.emitter.removeAllListeners(type);
  }
}
