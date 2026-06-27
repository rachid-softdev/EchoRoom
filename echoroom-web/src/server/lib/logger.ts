import { getRequestId } from "./requestContext";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  meta?: Record<string, unknown>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getEffectiveLevel(): LogLevel {
  if (typeof process === "undefined") return "info";
  return process.env?.NODE_ENV === "development" ? "debug" : "info";
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getEffectiveLevel()];
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Error) {
    const serialized: Record<string, unknown> = {
      name: value.name,
      message: value.message,
    };
    if (process.env["NODE_ENV"] === "development") {
      serialized["stack"] = value.stack;
    }
    // Capture custom properties (e.g., AppError.code)
    for (const key of Object.keys(value as unknown as Record<string, unknown>)) {
      if (key !== "name" && key !== "message" && key !== "stack") {
        serialized[key] = (value as unknown as Record<string, unknown>)[key];
      }
    }
    return serialized;
  }
  if (value instanceof Request || value instanceof Response) {
    return `[${value.constructor.name}]`;
  }
  return value;
}

function serializeMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    result[key] = serializeValue(value);
  }
  return result;
}

function writeEntry(
  level: LogLevel,
  module: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  if (!shouldLog(level)) return;

  const serializedMeta = serializeMeta(meta);
  const requestId = getRequestId();
  const enhancedMeta =
    requestId !== "no-request-id" ? { ...serializedMeta, requestId } : serializedMeta;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    ...(enhancedMeta ? { meta: enhancedMeta } : {}),
  };

  const line = JSON.stringify(entry);

  try {
    if (level === "error") {
      if (typeof process?.stderr?.write === "function") {
        process.stderr.write(`${line}\n`);
      }
    } else {
      if (typeof process?.stdout?.write === "function") {
        process.stdout.write(`${line}\n`);
      }
    }
  } catch {
    // Silently fail in environments without stdout/stderr (e.g. Edge Runtime)
  }
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export function createLogger(module: string): Logger {
  return {
    debug: (message, meta) => writeEntry("debug", module, message, meta),
    info: (message, meta) => writeEntry("info", module, message, meta),
    warn: (message, meta) => writeEntry("warn", module, message, meta),
    error: (message, meta) => writeEntry("error", module, message, meta),
  };
}
