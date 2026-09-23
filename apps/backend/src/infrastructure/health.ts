export type DependencyStatus = "ok" | "error" | "degraded";

export interface DependencyHealth {
  status: DependencyStatus;
  message?: string;
}

export function sanitizeDependencyMessage(message: string): string {
  return message
    .replace(/[a-z][a-z0-9+.-]*:\/\/[^\s]+/gi, "[redacted]")
    .replace(/(password|secret|token)=[^\s&]+/gi, "$1=[redacted]")
    .slice(0, 200);
}

export function toSafeDependency(health: { status: "ok" | "error"; message?: string }): DependencyHealth {
  if (health.status === "ok") {
    return { status: "ok" };
  }
  return {
    status: "error",
    message: health.message ? sanitizeDependencyMessage(health.message) : "unavailable",
  };
}

export function readinessFromDependencies(postgres: DependencyHealth, redis: DependencyHealth): {
  statusCode: number;
  body: {
    status: "ok" | "error";
    dependencies: {
      postgres: DependencyHealth;
      redis: DependencyHealth;
    };
  };
} {
  const redisReported: DependencyHealth =
    redis.status === "ok" ? { status: "ok" } : { status: "degraded", message: redis.message };
  const ready = postgres.status === "ok";
  return {
    statusCode: ready ? 200 : 503,
    body: {
      status: ready ? "ok" : "error",
      dependencies: {
        postgres,
        redis: redisReported,
      },
    },
  };
}
