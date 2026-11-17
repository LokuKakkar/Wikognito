import { describe, expect, it } from "vitest";
import { isValidSessionId, rateLimitBucket, rateLimitKey, rateLimitMax } from "./rate-limit.js";
import { loadConfig } from "../../infrastructure/config/env.js";

const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://redactle:redactle_dev@localhost:5433/redactle",
  REDIS_URL: "redis://localhost:6380",
  RATE_LIMIT_ENABLED: "true",
});

describe("rateLimitBucket", () => {
  it("classifies auth, game, admin, and public routes", () => {
    expect(rateLimitBucket("/health")).toBe("none");
    expect(rateLimitBucket("/api/auth/login")).toBe("auth");
    expect(rateLimitBucket("/api/games/complete")).toBe("game");
    expect(rateLimitBucket("/api/admin/puzzles")).toBe("admin");
    expect(rateLimitBucket("/api/internal/puzzles/publish-today")).toBe("admin");
    expect(rateLimitBucket("/api/puzzles/today")).toBe("public");
    expect(rateLimitMax("/api/auth/login", config)).toBe(30);
    expect(rateLimitMax("/api/puzzles/today", config)).toBe(600);
  });
});

describe("readiness probes", () => {
  it("only liveness is unlimited; readiness hits Postgres and Redis so it is limited", () => {
    expect(rateLimitBucket("/health")).toBe("none");
    expect(rateLimitBucket("/api/health")).toBe("none");
    expect(rateLimitBucket("/health/ready")).toBe("public");
    expect(rateLimitBucket("/api/health/dependencies")).toBe("public");
  });
});

describe("rateLimitKey", () => {
  it("depends only on bucket and address, never on a client-supplied cookie", () => {
    expect(rateLimitKey("/api/auth/login", "203.0.113.9")).toBe("auth:203.0.113.9");
    expect(rateLimitKey("/api/puzzles/today?x=1", "203.0.113.9")).toBe("public:203.0.113.9");
  });
});

describe("isValidSessionId", () => {
  it("accepts server-minted UUIDs and rejects attacker-chosen values", () => {
    expect(isValidSessionId("3f2b8c1e-5d4a-4e6f-9a1b-0c2d3e4f5a6b")).toBe(true);
    expect(isValidSessionId(undefined)).toBe(false);
    expect(isValidSessionId("")).toBe(false);
    expect(isValidSessionId("x".repeat(5000))).toBe(false);
    expect(isValidSessionId("'; DROP TABLE sessions;--")).toBe(false);
  });
});
