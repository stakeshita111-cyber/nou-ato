export type LogLevel = "debug" | "info" | "warn" | "error";

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
  private sanitizeData(data?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!data) return undefined;
    const sanitized = { ...data };
    const sensitiveKeys = ["password", "token", "secret", "authorization", "apikey", "gemini_key", "key"];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        sanitized[key] = "********";
      }
    }
    return sanitized;
  }

  private log(level: LogLevel, message: string, context?: string, data?: Record<string, unknown>, err?: unknown) {
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
        name: "UnknownError",
        message: String(err),
      };
    }

    const jsonString = JSON.stringify(entry);

    switch (level) {
      case "error":
        console.error(jsonString);
        break;
      case "warn":
        console.warn(jsonString);
        break;
      case "debug":
        if (process.env.NODE_ENV !== "production") {
          console.debug(jsonString);
        }
        break;
      case "info":
      default:
        console.info(jsonString);
        break;
    }

    return entry;
  }

  debug(message: string, context?: string, data?: Record<string, unknown>) {
    return this.log("debug", message, context, data);
  }

  info(message: string, context?: string, data?: Record<string, unknown>) {
    return this.log("info", message, context, data);
  }

  warn(message: string, context?: string, data?: Record<string, unknown>, err?: unknown) {
    return this.log("warn", message, context, data, err);
  }

  error(message: string, context?: string, data?: Record<string, unknown>, err?: unknown) {
    return this.log("error", message, context, data, err);
  }
}

export const logger = new Logger();
