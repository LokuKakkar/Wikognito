import type { AppConfig } from "../../infrastructure/config/env.js";

export type RateLimitBucket = "none" | "auth" | "game" | "admin" | "public";

export function rateLimitBucket(url: string): RateLimitBucket {
  const path = url.split("?")[0] ?? url;
  if (
    path === "/health" ||
    path === "/health/ready" ||
    path === "/api/health" ||
    path === "/api/health/dependencies"
  ) {
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
