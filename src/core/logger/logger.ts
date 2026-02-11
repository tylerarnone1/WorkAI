import pino from 'pino';

let logger: pino.Logger | undefined;

export function initLogger(level: string = 'info'): pino.Logger {
  const prettyDisabled = process.env['PINO_PRETTY_DISABLED'] === 'true';
  logger = pino({
    level,
    transport:
      process.env['NODE_ENV'] !== 'production' && !prettyDisabled
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  });
  return logger;
}

export function getLogger(): pino.Logger {
  if (!logger) {
    logger = initLogger();
  }
  return logger;
}

export function createChildLogger(bindings: Record<string, unknown>): pino.Logger {
  return getLogger().child(bindings);
}
