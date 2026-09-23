export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEY =
  /^(password|currentpassword|newpassword|token|rawtoken|authorization|cookie|secret|sessionsecret|publishsecret|smtppassword|clientsecret|accesstoken|refreshtoken|idtoken)$/i;

let minLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

export function redactValue(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_KEY.test(key.replace(/[_-]/g, ""))) {
    return "[redacted]";
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([childKey, child]) => [
      childKey,
      redactValue(child, childKey),
    ]);
    return Object.fromEntries(entries);
  }
  if (typeof value === "string" && /Bearer\s+\S+/i.test(value)) {
    return value.replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
  }
  return value;
}

function log(level: LogLevel, event: string, meta?: Record<string, unknown>): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return;
  const safeMeta = (redactValue(meta) ?? {}) as Record<string, unknown>;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...safeMeta,
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (event: string, meta?: Record<string, unknown>) => log("info", event, meta),
  warn: (event: string, meta?: Record<string, unknown>) => log("warn", event, meta),
  error: (event: string, meta?: Record<string, unknown>) => log("error", event, meta),
  debug: (event: string, meta?: Record<string, unknown>) => log("debug", event, meta),
};
