import { describe, expect, it } from "vitest";
import { readinessFromDependencies, sanitizeDependencyMessage, toSafeDependency } from "./health.js";

describe("health helpers", () => {
  it("strips connection strings from dependency messages", () => {
    expect(
      sanitizeDependencyMessage("connect failed postgresql://redactle:secret@localhost:5433/redactle"),
    ).toBe("connect failed [redacted]");
  });

  it("stays ready when Redis is down and Postgres is up", () => {
    const result = readinessFromDependencies(
      { status: "ok" },
      toSafeDependency({ status: "error", message: "redis://secret" }),
    );
    expect(result.statusCode).toBe(200);
    expect(result.body.status).toBe("ok");
    expect(result.body.dependencies.redis.status).toBe("degraded");
    expect(JSON.stringify(result.body)).not.toContain("secret");
  });

  it("returns 503 when Postgres is down", () => {
    const result = readinessFromDependencies(
      toSafeDependency({ status: "error", message: "postgresql://secret@host/db" }),
      { status: "ok" },
    );
    expect(result.statusCode).toBe(503);
    expect(result.body.status).toBe("error");
    expect(JSON.stringify(result.body)).not.toContain("secret");
  });
});
