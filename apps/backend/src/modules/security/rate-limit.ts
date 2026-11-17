import type { AppConfig } from "../../infrastructure/config/env.js";

export type RateLimitBucket = "none" | "auth" | "game" | "admin" | "public";

export function rateLimitBucket(url: string): RateLimitBucket {
  const path = url.split("?")[0] ?? url;
  // Only the liveness probes are unlimited (they touch no dependency). The readiness
  // probes query Postgres and Redis, so they stay rate limited as "public".
  if (path === "/health" || path === "/api/health") {
    return "none";
  }
  if (path.startsWith("/api/auth") || path === "/api/me/password/change") {
    return "auth";
  }
  if (path === "/api/sessions/sync" || path === "/api/games/complete") {
    return "game";
  }
  if (path.startsWith("/api/admin") || path.startsWith("/api/internal")) {
    return "admin";
  }
  return "public";
}

export function rateLimitMax(url: string, config: AppConfig): number {
  switch (rateLimitBucket(url)) {
    case "none":
      return 0;
    case "auth":
      return config.RATE_LIMIT_AUTH_MAX;
    case "game":
      return config.RATE_LIMIT_GAME_MAX;
    case "admin":
      return config.RATE_LIMIT_ADMIN_MAX;
    default:
      return config.RATE_LIMIT_PUBLIC_MAX;
  }
}

/** Session ids are UUIDs minted by the server; anything else in the cookie is attacker-chosen. */
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidSessionId(value: string | undefined): value is string {
  return typeof value === "string" && SESSION_ID_PATTERN.test(value);
}

/**
 * Rate-limit key: always the client address plus the bucket. Never the session cookie, because
 * a client can mint a fresh cookie value per request and would escape the limit entirely.
 */
export function rateLimitKey(url: string, ip: string): string {
  return `${rateLimitBucket(url)}:${ip}`;
}
