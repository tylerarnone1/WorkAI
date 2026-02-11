import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'shutdown' });

type ShutdownHandler = () => Promise<void> | void;

const handlers: ShutdownHandler[] = [];
let isShuttingDown = false;

export function onShutdown(handler: ShutdownHandler): void {
  handlers.push(handler);
}

export function registerShutdownHandlers(): void {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    log.info({ signal }, 'Shutdown signal received');

    for (const handler of handlers.reverse()) {
      try {
        await handler();
      } catch (err) {
        log.error({ err }, 'Shutdown handler error');
      }
    }

    log.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    log.fatal({ err }, 'Uncaught exception');
    shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    log.fatal({ reason }, 'Unhandled rejection');
    shutdown('unhandledRejection');
  });
}
