import { describe, expect, it } from "vitest";
import { AppError, toErrorResponse } from "./errors.js";

describe("toErrorResponse", () => {
  it("includes requestId and hides internals in production", () => {
    const mapped = toErrorResponse(new Error("boom at /secret"), false, "req-1");
    expect(mapped.statusCode).toBe(500);
    expect(mapped.body.error).toEqual({
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      requestId: "req-1",
    });
    expect(JSON.stringify(mapped.body)).not.toContain("boom");
  });

  it("maps Fastify rate-limit errors to RATE_LIMITED", () => {
    const mapped = toErrorResponse({ statusCode: 429, message: "Rate limit exceeded" }, false, "req-3");
    expect(mapped).toEqual({
      statusCode: 429,
      body: { error: { code: "RATE_LIMITED", message: "Too many requests.", requestId: "req-3" } },
    });
  });

  it("preserves AppError codes", () => {
    const mapped = toErrorResponse(new AppError("NOT_FOUND", "Missing.", 404), false, "req-2");
    expect(mapped).toEqual({
      statusCode: 404,
      body: { error: { code: "NOT_FOUND", message: "Missing.", requestId: "req-2" } },
    });
  });
});
