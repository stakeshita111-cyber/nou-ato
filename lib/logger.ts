export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private sanitizeValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    if (seen.has(value)) {
      return '[Circular]';
    }

    if (depth > 4) {
      return Array.isArray(value) ? '[Array]' : '[Object]';
    }

    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item, depth + 1, seen));
    }

    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'authorization',
      'apikey',
      'api_key',
      'gemini_key',
      'private_key',
      'service_role',
    ];

    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
        sanitized[k] = '********';
      } else {
        sanitized[k] = this.sanitizeValue(v, depth + 1, seen);
      }
    }
    return sanitized;
  }

  private sanitizeData(data?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!data) return undefined;
    return this.sanitizeValue(data, 0) as Record<string, unknown>;
  }

  private log(
    level: LogLevel,
    message: string,
    context?: string,
    data?: Record<string, unknown>,
    err?: unknown
  ) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context ? { context } : {}),
      ...(data ? { data: this.sanitizeData(data) } : {}),
    };

    if (err instanceof Error) {
      entry.error = {
        name: err.name,
        message: err.message,
        stack: err.stack,
      };
    } else if (err) {
      entry.error = {
        name: 'UnknownError',
        message: String(err),
      };
    }

    const jsonString = JSON.stringify(entry);

    switch (level) {
      case 'error':
        console.error(jsonString);
        break;
      case 'warn':
        console.warn(jsonString);
        break;
      case 'debug':
        if (process.env.NODE_ENV !== 'production') {
          console.debug(jsonString);
        }
        break;
      case 'info':
      default:
        console.info(jsonString);
        break;
    }

    return entry;
  }

  debug(message: string, context?: string, data?: Record<string, unknown>) {
    return this.log('debug', message, context, data);
  }

  info(message: string, context?: string, data?: Record<string, unknown>) {
    return this.log('info', message, context, data);
  }

  warn(message: string, context?: string, data?: Record<string, unknown>, err?: unknown) {
    return this.log('warn', message, context, data, err);
  }

  error(message: string, context?: string, data?: Record<string, unknown>, err?: unknown) {
    return this.log('error', message, context, data, err);
  }
}

export const logger = new Logger();
