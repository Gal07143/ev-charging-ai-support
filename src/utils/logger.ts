import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
  base: {
    env: process.env.NODE_ENV || 'development',
  },
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

// Helper to create child logger with request ID
export function createRequestLogger(requestId: string, metadata: Record<string, any> = {}) {
  return logger.child({ requestId, ...metadata });
}

// Generate unique request ID
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
