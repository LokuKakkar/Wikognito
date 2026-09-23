import { describe, expect, it } from "vitest";
import { rateLimitBucket, rateLimitMax } from "./rate-limit.js";
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
    expect(rateLimitMax("/api/auth/login", config)).toBe(10);
    expect(rateLimitMax("/api/puzzles/today", config)).toBe(120);
  });
});
